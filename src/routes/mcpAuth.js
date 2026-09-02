const express = require("express");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const tokenService = require("../services/mcpTokenService");
const {
  resolveSlackUserFromCode,
  mcpRedirectUri,
  legacyMcpRedirectUri,
} = require("../utils/slackIdentity");
const oauthTokenService = require("../mcp/auth/oauthTokenService");

const router = express.Router();

const OAUTH_STATE_TTL = 5 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const oauthStates = new Map();

// Reuse the admin session cookie machinery, but WITHOUT the admin gate:
// any registered user may hold an MCP session and manage their own tokens.
async function requireMcpSession(req, res, next) {
  const token = req.cookies?.mcp_session;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const session = await prisma.sessions.findUnique({
      where: { token },
      include: { users: true },
    });
    if (!session || !session.users || session.expires_at <= new Date()) {
      return res.status(401).json({ error: "Session expired" });
    }
    req.mcpSessionUser = session.users;
    next();
  } catch (err) {
    console.error("requireMcpSession error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Start the Slack OAuth flow for the token page: record a short-lived `state`
 * and redirect the browser to Slack's authorize endpoint. Canonically served
 * at `GET /mcp/login` (mounted in app.js), returning to `/mcp/cb`.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {void}
 */
function startSlackOAuth(req, res) {
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, Date.now() + OAUTH_STATE_TTL);
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    user_scope: "identity.basic,identity.email",
    redirect_uri: mcpRedirectUri(),
    state,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
}

// GET /api/mcp/auth/slack — legacy sign-in path, kept for old bookmarks.
router.get("/auth/slack", (req, res) => res.redirect("/mcp/login"));

/**
 * Build the Slack callback handler for the token page. The `redirect_uri` is
 * injected rather than hardcoded because Slack requires the value sent to
 * oauth.v2.access to match the one used at authorize time: the canonical
 * `/mcp/cb` and the superseded `/api/mcp/auth/callback` must each exchange
 * with their own URI. Note this does not carry a sign-in across a *restart*:
 * `oauthStates` is in-memory, so a deploy drops it and the callback lands on
 * `invalid_state` either way. Serving the old path just makes that a clean
 * error on the token page instead of the SPA fallback. (The OAuth 2.1 server's
 * own flow does survive a restart — its state is the `oauth_auth_codes` row.)
 * @param {() => string} redirectUri - Resolves the URI this path was reached by.
 * @returns {import("express").RequestHandler}
 */
function makeTokenPageCallback(redirectUri) {
  return async function handleTokenPageCallback(req, res) {
    const { code, state } = req.query;
    const expiry = oauthStates.get(state);
    const appUrl = process.env.APP_URL || "";

    if (!state || !expiry || Date.now() > expiry) {
      oauthStates.delete(state);
      return res.redirect(`${appUrl}/mcp-tokens?error=invalid_state`);
    }
    oauthStates.delete(state);

    try {
      if (!code) return res.redirect(`${appUrl}/mcp-tokens?error=oauth_denied`);

      const { user } = await resolveSlackUserFromCode(code, redirectUri());
      if (!user) {
        return res.redirect(`${appUrl}/mcp-tokens?error=not_registered`);
      }

      const sessionToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await prisma.sessions.create({
        data: {
          id: crypto.randomUUID(),
          user_id: user.id,
          token: sessionToken,
          expires_at: expiresAt,
          ip_address: req.ip,
          user_agent: req.headers["user-agent"],
        },
      });
      res.cookie("mcp_session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_TTL_MS,
        sameSite: "lax",
      });
      res.redirect(`${appUrl}/mcp-tokens`);
    } catch (err) {
      console.error("MCP OAuth callback error:", err);
      res.redirect(`${appUrl}/mcp-tokens?error=oauth_failed`);
    }
  };
}

// The canonical token-page callback, mounted at GET /mcp/cb in app.js.
const handleTokenPageCallback = makeTokenPageCallback(mcpRedirectUri);

// GET /api/mcp/auth/callback — superseded path, still served so a callback
// arriving on it resolves on the token page rather than the SPA fallback. It
// exchanges with the legacy URI because Slack matches redirect_uri; see
// makeTokenPageCallback on why that alone does not survive a restart.
router.get("/auth/callback", makeTokenPageCallback(legacyMcpRedirectUri));

// GET /api/mcp/me — who am I (for the SPA)
router.get("/me", requireMcpSession, (req, res) => {
  const u = req.mcpSessionUser;
  res.json({ id: u.id, slackUserId: u.slackUserId, name: u.name });
});

// GET /api/mcp/tokens — list caller's tokens (no secrets)
router.get("/tokens", requireMcpSession, async (req, res) => {
  try {
    res.json(await tokenService.listTokens(req.mcpSessionUser.id));
  } catch (err) {
    console.error("GET /tokens error:", err.message);
    res.status(500).json({ error: "Failed to list tokens" });
  }
});

// POST /api/mcp/tokens — mint a token (raw value returned ONCE)
router.post("/tokens", requireMcpSession, async (req, res) => {
  try {
    const name =
      typeof req.body?.name === "string" ? req.body.name.slice(0, 100) : null;
    const { rawToken, id, expiresAt } = await tokenService.mintToken(
      req.mcpSessionUser.id,
      name
    );
    res.status(201).json({ id, token: rawToken, expiresAt });
  } catch (err) {
    console.error("POST /tokens error:", err.message);
    res.status(500).json({ error: "Failed to mint token" });
  }
});

// DELETE /api/mcp/tokens/:id — revoke
router.delete("/tokens/:id", requireMcpSession, async (req, res) => {
  try {
    await tokenService.revokeToken(req.mcpSessionUser.id, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /tokens/:id error:", err.message);
    res.status(500).json({ error: "Failed to revoke token" });
  }
});

// GET /api/mcp/connections — list the caller's connected OAuth clients
router.get("/connections", requireMcpSession, async (req, res) => {
  try {
    res.json(await oauthTokenService.listConnections(req.mcpSessionUser.id));
  } catch (err) {
    console.error("GET /connections error:", err.message);
    res.status(500).json({ error: "Failed to list connections" });
  }
});

// DELETE /api/mcp/connections/:clientId — revoke all grants for one client
router.delete("/connections/:clientId", requireMcpSession, async (req, res) => {
  try {
    await oauthTokenService.revokeConnection(
      req.mcpSessionUser.id,
      req.params.clientId
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /connections/:clientId error:", err.message);
    res.status(500).json({ error: "Failed to revoke connection" });
  }
});

module.exports = { router, startSlackOAuth, handleTokenPageCallback };
