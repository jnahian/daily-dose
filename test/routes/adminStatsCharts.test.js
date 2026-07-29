// Drives GET /api/admin/stats/charts through the real router, same harness as
// test/routes/adminHolidayImport.test.js.

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
  teamMember: { count: jest.fn() },
  $queryRaw: jest.fn(),
}));

const prisma = require("../../src/config/prisma");
const { router } = require("../../src/routes/admin");

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => console.error.mockRestore());

const ORG_ID = "org-1";

function callRoute(url) {
  return new Promise((resolve, reject) => {
    const req = {
      method: "GET",
      url,
      // req.query is populated by the Express app, not router.handle().
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

const day = (iso) => new Date(`${iso}T00:00:00.000Z`);

beforeEach(() => {
  jest.clearAllMocks();
  prisma.sessions.findUnique.mockResolvedValue({
    users: { id: "u1", slackUserId: "U1" },
    expires_at: new Date(Date.now() + 3_600_000),
  });
  prisma.super_admins.findUnique.mockResolvedValue(null);
  prisma.organizationMember.findFirst.mockResolvedValue({
    id: "m1",
    role: "ADMIN",
  });
  prisma.teamMember.count.mockResolvedValue(8);
  // The three raw queries resolve in the order they're passed to Promise.all:
  // daily, byTeam, activity.
  prisma.$queryRaw
    .mockResolvedValueOnce([
      { day: day("2026-07-27"), submitted: 6, late: 1 },
      { day: day("2026-07-28"), submitted: 8, late: 3 },
    ])
    .mockResolvedValueOnce([
      { team: "Engineering", submitted: 10, late: 3 },
      { team: "Design", submitted: 4, late: 1 },
    ])
    .mockResolvedValueOnce([
      { member: "alice", day: day("2026-07-27"), late: false },
      { member: "alice", day: day("2026-07-28"), late: true },
    ]);
});

describe("GET /stats/charts", () => {
  it("is reachable by an org admin and returns all four series", async () => {
    const { status, body } = await callRoute(`/stats/charts?orgId=${ORG_ID}`);

    expect(status).toBe(200);
    expect(body.activeMembers).toBe(8);
    expect(body.daily).toHaveLength(2);
    expect(body.byTeam).toHaveLength(2);
    expect(body.activity).toHaveLength(2);
  });

  // Dates come back as @db.Date values; formatting them in local time would
  // shift the day for any server west of UTC.
  it("serializes days as UTC calendar dates", async () => {
    const { body } = await callRoute(`/stats/charts?orgId=${ORG_ID}`);

    expect(body.daily.map((d) => d.day)).toEqual(["2026-07-27", "2026-07-28"]);
    expect(body.activity[0].day).toBe("2026-07-27");
  });

  it("derives onTime per team so the client never subtracts", async () => {
    const { body } = await callRoute(`/stats/charts?orgId=${ORG_ID}`);

    expect(body.byTeam[0]).toEqual({
      team: "Engineering",
      submitted: 10,
      late: 3,
      onTime: 7,
    });
  });

  it("clamps the window to 7–90 days", async () => {
    const wide = await callRoute(`/stats/charts?orgId=${ORG_ID}&days=999`);
    expect(wide.body.days).toBe(90);

    // mockReset, not clearAllMocks — the latter leaves the beforeEach
    // mockResolvedValueOnce queue in place and it would win over the fallback.
    prisma.$queryRaw.mockReset().mockResolvedValue([]);
    prisma.teamMember.count.mockResolvedValue(0);

    const narrow = await callRoute(`/stats/charts?orgId=${ORG_ID}&days=1`);
    expect(narrow.body.days).toBe(7);
  });

  // The `since` bound is the only thing that decides how much history the
  // charts cover, and it never reaches the response body — so it has to be
  // read off the query call. Subtracting the full window instead of window - 1
  // returns 31 days behind a control that says "Last 30 days".
  it("spans exactly `days` calendar days, today included", async () => {
    // A fixed past instant: mid-afternoon, so the UTC-midnight floor is doing
    // real work, and earlier than the session expiry set in beforeEach.
    jest.useFakeTimers().setSystemTime(new Date("2026-05-20T14:30:00.000Z"));
    try {
      await callRoute(`/stats/charts?orgId=${ORG_ID}&days=30`);

      // $queryRaw is tagged: (strings, orgId, since). `daily` runs first.
      const since = prisma.$queryRaw.mock.calls[0][2];
      // 30 days ending 20 May starts on 21 Apr, floored to UTC midnight.
      expect(since.toISOString()).toBe("2026-04-21T00:00:00.000Z");

      // Every series must share the window, or the charts disagree with each other.
      for (const call of prisma.$queryRaw.mock.calls) {
        expect(call[2].toISOString()).toBe("2026-04-21T00:00:00.000Z");
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it("returns empty series rather than failing when there is no activity", async () => {
    prisma.$queryRaw.mockReset().mockResolvedValue([]);
    prisma.teamMember.count.mockResolvedValue(0);

    const { status, body } = await callRoute(`/stats/charts?orgId=${ORG_ID}`);

    expect(status).toBe(200);
    expect(body).toMatchObject({
      activeMembers: 0,
      daily: [],
      byTeam: [],
      activity: [],
    });
  });

  it("returns 403 for an org the caller does not administer", async () => {
    prisma.organizationMember.findFirst.mockResolvedValue(null);

    const { status } = await callRoute("/stats/charts?orgId=other-org");

    expect(status).toBe(403);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns 400 without an orgId", async () => {
    const { status } = await callRoute("/stats/charts");

    expect(status).toBe(400);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
