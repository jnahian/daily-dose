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

module.exports = {
  isWorkingDay,
};