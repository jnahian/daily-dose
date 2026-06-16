jest.mock("../../src/config/prisma", () => ({
  teamMember: { findMany: jest.fn() },
}));
jest.mock("../../src/mcp/teamResolver", () => ({ resolveTeam: jest.fn() }));
jest.mock("../../src/services/standupService", () => ({
  submitStandup: jest.fn(),
  getUserStandupHistory: jest.fn(),
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
