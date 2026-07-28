// Drives the /api/admin/zoho routes through the real router (no HTTP server,
// no supertest), the same way test/routes/adminHolidayImport.test.js does.

jest.mock("@slack/web-api", () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    conversations: { list: jest.fn() },
    oauth: { v2: { access: jest.fn() } },
    users: { identity: jest.fn(), info: jest.fn() },
  })),
}));

jest.mock("../../src/config/prisma", () => ({
  sessions: { findUnique: jest.fn() },
  super_admins: { findUnique: jest.fn() },
  organizationMember: { findFirst: jest.fn(), findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  zohoCredential: { findUnique: jest.fn() },
  zohoSyncRun: { findFirst: jest.fn() },
  zohoUserMapping: { findUnique: jest.fn(), delete: jest.fn() },
}));

jest.mock("../../src/services/zoho/zohoMappingService", () => ({
  listMappings: jest.fn(),
  mapMember: jest.fn(),
  unmapMember: jest.fn(),
}));

jest.mock("../../src/services/zoho/zohoSyncService", () => ({
  syncHolidaysForOrganization: jest.fn(),
  syncLeavesForOrganization: jest.fn(),
}));

const prisma = require("../../src/config/prisma");
const zohoMappingService = require("../../src/services/zoho/zohoMappingService");
const zohoSyncService = require("../../src/services/zoho/zohoSyncService");
const { UserFacingError } = require("../../src/utils/errorHelper");
const { router } = require("../../src/routes/admin");

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => console.error.mockRestore());

const ORG_ID = "org-1";

function callRoute(method, url, body) {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url,
      body,
      // Required, not redundant: req.query is populated by the Express *app*,
      // not by router.handle(). Drop this and every GET route 500s on
      // `const { orgId } = req.query`.
      query: Object.fromEntries(
        new URLSearchParams(url.split("?")[1] || "").entries()
      ),
      cookies: { admin_session: "tok" },
      headers: {},
    };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload });
      },
    };
    router.handle(req, res, (err) =>
      err ? reject(err) : resolve({ status: 404, body: null })
    );
  });
}

function makeRun(overrides = {}) {
  return {
    status: "SUCCESS",
    recordsSynced: 5,
    skippedUnmapped: 0,
    skippedNotApproved: 0,
    skippedInvalid: 0,
    error: null,
    startedAt: new Date("2026-07-28T01:30:00.000Z"),
    completedAt: new Date("2026-07-28T01:30:12.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.sessions.findUnique.mockResolvedValue({
    users: { id: "u1", slackUserId: "U1" },
    expires_at: new Date(Date.now() + 3_600_000),
  });
  // Not a super admin — an org ADMIN, which is the tier this page targets.
  prisma.super_admins.findUnique.mockResolvedValue(null);
  prisma.organizationMember.findFirst.mockResolvedValue({
    id: "m1",
    role: "ADMIN",
  });
  prisma.zohoCredential.findUnique.mockResolvedValue({
    enabled: true,
    dataCenter: "com",
  });
  prisma.zohoSyncRun.findFirst.mockResolvedValue(makeRun());
  zohoMappingService.listMappings.mockResolvedValue([]);
  // Default: the mapping target is a known, active member of the org.
  prisma.user.findUnique.mockResolvedValue({ id: "user-9", slackUserId: "U9" });
  prisma.organizationMember.findUnique.mockResolvedValue({
    id: "om-1",
    isActive: true,
  });
});

describe("GET /zoho", () => {
  it("is reachable by an org admin who is not a super admin", async () => {
    const { status, body } = await callRoute("GET", `/zoho?orgId=${ORG_ID}`);

    expect(status).toBe(200);
    expect(body.credential).toEqual({ enabled: true, dataCenter: "com" });
  });

  it("never returns the refresh or access token", async () => {
    await callRoute("GET", `/zoho?orgId=${ORG_ID}`);

    const select = prisma.zohoCredential.findUnique.mock.calls[0][0].select;
    expect(select.refreshToken).toBeUndefined();
    expect(select.accessToken).toBeUndefined();
    expect(select).toEqual({ enabled: true, dataCenter: true });
  });

  it("queries the latest run per sync type separately", async () => {
    await callRoute("GET", `/zoho?orgId=${ORG_ID}`);

    const types = prisma.zohoSyncRun.findFirst.mock.calls.map(
      (c) => c[0].where.syncType
    );
    expect(types).toEqual(["HOLIDAY", "LEAVE"]);
  });

  it("flags a run that synced nothing because every employee was unmapped", async () => {
    prisma.zohoSyncRun.findFirst.mockResolvedValue(
      makeRun({ recordsSynced: 0, skippedUnmapped: 4 })
    );

    const { body } = await callRoute("GET", `/zoho?orgId=${ORG_ID}`);

    expect(body.runs.LEAVE.warning).toMatch(/unmapped employee/);
  });

  it("flags a run where no record could be read", async () => {
    prisma.zohoSyncRun.findFirst.mockResolvedValue(
      makeRun({ recordsSynced: 0, skippedInvalid: 9 })
    );

    const { body } = await callRoute("GET", `/zoho?orgId=${ORG_ID}`);

    expect(body.runs.HOLIDAY.warning).toMatch(/field names likely differ/);
  });

  it("does not warn on a healthy run", async () => {
    const { body } = await callRoute("GET", `/zoho?orgId=${ORG_ID}`);

    expect(body.runs.HOLIDAY.warning).toBeNull();
  });

  it("never leaks the raw error message of a failed run", async () => {
    prisma.zohoSyncRun.findFirst.mockResolvedValue(
      makeRun({ status: "FAILED", error: "connect ECONNREFUSED 10.0.0.5:5432" })
    );

    const { body } = await callRoute("GET", `/zoho?orgId=${ORG_ID}`);

    expect(body.runs.HOLIDAY.failed).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED/);
  });

  it("reports a missing credential as null rather than failing", async () => {
    prisma.zohoCredential.findUnique.mockResolvedValue(null);

    const { status, body } = await callRoute("GET", `/zoho?orgId=${ORG_ID}`);

    expect(status).toBe(200);
    expect(body.credential).toBeNull();
  });

  it("returns 403 for an org the caller does not administer", async () => {
    prisma.organizationMember.findFirst.mockResolvedValue(null);

    const { status } = await callRoute("GET", "/zoho?orgId=other-org");

    expect(status).toBe(403);
  });
});

describe("POST /zoho/mappings", () => {
  it("maps a member and passes the admin Slack client through", async () => {
    zohoMappingService.mapMember.mockResolvedValue({
      id: "map-1",
      zohoEmployeeId: "ZP-1",
    });

    const { status, body } = await callRoute("POST", "/zoho/mappings", {
      orgId: ORG_ID,
      slackUserId: "  U9  ",
      zohoEmployeeId: "  ZP-1  ",
    });

    expect(status).toBe(200);
    expect(body).toEqual({ id: "map-1", zohoEmployeeId: "ZP-1" });
    // Trimmed, and the employee ID stays a string — Zoho IDs overflow Number.
    const [orgId, slackUserId, employeeId, client] =
      zohoMappingService.mapMember.mock.calls[0];
    expect([orgId, slackUserId, employeeId]).toEqual([ORG_ID, "U9", "ZP-1"]);
    expect(client).toBeTruthy();
  });

  it("surfaces a UserFacingError as a 400 with its message", async () => {
    zohoMappingService.mapMember.mockRejectedValue(
      new UserFacingError("Zoho employee ID ZP-1 is already mapped")
    );

    const { status, body } = await callRoute("POST", "/zoho/mappings", {
      orgId: ORG_ID,
      slackUserId: "U9",
      zohoEmployeeId: "ZP-1",
    });

    expect(status).toBe(400);
    expect(body).toEqual({ error: "Zoho employee ID ZP-1 is already mapped" });
  });

  it("hides an unexpected error behind a 500", async () => {
    zohoMappingService.mapMember.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.5:5432")
    );

    const { status, body } = await callRoute("POST", "/zoho/mappings", {
      orgId: ORG_ID,
      slackUserId: "U9",
      zohoEmployeeId: "ZP-1",
    });

    expect(status).toBe(500);
    expect(body).toEqual({ error: "Internal server error" });
  });

  it("rejects a missing Slack user before touching the service", async () => {
    const { status } = await callRoute("POST", "/zoho/mappings", {
      orgId: ORG_ID,
      zohoEmployeeId: "ZP-1",
    });

    expect(status).toBe(400);
    expect(zohoMappingService.mapMember).not.toHaveBeenCalled();
  });

  // mapMember() → userService.findOrCreateUser() *creates* a User for an
  // unknown Slack ID, and a failed users.info lookup is swallowed — so without
  // this guard a typo in the form would silently mint an empty orphan User.
  it("refuses an unknown Slack user instead of creating one", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const { status, body } = await callRoute("POST", "/zoho/mappings", {
      orgId: ORG_ID,
      slackUserId: "U-typo",
      zohoEmployeeId: "ZP-1",
    });

    expect(status).toBe(404);
    expect(body.error).toMatch(/must sign in to the bot first/);
    expect(zohoMappingService.mapMember).not.toHaveBeenCalled();
  });

  it("refuses a user who is not a member of the target org", async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(null);

    const { status, body } = await callRoute("POST", "/zoho/mappings", {
      orgId: ORG_ID,
      slackUserId: "U9",
      zohoEmployeeId: "ZP-1",
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/not an active member/);
    expect(zohoMappingService.mapMember).not.toHaveBeenCalled();
  });

  it("refuses a member whose org membership is inactive", async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({
      id: "om-1",
      isActive: false,
    });

    const { status } = await callRoute("POST", "/zoho/mappings", {
      orgId: ORG_ID,
      slackUserId: "U9",
      zohoEmployeeId: "ZP-1",
    });

    expect(status).toBe(400);
    expect(zohoMappingService.mapMember).not.toHaveBeenCalled();
  });
});

describe("DELETE /zoho/mappings/:id", () => {
  it("authorizes against the mapping's own org, not a caller-supplied one", async () => {
    prisma.zohoUserMapping.findUnique.mockResolvedValue({
      id: "map-1",
      organizationId: "org-owned-by-someone-else",
    });
    prisma.organizationMember.findFirst.mockResolvedValue(null);

    const { status } = await callRoute("DELETE", "/zoho/mappings/map-1");

    expect(status).toBe(403);
    expect(prisma.zohoUserMapping.delete).not.toHaveBeenCalled();
  });

  it("removes a mapping the caller administers, by primary key", async () => {
    prisma.zohoUserMapping.findUnique.mockResolvedValue({
      id: "map-1",
      organizationId: ORG_ID,
    });

    const { status } = await callRoute("DELETE", "/zoho/mappings/map-1");

    expect(status).toBe(200);
    expect(prisma.zohoUserMapping.delete).toHaveBeenCalledWith({
      where: { id: "map-1" },
    });
    // The row is already fetched and authorized — no service round trip.
    expect(zohoMappingService.unmapMember).not.toHaveBeenCalled();
  });

  it("404s on an unknown mapping", async () => {
    prisma.zohoUserMapping.findUnique.mockResolvedValue(null);

    const { status } = await callRoute("DELETE", "/zoho/mappings/nope");

    expect(status).toBe(404);
  });
});

describe("POST /zoho/sync", () => {
  beforeEach(() => {
    zohoSyncService.syncHolidaysForOrganization.mockResolvedValue({
      recordsSynced: 14,
    });
    zohoSyncService.syncLeavesForOrganization.mockResolvedValue({
      recordsSynced: 3,
      skippedUnmapped: 2,
    });
  });

  it("runs both syncs and returns their counts", async () => {
    const { status, body } = await callRoute("POST", "/zoho/sync", {
      orgId: ORG_ID,
      type: "ALL",
    });

    expect(status).toBe(200);
    expect(body.HOLIDAY.recordsSynced).toBe(14);
    expect(body.LEAVE.recordsSynced).toBe(3);
  });

  it("runs only the requested type", async () => {
    await callRoute("POST", "/zoho/sync", { orgId: ORG_ID, type: "HOLIDAY" });

    expect(zohoSyncService.syncHolidaysForOrganization).toHaveBeenCalledTimes(
      1
    );
    expect(zohoSyncService.syncLeavesForOrganization).not.toHaveBeenCalled();
  });

  it("rejects an unknown sync type", async () => {
    const { status } = await callRoute("POST", "/zoho/sync", {
      orgId: ORG_ID,
      type: "EVERYTHING",
    });

    expect(status).toBe(400);
    expect(zohoSyncService.syncHolidaysForOrganization).not.toHaveBeenCalled();
  });

  // The whole point of catching per type: a holiday failure must not erase a
  // leave sync that already landed, the way syncAllOrganizations handles it.
  it("keeps a successful sync's counts when the other type fails", async () => {
    const err = new Error("Zoho rejected the request as unauthorized");
    err.name = "ZohoApiError";
    zohoSyncService.syncLeavesForOrganization.mockRejectedValue(err);

    const { status, body } = await callRoute("POST", "/zoho/sync", {
      orgId: ORG_ID,
      type: "ALL",
    });

    expect(status).toBe(200);
    expect(body.HOLIDAY.recordsSynced).toBe(14);
    expect(body.LEAVE).toBeUndefined();
    expect(body.errors).toEqual({
      LEAVE: expect.stringMatching(/unauthorized/),
    });
  });

  it("reports no errors on a fully successful run", async () => {
    const { body } = await callRoute("POST", "/zoho/sync", { orgId: ORG_ID });

    expect(body.errors).toEqual({});
  });

  it("passes a Zoho auth failure through as actionable 400 when nothing synced", async () => {
    const err = new Error("Zoho integration is disabled for organization x");
    err.name = "ZohoAuthError";
    zohoSyncService.syncHolidaysForOrganization.mockRejectedValue(err);
    zohoSyncService.syncLeavesForOrganization.mockRejectedValue(err);

    const { status, body } = await callRoute("POST", "/zoho/sync", {
      orgId: ORG_ID,
    });

    expect(status).toBe(400);
    expect(body.error).toMatch(/disabled for organization/);
    expect(Object.keys(body.errors)).toEqual(["HOLIDAY", "LEAVE"]);
  });

  it("hides an unexpected failure behind a 500 when nothing synced", async () => {
    const boom = new Error("connect ECONNREFUSED 10.0.0.5:5432");
    zohoSyncService.syncHolidaysForOrganization.mockRejectedValue(boom);
    zohoSyncService.syncLeavesForOrganization.mockRejectedValue(boom);

    const { status, body } = await callRoute("POST", "/zoho/sync", {
      orgId: ORG_ID,
    });

    expect(status).toBe(500);
    expect(body.error).not.toMatch(/ECONNREFUSED/);
  });

  it("returns 403 for an org the caller does not administer", async () => {
    prisma.organizationMember.findFirst.mockResolvedValue(null);

    const { status } = await callRoute("POST", "/zoho/sync", {
      orgId: "other-org",
    });

    expect(status).toBe(403);
    expect(zohoSyncService.syncHolidaysForOrganization).not.toHaveBeenCalled();
  });
});
