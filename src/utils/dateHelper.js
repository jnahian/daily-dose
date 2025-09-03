const prisma = require("../config/prisma");
const { DateTime } = require("luxon");

async function isWorkingDay(date, organizationId) {
  const dt = DateTime.fromJSDate(date);

  // Check weekend
  if (dt.weekday === 6 || dt.weekday === 7) {
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