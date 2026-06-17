const {
  mcpAuthRouter,
  getOAuthProtectedResourceMetadataUrl,
} = require("@modelcontextprotocol/sdk/server/auth/router.js");
const { provider } = require("./oauthProvider");
const { completeAuthorization } = require("./slackAuthBridge");
const legacyTokenService = require("../../services/mcpTokenService");

function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}
function resourceMetadataUrl() {
  return getOAuthProtectedResourceMetadataUrl(new URL(`${appUrl()}/mcp`));
}

// The OAuth 2.1 router (authorize/token/register/revoke + metadata).
function buildAuthRouter() {
  return mcpAuthRouter({
    provider,
    issuerUrl: new URL(appUrl()),
    resourceServerUrl: new URL(`${appUrl()}/mcp`),
    scopesSupported: ["mcp"],
    resourceName: "Daily Dose Standup",
  });
}

function bearer(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

function challenge(res) {
  res.set(
    "WWW-Authenticate",
    `Bearer resource_metadata="${resourceMetadataUrl()}"`
  );
  return res.status(401).json({ error: "Unauthorized" });
}

// Accept an OAuth access token OR a legacy ddm_ token; set req.mcpUser.
async function authenticateMcp(req, res, next) {
  const token = bearer(req);
  if (!token) return challenge(res);
  try {
    const info = await provider.verifyAccessToken(token);
    req.mcpUser = info.extra.user;
    return next();
  } catch {
    // fall through to legacy
  }
  try {
    const user = await legacyTokenService.validateToken(token);
    if (user) {
      req.mcpUser = user;
      return next();
    }
  } catch (err) {
    console.error("legacy token validation error:", err.message);
  }
  return challenge(res);
}

// GET handler for the AS's Slack callback (mounted in app.js).
async function handleSlackCallback(req, res) {
  const { code, state } = req.query;
  const appBase = appUrl();
  if (!code || !state) {
    return res.redirect(`${appBase}/mcp-tokens?error=invalid_state`);
  }
  try {
    const redirectUrl = await completeAuthorization({
      slackState: state,
      slackCode: code,
    });
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error("MCP OAuth Slack callback error:", err.message);
    return res.redirect(`${appBase}/mcp-tokens?error=oauth_failed`);
  }
}

module.exports = {
  buildAuthRouter,
  authenticateMcp,
  handleSlackCallback,
  resourceMetadataUrl,
};
