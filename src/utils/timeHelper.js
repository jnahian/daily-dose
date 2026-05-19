class TimeFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "TimeFormatError";
    this.userFacing = true;
  }
}

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function parseTimeString(input) {
  if (typeof input !== "string" || input.length === 0) {
    throw new TimeFormatError(
      "Time must be a string in HH:MM (24-hour) format, e.g. 09:30"
    );
  }

  const match = input.match(TIME_RE);
  if (!match) {
    throw new TimeFormatError(
      `Invalid time "${input}". Use HH:MM (24-hour) format, e.g. 09:30`
    );
  }

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);

  if (hour < 0 || hour > 23) {
    throw new TimeFormatError(
      `Invalid hour ${hour} in "${input}". Hours must be 0-23`
    );
  }
  if (minute < 0 || minute > 59) {
    throw new TimeFormatError(
      `Invalid minute ${minute} in "${input}". Minutes must be 0-59`
    );
  }

  const normalized = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return { hour, minute, normalized };
}

module.exports = { parseTimeString, TimeFormatError };
