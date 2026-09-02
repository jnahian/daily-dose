// The AS's Slack callbacks. Slack matches redirect_uri at token exchange, so
// each path must complete the flow with the URI that flow began with.

jest.mock("../../../src/mcp/auth/oauthProvider", () => ({
  provider: { verifyAccessToken: jest.fn() },
}));
jest.mock("../../../src/services/mcpTokenService", () => ({
  validateToken: jest.fn(),
}));
jest.mock("../../../src/mcp/auth/slackAuthBridge", () => ({
  completeAuthorization: jest.fn(),
}));

const {
  completeAuthorization,
} = require("../../../src/mcp/auth/slackAuthBridge");
const {
  handleSlackCallback,
  handleLegacySlackCallback,
} = require("../../../src/mcp/auth");

const APP_URL = "https://dd.test";

beforeAll(() => {
  process.env.APP_URL = APP_URL;
  jest.spyOn(console, "error").mockImplementation(() => {});
});
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

describe("AS Slack callback redirect_uri matching", () => {
  it("completes the canonical /mcp/oauth/cb flow with the new URI", async () => {
    completeAuthorization.mockResolvedValue("https://claude.ai/cb?code=1");
    const res = mockRes();
    await handleSlackCallback({ query: { code: "c", state: "s" } }, res);

    expect(completeAuthorization).toHaveBeenCalledWith({
      slackState: "s",
      slackCode: "c",
      redirectUri: `${APP_URL}/mcp/oauth/cb`,
    });
    expect(res.redirectedTo).toBe("https://claude.ai/cb?code=1");
  });

  it("completes a legacy-path flow with the URI that flow began with", async () => {
    completeAuthorization.mockResolvedValue("https://claude.ai/cb?code=2");
    await handleLegacySlackCallback(
      { query: { code: "c", state: "s" } },
      mockRes()
    );

    expect(completeAuthorization).toHaveBeenCalledWith({
      slackState: "s",
      slackCode: "c",
      redirectUri: `${APP_URL}/api/mcp/oauth/slack/callback`,
    });
  });

  it("sends the browser to the token page when Slack returns no code", async () => {
    const res = mockRes();
    await handleSlackCallback({ query: { state: "s" } }, res);
    expect(completeAuthorization).not.toHaveBeenCalled();
    expect(res.redirectedTo).toBe(`${APP_URL}/mcp-tokens?error=invalid_state`);
  });
});
