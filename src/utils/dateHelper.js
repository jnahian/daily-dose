const prisma = require("../config/prisma");
const dayjs = require("dayjs");
const weekday = require("dayjs/plugin/weekday");

dayjs.extend(weekday);

async function isWorkingDay(date, organizationId, userId = null) {
  const dt = dayjs(date);

  // Get work days - user-specific or organization default
  let workDays;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { workDays: true },
    });
    workDays = user?.workDays || null;
  }

  if (!workDays) {
    // Use organization default
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    workDays = org?.settings?.defaultWorkDays || [1, 2, 3, 4, 7];
  }

  // Check if current day is a work day (Day.js weekday: 0=Sunday, 1=Monday, etc.)
  // Convert to match Luxon format (1=Monday, 7=Sunday)
  const dayOfWeek = dt.day() === 0 ? 7 : dt.day();
  if (!workDays.includes(dayOfWeek)) {
    return false;
  }

  // Check holidays
  const holiday = await prisma.holiday.findFirst({
    where: {
      organization_id: organizationId,
      date: {
        gte: dt.startOf("day").toDate(),
        lte: dt.endOf("day").toDate(),
      },
    },
  });

  if (holiday) {
    return false;
  }

  return true;
}

/**
 * Format time from 24-hour format (HH:MM) to 12-hour format (h:MM AM/PM)
 * @param {string} time24 - Time in 24-hour format (e.g., "14:30")
 * @returns {string} Time in 12-hour format (e.g., "2:30 PM")
 */
function formatTime12Hour(time24) {
  if (!time24 || typeof time24 !== "string") return time24;

  // Validate time format and range
  if (!/^\d{1,2}:\d{2}$/.test(time24)) return time24;

  const [hours, minutes] = time24.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return time24;
  }

  try {
    // Parse time using dayjs - create a date with the time
    const timeObj = dayjs(`2000-01-01 ${time24}`, "YYYY-MM-DD HH:mm", true);

    // Check if the parsing was successful
    if (!timeObj.isValid()) return time24;

    // Format to 12-hour format
    return timeObj.format("h:mm A");
  } catch (error) {
    return time24;
  }
}

module.exports = {
  isWorkingDay,
  formatTime12Hour,
};
