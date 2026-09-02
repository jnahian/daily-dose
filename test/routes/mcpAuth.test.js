// Drives the MCP auth routes through the real router, same harness as
// test/routes/adminStatsCharts.test.js.

jest.mock("../../src/config/prisma", () => ({
  sessions: { findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
}));

jest.mock("../../src/utils/slackIdentity", () => ({
  resolveSlackUserFromCode: jest.fn(),
  slackAuthorizeUrl: ({ redirectUri, state }) =>
    `https://slack.com/oauth/v2/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
  appBaseUrl: () => "https://dd.test",
  mcpRedirectUri: () => "https://dd.test/mcp/cb",
}));

const prisma = require("../../src/config/prisma");
const { resolveSlackUserFromCode } = require("../../src/utils/slackIdentity");
const {
  router,
  startSlackOAuth,
  handleTokenPageCallback,
} = require("../../src/routes/mcpAuth");

const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => console.error.mockRestore());
beforeEach(() => jest.clearAllMocks());

/**
 * Minimal Express `res` double: records the redirect target, JSON body and
 * cookies. `onFinish` fires when the handler responds, for router-driven calls.
 * @param {(res: object) => void} [onFinish]
 * @returns {object} The res double.
 */
function mockRes(onFinish = () => {}) {
  return {
    cookies: {},
    cleared: [],
    redirectedTo: null,
    body: null,
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    cookie(name, value, options) {
      this.cookies[name] = { value, options };
      return this;
    },
    clearCookie(name) {
      this.cleared.push(name);
      return this;
    },
    json(body) {
      this.body = body;
      onFinish(this);
    },
    redirect(url) {
      this.redirectedTo = url;
      onFinish(this);
    },
  };
}

function mockReq(query = {}, extra = {}) {
  return { query, cookies: {}, headers: {}, ip: "1.2.3.4", ...extra };
}

/**
 * Drive one request through the real router and resolve with the res double
 * once the handler responds.
 * @param {string} url - Router-relative URL, query string included.
 * @param {{method?: string, cookies?: object}} [opts]
 * @returns {Promise<object>} Resolves with the res double.
 */
function callRoute(url, { method = "GET", cookies = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = mockReq(
      Object.fromEntries(new URLSearchParams(url.split("?")[1] || "")),
      { method, url, cookies }
    );
    router.handle(req, mockRes(resolve), (err) =>
      reject(err || new Error(`unhandled route: ${url}`))
    );
  });
}

/**
 * Prime a valid one-shot OAuth `state` by walking the sign-in link's own path.
 * @returns {string} The state Slack would echo back.
 */
function primeState() {
  const res = mockRes();
  startSlackOAuth(mockReq(), res);
  return new URL(res.redirectedTo).searchParams.get("state");
}

describe("MCP sign-in entry point", () => {
  it("sends the browser to Slack from startSlackOAuth", () => {
    const res = mockRes();
    startSlackOAuth(mockReq(), res);
    expect(res.redirectedTo).toContain("https://slack.com/oauth/v2/authorize");
    expect(res.redirectedTo).toContain(
      encodeURIComponent("https://dd.test/mcp/cb")
    );
  });

  it("keeps the legacy /auth/slack path working as a redirect", async () => {
    const res = await callRoute("/auth/slack");
    expect(res.redirectedTo).toBe("/mcp/login");
  });
});

describe("token-page callback", () => {
  beforeEach(() => {
    resolveSlackUserFromCode.mockResolvedValue({ user: { id: "user-1" } });
    prisma.sessions.create.mockResolvedValue({});
  });

  it("issues a 30-day session and exchanges the code with /mcp/cb", async () => {
    const state = primeState();
    const res = mockRes();

    const before = Date.now();
    await handleTokenPageCallback(mockReq({ code: "abc", state }), res);
    const after = Date.now();

    expect(resolveSlackUserFromCode).toHaveBeenCalledWith(
      "abc",
      "https://dd.test/mcp/cb"
    );
    const { expires_at: expiresAt } =
      prisma.sessions.create.mock.calls[0][0].data;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY_MS);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 30 * DAY_MS);
    expect(res.cookies.mcp_session.options.maxAge).toBe(30 * DAY_MS);
    expect(res.redirectedTo).toBe("https://dd.test/mcp-tokens");
  });

  it("rejects a state it did not issue", async () => {
    const res = mockRes();
    await handleTokenPageCallback(mockReq({ code: "abc", state: "nope" }), res);
    expect(resolveSlackUserFromCode).not.toHaveBeenCalled();
    expect(res.redirectedTo).toBe(
      "https://dd.test/mcp-tokens?error=invalid_state"
    );
  });

  it("drops expired states from the map on the next sign-in", async () => {
    const state = primeState();
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now + 6 * 60 * 1000);
    try {
      primeState();
      const res = mockRes();
      await handleTokenPageCallback(mockReq({ code: "abc", state }), res);
      expect(res.redirectedTo).toBe(
        "https://dd.test/mcp-tokens?error=invalid_state"
      );
    } finally {
      Date.now.mockRestore();
    }
  });

  it("sends the pre-1.19 callback path to the token page as an expired sign-in", async () => {
    const res = await callRoute("/auth/callback?code=xyz&state=old");
    expect(resolveSlackUserFromCode).not.toHaveBeenCalled();
    expect(res.redirectedTo).toBe(
      "https://dd.test/mcp-tokens?error=invalid_state"
    );
  });
});

describe("POST /auth/logout", () => {
  it("deletes the session row and clears the cookie", async () => {
    prisma.sessions.findUnique.mockResolvedValue({
      token: "sess",
      expires_at: new Date(Date.now() + DAY_MS),
      users: { id: "user-1" },
    });
    prisma.sessions.deleteMany.mockResolvedValue({ count: 1 });

    const res = await callRoute("/auth/logout", {
      method: "POST",
      cookies: { mcp_session: "sess" },
    });

    expect(prisma.sessions.deleteMany).toHaveBeenCalledWith({
      where: { token: "sess" },
    });
    expect(res.cleared).toEqual(["mcp_session"]);
    expect(res.body).toEqual({ ok: true });
  });

  it("requires a session", async () => {
    const res = await callRoute("/auth/logout", { method: "POST" });
    expect(res.statusCode).toBe(401);
    expect(prisma.sessions.deleteMany).not.toHaveBeenCalled();
  });
});
