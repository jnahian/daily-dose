jest.mock("../../../src/mcp/auth/oauthProvider", () => ({
  provider: { verifyAccessToken: jest.fn() },
}));
jest.mock("../../../src/services/mcpTokenService", () => ({
  validateToken: jest.fn(),
}));

const { provider } = require("../../../src/mcp/auth/oauthProvider");
const legacy = require("../../../src/services/mcpTokenService");
const { authenticateMcp } = require("../../../src/mcp/auth");

function mockRes() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    set(k, v) {
      this.headers[k] = v;
      return this;
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}

describe("authenticateMcp combined middleware", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401s with WWW-Authenticate when no token", async () => {
    const res = mockRes();
    const next = jest.fn();
    await authenticateMcp({ headers: {} }, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.headers["WWW-Authenticate"]).toMatch(/Bearer/);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts an OAuth access token and sets req.mcpUser", async () => {
    provider.verifyAccessToken.mockResolvedValue({
      extra: { user: { id: "u1" } },
    });
    const req = { headers: { authorization: "Bearer mcat_a" } };
    const next = jest.fn();
    await authenticateMcp(req, mockRes(), next);
    expect(req.mcpUser).toEqual({ id: "u1" });
    expect(next).toHaveBeenCalled();
  });

  it("falls back to a legacy ddm_ token", async () => {
    provider.verifyAccessToken.mockRejectedValue(new Error("nope"));
    legacy.validateToken.mockResolvedValue({ id: "u2" });
    const req = { headers: { authorization: "Bearer ddm_x" } };
    const next = jest.fn();
    await authenticateMcp(req, mockRes(), next);
    expect(req.mcpUser).toEqual({ id: "u2" });
    expect(next).toHaveBeenCalled();
  });

  it("401s when both OAuth and legacy reject", async () => {
    provider.verifyAccessToken.mockRejectedValue(new Error("nope"));
    legacy.validateToken.mockResolvedValue(null);
    const res = mockRes();
    const next = jest.fn();
    await authenticateMcp(
      { headers: { authorization: "Bearer bad" } },
      res,
      next
    );
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
