jest.mock("../../src/config/prisma", () => ({
  mcp_tokens: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const prisma = require("../../src/config/prisma");
const svc = require("../../src/services/mcpTokenService");

describe("mcpTokenService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("mintToken returns a raw token and stores only its hash", async () => {
    prisma.mcp_tokens.create.mockResolvedValue({ id: "t1" });
    const { rawToken } = await svc.mintToken("user-1", "Cursor");

    expect(rawToken).toMatch(/^ddm_[0-9a-f]{64}$/);
    const stored = prisma.mcp_tokens.create.mock.calls[0][0].data;
    expect(stored.token_hash).toBe(svc.hashToken(rawToken));
    expect(stored.token_hash).not.toContain(rawToken);
    expect(stored.user_id).toBe("user-1");
    expect(stored.name).toBe("Cursor");
  });

  it("validateToken returns the user for a live token", async () => {
    const user = { id: "user-1", slackUserId: "U1" };
    prisma.mcp_tokens.findUnique.mockResolvedValue({
      id: "t1",
      expires_at: new Date(Date.now() + 1000),
      revoked_at: null,
      users: user,
    });
    prisma.mcp_tokens.update.mockResolvedValue({});

    const result = await svc.validateToken("ddm_abc");
    expect(result).toBe(user);
    expect(prisma.mcp_tokens.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" } })
    );
  });

  it("validateToken returns null for expired or revoked tokens", async () => {
    prisma.mcp_tokens.findUnique.mockResolvedValue({
      id: "t1",
      expires_at: new Date(Date.now() - 1000),
      revoked_at: null,
      users: { id: "u" },
    });
    expect(await svc.validateToken("ddm_x")).toBeNull();

    prisma.mcp_tokens.findUnique.mockResolvedValue({
      id: "t2",
      expires_at: new Date(Date.now() + 1000),
      revoked_at: new Date(),
      users: { id: "u" },
    });
    expect(await svc.validateToken("ddm_y")).toBeNull();
  });

  it("validateToken returns null when token unknown", async () => {
    prisma.mcp_tokens.findUnique.mockResolvedValue(null);
    expect(await svc.validateToken("ddm_z")).toBeNull();
  });
});
