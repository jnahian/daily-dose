class TimeFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "TimeFormatError";
    this.userFacing = true;
  }
}

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

// Escape characters significant in Slack mrkdwn so user-provided input echoed
// back in error messages can't break rendering or inject mentions/links.
function escapeForMessage(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function parseTimeString(input) {
  if (typeof input !== "string" || input.length === 0) {
    throw new TimeFormatError(
      "Time must be a string in HH:MM (24-hour) format, e.g. 09:30"
    );
  }

  const safeInput = escapeForMessage(input);

  const match = input.match(TIME_RE);
  if (!match) {
    throw new TimeFormatError(
      `Invalid time "${safeInput}". Use HH:MM (24-hour) format, e.g. 09:30`
    );
  }

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);

  if (hour < 0 || hour > 23) {
    throw new TimeFormatError(
      `Invalid hour ${hour} in "${safeInput}". Hours must be 0-23`
    );
  }
  if (minute < 0 || minute > 59) {
    throw new TimeFormatError(
      `Invalid minute ${minute} in "${safeInput}". Minutes must be 0-59`
    );
  }

  const normalized = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return { hour, minute, normalized };
}

/**
 * Validate an IANA timezone identifier (e.g. "America/New_York").
 * Team timezones are stored as free-form strings; a typo like
 * "America/NewYork" would otherwise be accepted and make node-cron/dayjs
 * silently schedule the team's jobs at the wrong time.
 * @param {string} timezone
 * @returns {string} the validated timezone, unchanged
 * @throws {TimeFormatError} when the identifier is not a valid IANA timezone
 */
function validateTimezone(timezone) {
  if (typeof timezone !== "string" || timezone.length === 0) {
    throw new TimeFormatError(
      "Timezone must be an IANA identifier, e.g. Asia/Dhaka or America/New_York"
    );
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new TimeFormatError(
      `Invalid timezone "${escapeForMessage(timezone)}". Use an IANA identifier, e.g. Asia/Dhaka or America/New_York`
    );
  }
  return timezone;
}

module.exports = { parseTimeString, validateTimezone, TimeFormatError };
