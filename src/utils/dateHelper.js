const prisma = require("../config/prisma");
const dayjs = require("dayjs");
const weekday = require("dayjs/plugin/weekday");
const utc = require("dayjs/plugin/utc");

dayjs.extend(weekday);
dayjs.extend(utc);

const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 7];

function getDayOfWeekIso(date) {
  const dow = dayjs(date).day();
  return dow === 0 ? 7 : dow;
}

function toIsoDate(date) {
  return dayjs.utc(date).format("YYYY-MM-DD");
}

/**
 * Pure: does this date count as a working day given pre-loaded inputs?
 * Use this inside loops where workDays + holidays have already been fetched.
 */
function isWorkingDayPure({ date, workDays, holidayDateSet }) {
  const effectiveWorkDays =
    Array.isArray(workDays) && workDays.length > 0
      ? workDays
      : DEFAULT_WORK_DAYS;

  const dayOfWeek = getDayOfWeekIso(date);
  if (!effectiveWorkDays.includes(dayOfWeek)) return false;

  if (holidayDateSet && holidayDateSet.has(toIsoDate(date))) return false;

  return true;
}

/**
 * Batch helper: returns a Set of "YYYY-MM-DD" strings for the org's
 * holidays within the (inclusive) date range.
 */
async function getHolidayDateSet(organizationId, startDate, endDate) {
  const start = dayjs(startDate).startOf("day").toDate();
  const end = dayjs(endDate).endOf("day").toDate();
  const holidays = await prisma.holiday.findMany({
    where: {
      organization_id: organizationId,
      date: { gte: start, lte: end },
    },
    select: { date: true },
  });
  return new Set(holidays.map((h) => toIsoDate(h.date)));
}

/**
 * Convenience for org default work days. Returns the array stored in
 * organization.settings.defaultWorkDays or the hardcoded fallback.
 */
function getOrgDefaultWorkDays(orgSettings) {
  if (orgSettings && Array.isArray(orgSettings.defaultWorkDays)) {
    return orgSettings.defaultWorkDays;
  }
  return DEFAULT_WORK_DAYS;
}

/**
 * Original async wrapper. Kept for callers that don't pre-load inputs
 * (one-off commands, tests, etc.). Hot-path callers should switch to
 * isWorkingDayPure + getHolidayDateSet to avoid N+1 queries.
 */
async function isWorkingDay(date, organizationId, userId = null) {
  let workDays = null;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { workDays: true },
    });
    workDays = user?.workDays?.length ? user.workDays : null;
  }

  if (!workDays) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    workDays = getOrgDefaultWorkDays(org?.settings);
  }

  // Fast path: skip the holiday query when the day isn't a work day anyway.
  const effectiveWorkDays =
    Array.isArray(workDays) && workDays.length > 0
      ? workDays
      : DEFAULT_WORK_DAYS;
  if (!effectiveWorkDays.includes(getDayOfWeekIso(date))) return false;

  const dt = dayjs(date);
  const holidayDateSet = await getHolidayDateSet(
    organizationId,
    dt.startOf("day").toDate(),
    dt.endOf("day").toDate()
  );

  return isWorkingDayPure({ date, workDays, holidayDateSet });
}

/**
 * Format time from 24-hour format (HH:MM) to 12-hour format (h:MM AM/PM)
 * @param {string} time24 - Time in 24-hour format (e.g., "14:30")
 * @returns {string} Time in 12-hour format (e.g., "2:30 PM")
 */
function formatTime12Hour(time24) {
  if (!time24 || typeof time24 !== "string") return time24;
  if (!/^\d{1,2}:\d{2}$/.test(time24)) return time24;
  const [hours, minutes] = time24.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return time24;
  try {
    const timeObj = dayjs(`2000-01-01 ${time24}`, "YYYY-MM-DD HH:mm", true);
    if (!timeObj.isValid()) return time24;
    return timeObj.format("h:mm A");
  } catch (error) {
    return time24;
  }
}

module.exports = {
  isWorkingDay,
  isWorkingDayPure,
  getDayOfWeekIso,
  getHolidayDateSet,
  getOrgDefaultWorkDays,
  formatTime12Hour,
};
