const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(customParseFormat);

// Zoho People returns dates as "dd-MMM-yyyy" (e.g. "05-Jul-2026"). Parse
// strictly and normalize to a Date at local-midnight, consistent with how
// the rest of the app builds Leave/Holiday dates from YYYY-MM-DD strings
// (see dateHelper.js's toIsoDate comment — this lines up with UTC-midnight
// as long as the process runs in UTC, the deployment default).
function parseZohoDate(value) {
  if (!value || typeof value !== "string") return null;
  const parsed = dayjs(value, "DD-MMM-YYYY", true);
  return parsed.isValid() ? parsed.startOf("day").toDate() : null;
}

module.exports = { parseZohoDate };
