jest.mock("../../../src/config/prisma", () => ({
  oauth_auth_codes: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock("../../../src/utils/slackIdentity", () => ({
  resolveSlackUserFromCode: jest.fn(),
  slackAuthorizeUrl: jest.fn(() => "https://slack.com/oauth/v2/authorize?x=1"),
  mcpAsRedirectUri: jest.fn(() => "https://app.example/mcp/oauth/cb"),
}));

const prisma = require("../../../src/config/prisma");
const {
  resolveSlackUserFromCode,
} = require("../../../src/utils/slackIdentity");
const bridge = require("../../../src/mcp/auth/slackAuthBridge");
const { hashToken } = require("../../../src/mcp/auth/oauthTokenService");

describe("slackAuthBridge", () => {
  beforeEach(() => jest.clearAllMocks());

  it("beginAuthorization persists the in-flight code and returns a Slack URL", async () => {
    prisma.oauth_auth_codes.create.mockResolvedValue({});
    const url = await bridge.beginAuthorization({
      clientId: "c1",
      redirectUri: "https://claude.ai/cb",
      clientState: "xyz",
      codeChallenge: "chal",
      scope: "mcp",
      resource: "https://x/mcp",
    });
    expect(url).toMatch(/slack\.com/);
    const data = prisma.oauth_auth_codes.create.mock.calls[0][0].data;
    expect(data.client_id).toBe("c1");
    expect(data.redirect_uri).toBe("https://claude.ai/cb");
    expect(data.code_challenge).toBe("chal");
    expect(typeof data.slack_state).toBe("string");
  });

  it("completeAuthorization issues a code and returns the client redirect on success", async () => {
    prisma.oauth_auth_codes.findUnique.mockResolvedValue({
      id: "ac1",
      slack_state: "s1",
      redirect_uri: "https://claude.ai/cb",
      client_state: "xyz",
      expires_at: new Date(Date.now() + 100000),
      user_id: null,
    });
    prisma.oauth_auth_codes.update.mockResolvedValue({});
    resolveSlackUserFromCode.mockResolvedValue({
      user: { id: "u1" },
      slackUserId: "U1",
    });

    const url = await bridge.completeAuthorization({
      slackState: "s1",
      slackCode: "slack-code",
    });

    // Slack matches redirect_uri at exchange against the one sent at authorize.
    expect(resolveSlackUserFromCode).toHaveBeenCalledWith(
      "slack-code",
      "https://app.example/mcp/oauth/cb"
    );
    expect(url).toMatch(/^https:\/\/claude\.ai\/cb\?/);
    expect(url).toMatch(/[?&]code=/);
    expect(url).toMatch(/[?&]state=xyz/);
    const upd = prisma.oauth_auth_codes.update.mock.calls[0][0].data;
    expect(upd.user_id).toBe("u1");
    expect(typeof upd.code_hash).toBe("string");
    // The stored hash must match the issued code in the redirect URL.
    const issued = new URL(url).searchParams.get("code");
    expect(upd.code_hash).toBe(hashToken(issued));
  });

  it("completeAuthorization redirects with error when the user isn't registered", async () => {
    prisma.oauth_auth_codes.findUnique.mockResolvedValue({
      id: "ac1",
      slack_state: "s1",
      redirect_uri: "https://claude.ai/cb",
      client_state: "xyz",
      expires_at: new Date(Date.now() + 100000),
      user_id: null,
    });
    resolveSlackUserFromCode.mockResolvedValue({
      user: null,
      slackUserId: "U9",
    });

    const url = await bridge.completeAuthorization({
      slackState: "s1",
      slackCode: "slack-code",
    });
    expect(url).toMatch(/[?&]error=access_denied/);
    expect(url).toMatch(/[?&]state=xyz/);
    expect(prisma.oauth_auth_codes.update).not.toHaveBeenCalled();
  });

  it("completeAuthorization throws on unknown/expired slack_state", async () => {
    prisma.oauth_auth_codes.findUnique.mockResolvedValue(null);
    await expect(
      bridge.completeAuthorization({ slackState: "bad", slackCode: "x" })
    ).rejects.toThrow(/authorization/i);
  });

  it("abortAuthorization sends the client its error with its own state", async () => {
    prisma.oauth_auth_codes.findUnique.mockResolvedValue({
      id: "ac1",
      redirect_uri: "https://claude.ai/cb",
      client_state: "xyz",
    });
    const url = await bridge.abortAuthorization({
      slackState: "s1",
      error: "access_denied",
      description: "cancelled",
    });
    const params = new URL(url).searchParams;
    expect(url).toMatch(/^https:\/\/claude\.ai\/cb\?/);
    expect(params.get("state")).toBe("xyz");
    expect(params.get("error")).toBe("access_denied");
    expect(params.get("error_description")).toBe("cancelled");
  });

  it("abortAuthorization returns null for an unknown slack_state", async () => {
    prisma.oauth_auth_codes.findUnique.mockResolvedValue(null);
    expect(
      await bridge.abortAuthorization({
        slackState: "bad",
        error: "access_denied",
        description: "x",
      })
    ).toBeNull();
  });

  it("consumeAuthorizationCode returns the row once then deletes it", async () => {
    const row = {
      id: "ac1",
      client_id: "c1",
      user_id: "u1",
      code_hash: hashToken("the-code"),
      redirect_uri: "https://claude.ai/cb",
      code_challenge: "chal",
      scope: "mcp",
      resource: "https://x/mcp",
      expires_at: new Date(Date.now() + 100000),
    };
    prisma.oauth_auth_codes.findUnique.mockResolvedValue(row);
    prisma.oauth_auth_codes.delete.mockResolvedValue({});
    const got = await bridge.consumeAuthorizationCode("c1", "the-code");
    expect(got.user_id).toBe("u1");
    expect(prisma.oauth_auth_codes.delete).toHaveBeenCalledWith({
      where: { id: "ac1" },
    });
  });
});
