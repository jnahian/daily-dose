// Drives POST /api/admin/holidays/import through the real router (no HTTP
// server, no supertest) so auth, normalization, the upsert transaction and the
// created/updated counting are all covered together.

jest.mock("@slack/web-api", () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    conversations: { list: jest.fn() },
    oauth: { v2: { access: jest.fn() } },
    users: { identity: jest.fn() },
  })),
}));

jest.mock("../../src/config/prisma", () => ({
  sessions: { findUnique: jest.fn() },
  super_admins: { findUnique: jest.fn() },
  organizationMember: { findFirst: jest.fn() },
  holiday: { findMany: jest.fn(), upsert: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../../src/config/prisma");
const { router } = require("../../src/routes/admin");

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => console.error.mockRestore());

const ORG_ID = "org-1";

// Invokes the router directly and resolves with { status, body }.
function callRoute(body) {
  return new Promise((resolve, reject) => {
    const req = {
      method: "POST",
      url: "/holidays/import",
      body,
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

beforeEach(() => {
  jest.clearAllMocks();
  prisma.sessions.findUnique.mockResolvedValue({
    users: { id: "u1", slackUserId: "U1" },
    expires_at: new Date(Date.now() + 3_600_000),
  });
  prisma.super_admins.findUnique.mockResolvedValue({
    user_id: "u1",
    revoked_at: null,
  });
  prisma.holiday.findMany.mockResolvedValue([]);
  prisma.$transaction.mockResolvedValue([]);
});

describe("POST /holidays/import", () => {
  it("writes the exact UTC day that was previewed", async () => {
    const { status } = await callRoute({
      orgId: ORG_ID,
      items: [{ date: "2026-03-19", name: "Eid", description: null }],
    });

    expect(status).toBe(200);
    // The upsert key must be UTC midnight of the previewed day — local
    // midnight would land on 2026-03-18 or -20 depending on host TZ and
    // overwrite the neighbouring holiday.
    expect(prisma.holiday.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organization_id_date: {
            organization_id: ORG_ID,
            date: new Date("2026-03-19T00:00:00.000Z"),
          },
        },
      })
    );
  });

  it("counts created vs updated against existing rows", async () => {
    prisma.holiday.findMany.mockResolvedValue([
      { date: new Date("2026-03-19T00:00:00.000Z") },
    ]);

    const { body } = await callRoute({
      orgId: ORG_ID,
      items: [
        { date: "2026-03-19", name: "Eid" },
        { date: "2026-03-20", name: "Eid" },
        { date: "not-a-date", name: "Bad" },
      ],
    });

    expect(body).toEqual({ created: 1, updated: 1, skipped: 1, total: 2 });
  });

  it("tags imported rows MANUAL and clears any Zoho externalId", async () => {
    await callRoute({
      orgId: ORG_ID,
      items: [{ date: "2026-03-19", name: "Eid" }],
    });

    const call = prisma.holiday.upsert.mock.calls[0][0];
    expect(call.update).toMatchObject({ source: "MANUAL", externalId: null });
    expect(call.create).toMatchObject({ source: "MANUAL" });
  });

  it("issues one transaction rather than a query per row", async () => {
    await callRoute({
      orgId: ORG_ID,
      items: [
        { date: "2026-03-19", name: "A" },
        { date: "2026-03-20", name: "B" },
        { date: "2026-03-21", name: "C" },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(3);
    expect(prisma.holiday.findMany).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when no item survives normalization", async () => {
    const { status, body } = await callRoute({
      orgId: ORG_ID,
      items: [{ date: "19-Mar-2026", name: "Bad date" }],
    });

    expect(status).toBe(400);
    expect(body).toEqual({ error: "No valid holidays to import" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 403 for an org admin who is not a super admin", async () => {
    prisma.super_admins.findUnique.mockResolvedValue(null);

    const { status, body } = await callRoute({
      orgId: ORG_ID,
      items: [{ date: "2026-03-19", name: "Eid" }],
    });

    expect(status).toBe(403);
    expect(body).toEqual({ error: "Forbidden" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    prisma.sessions.findUnique.mockResolvedValue(null);

    const { status } = await callRoute({
      orgId: ORG_ID,
      items: [{ date: "2026-03-19", name: "Eid" }],
    });

    expect(status).toBe(401);
  });
});
