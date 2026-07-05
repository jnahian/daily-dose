// Zoho People OAuth/API configuration. A single Zoho "self-client" app
// (ZOHO_CLIENT_ID/SECRET) is shared across every organization that enables
// the integration; each organization's own refresh token lives in the
// ZohoCredential table (see zohoAuthService.js).

function getConfig() {
  return {
    clientId: process.env.ZOHO_CLIENT_ID,
    clientSecret: process.env.ZOHO_CLIENT_SECRET,
    // Only used for the one-time grant-token exchange (scripts/zohoAuthSetup.js).
    // Self-client apps require a redirect_uri that matches the one registered
    // in the Zoho API console, even though no browser redirect happens.
    redirectUri: process.env.ZOHO_REDIRECT_URI,
    // Zoho data center suffix — "com" (US), "eu", "in", "com.au", "jp", "com.cn".
    // Must match the data center the target Zoho org's data lives in.
    dataCenter: process.env.ZOHO_DATA_CENTER || "com",
  };
}

function accountsBaseUrl(dataCenter) {
  return `https://accounts.zoho.${dataCenter}`;
}

function peopleBaseUrl(dataCenter) {
  return `https://people.zoho.${dataCenter}`;
}

module.exports = { getConfig, accountsBaseUrl, peopleBaseUrl };
