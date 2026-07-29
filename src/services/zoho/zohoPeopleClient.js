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
// Returns { body, raw } — `raw` is kept so failures can report what Zoho
// actually said. Dropping it leaves only a status code, which is not enough
// to tell an OAuth scope mismatch apart from a permissions problem.
async function parseJsonBig(response) {
  const raw = await response.text();
  if (!raw) return { body: null, raw: "" };
  try {
    return { body: JSONbig.parse(raw), raw };
  } catch {
    return { body: null, raw };
  }
}

// Zoho signals failures inconsistently: sometimes `error`/`error_description`,
// sometimes `errorCode`/`message`, sometimes a nested `response.errors`, and
// sometimes HTML. Pull out whatever is there rather than guessing.
function describeZohoError(body, raw) {
  const nested = body?.response?.errors;
  const parts = [
    body?.error,
    body?.error_description,
    body?.errorCode,
    body?.message,
    nested && (nested.message || nested.code),
  ].filter(Boolean);

  if (parts.length > 0) return [...new Set(parts.map(String))].join(": ");
  return raw.slice(0, 300).trim() || "(empty response body)";
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

  const { body, raw } = await parseJsonBig(response);

  if (response.status === 401 || response.status === 403) {
    const detail = describeZohoError(body, raw);
    // A scope mismatch and a permissions gap both arrive as 401/403 but need
    // opposite fixes — regenerate the grant token with the right scope, vs.
    // change the Zoho account's profile. Only Zoho's own message separates
    // them, so lead with it and keep the guidance as a hint.
    const scopeProblem = /scope/i.test(detail);
    throw new ZohoApiError(
      `Zoho rejected the request as unauthorized (HTTP ${response.status}) ` +
        `at ${path} — Zoho said: ${detail}. ` +
        (scopeProblem
          ? "That is an OAuth scope problem: regenerate the grant token with " +
            "the scope this endpoint needs and re-run `npm run zoho:auth-setup`."
          : "If that isn't self-explanatory, verify the integration account's " +
            "profile has API access enabled and reporting-manager-level leave " +
            "visibility for the team."),
      { status: response.status, body, raw }
    );
  }

  if (!response.ok) {
    throw new ZohoApiError(
      `Zoho API request failed (HTTP ${response.status}) at ${path} — ` +
        `Zoho said: ${describeZohoError(body, raw)}`,
      { status: response.status, body, raw }
    );
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
