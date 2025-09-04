const prisma = require("../config/prisma");
const dayjs = require("dayjs");

async function isWorkingDay(date, organizationId, userId = null) {
  const dt = DateTime.fromJSDate(date);

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

  // Check if current day is a work day
  if (!workDays.includes(dt.weekday)) {
    return false;
  }

  // Check holidays
  const holiday = await prisma.holiday.findFirst({
    where: {
      date: {
        gte: dt.startOf("day").toJSDate(),
        lte: dt.endOf("day").toJSDate(),
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