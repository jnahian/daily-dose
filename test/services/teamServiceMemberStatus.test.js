jest.mock("../../src/config/prisma", () => ({
  team: { findUnique: jest.fn() },
  teamMember: { findMany: jest.fn() },
  organizationMember: { findMany: jest.fn() },
  standupResponse: { findMany: jest.fn() },
  leave: { findMany: jest.fn() },
  holiday: { findMany: jest.fn() },
}));

const prisma = require("../../src/config/prisma");
const teamService = require("../../src/services/teamService");

const team = {
  id: "t1",
  organizationId: "o1",
  timezone: "America/New_York",
  organization: { id: "o1", settings: { defaultWorkDays: [1, 2, 3, 4, 5] } },
};

// A fixed work-day Wednesday (ISO day 3) for deterministic workingToday.
const WED = new Date("2026-06-24T12:00:00Z");

beforeEach(() => {
  jest.clearAllMocks();
  prisma.team.findUnique.mockResolvedValue(team);
  prisma.holiday.findMany.mockResolvedValue([]);
  prisma.organizationMember.findMany.mockResolvedValue([
    { userId: "u1", isActive: true },
    { userId: "u2", isActive: false },
    { userId: "u3", isActive: true },
  ]);
  prisma.standupResponse.findMany.mockResolvedValue([
    {
      teamId: "t1",
      userId: "u1",
      standupDate: new Date("2026-06-24T12:00:00Z"),
    },
  ]);
  prisma.leave.findMany.mockResolvedValue([
    {
      userId: "u3",
      startDate: new Date("2026-06-01T00:00:00Z"),
      endDate: new Date("2026-12-31T00:00:00Z"),
    },
  ]);
  prisma.teamMember.findMany.mockResolvedValue([
    {
      role: "MEMBER",
      isActive: true,
      receiveNotifications: true,
      teamId: "t1",
      userId: "u1",
      user: {
        id: "u1",
        slackUserId: "U1",
        name: "Alice",
        workDays: [1, 2, 3, 4, 5],
      },
    },
    {
      role: "MEMBER",
      isActive: true,
      receiveNotifications: false,
      teamId: "t1",
      userId: "u2",
      user: { id: "u2", slackUserId: "U2", name: "Bob", workDays: null },
    },
    {
      role: "ADMIN",
      isActive: true,
      receiveNotifications: true,
      teamId: "t1",
      userId: "u3",
      user: { id: "u3", slackUserId: "U3", name: "Carol", workDays: null },
    },
  ]);
});

describe("getTeamMembersWithStatus", () => {
  it("enriches each member with responded/onLeave/orgActive/workingToday", async () => {
    const out = await teamService.getTeamMembersWithStatus("t1", WED);
    const byId = Object.fromEntries(out.map((m) => [m.user.slackUserId, m]));

    expect(byId.U1).toMatchObject({
      role: "MEMBER",
      teamActive: true,
      orgActive: true,
      receiveNotifications: true,
      onLeave: false,
      responded: true,
      workingToday: true,
    });
    expect(byId.U2).toMatchObject({ orgActive: false, responded: false });
    expect(byId.U3).toMatchObject({ role: "ADMIN", onLeave: true });
  });

  it("returns [] when the team has no members", async () => {
    prisma.teamMember.findMany.mockResolvedValue([]);
    expect(await teamService.getTeamMembersWithStatus("t1", WED)).toEqual([]);
  });

  it("treats a member with no org-membership row as org-inactive", async () => {
    prisma.organizationMember.findMany.mockResolvedValue([]); // no rows at all
    const out = await teamService.getTeamMembersWithStatus("t1", WED);
    expect(out.every((m) => m.orgActive === false)).toBe(true);
  });
});

describe("getMembersWithStatusByTeam", () => {
  it("groups members by team id and returns an entry per team", async () => {
    prisma.teamMember.findMany.mockResolvedValue([
      {
        role: "MEMBER",
        isActive: true,
        receiveNotifications: true,
        teamId: "t1",
        userId: "u1",
        user: { id: "u1", slackUserId: "U1", name: "Alice", workDays: null },
      },
      {
        role: "MEMBER",
        isActive: true,
        receiveNotifications: true,
        teamId: "t2",
        userId: "u2",
        user: { id: "u2", slackUserId: "U2", name: "Bob", workDays: null },
      },
    ]);

    const teams = [
      { id: "t1", timezone: "America/New_York" },
      { id: "t2", timezone: "America/New_York" },
    ];
    const byTeam = await teamService.getMembersWithStatusByTeam(
      teams,
      team.organization,
      WED
    );

    expect(byTeam.get("t1").map((m) => m.user.slackUserId)).toEqual(["U1"]);
    expect(byTeam.get("t2").map((m) => m.user.slackUserId)).toEqual(["U2"]);
  });

  it("returns an empty map entry for each team when there are no members", async () => {
    prisma.teamMember.findMany.mockResolvedValue([]);
    const byTeam = await teamService.getMembersWithStatusByTeam(
      [{ id: "t1", timezone: "UTC" }],
      team.organization,
      WED
    );
    expect(byTeam.get("t1")).toEqual([]);
  });
});
