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
  ]);
  prisma.standupResponse.findMany.mockResolvedValue([{ userId: "u1" }]);
  prisma.leave.findMany.mockResolvedValue([{ userId: "u3" }]);
  prisma.teamMember.findMany.mockResolvedValue([
    {
      role: "MEMBER",
      isActive: true,
      receiveNotifications: true,
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
      userId: "u2",
      user: { id: "u2", slackUserId: "U2", name: "Bob", workDays: null },
    },
    {
      role: "ADMIN",
      isActive: true,
      receiveNotifications: true,
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
});
