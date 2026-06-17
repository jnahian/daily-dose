jest.mock("../../../src/mcp/auth/clientStore", () => ({ clientStore: {} }));
jest.mock("../../../src/mcp/auth/slackAuthBridge", () => ({
  beginAuthorization: jest.fn(),
  getAuthorizationCode: jest.fn(),
  consumeAuthorizationCode: jest.fn(),
}));
jest.mock("../../../src/mcp/auth/oauthTokenService", () => ({
  mintGrant: jest.fn(),
  rotateRefresh: jest.fn(),
  verifyAccessToken: jest.fn(),
  revokeRawToken: jest.fn(),
}));

const bridge = require("../../../src/mcp/auth/slackAuthBridge");
const tokenSvc = require("../../../src/mcp/auth/oauthTokenService");
const { provider } = require("../../../src/mcp/auth/oauthProvider");

const client = { client_id: "c1" };

describe("oauthProvider", () => {
  beforeEach(() => jest.clearAllMocks());

  it("authorize redirects to the Slack URL from the bridge", async () => {
    bridge.beginAuthorization.mockResolvedValue("https://slack/x");
    const res = { redirect: jest.fn() };
    await provider.authorize(
      client,
      {
        codeChallenge: "chal",
        redirectUri: "https://claude/cb",
        state: "s",
        scopes: ["mcp"],
        resource: new URL("https://x/mcp"),
      },
      res
    );
    expect(bridge.beginAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "c1",
        redirectUri: "https://claude/cb",
        clientState: "s",
        codeChallenge: "chal",
        scope: "mcp",
        resource: "https://x/mcp",
      })
    );
    expect(res.redirect).toHaveBeenCalledWith("https://slack/x");
  });

  it("challengeForAuthorizationCode returns the stored challenge", async () => {
    bridge.getAuthorizationCode.mockResolvedValue({ code_challenge: "chal" });
    expect(await provider.challengeForAuthorizationCode(client, "code")).toBe(
      "chal"
    );
  });

  it("challengeForAuthorizationCode throws on unknown code", async () => {
    bridge.getAuthorizationCode.mockResolvedValue(null);
    await expect(
      provider.challengeForAuthorizationCode(client, "bad")
    ).rejects.toThrow();
  });

  it("exchangeAuthorizationCode consumes the code and mints a grant", async () => {
    bridge.consumeAuthorizationCode.mockResolvedValue({
      user_id: "u1",
      scope: "mcp",
      resource: "https://x/mcp",
    });
    tokenSvc.mintGrant.mockResolvedValue({
      accessToken: "mcat_a",
      refreshToken: "mcrt_b",
      expiresIn: 3600,
    });
    const tokens = await provider.exchangeAuthorizationCode(client, "code");
    expect(tokenSvc.mintGrant).toHaveBeenCalledWith({
      userId: "u1",
      clientId: "c1",
      scope: "mcp",
      resource: "https://x/mcp",
    });
    expect(tokens).toEqual({
      access_token: "mcat_a",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "mcrt_b",
      scope: "mcp",
    });
  });

  it("exchangeAuthorizationCode throws invalid_grant on a bad code", async () => {
    bridge.consumeAuthorizationCode.mockResolvedValue(null);
    await expect(
      provider.exchangeAuthorizationCode(client, "bad")
    ).rejects.toThrow();
  });

  it("exchangeRefreshToken rotates and returns tokens", async () => {
    tokenSvc.rotateRefresh.mockResolvedValue({
      accessToken: "mcat_c",
      refreshToken: "mcrt_d",
      expiresIn: 3600,
      scope: "mcp",
    });
    const tokens = await provider.exchangeRefreshToken(client, "mcrt_old");
    expect(tokenSvc.rotateRefresh).toHaveBeenCalledWith("mcrt_old", "c1");
    expect(tokens).toEqual({
      access_token: "mcat_c",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "mcrt_d",
      scope: "mcp",
    });
  });

  it("verifyAccessToken returns AuthInfo with the user in extra", async () => {
    tokenSvc.verifyAccessToken.mockResolvedValue({
      row: {
        client_id: "c1",
        scope: "mcp",
        resource: "https://x/mcp",
        access_token_expires_at: new Date(2000000000000),
      },
      user: { id: "u1", slackUserId: "U1" },
    });
    const info = await provider.verifyAccessToken("mcat_a");
    expect(info.clientId).toBe("c1");
    expect(info.scopes).toEqual(["mcp"]);
    expect(info.extra.user.id).toBe("u1");
  });

  it("verifyAccessToken throws on invalid token", async () => {
    tokenSvc.verifyAccessToken.mockResolvedValue(null);
    await expect(provider.verifyAccessToken("bad")).rejects.toThrow();
  });
});
