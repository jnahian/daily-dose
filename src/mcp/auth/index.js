const {
  mcpAuthRouter,
  getOAuthProtectedResourceMetadataUrl,
} = require("@modelcontextprotocol/sdk/server/auth/router.js");
const { provider } = require("./oauthProvider");
const {
  completeAuthorization,
  abortAuthorization,
} = require("./slackAuthBridge");
const legacyTokenService = require("../../services/mcpTokenService");
const { appBaseUrl } = require("../../utils/slackIdentity");

function resourceMetadataUrl() {
  return getOAuthProtectedResourceMetadataUrl(new URL(`${appBaseUrl()}/mcp`));
}

// The OAuth 2.1 router (authorize/token/register/revoke + metadata).
function buildAuthRouter() {
  return mcpAuthRouter({
    provider,
    issuerUrl: new URL(appBaseUrl()),
    resourceServerUrl: new URL(`${appBaseUrl()}/mcp`),
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

// GET /mcp/oauth/cb — the AS's Slack callback (delegated login). The MCP
// client is waiting on its own redirect_uri, so every outcome that can be
// tied to an in-flight authorization goes back there; only an unknown state
// falls through to the token page.
async function handleSlackCallback(req, res) {
  const { code, state } = req.query;
  const tokenPage = (error) =>
    res.redirect(`${appBaseUrl()}/mcp-tokens?error=${error}`);
  if (!state) return tokenPage("invalid_state");
  try {
    if (!code) {
      // Slack sends ?error=access_denied with no code when the user cancels.
      const url = await abortAuthorization({
        slackState: state,
        error: "access_denied",
        description: "Slack sign-in was cancelled",
      });
      return url ? res.redirect(url) : tokenPage("invalid_state");
    }
    return res.redirect(
      await completeAuthorization({ slackState: state, slackCode: code })
    );
  } catch (err) {
    console.error("MCP OAuth Slack callback error:", err.message);
    const url = await abortAuthorization({
      slackState: state,
      error: "server_error",
      description: "Slack sign-in failed; please try again",
    }).catch(() => null);
    return url ? res.redirect(url) : tokenPage("oauth_failed");
  }
}

module.exports = {
  buildAuthRouter,
  authenticateMcp,
  handleSlackCallback,
  resourceMetadataUrl,
};
