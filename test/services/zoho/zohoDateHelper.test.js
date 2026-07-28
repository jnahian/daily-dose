const { parseZohoDate } = require("../../../src/services/zoho/zohoDateHelper");

describe("parseZohoDate", () => {
  it("parses Zoho's dd-MMM-yyyy format", () => {
    const date = parseZohoDate("05-Jul-2026");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6); // July is month index 6
    expect(date.getDate()).toBe(5);
  });

  it("returns null for an invalid date string", () => {
    expect(parseZohoDate("not-a-date")).toBeNull();
  });

  it("returns null for a differently-formatted date string", () => {
    expect(parseZohoDate("2026-07-05")).toBeNull();
  });

  it("returns null for empty/non-string input", () => {
    expect(parseZohoDate("")).toBeNull();
    expect(parseZohoDate(null)).toBeNull();
    expect(parseZohoDate(undefined)).toBeNull();
  });
});
