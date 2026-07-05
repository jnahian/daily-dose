jest.mock("../../../src/services/zoho/zohoAuthService", () => ({
  getValidAccessToken: jest.fn(),
}));

const {
  getValidAccessToken,
} = require("../../../src/services/zoho/zohoAuthService");
const {
  fetchLeaveRecords,
  fetchHolidays,
  ZohoApiError,
} = require("../../../src/services/zoho/zohoPeopleClient");

describe("zohoPeopleClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    getValidAccessToken.mockResolvedValue({
      accessToken: "access-token-abc",
      dataCenter: "com",
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetchLeaveRecords requests the leave-tracker endpoint and returns the leaves array", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ leaves: [{ recordId: 1 }] }),
    });

    const records = await fetchLeaveRecords(
      "org-1",
      "01-01-2026",
      "01-31-2026"
    );

    expect(records).toEqual([{ recordId: 1 }]);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://people.zoho.com/api/v2/leavetracker/leaves/records?fromDate=01-01-2026&toDate=01-31-2026",
      { headers: { Authorization: "Zoho-oauthtoken access-token-abc" } }
    );
  });

  it("fetchLeaveRecords never coerces big Zoho record/employee IDs to Number", async () => {
    // 19-digit IDs like this lose precision if run through JSON.parse/Number().
    const bigId = "9007199254740993012";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        `{"leaves":[{"recordId":${bigId},"employeeId":${bigId}}]}`,
    });

    const [record] = await fetchLeaveRecords("org-1", "a", "b");

    expect(record.recordId).toBe(bigId);
    expect(record.employeeId).toBe(bigId);
    expect(typeof record.recordId).toBe("string");
  });

  it("fetchHolidays requests the holidays endpoint and returns the holidays array", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ holidays: [{ Name: "New Year" }] }),
    });

    const holidays = await fetchHolidays("org-1");

    expect(holidays).toEqual([{ Name: "New Year" }]);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://people.zoho.com/api/leave/v2/holidays/get",
      { headers: { Authorization: "Zoho-oauthtoken access-token-abc" } }
    );
  });

  it("returns an empty array when the response shape is unexpected", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ unexpected: true }),
    });

    expect(await fetchHolidays("org-1")).toEqual([]);
  });

  it("throws ZohoApiError with a clear message on 401/403", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: "no permission" }),
    });

    await expect(fetchHolidays("org-1")).rejects.toThrow(ZohoApiError);
    await expect(fetchHolidays("org-1")).rejects.toThrow(/unauthorized/);
  });

  it("throws ZohoApiError on other non-ok responses", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "",
    });

    await expect(fetchHolidays("org-1")).rejects.toThrow(ZohoApiError);
  });
});
