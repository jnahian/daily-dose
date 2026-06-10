const {
  isWorkingDayPure,
  getDayOfWeekIso,
} = require("../../src/utils/dateHelper");

describe("getDayOfWeekIso", () => {
  it("returns 1 for Monday, 7 for Sunday (ISO weekday)", () => {
    // 2024-01-01 is a Monday
    expect(getDayOfWeekIso(new Date("2024-01-01T12:00:00Z"))).toBe(1);
    // 2024-01-07 is a Sunday
    expect(getDayOfWeekIso(new Date("2024-01-07T12:00:00Z"))).toBe(7);
  });
});

describe("isWorkingDayPure", () => {
  // Mon 2024-01-01
  const monday = new Date("2024-01-01T12:00:00Z");
  // Sun 2024-01-07
  const sunday = new Date("2024-01-07T12:00:00Z");

  it("returns false when the weekday is not in workDays", () => {
    expect(
      isWorkingDayPure({
        date: sunday,
        workDays: [1, 2, 3, 4, 5],
        holidayDateSet: new Set(),
      })
    ).toBe(false);
  });

  it("returns true when the weekday is in workDays and not a holiday", () => {
    expect(
      isWorkingDayPure({
        date: monday,
        workDays: [1, 2, 3, 4, 5],
        holidayDateSet: new Set(),
      })
    ).toBe(true);
  });

  it("returns false when the date matches a holiday", () => {
    expect(
      isWorkingDayPure({
        date: monday,
        workDays: [1, 2, 3, 4, 5],
        holidayDateSet: new Set(["2024-01-01"]),
      })
    ).toBe(false);
  });

  it("accepts Sunday=7 in workDays (legacy data uses [1,2,3,4,7])", () => {
    expect(
      isWorkingDayPure({
        date: sunday,
        workDays: [1, 2, 3, 4, 7],
        holidayDateSet: new Set(),
      })
    ).toBe(true);
  });

  it("falls back to default [1,2,3,4,7] when workDays is null/undefined", () => {
    expect(
      isWorkingDayPure({
        date: monday,
        workDays: null,
        holidayDateSet: new Set(),
      })
    ).toBe(true);
    expect(
      isWorkingDayPure({
        date: new Date("2024-01-05T12:00:00Z"), // Friday = 5
        workDays: null,
        holidayDateSet: new Set(),
      })
    ).toBe(false);
  });

  it("falls back to default [1,2,3,4,7] when workDays is an empty array", () => {
    expect(
      isWorkingDayPure({
        date: monday,
        workDays: [],
        holidayDateSet: new Set(),
      })
    ).toBe(true);
  });
});
