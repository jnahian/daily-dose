jest.mock("../../../src/config/prisma", () => ({
  holiday: { upsert: jest.fn() },
  leave: { upsert: jest.fn(), deleteMany: jest.fn() },
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
          // The second fixture row has no date and is dropped by the mapper.
          skippedInvalid: 1,
        }),
      })
    );
  });

  it("still surfaces the Zoho error when the audit write itself fails", async () => {
    fetchHolidays.mockRejectedValue(new Error("boom"));
    prisma.zohoSyncRun.create.mockRejectedValue(new Error("db down"));

    await expect(
      zohoSyncService.syncHolidaysForOrganization("org-1")
    ).rejects.toThrow("boom");
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
    prisma.leave.deleteMany.mockResolvedValue({ count: 0 });
    prisma.zohoSyncRun.create.mockResolvedValue({});

    await zohoSyncService.syncLeavesForOrganization("org-1");

    expect(prisma.leave.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.leave.upsert.mock.calls[0][0];
    expect(call.where.organizationId_source_externalId).toEqual({
      organizationId: "org-1",
      source: "ZOHO",
      externalId: "r1",
    });
    expect(call.create.userId).toBe("user-1");
    expect(call.create.source).toBe("ZOHO");
    expect(call.create.organizationId).toBe("org-1");

    expect(prisma.zohoSyncRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          syncType: "LEAVE",
          status: "SUCCESS",
          recordsSynced: 1,
          skippedUnmapped: 1,
          skippedNotApproved: 1,
          skippedInvalid: 0,
        }),
      })
    );
  });

  // Guards the silent-failure case: if the employee IDs an admin mapped don't
  // match what Zoho returns, the run must not look like a clean empty night.
  it("persists skippedUnmapped so a 0-record run is distinguishable from an idle one", async () => {
    fetchLeaveRecords.mockResolvedValue([
      {
        recordId: "r1",
        employeeId: "12345000000012345",
        approvalStatus: "Approved",
        fromDate: "05-Jul-2026",
        toDate: "06-Jul-2026",
      },
    ]);
    // Admin mapped the Zoho UI employee code, not the internal numeric ID.
    getUserIdsByEmployeeId.mockResolvedValue(
      new Map([["ZP-0012345", "user-1"]])
    );
    prisma.leave.deleteMany.mockResolvedValue({ count: 0 });
    prisma.zohoSyncRun.create.mockResolvedValue({});

    const result = await zohoSyncService.syncLeavesForOrganization("org-1");

    expect(result).toEqual(
      expect.objectContaining({ recordsSynced: 0, skippedUnmapped: 1 })
    );
    expect(prisma.zohoSyncRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUCCESS",
          recordsSynced: 0,
          skippedUnmapped: 1,
        }),
      })
    );
  });

  it("counts records the mapper couldn't read as skippedInvalid", async () => {
    // Field names the mappers don't recognize — the "Zoho renamed its fields"
    // failure mode, which would otherwise vanish silently.
    fetchLeaveRecords.mockResolvedValue([{ SomeOtherField: "x" }]);
    getUserIdsByEmployeeId.mockResolvedValue(new Map());
    prisma.zohoSyncRun.create.mockResolvedValue({});

    const result = await zohoSyncService.syncLeavesForOrganization("org-1");

    expect(result).toEqual(
      expect.objectContaining({ recordsSynced: 0, skippedInvalid: 1 })
    );
  });

  // The PR flags MM-DD-YYYY as the first thing to check on an empty sync, so
  // pin it — a change to the format or the window is then visible in the diff.
  it("requests a 7-day-back / 30-day-forward window in MM-DD-YYYY", async () => {
    fetchLeaveRecords.mockResolvedValue([]);
    getUserIdsByEmployeeId.mockResolvedValue(new Map());
    prisma.zohoSyncRun.create.mockResolvedValue({});

    await zohoSyncService.syncLeavesForOrganization("org-1");

    const [, fromDate, toDate] = fetchLeaveRecords.mock.calls[0];
    expect(fromDate).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    expect(toDate).toMatch(/^\d{2}-\d{2}-\d{4}$/);

    const toMs = (s) => {
      const [m, d, y] = s.split("-").map(Number);
      return Date.UTC(y, m - 1, d);
    };
    expect(Math.round((toMs(toDate) - toMs(fromDate)) / 86400000)).toBe(37);
  });

  it("deletes a previously-synced Zoho leave once the record is no longer approved", async () => {
    fetchLeaveRecords.mockResolvedValue([
      {
        recordId: "r9",
        employeeId: "emp-mapped",
        approvalStatus: "Rejected",
        fromDate: "05-Jul-2026",
        toDate: "06-Jul-2026",
      },
    ]);
    getUserIdsByEmployeeId.mockResolvedValue(
      new Map([["emp-mapped", "user-1"]])
    );
    prisma.leave.deleteMany.mockResolvedValue({ count: 1 });
    prisma.zohoSyncRun.create.mockResolvedValue({});

    await zohoSyncService.syncLeavesForOrganization("org-1");

    expect(prisma.leave.upsert).not.toHaveBeenCalled();
    expect(prisma.leave.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", source: "ZOHO", externalId: "r9" },
    });
  });

  it("scopes the upsert/delete key by organization so two tenants can't collide on the same Zoho record ID", async () => {
    // Same externalId ("r1") from two different Zoho tenants — the
    // organizationId in the key is what keeps these from colliding.
    const sameRecord = {
      recordId: "r1",
      employeeId: "emp-mapped",
      approvalStatus: "Approved",
      fromDate: "05-Jul-2026",
      toDate: "06-Jul-2026",
    };
    fetchLeaveRecords.mockResolvedValue([sameRecord]);
    getUserIdsByEmployeeId.mockResolvedValue(
      new Map([["emp-mapped", "user-1"]])
    );
    prisma.leave.upsert.mockResolvedValue({});
    prisma.zohoSyncRun.create.mockResolvedValue({});

    await zohoSyncService.syncLeavesForOrganization("org-a");
    await zohoSyncService.syncLeavesForOrganization("org-b");

    const keys = prisma.leave.upsert.mock.calls.map(
      ([args]) => args.where.organizationId_source_externalId
    );
    expect(keys).toEqual([
      { organizationId: "org-a", source: "ZOHO", externalId: "r1" },
      { organizationId: "org-b", source: "ZOHO", externalId: "r1" },
    ]);
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
