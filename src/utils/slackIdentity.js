const { WebClient } = require("@slack/web-api");
const prisma = require("../config/prisma");

/**
 * Exchange a Slack OAuth `code` for the user's identity and resolve it to a
 * registered `users` row. Returns the user or null if not registered.
 * @returns {Promise<{ user: object|null, slackUserId: string|null }>}
 */
async function resolveSlackUserFromCode(code, redirectUri) {
  const slack = new WebClient();
  const result = await slack.oauth.v2.access({
    client_id: process.env.SLACK_CLIENT_ID,
    client_secret: process.env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
  });
  if (!result.ok) throw new Error(`Slack OAuth error: ${result.error}`);
  const userToken = result.authed_user?.access_token;
  if (!userToken) throw new Error("No user access token in OAuth response");
  const identity = await new WebClient(userToken).users.identity();
  const slackUserId = identity.user?.id || null;
  if (!slackUserId) return { user: null, slackUserId: null };
  const user = await prisma.user.findUnique({ where: { slackUserId } });
  return { user: user || null, slackUserId };
}

function slackAuthorizeUrl({ redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    user_scope: "identity.basic,identity.email",
    redirect_uri: redirectUri,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

function appBaseUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

// Slack OAuth callback for the manual token web flow (/mcp-tokens sign-in).
function mcpRedirectUri() {
  return `${appBaseUrl()}/api/mcp/auth/callback`;
}

// Slack OAuth callback for the OAuth 2.1 authorization server (automatic client sign-in).
function mcpAsRedirectUri() {
  return `${appBaseUrl()}/api/mcp/oauth/slack/callback`;
}

module.exports = {
  resolveSlackUserFromCode,
  slackAuthorizeUrl,
  mcpRedirectUri,
  mcpAsRedirectUri,
};
