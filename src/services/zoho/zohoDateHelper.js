const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
const utc = require("dayjs/plugin/utc");

dayjs.extend(customParseFormat);
dayjs.extend(utc);

// Zoho People returns dates as "dd-MMM-yyyy" (e.g. "05-Jul-2026"). Parse
// strictly and normalize to UTC-midnight explicitly — matching how the rest
// of the app stores Leave/Holiday dates (see dateHelper.js's toIsoDate
// comment) regardless of the deployment process's own timezone.
function parseZohoDate(value) {
  if (!value || typeof value !== "string") return null;
  const parsed = dayjs.utc(value, "DD-MMM-YYYY", true);
  return parsed.isValid() ? parsed.startOf("day").toDate() : null;
}

module.exports = { parseZohoDate };
