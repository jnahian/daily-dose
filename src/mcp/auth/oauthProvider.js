const {
  InvalidGrantError,
  InvalidTokenError,
} = require("@modelcontextprotocol/sdk/server/auth/errors.js");
const { clientStore } = require("./clientStore");
const bridge = require("./slackAuthBridge");
const tokenSvc = require("./oauthTokenService");

function toTokens({ accessToken, refreshToken, expiresIn, scope }) {
  const out = {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: expiresIn,
    refresh_token: refreshToken,
  };
  if (scope) out.scope = scope;
  return out;
}

const provider = {
  get clientsStore() {
    return clientStore;
  },

  async authorize(client, params, res) {
    const url = await bridge.beginAuthorization({
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      clientState: params.state,
      codeChallenge: params.codeChallenge,
      scope: params.scopes?.join(" ") || null,
      resource: params.resource?.href || null,
    });
    res.redirect(url);
  },

  async challengeForAuthorizationCode(client, authorizationCode) {
    const row = await bridge.getAuthorizationCode(
      client.client_id,
      authorizationCode
    );
    if (!row) throw new InvalidGrantError("Invalid authorization code");
    return row.code_challenge;
  },

  // SDK verifies PKCE before calling this (codeVerifier is undefined).
  async exchangeAuthorizationCode(client, authorizationCode) {
    const row = await bridge.consumeAuthorizationCode(
      client.client_id,
      authorizationCode
    );
    if (!row) throw new InvalidGrantError("Invalid authorization code");
    const grant = await tokenSvc.mintGrant({
      userId: row.user_id,
      clientId: client.client_id,
      scope: row.scope,
      resource: row.resource,
    });
    return toTokens({ ...grant, scope: row.scope });
  },

  async exchangeRefreshToken(client, refreshToken) {
    let grant;
    try {
      grant = await tokenSvc.rotateRefresh(refreshToken, client.client_id);
    } catch (err) {
      throw new InvalidGrantError(err.message);
    }
    return toTokens(grant);
  },

  async verifyAccessToken(token) {
    const result = await tokenSvc.verifyAccessToken(token);
    if (!result) throw new InvalidTokenError("Token is invalid or expired");
    const { row, user } = result;
    return {
      token,
      clientId: row.client_id,
      scopes: row.scope ? row.scope.split(" ") : [],
      expiresAt: Math.floor(
        new Date(row.access_token_expires_at).getTime() / 1000
      ),
      resource: row.resource ? new URL(row.resource) : undefined,
      extra: { userId: user.id, user },
    };
  },

  async revokeToken(client, request) {
    await tokenSvc.revokeRawToken(request.token);
  },
};

module.exports = { provider };
