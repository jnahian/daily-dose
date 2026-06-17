// Downstream modules pulled in transitively via src/mcp/server.js -> ./tools.
// Mock them so requiring the module under test stays light and offline.
jest.mock("../../src/config/prisma", () => ({
  teamMember: { findMany: jest.fn() },
}));
jest.mock("../../src/services/mcpTokenService", () => ({
  validateToken: jest.fn(),
}));
jest.mock("../../src/mcp/teamResolver", () => ({ resolveTeam: jest.fn() }));
jest.mock("../../src/services/standupService", () => ({
  submitStandup: jest.fn(),
  getUserStandupHistory: jest.fn(),
  getTeamResponses: jest.fn(),
  getLateResponses: jest.fn(),
  getActiveMembers: jest.fn(),
  getUserResponse: jest.fn(),
}));
jest.mock("../../src/services/teamService", () => ({ getTeamById: jest.fn() }));
jest.mock("../../src/utils/permissionHelper", () => ({
  canManageTeam: jest.fn(),
}));
jest.mock("../../src/mcp/memberResolver", () => ({ resolveMember: jest.fn() }));

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const tokenService = require("../../src/services/mcpTokenService");
const { validateMcpToken } = require("../../src/mcp/server");
const { registerTools } = require("../../src/mcp/tools");

function mockRes() {
  return {
    statusCode: null,
    body: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("validateMcpToken middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects a request with no Authorization header", async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await validateMcpToken(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Missing bearer token" });
    expect(next).not.toHaveBeenCalled();
    expect(tokenService.validateToken).not.toHaveBeenCalled();
  });

  it("rejects a non-Bearer Authorization header", async () => {
    const req = { headers: { authorization: "Basic abc123" } };
    const res = mockRes();
    const next = jest.fn();

    await validateMcpToken(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Missing bearer token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired token", async () => {
    tokenService.validateToken.mockResolvedValue(null);
    const req = { headers: { authorization: "Bearer ddm_bad" } };
    const res = mockRes();
    const next = jest.fn();

    await validateMcpToken(req, res, next);

    expect(tokenService.validateToken).toHaveBeenCalledWith("ddm_bad");
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.mcpUser and calls next for a valid token", async () => {
    const user = { id: "u1", slackUserId: "U1" };
    tokenService.validateToken.mockResolvedValue(user);
    const req = { headers: { authorization: "Bearer ddm_good" } };
    const res = mockRes();
    const next = jest.fn();

    await validateMcpToken(req, res, next);

    expect(req.mcpUser).toBe(user);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
  });

  it("returns 500 when token validation throws", async () => {
    tokenService.validateToken.mockRejectedValue(new Error("db down"));
    const req = { headers: { authorization: "Bearer ddm_x" } };
    const res = mockRes();
    const next = jest.fn();

    await validateMcpToken(req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("registerTools SDK wiring", () => {
  it("registers all four Phase 1 tools on a real McpServer without throwing", () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const spy = jest.spyOn(server, "registerTool");
    const user = { id: "u1", slackUserId: "U1", name: "Alice" };
    const slackClient = { chat: { postMessage: jest.fn() } };

    // Exercises the real SDK against our zod inputSchemas — a schema-shape
    // incompatibility would throw here even though handler unit tests pass.
    expect(() => registerTools(server, user, slackClient)).not.toThrow();

    const names = spy.mock.calls.map((c) => c[0]);
    expect(names).toEqual(
      expect.arrayContaining([
        "list_my_teams",
        "submit_standup",
        "update_standup",
        "get_my_standup_history",
        "get_team_standup",
        "get_member_standup",
      ])
    );
  });
});
