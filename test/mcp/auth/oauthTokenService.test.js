jest.mock("../../../src/config/prisma", () => ({
  oauth_tokens: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
}));

const prisma = require("../../../src/config/prisma");
const svc = require("../../../src/mcp/auth/oauthTokenService");

describe("oauthTokenService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("mintGrant returns prefixed access+refresh and stores only hashes", async () => {
    prisma.oauth_tokens.create.mockResolvedValue({ id: "g1" });
    const grant = await svc.mintGrant({
      userId: "u1",
      clientId: "c1",
      scope: "mcp",
      resource: "https://x/mcp",
    });
    expect(grant.accessToken).toMatch(/^mcat_[0-9a-f]{64}$/);
    expect(grant.refreshToken).toMatch(/^mcrt_[0-9a-f]{64}$/);
    expect(grant.expiresIn).toBe(3600);
    const data = prisma.oauth_tokens.create.mock.calls[0][0].data;
    expect(data.access_token_hash).toBe(svc.hashToken(grant.accessToken));
    expect(data.refresh_token_hash).toBe(svc.hashToken(grant.refreshToken));
    expect(data.access_token_hash).not.toContain(grant.accessToken);
    expect(data.user_id).toBe("u1");
    expect(data.client_id).toBe("c1");
  });

  it("verifyAccessToken returns the row+user for a live token and updates last_used_at", async () => {
    const row = {
      id: "g1",
      client_id: "c1",
      user_id: "u1",
      scope: "mcp",
      resource: "https://x/mcp",
      access_token_expires_at: new Date(Date.now() + 1000),
      revoked_at: null,
      user: { id: "u1", slackUserId: "U1" },
    };
    prisma.oauth_tokens.findUnique.mockResolvedValue(row);
    prisma.oauth_tokens.update.mockResolvedValue({});
    const result = await svc.verifyAccessToken("mcat_abc");
    expect(result.user.id).toBe("u1");
    expect(result.row.client_id).toBe("c1");
    expect(prisma.oauth_tokens.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "g1" } })
    );
  });

  it("verifyAccessToken returns null for expired/revoked/unknown", async () => {
    prisma.oauth_tokens.findUnique.mockResolvedValue({
      id: "g1",
      access_token_expires_at: new Date(Date.now() - 1000),
      revoked_at: null,
      user: { id: "u" },
    });
    expect(await svc.verifyAccessToken("mcat_x")).toBeNull();
    prisma.oauth_tokens.findUnique.mockResolvedValue({
      id: "g2",
      access_token_expires_at: new Date(Date.now() + 1000),
      revoked_at: new Date(),
      user: { id: "u" },
    });
    expect(await svc.verifyAccessToken("mcat_y")).toBeNull();
    prisma.oauth_tokens.findUnique.mockResolvedValue(null);
    expect(await svc.verifyAccessToken("mcat_z")).toBeNull();
  });

  it("rotateRefresh issues new tokens in place and rejects client mismatch", async () => {
    const row = {
      id: "g1",
      client_id: "c1",
      user_id: "u1",
      scope: "mcp",
      resource: "https://x/mcp",
      refresh_token_expires_at: new Date(Date.now() + 100000),
      revoked_at: null,
    };
    prisma.oauth_tokens.findUnique.mockResolvedValue(row);
    prisma.oauth_tokens.update.mockResolvedValue({});
    const result = await svc.rotateRefresh("mcrt_abc", "c1");
    expect(result.accessToken).toMatch(/^mcat_/);
    expect(result.refreshToken).toMatch(/^mcrt_/);
    const upd = prisma.oauth_tokens.update.mock.calls[0][0].data;
    expect(upd.access_token_hash).toBe(svc.hashToken(result.accessToken));
    expect(upd.refresh_token_hash).toBe(svc.hashToken(result.refreshToken));

    await expect(svc.rotateRefresh("mcrt_abc", "OTHER")).rejects.toThrow(
      /client/i
    );
  });

  it("revokeRawToken revokes by access or refresh hash", async () => {
    prisma.oauth_tokens.updateMany.mockResolvedValue({ count: 1 });
    await svc.revokeRawToken("mcat_abc");
    const where = prisma.oauth_tokens.updateMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { access_token_hash: svc.hashToken("mcat_abc") },
      { refresh_token_hash: svc.hashToken("mcat_abc") },
    ]);
  });

  it("listConnections groups live grants by client; revokeConnection scopes by user+client", async () => {
    prisma.oauth_tokens.findMany.mockResolvedValue([
      {
        client_id: "c1",
        last_used_at: new Date("2026-06-17"),
        created_at: new Date("2026-06-10"),
        client: { client_name: "Claude" },
      },
      {
        client_id: "c1",
        last_used_at: new Date("2026-06-16"),
        created_at: new Date("2026-06-11"),
        client: { client_name: "Claude" },
      },
    ]);
    const conns = await svc.listConnections("u1");
    expect(conns).toHaveLength(1);
    expect(conns[0]).toEqual(
      expect.objectContaining({ clientId: "c1", clientName: "Claude" })
    );

    prisma.oauth_tokens.updateMany.mockResolvedValue({ count: 2 });
    await svc.revokeConnection("u1", "c1");
    expect(prisma.oauth_tokens.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: "u1",
          client_id: "c1",
          revoked_at: null,
        }),
      })
    );
  });
});
