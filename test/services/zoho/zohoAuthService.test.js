jest.mock("../../../src/config/prisma", () => ({
  zohoCredential: {
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
}));

const prisma = require("../../../src/config/prisma");
const svc = require("../../../src/services/zoho/zohoAuthService");

describe("zohoAuthService", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ZOHO_CLIENT_ID = "client-id";
    process.env.ZOHO_CLIENT_SECRET = "client-secret";
    process.env.ZOHO_REDIRECT_URI = "https://example.com/callback";
    process.env.ZOHO_DATA_CENTER = "com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("getValidAccessToken returns the cached token when not near expiry", async () => {
    prisma.zohoCredential.findUnique.mockResolvedValue({
      id: "cred-1",
      organizationId: "org-1",
      dataCenter: "com",
      refreshToken: "refresh-abc",
      accessToken: "cached-access-token",
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      enabled: true,
    });
    global.fetch = jest.fn();

    const result = await svc.getValidAccessToken("org-1");

    expect(result).toEqual({
      accessToken: "cached-access-token",
      dataCenter: "com",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("getValidAccessToken refreshes when the cached token is missing/expired", async () => {
    prisma.zohoCredential.findUnique.mockResolvedValue({
      id: "cred-1",
      organizationId: "org-1",
      dataCenter: "com",
      refreshToken: "refresh-abc",
      accessToken: null,
      accessTokenExpiresAt: null,
      enabled: true,
    });
    prisma.zohoCredential.update.mockResolvedValue({});
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "new-access-token",
        expires_in: 3600,
      }),
    });

    const result = await svc.getValidAccessToken("org-1");

    expect(result.accessToken).toBe("new-access-token");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://accounts.zoho.com/oauth/v2/token",
      expect.objectContaining({ method: "POST" })
    );
    const body = new URLSearchParams(global.fetch.mock.calls[0][1].body);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("refresh-abc");
    expect(prisma.zohoCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cred-1" },
        data: expect.objectContaining({ accessToken: "new-access-token" }),
      })
    );
  });

  it("getValidAccessToken refreshes when the cached token is within the safety margin", async () => {
    prisma.zohoCredential.findUnique.mockResolvedValue({
      id: "cred-1",
      organizationId: "org-1",
      dataCenter: "com",
      refreshToken: "refresh-abc",
      accessToken: "about-to-expire",
      // Expires in 1 minute — inside the 5-minute safety margin.
      accessTokenExpiresAt: new Date(Date.now() + 60 * 1000),
      enabled: true,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "refreshed", expires_in: 3600 }),
    });

    const result = await svc.getValidAccessToken("org-1");

    expect(result.accessToken).toBe("refreshed");
    expect(global.fetch).toHaveBeenCalled();
  });

  it("getValidAccessToken throws when no credential exists for the org", async () => {
    prisma.zohoCredential.findUnique.mockResolvedValue(null);

    await expect(svc.getValidAccessToken("org-missing")).rejects.toThrow(
      /No Zoho credential configured/
    );
  });

  it("getValidAccessToken throws when the credential is disabled", async () => {
    prisma.zohoCredential.findUnique.mockResolvedValue({
      id: "cred-1",
      organizationId: "org-1",
      enabled: false,
    });

    await expect(svc.getValidAccessToken("org-1")).rejects.toThrow(/disabled/);
  });

  it("exchangeGrantToken persists the refresh token via upsert", async () => {
    prisma.zohoCredential.upsert.mockResolvedValue({
      dataCenter: "com",
      accessTokenExpiresAt: new Date(),
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "initial-access-token",
        refresh_token: "initial-refresh-token",
        expires_in: 3600,
      }),
    });

    await svc.exchangeGrantToken("org-1", "grant-token-abc");

    expect(prisma.zohoCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
        create: expect.objectContaining({
          organizationId: "org-1",
          refreshToken: "initial-refresh-token",
        }),
      })
    );
  });

  it("exchangeGrantToken throws when Zoho doesn't return a refresh_token", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "x", expires_in: 3600 }),
    });

    await expect(
      svc.exchangeGrantToken("org-1", "grant-token-abc")
    ).rejects.toThrow(/did not return a refresh_token/);
  });

  it("throws a clear error when Zoho client credentials aren't configured", async () => {
    delete process.env.ZOHO_CLIENT_ID;
    prisma.zohoCredential.findUnique.mockResolvedValue({
      id: "cred-1",
      organizationId: "org-1",
      dataCenter: "com",
      refreshToken: "refresh-abc",
      accessToken: null,
      accessTokenExpiresAt: null,
      enabled: true,
    });

    await expect(svc.getValidAccessToken("org-1")).rejects.toThrow(
      /ZOHO_CLIENT_ID/
    );
  });
});
