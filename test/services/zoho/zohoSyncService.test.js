jest.mock("../../../src/config/prisma", () => ({
  holiday: { upsert: jest.fn() },
  leave: { upsert: jest.fn() },
  zohoSyncRun: { create: jest.fn() },
  organization: { findMany: jest.fn() },
}));
jest.mock("../../../src/services/zoho/zohoPeopleClient", () => ({
  fetchLeaveRecords: jest.fn(),
  fetchHolidays: jest.fn(),
}));
jest.mock("../../../src/services/zoho/zohoMappingService", () => ({
  getUserIdsByEmployeeId: jest.fn(),
}));
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const prisma = require("../../../src/config/prisma");
const {
  fetchLeaveRecords,
  fetchHolidays,
} = require("../../../src/services/zoho/zohoPeopleClient");
const {
  getUserIdsByEmployeeId,
} = require("../../../src/services/zoho/zohoMappingService");
const zohoSyncService = require("../../../src/services/zoho/zohoSyncService");

describe("mapZohoHoliday", () => {
  it("maps the documented field names", () => {
    const mapped = zohoSyncService.mapZohoHoliday({
      holidayId: 123,
      Name: "New Year's Day",
      Date: "01-Jan-2027",
    });
    expect(mapped).toEqual({
      externalId: "123",
      name: "New Year's Day",
      date: expect.any(Date),
    });
  });

  it("returns null when required fields are missing", () => {
    expect(zohoSyncService.mapZohoHoliday({ Name: "No Date" })).toBeNull();
  });

  it("returns null when the date can't be parsed", () => {
    expect(
      zohoSyncService.mapZohoHoliday({ Name: "Bad Date", Date: "2027-01-01" })
    ).toBeNull();
  });
});

describe("mapZohoLeaveRecord", () => {
  const bigId = "9007199254740993012";

  it("maps an approved record and keeps IDs as strings", () => {
    const mapped = zohoSyncService.mapZohoLeaveRecord({
      recordId: bigId,
      employeeId: bigId,
      approvalStatus: "Approved",
      fromDate: "05-Jul-2026",
      toDate: "06-Jul-2026",
      leaveType: "Sick Leave",
    });

    expect(mapped.externalId).toBe(bigId);
    expect(mapped.zohoEmployeeId).toBe(bigId);
    expect(mapped.isApproved).toBe(true);
    expect(mapped.reason).toBe("Sick Leave");
  });

  it("flags non-approved statuses as not approved", () => {
    const mapped = zohoSyncService.mapZohoLeaveRecord({
      recordId: "1",
      employeeId: "2",
      approvalStatus: "Pending",
      fromDate: "05-Jul-2026",
      toDate: "06-Jul-2026",
    });
    expect(mapped.isApproved).toBe(false);
  });

  it("returns null when required fields are missing", () => {
    expect(
      zohoSyncService.mapZohoLeaveRecord({ approvalStatus: "Approved" })
    ).toBeNull();
  });
});

describe("syncHolidaysForOrganization", () => {
  beforeEach(() => jest.clearAllMocks());

  it("upserts each mapped holiday tagged with source=ZOHO and records a SUCCESS run", async () => {
    fetchHolidays.mockResolvedValue([
      { holidayId: "h1", Name: "New Year's Day", Date: "01-Jan-2027" },
      { Name: "Missing date, dropped" },
    ]);
    prisma.holiday.upsert.mockResolvedValue({});
    prisma.zohoSyncRun.create.mockResolvedValue({});

    await zohoSyncService.syncHolidaysForOrganization("org-1");

    expect(prisma.holiday.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.holiday.upsert.mock.calls[0][0];
    expect(call.where.organization_id_date.organization_id).toBe("org-1");
    expect(call.update.source).toBe("ZOHO");
    expect(call.update.externalId).toBe("h1");
    expect(call.create.source).toBe("ZOHO");

    expect(prisma.zohoSyncRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          syncType: "HOLIDAY",
          status: "SUCCESS",
          recordsSynced: 1,
        }),
      })
    );
  });

  it("records a FAILED run when the Zoho API call throws", async () => {
    fetchHolidays.mockRejectedValue(new Error("boom"));
    prisma.zohoSyncRun.create.mockResolvedValue({});

    await expect(
      zohoSyncService.syncHolidaysForOrganization("org-1")
    ).rejects.toThrow("boom");

    expect(prisma.zohoSyncRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          syncType: "HOLIDAY",
          status: "FAILED",
          error: "boom",
        }),
      })
    );
  });
});

describe("syncLeavesForOrganization", () => {
  beforeEach(() => jest.clearAllMocks());

  it("only syncs approved leaves for mapped employees", async () => {
    fetchLeaveRecords.mockResolvedValue([
      {
        recordId: "r1",
        employeeId: "emp-mapped",
        approvalStatus: "Approved",
        fromDate: "05-Jul-2026",
        toDate: "06-Jul-2026",
      },
      {
        recordId: "r2",
        employeeId: "emp-unmapped",
        approvalStatus: "Approved",
        fromDate: "05-Jul-2026",
        toDate: "06-Jul-2026",
      },
      {
        recordId: "r3",
        employeeId: "emp-mapped",
        approvalStatus: "Pending",
        fromDate: "05-Jul-2026",
        toDate: "06-Jul-2026",
      },
    ]);
    getUserIdsByEmployeeId.mockResolvedValue(
      new Map([["emp-mapped", "user-1"]])
    );
    prisma.leave.upsert.mockResolvedValue({});
    prisma.zohoSyncRun.create.mockResolvedValue({});

    await zohoSyncService.syncLeavesForOrganization("org-1");

    expect(prisma.leave.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.leave.upsert.mock.calls[0][0];
    expect(call.where.source_externalId).toEqual({
      source: "ZOHO",
      externalId: "r1",
    });
    expect(call.create.userId).toBe("user-1");
    expect(call.create.source).toBe("ZOHO");

    expect(prisma.zohoSyncRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          syncType: "LEAVE",
          status: "SUCCESS",
          recordsSynced: 1,
        }),
      })
    );
  });
});

describe("syncAllOrganizations", () => {
  beforeEach(() => jest.clearAllMocks());

  it("only processes organizations with an enabled Zoho credential", async () => {
    prisma.organization.findMany.mockResolvedValue([
      { id: "org-1", name: "Org One" },
    ]);
    fetchHolidays.mockResolvedValue([]);
    fetchLeaveRecords.mockResolvedValue([]);
    getUserIdsByEmployeeId.mockResolvedValue(new Map());
    prisma.zohoSyncRun.create.mockResolvedValue({});

    const result = await zohoSyncService.syncAllOrganizations();

    expect(prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, zohoCredential: { enabled: true } },
      })
    );
    expect(result.organizationsProcessed).toBe(1);
  });

  it("continues to the next organization when one sync fails", async () => {
    prisma.organization.findMany.mockResolvedValue([
      { id: "org-1", name: "Org One" },
      { id: "org-2", name: "Org Two" },
    ]);
    fetchHolidays
      .mockRejectedValueOnce(new Error("org-1 holiday fetch failed"))
      .mockResolvedValueOnce([]);
    fetchLeaveRecords.mockResolvedValue([]);
    getUserIdsByEmployeeId.mockResolvedValue(new Map());
    prisma.zohoSyncRun.create.mockResolvedValue({});

    await zohoSyncService.syncAllOrganizations();

    // Both orgs' leave sync still ran despite org-1's holiday sync failing.
    expect(fetchLeaveRecords).toHaveBeenCalledTimes(2);
  });
});
