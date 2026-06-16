jest.mock("../../src/config/prisma", () => ({
  teamMember: { findMany: jest.fn() },
}));

const prisma = require("../../src/config/prisma");
const { resolveTeam } = require("../../src/mcp/teamResolver");

const memberships = [
  { team: { id: "t1", name: "Engineering" } },
  { team: { id: "t2", name: "Design" } },
];

describe("resolveTeam", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.teamMember.findMany.mockResolvedValue(memberships);
  });

  it("matches by case-insensitive name", async () => {
    const { team } = await resolveTeam("U1", "engineering");
    expect(team.id).toBe("t1");
  });

  it("matches by id", async () => {
    const { team } = await resolveTeam("U1", "t2");
    expect(team.id).toBe("t2");
  });

  it("returns an error for unknown teams, listing available names", async () => {
    const { team, error } = await resolveTeam("U1", "Marketing");
    expect(team).toBeUndefined();
    expect(error).toContain("Engineering");
    expect(error).toContain("Design");
  });

  it("returns an error when the user has no teams", async () => {
    prisma.teamMember.findMany.mockResolvedValue([]);
    const { error } = await resolveTeam("U1", "Engineering");
    expect(error).toMatch(/not a member of any teams/i);
  });

  it("passes the correct where clause to prisma", async () => {
    await resolveTeam("U1", "Engineering");
    expect(prisma.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          user: { slackUserId: "U1" },
        }),
      })
    );
  });
});
