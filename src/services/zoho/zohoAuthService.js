const prisma = require("../../config/prisma");
const logger = require("../../utils/logger");
const { getConfig, accountsBaseUrl } = require("./zohoConfig");

// Refresh a bit before actual expiry so a request already in flight doesn't
// race the deadline. Zoho access tokens are typically issued for 3600s.
const EXPIRY_SAFETY_MARGIN_MS = 5 * 60 * 1000;
// A hung Zoho token endpoint would otherwise block auth setup / nightly sync indefinitely.
const TOKEN_REQUEST_TIMEOUT_MS = 10 * 1000;

class ZohoAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "ZohoAuthError";
  }
}

async function requestToken(dataCenter, params) {
  const url = `${accountsBaseUrl(dataCenter)}/oauth/v2/token`;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TOKEN_REQUEST_TIMEOUT_MS
  );

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok || !body || body.error) {
    throw new ZohoAuthError(
      `Zoho token request failed: ${body?.error || response.status}`
    );
  }

  return body;
}

// One-time setup: exchange a "grant token" (an admin generates this from the
// Zoho API console's self-client flow — see scripts/zohoAuthSetup.js) for a
// long-lived refresh token, and persist it for the organization.
async function exchangeGrantToken(organizationId, grantToken) {
  const { clientId, clientSecret, redirectUri, dataCenter } = getConfig();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new ZohoAuthError(
      "ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REDIRECT_URI are not configured"
    );
  }

  const body = await requestToken(dataCenter, {
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code: grantToken,
  });

  if (!body.refresh_token) {
    throw new ZohoAuthError(
      "Zoho did not return a refresh_token — the grant token may already " +
        "be used, or the self-client scope doesn't include offline access"
    );
  }

  return prisma.zohoCredential.upsert({
    where: { organizationId },
    update: {
      dataCenter,
      refreshToken: body.refresh_token,
      accessToken: body.access_token,
      accessTokenExpiresAt: new Date(Date.now() + body.expires_in * 1000),
      enabled: true,
    },
    create: {
      organizationId,
      dataCenter,
      refreshToken: body.refresh_token,
      accessToken: body.access_token,
      accessTokenExpiresAt: new Date(Date.now() + body.expires_in * 1000),
    },
  });
}

async function refreshAccessToken(credential) {
  const { clientId, clientSecret } = getConfig();
  if (!clientId || !clientSecret) {
    throw new ZohoAuthError(
      "ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET are not configured"
    );
  }

  const body = await requestToken(credential.dataCenter, {
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: credential.refreshToken,
  });

  const accessTokenExpiresAt = new Date(Date.now() + body.expires_in * 1000);

  await prisma.zohoCredential.update({
    where: { id: credential.id },
    data: { accessToken: body.access_token, accessTokenExpiresAt },
  });

  return { accessToken: body.access_token, accessTokenExpiresAt };
}

// Returns a valid { accessToken, dataCenter } for the organization, refreshing
// lazily if the cached access token is missing or close to expiry. Throws
// ZohoAuthError if Zoho isn't configured/enabled for this org, or if Zoho
// rejects the refresh (e.g. the refresh token was revoked in the API console
// — re-run scripts/zohoAuthSetup.js to re-authorize).
async function getValidAccessToken(organizationId) {
  const credential = await prisma.zohoCredential.findUnique({
    where: { organizationId },
  });

  if (!credential) {
    throw new ZohoAuthError(
      `No Zoho credential configured for organization ${organizationId}`
    );
  }
  if (!credential.enabled) {
    throw new ZohoAuthError(
      `Zoho integration is disabled for organization ${organizationId}`
    );
  }

  const isExpired =
    !credential.accessToken ||
    !credential.accessTokenExpiresAt ||
    credential.accessTokenExpiresAt.getTime() - EXPIRY_SAFETY_MARGIN_MS <=
      Date.now();

  if (!isExpired) {
    return {
      accessToken: credential.accessToken,
      dataCenter: credential.dataCenter,
    };
  }

  try {
    const refreshed = await refreshAccessToken(credential);
    return {
      accessToken: refreshed.accessToken,
      dataCenter: credential.dataCenter,
    };
  } catch (error) {
    logger.error(
      `Failed to refresh Zoho access token for organization ${organizationId}:`,
      error
    );
    throw error;
  }
}

module.exports = {
  ZohoAuthError,
  exchangeGrantToken,
  getValidAccessToken,
};
