const express = require("express");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const tokenService = require("../services/mcpTokenService");
const {
  resolveSlackUserFromCode,
  slackAuthorizeUrl,
  appBaseUrl,
  mcpRedirectUri,
} = require("../utils/slackIdentity");
const oauthTokenService = require("../mcp/auth/oauthTokenService");
const { createSession } = require("../utils/sessionHelper");

const router = express.Router();

const OAUTH_STATE_TTL = 5 * 60 * 1000;
// Longer than the admin panel's 7 days: this session only manages the
// caller's own MCP tokens, and re-signing in weekly to check them was the
// complaint. Revocable any time via POST /api/mcp/auth/logout.
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
  // Public, unauthenticated endpoint: drop expired states on every insert so
  // abandoned sign-ins can't grow the map for the life of the process.
  const now = Date.now();
  for (const [key, expiry] of oauthStates) {
    if (expiry <= now) oauthStates.delete(key);
  }
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, now + OAUTH_STATE_TTL);
  res.redirect(slackAuthorizeUrl({ redirectUri: mcpRedirectUri(), state }));
}

// GET /api/mcp/auth/slack — legacy sign-in path, kept for old bookmarks.
router.get("/auth/slack", (req, res) => res.redirect("/mcp/login"));

/**
 * The token page's Slack callback, mounted at `GET /mcp/cb` in app.js.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function handleTokenPageCallback(req, res) {
  const { code, state } = req.query;
  const expiry = oauthStates.get(state);
  const tokenPage = `${appBaseUrl()}/mcp-tokens`;

  if (!state || !expiry || Date.now() > expiry) {
    oauthStates.delete(state);
    return res.redirect(`${tokenPage}?error=invalid_state`);
  }
  oauthStates.delete(state);

  try {
    if (!code) return res.redirect(`${tokenPage}?error=oauth_denied`);

    const { user } = await resolveSlackUserFromCode(code, mcpRedirectUri());
    if (!user) return res.redirect(`${tokenPage}?error=not_registered`);

    await createSession(user, req, res, {
      cookieName: "mcp_session",
      ttlMs: SESSION_TTL_MS,
    });
    res.redirect(tokenPage);
  } catch (err) {
    console.error("MCP OAuth callback error:", err);
    res.redirect(`${tokenPage}?error=oauth_failed`);
  }
}

// GET /api/mcp/auth/callback — the pre-1.19 callback path. Its `state` lived
// in this process's memory, so nothing that reaches it can still complete.
router.get("/auth/callback", (req, res) =>
  res.redirect(`${appBaseUrl()}/mcp-tokens?error=invalid_state`)
);

// POST /api/mcp/auth/logout — end the session (mirrors the admin panel's).
router.post("/auth/logout", requireMcpSession, async (req, res) => {
  try {
    await prisma.sessions.deleteMany({
      where: { token: req.cookies.mcp_session },
    });
    res.clearCookie("mcp_session");
    res.json({ ok: true });
  } catch (err) {
    console.error("MCP logout error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
