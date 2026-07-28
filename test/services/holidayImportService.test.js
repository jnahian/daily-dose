const XLSX = require("xlsx");
const {
  parseHolidayFile,
  expandToDailyRecords,
  diffAgainstExisting,
  normalizeImportItems,
  toUtcDate,
  toDateKey,
  MAX_TOTAL_RECORDS,
  MAX_NAME_LENGTH,
} = require("../../src/services/holidayImportService");

function makeXlsxBuffer(rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

describe("parseHolidayFile (csv)", () => {
  it("parses a Zoho-style CSV export into rows", () => {
    const csv =
      "Name,From,To,Locations,Shifts,Description,Restricted holiday,Reminder,Date - Duration and Session,Holidays Classification\n" +
      "New Year,01-Jan-2027,01-Jan-2027,Dhaka,-,,False,5,,Bank Holiday\n" +
      'Winter Break,25-Dec-2027,27-Dec-2027,Dhaka,-,"Long, cozy weekend",False,5,,Bank Holiday\n';

    const { rows, warnings } = parseHolidayFile(
      Buffer.from(csv, "utf8"),
      "holidays.csv"
    );

    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("New Year");
    expect(rows[0].startDate.format("YYYY-MM-DD")).toBe("2027-01-01");
    expect(rows[1].description).toBe("Long, cozy weekend");
    expect(rows[1].endDate.format("YYYY-MM-DD")).toBe("2027-12-27");
  });

  it("skips rows with missing name or unparsable dates and reports why", () => {
    const csv =
      "Name,From,To\n" +
      ",01-Jan-2027,01-Jan-2027\n" +
      "Bad Date,not-a-date,not-a-date\n" +
      "Reversed Range,10-Feb-2027,05-Feb-2027\n";

    const { rows, warnings } = parseHolidayFile(
      Buffer.from(csv, "utf8"),
      "holidays.csv"
    );

    expect(rows).toHaveLength(0);
    expect(warnings).toEqual([
      "Row 2: skipped, missing holiday name",
      'Row 3: skipped, unrecognized "From" date "not-a-date"',
      'Row 4: skipped, "To" date is before "From" date',
    ]);
  });

  it("throws when no recognizable header row is present", () => {
    const csv = "foo,bar\n1,2\n";
    expect(() =>
      parseHolidayFile(Buffer.from(csv, "utf8"), "holidays.csv")
    ).toThrow(/header row/i);
  });
});

describe("parseHolidayFile (xlsx)", () => {
  it("parses rows from a real workbook buffer", () => {
    const buffer = makeXlsxBuffer([
      ["Name", "From", "To", "Description"],
      ["Independence Day", "26-Mar-2026", "26-Mar-2026", ""],
      ["Eid Ul Fitr", "19-Mar-2026", "21-Mar-2026", "Eid holiday"],
    ]);

    const { rows, warnings } = parseHolidayFile(buffer, "holidays.xlsx");

    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[1].startDate.format("YYYY-MM-DD")).toBe("2026-03-19");
    expect(rows[1].endDate.format("YYYY-MM-DD")).toBe("2026-03-21");
  });
});

describe("expandToDailyRecords", () => {
  it("expands multi-day ranges into one record per day", () => {
    const csv = "Name,From,To\n" + "Eid Ul Azha,25-May-2026,27-May-2026\n";
    const { rows } = parseHolidayFile(Buffer.from(csv, "utf8"), "holidays.csv");

    const { records, truncated } = expandToDailyRecords(rows);

    expect(truncated).toBe(0);
    expect(records.map((r) => r.date)).toEqual([
      "2026-05-25",
      "2026-05-26",
      "2026-05-27",
    ]);
    expect(records.every((r) => r.name === "Eid Ul Azha")).toBe(true);
  });

  it("dedupes overlapping rows on the same day, keeping the later row", () => {
    const csv =
      "Name,From,To\n" +
      "First Name,01-Jan-2026,02-Jan-2026\n" +
      "Second Name,02-Jan-2026,02-Jan-2026\n";
    const { rows } = parseHolidayFile(Buffer.from(csv, "utf8"), "holidays.csv");

    const { records } = expandToDailyRecords(rows);

    expect(records).toHaveLength(2);
    expect(records.find((r) => r.date === "2026-01-02").name).toBe(
      "Second Name"
    );
  });

  it("reports how many days the total cap dropped", () => {
    // 21 rows x 50 days (Jan 1–Feb 19, leap-year safe) = 1050 distinct days,
    // 50 over MAX_TOTAL_RECORDS.
    const lines = ["Name,From,To"];
    for (let i = 0; i < 21; i++) {
      const year = 2030 + i;
      lines.push(`Long Break ${i},01-Jan-${year},19-Feb-${year}`);
    }
    const { rows } = parseHolidayFile(
      Buffer.from(lines.join("\n") + "\n", "utf8"),
      "holidays.csv"
    );

    const { records, truncated } = expandToDailyRecords(rows);

    expect(records).toHaveLength(MAX_TOTAL_RECORDS);
    expect(truncated).toBe(50);
  });
});

describe("UTC date keying", () => {
  it("round-trips a date key through UTC midnight", () => {
    const date = toUtcDate("2026-03-19");

    expect(date.toISOString()).toBe("2026-03-19T00:00:00.000Z");
    expect(toDateKey(date)).toBe("2026-03-19");
  });

  it("rejects malformed and out-of-range date keys", () => {
    expect(toUtcDate("19-Mar-2026")).toBeNull();
    expect(toUtcDate("2026-02-30")).toBeNull();
    expect(toUtcDate("2026-13-01")).toBeNull();
    expect(toUtcDate("")).toBeNull();
    expect(toUtcDate(undefined)).toBeNull();
    expect(toUtcDate({ date: "2026-03-19" })).toBeNull();
  });

  // Holiday.date is `@db.Date`, so Prisma persists the UTC calendar day. If
  // these used local midnight, the day would shift on any non-UTC host and the
  // (organization_id, date) upsert would clobber the neighbouring holiday.
  it("keys dates by UTC day regardless of the host timezone", () => {
    const originalTz = process.env.TZ;
    for (const tz of ["Asia/Dhaka", "America/New_York", "UTC"]) {
      process.env.TZ = tz;
      expect(toUtcDate("2026-03-19").toISOString()).toBe(
        "2026-03-19T00:00:00.000Z"
      );
      expect(toDateKey(new Date("2026-03-19T00:00:00.000Z"))).toBe(
        "2026-03-19"
      );
    }
    process.env.TZ = originalTz;
  });
});

describe("diffAgainstExisting", () => {
  const records = [
    { date: "2026-03-19", name: "Eid", description: null },
    { date: "2026-03-20", name: "Eid", description: null },
    { date: "2026-03-26", name: "Independence Day", description: null },
  ];

  it("tags each record new / update / unchanged", () => {
    const existing = [
      // stored as UTC midnight, exactly how Prisma returns a @db.Date
      {
        date: new Date("2026-03-19T00:00:00.000Z"),
        name: "Eid",
        description: null,
      },
      {
        date: new Date("2026-03-20T00:00:00.000Z"),
        name: "Old Name",
        description: null,
      },
    ];

    const items = diffAgainstExisting(records, existing);

    expect(items.map((i) => i.status)).toEqual(["unchanged", "update", "new"]);
  });

  it("treats a description change as an update", () => {
    const existing = [
      {
        date: new Date("2026-03-19T00:00:00.000Z"),
        name: "Eid",
        description: "was set",
      },
    ];

    const items = diffAgainstExisting(records, existing);

    expect(items[0].status).toBe("update");
  });
});

describe("normalizeImportItems", () => {
  it("keeps valid rows and reports skipped ones", () => {
    const { valid, skipped } = normalizeImportItems([
      { date: "2026-03-19", name: "Eid", description: " spaced " },
      { date: "2026-03-19", name: "Duplicate day" },
      { date: "19-Mar-2026", name: "Bad date" },
      { date: "2026-03-20", name: "   " },
      { date: "2026-03-21", name: "Valid", description: null },
    ]);

    expect(skipped).toBe(3);
    expect(valid).toHaveLength(2);
    expect(valid[0].date.toISOString()).toBe("2026-03-19T00:00:00.000Z");
    expect(valid[0].description).toBe("spaced");
    expect(valid[1].description).toBeNull();
  });

  it("truncates names to the column limit instead of failing the write", () => {
    const { valid } = normalizeImportItems([
      { date: "2026-03-19", name: "x".repeat(MAX_NAME_LENGTH + 50) },
    ]);

    expect(valid[0].name).toHaveLength(MAX_NAME_LENGTH);
  });

  it("coerces non-string descriptions rather than passing them to Prisma", () => {
    const { valid } = normalizeImportItems([
      { date: "2026-03-19", name: "Eid", description: { $ne: null } },
    ]);

    expect(typeof valid[0].description).toBe("string");
  });
});
