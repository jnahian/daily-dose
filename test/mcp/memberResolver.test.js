jest.mock("../../src/config/prisma", () => ({
  teamMember: { findMany: jest.fn() },
}));

const prisma = require("../../src/config/prisma");
const { resolveMember } = require("../../src/mcp/memberResolver");

const members = [
  {
    user: {
      id: "u1",
      slackUserId: "U111",
      name: "Alice Smith",
      username: "alice",
    },
  },
  {
    user: { id: "u2", slackUserId: "U222", name: "Bob Jones", username: "bob" },
  },
];

describe("resolveMember", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.teamMember.findMany.mockResolvedValue(members);
  });

  it("matches by Slack user id (case-sensitive)", async () => {
    const { member } = await resolveMember("t1", "U222");
    expect(member.id).toBe("u2");
  });

  it("matches by case-insensitive name", async () => {
    const { member } = await resolveMember("t1", "alice smith");
    expect(member.id).toBe("u1");
  });

  it("matches by case-insensitive username", async () => {
    const { member } = await resolveMember("t1", "BOB");
    expect(member.id).toBe("u2");
  });

  it("strips a Slack mention wrapper", async () => {
    const { member } = await resolveMember("t1", "<@U111>");
    expect(member.id).toBe("u1");
  });

  it("returns an error for an unknown member", async () => {
    const { member, error } = await resolveMember("t1", "Charlie");
    expect(member).toBeUndefined();
    expect(error).toMatch(/not found/i);
  });

  it("returns an error when the team has no active members", async () => {
    prisma.teamMember.findMany.mockResolvedValue([]);
    const { error } = await resolveMember("t1", "U111");
    expect(error).toMatch(/no active members/i);
  });

  it("scopes the query to active members of the team", async () => {
    await resolveMember("t1", "alice");
    expect(prisma.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId: "t1", isActive: true },
        include: { user: true },
      })
    );
  });
});
