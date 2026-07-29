// Zoho People OAuth/API configuration. A single Zoho "self-client" app
// (ZOHO_CLIENT_ID/SECRET) is shared across every organization that enables
// the integration; each organization's own refresh token lives in the
// ZohoCredential table (see zohoAuthService.js).

// Documented Zoho data centers. dataCenter is interpolated straight into the
// accounts/people hostnames that OAuth secrets and tokens get sent to, so it
// must be validated rather than trusted verbatim.
const ALLOWED_DATA_CENTERS = new Set([
  "com",
  "eu",
  "in",
  "com.au",
  "jp",
  "com.cn",
]);

function validateDataCenter(dataCenter) {
  if (!ALLOWED_DATA_CENTERS.has(dataCenter)) {
    throw new Error(`Unsupported ZOHO_DATA_CENTER: ${dataCenter}`);
  }
  return dataCenter;
}

function getConfig() {
  return {
    clientId: process.env.ZOHO_CLIENT_ID,
    clientSecret: process.env.ZOHO_CLIENT_SECRET,
    // Deliberately no redirectUri: a Self Client app has no redirect URI to
    // register, and Zoho's self-client token exchange rejects the parameter.
    // Zoho data center suffix — "com" (US), "eu", "in", "com.au", "jp", "com.cn".
    // Must match the data center the target Zoho org's data lives in.
    dataCenter: validateDataCenter(process.env.ZOHO_DATA_CENTER || "com"),
  };
}

function accountsBaseUrl(dataCenter) {
  return `https://accounts.zoho.${validateDataCenter(dataCenter)}`;
}

function peopleBaseUrl(dataCenter) {
  return `https://people.zoho.${validateDataCenter(dataCenter)}`;
}

module.exports = { getConfig, accountsBaseUrl, peopleBaseUrl };
