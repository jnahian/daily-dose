// computeIsLate is pure (dayjs + team config). Mock the heavy deps so requiring
// the service stays offline.
jest.mock("../../src/config/prisma", () => ({}));
jest.mock("../../src/services/userService", () => ({}));
jest.mock("../../src/services/notificationService", () => ({}));

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

const standupService = require("../../src/services/standupService");

const team = { timezone: "UTC", postingTime: "10:00" };

describe("standupService.computeIsLate", () => {
  it("is false for a past date regardless of time", () => {
    const pastDate = dayjs().utc().subtract(3, "day").toDate();
    expect(standupService.computeIsLate(team, pastDate)).toBe(false);
  });

  it("is true for today after the posting time", () => {
    // Pin 'now' to 23:59 UTC, well past 10:00 posting time.
    jest.useFakeTimers();
    jest.setSystemTime(
      dayjs().utc().startOf("day").hour(23).minute(59).toDate()
    );
    try {
      const lateToday = dayjs()
        .utc()
        .startOf("day")
        .hour(23)
        .minute(59)
        .toDate();
      expect(standupService.computeIsLate(team, lateToday)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("is false for today before the posting time", () => {
    // Pin 'now' to 06:00 UTC, before the 10:00 posting time.
    jest.useFakeTimers();
    jest.setSystemTime(dayjs().utc().startOf("day").hour(6).toDate());
    try {
      const earlyToday = dayjs().utc().startOf("day").hour(6).toDate();
      expect(standupService.computeIsLate(team, earlyToday)).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
