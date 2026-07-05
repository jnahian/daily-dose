const JSONbig = require("json-bigint")({ storeAsString: true });
const { getValidAccessToken } = require("./zohoAuthService");
const { peopleBaseUrl } = require("./zohoConfig");

// A hung Zoho endpoint would otherwise block the nightly sync run indefinitely.
const REQUEST_TIMEOUT_MS = 15 * 1000;

class ZohoApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "ZohoApiError";
    this.status = status;
    this.body = body;
  }
}

// Zoho employee/record IDs are large integers that overflow JS's safe
// integer range. The standard JSON.parse (and Response#json()) would parse
// them as lossy Numbers, so every Zoho response is parsed with json-bigint
// instead — big integers land as strings, everything else parses normally.
async function parseJsonBig(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSONbig.parse(text);
  } catch {
    return null;
  }
}

async function zohoGet(organizationId, path) {
  const { accessToken, dataCenter } = await getValidAccessToken(organizationId);
  const url = `${peopleBaseUrl(dataCenter)}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const body = await parseJsonBig(response);

  if (response.status === 401 || response.status === 403) {
    throw new ZohoApiError(
      "Zoho rejected the request as unauthorized — the integration " +
        "account may lack API access or leave-visibility permissions for " +
        "this data (verify the account's profile has API access enabled, " +
        "and that it has reporting-manager-level leave visibility for the " +
        "team; see the feature's known risks).",
      { status: response.status, body }
    );
  }

  if (!response.ok) {
    throw new ZohoApiError(`Zoho API request failed (${response.status})`, {
      status: response.status,
      body,
    });
  }

  return body;
}

// Fetch leave records overlapping [fromDate, toDate] (inclusive, "YYYY-MM-DD"
// strings). The approvalStatus/employee query params are unreliable over
// this REST endpoint (they throw EXTRA_PARAM_FOUND per the integration's
// design notes) — fetch the full date-range response and filter by status +
// mapped employee IDs in JS (see zohoSyncService.js).
async function fetchLeaveRecords(organizationId, fromDate, toDate) {
  const path = `/api/v2/leavetracker/leaves/records?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`;
  const body = await zohoGet(organizationId, path);
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.leaves)) return body.leaves;
  return [];
}

// Fetch the full organization holiday calendar. Zoho rate-limits this
// endpoint (30 req/min per the integration's design notes) — callers should
// go through zohoSyncService's nightly cache rather than calling this
// per-standup.
async function fetchHolidays(organizationId) {
  const body = await zohoGet(organizationId, "/api/leave/v2/holidays/get");
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.holidays)) return body.holidays;
  return [];
}

module.exports = { ZohoApiError, fetchLeaveRecords, fetchHolidays };
