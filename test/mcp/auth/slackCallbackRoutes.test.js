// The AS's Slack callback. The MCP client is waiting on its own redirect_uri,
// so a cancel or a failed exchange must be reported there, not to the token
// page — otherwise the client hangs on its local callback until it times out.

jest.mock("../../../src/mcp/auth/oauthProvider", () => ({
  provider: { verifyAccessToken: jest.fn() },
}));
jest.mock("../../../src/services/mcpTokenService", () => ({
  validateToken: jest.fn(),
}));
jest.mock("../../../src/mcp/auth/slackAuthBridge", () => ({
  completeAuthorization: jest.fn(),
  abortAuthorization: jest.fn(),
}));
jest.mock("../../../src/utils/slackIdentity", () => ({
  appBaseUrl: () => "https://dd.test",
}));

const {
  completeAuthorization,
  abortAuthorization,
} = require("../../../src/mcp/auth/slackAuthBridge");
const { handleSlackCallback } = require("../../../src/mcp/auth");

const TOKEN_PAGE = "https://dd.test/mcp-tokens";

beforeAll(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => console.error.mockRestore());
beforeEach(() => jest.clearAllMocks());

/** @returns {{redirectedTo: string|null, redirect: Function}} A minimal res double. */
function mockRes() {
  return {
    redirectedTo: null,
    redirect(url) {
      this.redirectedTo = url;
      return this;
    },
  };
}

async function call(query) {
  const res = mockRes();
  await handleSlackCallback({ query }, res);
  return res.redirectedTo;
}

describe("AS Slack callback", () => {
  it("completes the flow and sends the browser to the client", async () => {
    completeAuthorization.mockResolvedValue("https://claude.ai/cb?code=1");
    expect(await call({ code: "c", state: "s" })).toBe(
      "https://claude.ai/cb?code=1"
    );
    expect(completeAuthorization).toHaveBeenCalledWith({
      slackState: "s",
      slackCode: "c",
    });
  });

  it("reports a cancel at Slack to the waiting client", async () => {
    abortAuthorization.mockResolvedValue(
      "https://claude.ai/cb?error=access_denied"
    );
    expect(await call({ error: "access_denied", state: "s" })).toBe(
      "https://claude.ai/cb?error=access_denied"
    );
    expect(abortAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ slackState: "s", error: "access_denied" })
    );
    expect(completeAuthorization).not.toHaveBeenCalled();
  });

  it("reports a failed exchange to the waiting client", async () => {
    completeAuthorization.mockRejectedValue(new Error("bad_redirect_uri"));
    abortAuthorization.mockResolvedValue(
      "https://claude.ai/cb?error=server_error"
    );
    expect(await call({ code: "c", state: "s" })).toBe(
      "https://claude.ai/cb?error=server_error"
    );
    expect(abortAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ slackState: "s", error: "server_error" })
    );
  });

  it("falls back to the token page when the state is unknown", async () => {
    abortAuthorization.mockResolvedValue(null);
    expect(await call({ state: "s" })).toBe(
      `${TOKEN_PAGE}?error=invalid_state`
    );

    completeAuthorization.mockRejectedValue(new Error("unknown"));
    expect(await call({ code: "c", state: "s" })).toBe(
      `${TOKEN_PAGE}?error=oauth_failed`
    );
  });

  it("falls back to the token page when there is no state at all", async () => {
    expect(await call({ code: "c" })).toBe(`${TOKEN_PAGE}?error=invalid_state`);
    expect(abortAuthorization).not.toHaveBeenCalled();
    expect(completeAuthorization).not.toHaveBeenCalled();
  });
});
