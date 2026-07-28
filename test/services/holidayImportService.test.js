const XLSX = require("xlsx");
const {
  parseHolidayFile,
  expandToDailyRecords,
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

    const { rows, warnings } = parseHolidayFile(Buffer.from(csv, "utf8"), "holidays.csv");

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

    const { rows, warnings } = parseHolidayFile(Buffer.from(csv, "utf8"), "holidays.csv");

    expect(rows).toHaveLength(0);
    expect(warnings).toEqual([
      'Row 2: skipped, missing holiday name',
      'Row 3: skipped, unrecognized "From" date "not-a-date"',
      'Row 4: skipped, "To" date is before "From" date',
    ]);
  });

  it("throws when no recognizable header row is present", () => {
    const csv = "foo,bar\n1,2\n";
    expect(() => parseHolidayFile(Buffer.from(csv, "utf8"), "holidays.csv")).toThrow(
      /header row/i
    );
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
    const csv =
      "Name,From,To\n" + "Eid Ul Azha,25-May-2026,27-May-2026\n";
    const { rows } = parseHolidayFile(Buffer.from(csv, "utf8"), "holidays.csv");

    const records = expandToDailyRecords(rows);

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

    const records = expandToDailyRecords(rows);

    expect(records).toHaveLength(2);
    expect(records.find((r) => r.date === "2026-01-02").name).toBe("Second Name");
  });
});
