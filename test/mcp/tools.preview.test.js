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
  computeIsLate: jest.fn(),
}));
jest.mock("../../src/services/teamService", () => ({ getTeamById: jest.fn() }));
jest.mock("../../src/services/schedulerService", () => ({
  sendStandupReminders: jest.fn(),
  sendFollowupReminders: jest.fn(),
}));

const { resolveTeam } = require("../../src/mcp/teamResolver");
const standupService = require("../../src/services/standupService");
const teamService = require("../../src/services/teamService");
const { buildToolHandlers } = require("../../src/mcp/tools");

const user = { id: "user-1", slackUserId: "U1", name: "Alice" };
const slackClient = { chat: { postMessage: jest.fn() } };
const team = { id: "t1", name: "Eng", timezone: "UTC", postingTime: "10:00" };

describe("preview_standup handler", () => {
  let tools;
  beforeEach(() => {
    jest.clearAllMocks();
    resolveTeam.mockResolvedValue({ team: { id: "t1", name: "Eng" } });
    teamService.getTeamById.mockResolvedValue(team);
    standupService.computeIsLate.mockReturnValue(false);
    tools = buildToolHandlers(user, slackClient);
  });

  it("rejects when all fields are empty", async () => {
    await expect(tools.preview_standup({ team: "Eng" })).rejects.toThrow(
      /at least one field/i
    );
  });

  it("renders a preview and reports willOverwrite=false when nothing exists", async () => {
    standupService.getUserResponse.mockResolvedValue(null);
    const result = await tools.preview_standup({
      team: "Eng",
      date: "2026-06-17",
      yesterdayTasks: "Shipped auth",
      todayTasks: "Code review",
    });
    expect(result.team).toBe("Eng");
    expect(result.date).toBe("2026-06-17");
    expect(result.willOverwrite).toBe(false);
    expect(result.existing).toBeNull();
    expect(result.fields).toEqual({
      yesterdayTasks: "Shipped auth",
      todayTasks: "Code review",
      blockers: "",
    });
    expect(result.preview).toContain("Eng — 2026-06-17");
    expect(result.preview).toContain("Shipped auth");
    expect(standupService.submitStandup).not.toHaveBeenCalled();
  });

  it("reports willOverwrite=true with the existing submission", async () => {
    standupService.getUserResponse.mockResolvedValue({
      yesterdayTasks: "Old y",
      todayTasks: "Old t",
      blockers: "",
    });
    const result = await tools.preview_standup({
      team: "Eng",
      date: "2026-06-17",
      todayTasks: "New plan",
    });
    expect(result.willOverwrite).toBe(true);
    expect(result.existing).toEqual({
      yesterdayTasks: "Old y",
      todayTasks: "Old t",
      blockers: "",
    });
  });

  it("rejects an invalid date", async () => {
    await expect(
      tools.preview_standup({
        team: "Eng",
        date: "06-17-2026",
        todayTasks: "x",
      })
    ).rejects.toThrow(/Invalid date/);
  });
});
