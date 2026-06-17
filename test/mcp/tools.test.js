jest.mock("../../src/config/prisma", () => ({
  teamMember: { findMany: jest.fn() },
}));
jest.mock("../../src/mcp/teamResolver", () => ({ resolveTeam: jest.fn() }));
jest.mock("../../src/mcp/memberResolver", () => ({ resolveMember: jest.fn() }));
jest.mock("../../src/utils/permissionHelper", () => ({
  canManageTeam: jest.fn(),
}));
jest.mock("../../src/services/standupService", () => ({
  submitStandup: jest.fn(),
  getUserStandupHistory: jest.fn(),
  getTeamResponses: jest.fn(),
  getLateResponses: jest.fn(),
  getActiveMembers: jest.fn(),
  getUserResponse: jest.fn(),
}));
jest.mock("../../src/services/teamService", () => ({
  getTeamById: jest.fn(),
}));

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

const prisma = require("../../src/config/prisma");
const { resolveTeam } = require("../../src/mcp/teamResolver");
const { resolveMember } = require("../../src/mcp/memberResolver");
const { canManageTeam } = require("../../src/utils/permissionHelper");
const standupService = require("../../src/services/standupService");
const teamService = require("../../src/services/teamService");
const { buildToolHandlers } = require("../../src/mcp/tools");

const user = { id: "user-1", slackUserId: "U1", name: "Alice" };
const slackClient = { chat: { postMessage: jest.fn() } };

describe("MCP Phase 1 tool handlers", () => {
  let tools;
  beforeEach(() => {
    jest.clearAllMocks();
    tools = buildToolHandlers(user, slackClient);
  });

  it("list_my_teams returns the user's active memberships with role", async () => {
    prisma.teamMember.findMany.mockResolvedValue([
      { role: "ADMIN", team: { id: "t1", name: "Eng" } },
      { role: "MEMBER", team: { id: "t2", name: "Design" } },
    ]);
    const result = await tools.list_my_teams({});
    expect(result).toEqual([
      { id: "t1", name: "Eng", role: "ADMIN" },
      { id: "t2", name: "Design", role: "MEMBER" },
    ]);
  });

  it("submit_standup requires at least one field", async () => {
    await expect(
      tools.submit_standup({
        team: "Eng",
        yesterdayTasks: "",
        todayTasks: "",
        blockers: "",
      })
    ).rejects.toThrow(/at least one field/i);
    expect(standupService.submitStandup).not.toHaveBeenCalled();
  });

  it("submit_standup resolves the team and delegates to submitStandup", async () => {
    resolveTeam.mockResolvedValue({ team: { id: "t1", name: "Eng" } });
    teamService.getTeamById.mockResolvedValue({
      id: "t1",
      name: "Eng",
      timezone: "Asia/Dhaka",
    });
    standupService.submitStandup.mockResolvedValue({ isLate: true });

    const result = await tools.submit_standup({
      team: "Eng",
      todayTasks: "ship it",
    });

    expect(resolveTeam).toHaveBeenCalledWith("U1", "Eng");
    expect(standupService.submitStandup).toHaveBeenCalledWith(
      expect.objectContaining({
        slackUserId: "U1",
        name: "Alice",
        isUpdate: false,
        fields: expect.objectContaining({ todayTasks: "ship it" }),
        slackClient,
      })
    );
    expect(result).toEqual(
      expect.objectContaining({ team: "Eng", isLate: true })
    );
  });

  it("submit_standup throws the resolver error for an unknown team", async () => {
    resolveTeam.mockResolvedValue({
      error: 'Team "X" not found. Available teams: Eng',
    });
    await expect(
      tools.submit_standup({ team: "X", todayTasks: "y" })
    ).rejects.toThrow(/not found/);
  });

  it("update_standup rejects an invalid date", async () => {
    await expect(
      tools.update_standup({ team: "Eng", date: "06/01/2026", todayTasks: "y" })
    ).rejects.toThrow(/YYYY-MM-DD/);
  });

  it("get_my_standup_history defaults missing dates and returns entries", async () => {
    standupService.getUserStandupHistory.mockResolvedValue([
      {
        standupDate: new Date("2026-06-10"),
        team: { name: "Eng" },
        todayTasks: "x",
        isLate: false,
      },
    ]);
    const result = await tools.get_my_standup_history({});
    expect(standupService.getUserStandupHistory).toHaveBeenCalled();
    expect(result[0]).toEqual(
      expect.objectContaining({ team: "Eng", todayTasks: "x" })
    );
  });
});

describe("MCP Phase 2 — get_team_standup", () => {
  let tools;
  const team = { id: "t1", name: "Eng", timezone: "Asia/Dhaka" };

  beforeEach(() => {
    jest.clearAllMocks();
    tools = buildToolHandlers(user, slackClient);
    resolveTeam.mockResolvedValue({ team });
    canManageTeam.mockResolvedValue({
      canManage: true,
      role: "ADMIN",
      reason: null,
    });
    standupService.getTeamResponses.mockResolvedValue([]);
    standupService.getLateResponses.mockResolvedValue([]);
    standupService.getActiveMembers.mockResolvedValue([]);
    prisma.teamMember.findMany.mockResolvedValue([]); // on-leave query
  });

  it("throws the permission reason when the caller can't manage the team", async () => {
    canManageTeam.mockResolvedValue({
      canManage: false,
      role: null,
      reason: "User is not an admin or owner",
    });
    await expect(tools.get_team_standup({ team: "Eng" })).rejects.toThrow(
      /not an admin or owner/i
    );
    expect(canManageTeam).toHaveBeenCalledWith("user-1", "t1");
    expect(standupService.getTeamResponses).not.toHaveBeenCalled();
  });

  it("combines on-time and late responses, each tagged isLate", async () => {
    standupService.getTeamResponses.mockResolvedValue([
      {
        userId: "u1",
        user: { slackUserId: "U1", name: "Alice" },
        yesterdayTasks: "y",
        todayTasks: "t",
        blockers: "",
        isLate: false,
        submittedAt: new Date("2026-06-17T03:00:00Z"),
      },
    ]);
    standupService.getLateResponses.mockResolvedValue([
      {
        userId: "u2",
        user: { slackUserId: "U2", name: "Bob" },
        yesterdayTasks: "",
        todayTasks: "late",
        blockers: "",
        isLate: true,
        submittedAt: new Date("2026-06-17T05:00:00Z"),
      },
    ]);
    standupService.getActiveMembers.mockResolvedValue([
      { userId: "u1", user: { slackUserId: "U1", name: "Alice" } },
      { userId: "u2", user: { slackUserId: "U2", name: "Bob" } },
    ]);

    const result = await tools.get_team_standup({ team: "Eng" });

    expect(result.team).toBe("Eng");
    expect(result.responses).toHaveLength(2);
    expect(result.responses.map((r) => r.isLate).sort()).toEqual([false, true]);
    expect(result.notSubmitted).toEqual([]);
    expect(result.onLeave).toEqual([]);
  });

  it("lists active members who did not submit and excludes late submitters from notSubmitted", async () => {
    standupService.getTeamResponses.mockResolvedValue([
      {
        userId: "u1",
        user: { slackUserId: "U1", name: "Alice" },
        yesterdayTasks: "",
        todayTasks: "t",
        blockers: "",
        isLate: false,
        submittedAt: new Date("2026-06-17T03:00:00Z"),
      },
    ]);
    standupService.getLateResponses.mockResolvedValue([
      {
        userId: "u2",
        user: { slackUserId: "U2", name: "Bob" },
        yesterdayTasks: "",
        todayTasks: "late",
        blockers: "",
        isLate: true,
        submittedAt: new Date("2026-06-17T05:00:00Z"),
      },
    ]);
    standupService.getActiveMembers.mockResolvedValue([
      { userId: "u1", user: { slackUserId: "U1", name: "Alice" } },
      { userId: "u2", user: { slackUserId: "U2", name: "Bob" } },
      { userId: "u3", user: { slackUserId: "U3", name: "Carol" } },
    ]);

    const result = await tools.get_team_standup({ team: "Eng" });

    expect(result.notSubmitted).toEqual([{ slackUserId: "U3", name: "Carol" }]);
  });

  it("reports members on leave and excludes them from notSubmitted", async () => {
    standupService.getActiveMembers.mockResolvedValue([
      { userId: "u1", user: { slackUserId: "U1", name: "Alice" } },
    ]);
    prisma.teamMember.findMany.mockResolvedValue([
      { userId: "u9", user: { slackUserId: "U9", name: "Dave" } },
    ]);

    const result = await tools.get_team_standup({ team: "Eng" });

    expect(result.onLeave).toEqual([{ slackUserId: "U9", name: "Dave" }]);
    expect(result.notSubmitted).toEqual([{ slackUserId: "U1", name: "Alice" }]);
  });

  it("rejects an invalid date before doing any work", async () => {
    await expect(
      tools.get_team_standup({ team: "Eng", date: "06/17/2026" })
    ).rejects.toThrow(/YYYY-MM-DD/);
    expect(resolveTeam).not.toHaveBeenCalled();
  });
});

describe("MCP Phase 2 — get_member_standup", () => {
  let tools;
  const team = { id: "t1", name: "Eng", timezone: "Asia/Dhaka" };
  const member = { id: "u2", slackUserId: "U2", name: "Bob" };

  beforeEach(() => {
    jest.clearAllMocks();
    tools = buildToolHandlers(user, slackClient);
    resolveTeam.mockResolvedValue({ team });
    canManageTeam.mockResolvedValue({
      canManage: true,
      role: "ADMIN",
      reason: null,
    });
    resolveMember.mockResolvedValue({ member });
  });

  it("throws the permission reason when the caller can't manage the team", async () => {
    canManageTeam.mockResolvedValue({
      canManage: false,
      role: null,
      reason: "User is not an admin or owner",
    });
    await expect(
      tools.get_member_standup({ team: "Eng", member: "Bob" })
    ).rejects.toThrow(/not an admin or owner/i);
    expect(resolveMember).not.toHaveBeenCalled();
  });

  it("returns the member's response for the date", async () => {
    standupService.getUserResponse.mockResolvedValue({
      yesterdayTasks: "y",
      todayTasks: "t",
      blockers: "none",
      isLate: false,
      submittedAt: new Date("2026-06-17T03:00:00Z"),
    });

    const result = await tools.get_member_standup({
      team: "Eng",
      member: "Bob",
    });

    expect(resolveMember).toHaveBeenCalledWith("t1", "Bob");
    expect(standupService.getUserResponse).toHaveBeenCalledWith(
      "t1",
      "u2",
      expect.any(Date)
    );
    expect(result.member).toEqual({ slackUserId: "U2", name: "Bob" });
    expect(result.response).toEqual(
      expect.objectContaining({
        todayTasks: "t",
        blockers: "none",
        isLate: false,
      })
    );
  });

  it("returns response: null when the member has no submission", async () => {
    standupService.getUserResponse.mockResolvedValue(null);
    const result = await tools.get_member_standup({
      team: "Eng",
      member: "Bob",
    });
    expect(result.response).toBeNull();
    expect(result.member).toEqual({ slackUserId: "U2", name: "Bob" });
  });

  it("throws the resolver error for an unknown member", async () => {
    resolveMember.mockResolvedValue({
      error: 'Member "Zoe" not found in this team.',
    });
    await expect(
      tools.get_member_standup({ team: "Eng", member: "Zoe" })
    ).rejects.toThrow(/not found/i);
    expect(standupService.getUserResponse).not.toHaveBeenCalled();
  });

  it("rejects an invalid date before doing any work", async () => {
    await expect(
      tools.get_member_standup({
        team: "Eng",
        member: "Bob",
        date: "2026/06/17",
      })
    ).rejects.toThrow(/YYYY-MM-DD/);
    expect(resolveTeam).not.toHaveBeenCalled();
  });
});
