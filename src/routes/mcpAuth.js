const express = require("express");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const tokenService = require("../services/mcpTokenService");
const { resolveSlackUserFromCode } = require("../utils/slackIdentity");
const oauthTokenService = require("../mcp/auth/oauthTokenService");

const router = express.Router();

const OAUTH_STATE_TTL = 5 * 60 * 1000;
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

// GET /api/mcp/auth/slack — initiate OAuth
router.get("/auth/slack", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, Date.now() + OAUTH_STATE_TTL);
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    user_scope: "identity.basic,identity.email",
    redirect_uri: process.env.MCP_OAUTH_REDIRECT_URI,
    state,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
});

// GET /api/mcp/auth/callback — handle OAuth callback
router.get("/auth/callback", async (req, res) => {
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

    const { user } = await resolveSlackUserFromCode(
      code,
      process.env.MCP_OAUTH_REDIRECT_URI
    );
    if (!user) return res.redirect(`${appUrl}/mcp-tokens?error=not_registered`);

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });
    res.redirect(`${appUrl}/mcp-tokens`);
  } catch (err) {
    console.error("MCP OAuth callback error:", err);
    res.redirect(`${appUrl}/mcp-tokens?error=oauth_failed`);
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

module.exports = { router };
