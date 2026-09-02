// Drives the MCP auth routes through the real router, same harness as
// test/routes/adminStatsCharts.test.js.

jest.mock("../../src/config/prisma", () => ({
  sessions: { findUnique: jest.fn(), create: jest.fn() },
}));

jest.mock("../../src/utils/slackIdentity", () => ({
  resolveSlackUserFromCode: jest.fn(),
  mcpRedirectUri: () => "https://dd.test/api/mcp/auth/callback",
}));

const prisma = require("../../src/config/prisma");
const { resolveSlackUserFromCode } = require("../../src/utils/slackIdentity");
const { router, startSlackOAuth } = require("../../src/routes/mcpAuth");

const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => console.error.mockRestore());
beforeEach(() => jest.clearAllMocks());

/**
 * Minimal Express `res` double that captures the redirect target and any
 * cookie set, then hands itself to `done` once the handler redirects.
 * @param {(res: object) => void} done - Called with this res on redirect.
 * @returns {object} The res double.
 */
function makeRes(done) {
  return {
    cookies: {},
    redirectedTo: null,
    cookie(name, value, options) {
      this.cookies[name] = { value, options };
      return this;
    },
    redirect(url) {
      this.redirectedTo = url;
      done(this);
    },
  };
}

/**
 * Drive one GET through the real router and resolve with the res double once
 * the handler redirects.
 * @param {string} url - Router-relative URL, query string included.
 * @returns {Promise<object>} Resolves with the res double.
 */
function callRoute(url) {
  return new Promise((resolve, reject) => {
    const req = {
      method: "GET",
      url,
      query: Object.fromEntries(
        new URLSearchParams(url.split("?")[1] || "").entries()
      ),
      cookies: {},
      headers: {},
      ip: "1.2.3.4",
    };
    const res = makeRes(resolve);
    router.handle(req, res, (err) =>
      reject(err || new Error(`unhandled route: ${url}`))
    );
  });
}

describe("MCP sign-in entry point", () => {
  it("sends the browser to Slack from startSlackOAuth", () => {
    let res;
    const done = (r) => {
      res = r;
    };
    startSlackOAuth({ query: {} }, makeRes(done));
    expect(res.redirectedTo).toContain("https://slack.com/oauth/v2/authorize");
    expect(res.redirectedTo).toContain(
      encodeURIComponent("https://dd.test/api/mcp/auth/callback")
    );
  });

  it("keeps the legacy /auth/slack path working as a redirect", async () => {
    const res = await callRoute("/auth/slack");
    expect(res.redirectedTo).toBe("/mcp/login");
  });
});

describe("MCP session lifetime", () => {
  it("issues a 30-day session on a successful callback", async () => {
    const state = (() => {
      // Prime a valid state by walking the same path the sign-in link does.
      let captured;
      startSlackOAuth(
        { query: {} },
        makeRes((r) => {
          captured = new URL(r.redirectedTo).searchParams.get("state");
        })
      );
      return captured;
    })();

    resolveSlackUserFromCode.mockResolvedValue({ user: { id: "user-1" } });
    prisma.sessions.create.mockResolvedValue({});

    const before = Date.now();
    const res = await callRoute(`/auth/callback?code=abc&state=${state}`);
    const after = Date.now();

    const { expires_at: expiresAt } =
      prisma.sessions.create.mock.calls[0][0].data;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY_MS);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 30 * DAY_MS);
    expect(res.cookies.mcp_session.options.maxAge).toBe(30 * DAY_MS);
  });
});
