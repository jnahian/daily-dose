jest.mock("../../src/services/teamService", () => ({
  listTeams: jest.fn(),
}));

const teamService = require("../../src/services/teamService");
const { resolveTeam } = require("../../src/mcp/teamResolver");

const teams = [
  { id: "t1", name: "Engineering" },
  { id: "t2", name: "Design" },
];

describe("resolveTeam", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    teamService.listTeams.mockResolvedValue(teams);
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
    teamService.listTeams.mockResolvedValue([]);
    const { error } = await resolveTeam("U1", "Engineering");
    expect(error).toMatch(/not a member of any teams/i);
  });
});
