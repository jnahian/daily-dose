const crypto = require("crypto");
const prisma = require("../../config/prisma");
const {
  resolveSlackUserFromCode,
  slackAuthorizeUrl,
  mcpAsRedirectUri,
} = require("../../utils/slackIdentity");
const { hashToken } = require("./oauthTokenService");

const AUTH_CODE_TTL_MS = 10 * 60 * 1000;

// Step 1 (provider.authorize): persist the in-flight authorization and send the
// browser to Slack, carrying our slack_state so the callback can correlate it.
async function beginAuthorization({
  clientId,
  redirectUri,
  clientState,
  codeChallenge,
  codeChallengeMethod = "S256",
  scope = null,
  resource = null,
}) {
  const slackState = crypto.randomBytes(16).toString("hex");
  await prisma.oauth_auth_codes.create({
    data: {
      client_id: clientId,
      slack_state: slackState,
      redirect_uri: redirectUri,
      client_state: clientState ?? null,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      scope,
      resource,
      expires_at: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  });
  return slackAuthorizeUrl({
    redirectUri: mcpAsRedirectUri(),
    state: slackState,
  });
}

// Step 2 (Slack callback): resolve identity, mint the authorization code, and
// return the client redirect URL (success → code+state, failure → error+state).
async function completeAuthorization({ slackState, slackCode }) {
  const row = await prisma.oauth_auth_codes.findUnique({
    where: { slack_state: slackState },
  });
  if (!row || row.expires_at <= new Date()) {
    throw new Error("Unknown or expired authorization request");
  }

  const { user } = await resolveSlackUserFromCode(
    slackCode,
    mcpAsRedirectUri()
  );

  const redirect = new URL(row.redirect_uri);
  if (row.client_state) redirect.searchParams.set("state", row.client_state);

  if (!user) {
    redirect.searchParams.set("error", "access_denied");
    redirect.searchParams.set(
      "error_description",
      "Slack account not registered"
    );
    return redirect.toString();
  }

  const code = crypto.randomBytes(32).toString("hex");
  await prisma.oauth_auth_codes.update({
    where: { id: row.id },
    data: { user_id: user.id, code_hash: hashToken(code) },
  });
  redirect.searchParams.set("code", code);
  return redirect.toString();
}

// Step 3 (provider.exchangeAuthorizationCode / challengeForAuthorizationCode):
// look up a finalized code for this client; consume() deletes it (single-use).
async function getAuthorizationCode(clientId, code) {
  const row = await prisma.oauth_auth_codes.findUnique({
    where: { code_hash: hashToken(code) },
  });
  if (!row || row.client_id !== clientId || !row.user_id) return null;
  if (row.expires_at <= new Date()) return null;
  return row;
}

async function consumeAuthorizationCode(clientId, code) {
  const row = await getAuthorizationCode(clientId, code);
  if (!row) return null;
  await prisma.oauth_auth_codes.delete({ where: { id: row.id } });
  return row;
}

module.exports = {
  beginAuthorization,
  completeAuthorization,
  getAuthorizationCode,
  consumeAuthorizationCode,
};
