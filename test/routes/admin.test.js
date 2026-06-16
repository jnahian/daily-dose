// Mock @slack/web-api before the module is loaded so that
// `new WebClient(process.env.BOT_TOKEN)` at the top of admin.js does not throw.
jest.mock("@slack/web-api", () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    conversations: { list: jest.fn() },
    oauth: { v2: { access: jest.fn() } },
    users: { identity: jest.fn() },
  })),
}));

// Mock Prisma with all tables used by admin.js
jest.mock("../../src/config/prisma", () => ({
  sessions: { findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  super_admins: { findUnique: jest.fn(), findFirst: jest.fn() },
  organizationMember: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  team: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  teamMember: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    groupBy: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  user: { findUnique: jest.fn(), count: jest.fn() },
  holiday: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  standupResponse: { findMany: jest.fn(), count: jest.fn() },
  standupPost: { findMany: jest.fn() },
}));

const prisma = require("../../src/config/prisma");
const { requireAuth, requireSuperAdmin } = require("../../src/routes/admin");

// Silence console.error so expected-error paths don't spam test output
beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => console.error.mockRestore());

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  // Make status() chainable: res.status(401).json(...)
  res.status.mockReturnValue(res);
  return res;
}

function makeReq(cookieOverrides = {}) {
  return { cookies: { ...cookieOverrides } };
}

// ─── requireAuth ────────────────────────────────────────────────────────────

describe("requireAuth", () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = makeRes();
    next = jest.fn();
  });

  it("returns 401 and does not call next when no admin_session cookie is present", async () => {
    const req = makeReq(); // no admin_session key
    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when cookie is present but prisma returns null (session not found)", async () => {
    const req = makeReq({ admin_session: "tok_abc" });
    prisma.sessions.findUnique.mockResolvedValue(null);

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Session expired" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when session has no users (session.users is null)", async () => {
    const req = makeReq({ admin_session: "tok_abc" });
    prisma.sessions.findUnique.mockResolvedValue({
      token: "tok_abc",
      users: null,
      expires_at: new Date(Date.now() + 60_000),
    });

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Session expired" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the session is expired (expires_at <= now)", async () => {
    const req = makeReq({ admin_session: "tok_expired" });
    prisma.sessions.findUnique.mockResolvedValue({
      token: "tok_expired",
      users: { id: "u1", slackUserId: "U001" },
      // Set exactly now — still considered expired because condition is `<= new Date()`
      expires_at: new Date(Date.now() - 1),
    });

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Session expired" });
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.adminUser and calls next() when session is valid and not expired", async () => {
    const user = { id: "u1", slackUserId: "U001", username: "alice" };
    const req = makeReq({ admin_session: "tok_valid" });
    prisma.sessions.findUnique.mockResolvedValue({
      token: "tok_valid",
      users: user,
      expires_at: new Date(Date.now() + 3_600_000), // 1 hour from now
    });

    await requireAuth(req, res, next);

    expect(req.adminUser).toBe(user);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls prisma with the token from the cookie", async () => {
    const req = makeReq({ admin_session: "tok_specific" });
    prisma.sessions.findUnique.mockResolvedValue(null);

    await requireAuth(req, res, next);

    expect(prisma.sessions.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: "tok_specific" } })
    );
  });

  it("returns 500 when prisma throws an unexpected error", async () => {
    const req = makeReq({ admin_session: "tok_boom" });
    prisma.sessions.findUnique.mockRejectedValue(
      new Error("DB connection lost")
    );

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── requireSuperAdmin ───────────────────────────────────────────────────────

describe("requireSuperAdmin", () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = makeRes();
    next = jest.fn();
  });

  // Helper: build a req that has already passed requireAuth
  function makeAuthedReq(userId = "u1") {
    return { adminUser: { id: userId } };
  }

  it("sets req.isSuperAdmin = true and calls next() when an active super_admin row exists", async () => {
    const req = makeAuthedReq();
    prisma.super_admins.findUnique.mockResolvedValue({
      user_id: "u1",
      revoked_at: null,
    });

    await requireSuperAdmin(req, res, next);

    expect(req.isSuperAdmin).toBe(true);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 when super_admin row is not found", async () => {
    const req = makeAuthedReq();
    prisma.super_admins.findUnique.mockResolvedValue(null);

    await requireSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when the super_admin row has a revoked_at timestamp (revoked access)", async () => {
    const req = makeAuthedReq();
    prisma.super_admins.findUnique.mockResolvedValue({
      user_id: "u1",
      revoked_at: new Date("2024-01-01"),
    });

    await requireSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  it("does not set req.isSuperAdmin when access is denied", async () => {
    const req = makeAuthedReq();
    prisma.super_admins.findUnique.mockResolvedValue(null);

    await requireSuperAdmin(req, res, next);

    expect(req.isSuperAdmin).toBeUndefined();
  });

  it("returns 500 when prisma throws an unexpected error", async () => {
    const req = makeAuthedReq();
    prisma.super_admins.findUnique.mockRejectedValue(
      new Error("Unexpected DB error")
    );

    await requireSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    expect(next).not.toHaveBeenCalled();
  });

  it("queries prisma using the user id from req.adminUser", async () => {
    const req = makeAuthedReq("user-xyz");
    prisma.super_admins.findUnique.mockResolvedValue(null);

    await requireSuperAdmin(req, res, next);

    expect(prisma.super_admins.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: "user-xyz" } })
    );
  });
});
