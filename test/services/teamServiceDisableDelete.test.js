jest.mock("../../src/config/prisma", () => ({
  team: {
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../../src/services/userService", () => ({
  fetchSlackUserData: jest.fn().mockResolvedValue({}),
  findOrCreateUser: jest.fn(),
}));

jest.mock("../../src/utils/permissionHelper", () => ({
  canManageTeam: jest.fn(),
}));

const prisma = require("../../src/config/prisma");
const userService = require("../../src/services/userService");
const permissionHelper = require("../../src/utils/permissionHelper");
const teamService = require("../../src/services/teamService");

const org = { id: "o1", name: "Acme" };
const activeTeam = {
  id: "t1",
  name: "Eng",
  slackChannelId: "C123",
  isActive: true,
  status: "ACTIVE",
  organizationId: "o1",
  organization: org,
};

beforeEach(() => {
  jest.clearAllMocks();
  userService.findOrCreateUser.mockResolvedValue({ id: "u1" });
  permissionHelper.canManageTeam.mockResolvedValue({ canManage: true });
});

describe("teamService.setTeamActive", () => {
  it("disables an active team", async () => {
    prisma.team.findFirst.mockResolvedValue(activeTeam);
    prisma.team.update.mockResolvedValue({ ...activeTeam, isActive: false });

    await teamService.setTeamActive("U_ADMIN", "t1", false);

    // Permission is checked without requiring the team to be active, so disabled
    // teams remain manageable.
    expect(permissionHelper.canManageTeam).toHaveBeenCalledWith("u1", "t1", {
      requireActive: false,
    });
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { isActive: false },
    });
  });

  it("re-enables a disabled team", async () => {
    prisma.team.findFirst.mockResolvedValue({ ...activeTeam, isActive: false });
    prisma.team.update.mockResolvedValue(activeTeam);

    await teamService.setTeamActive("U_ADMIN", "t1", true);

    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { isActive: true },
    });
  });

  it("throws when the team is already in the target state", async () => {
    prisma.team.findFirst.mockResolvedValue(activeTeam);

    await expect(
      teamService.setTeamActive("U_ADMIN", "t1", true)
    ).rejects.toThrow(/already active/);
    expect(prisma.team.update).not.toHaveBeenCalled();
  });

  it("throws when the team is not found", async () => {
    prisma.team.findFirst.mockResolvedValue(null);

    await expect(
      teamService.setTeamActive("U_ADMIN", "t1", false)
    ).rejects.toThrow(/Team not found/);
  });

  it("blocks a user without manage permission", async () => {
    prisma.team.findFirst.mockResolvedValue(activeTeam);
    permissionHelper.canManageTeam.mockResolvedValue({ canManage: false });

    await expect(
      teamService.setTeamActive("U_RANDOM", "t1", false)
    ).rejects.toThrow(/admin permissions/);
    expect(prisma.team.update).not.toHaveBeenCalled();
  });
});

describe("teamService.deleteTeam", () => {
  it("hard-deletes a team and returns its snapshot", async () => {
    prisma.team.findFirst.mockResolvedValue(activeTeam);
    prisma.team.delete.mockResolvedValue(activeTeam);

    const result = await teamService.deleteTeam("U_ADMIN", "t1");

    expect(prisma.team.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(result.name).toBe("Eng");
  });

  it("throws when the team is not found", async () => {
    prisma.team.findFirst.mockResolvedValue(null);

    await expect(teamService.deleteTeam("U_ADMIN", "t1")).rejects.toThrow(
      /Team not found/
    );
    expect(prisma.team.delete).not.toHaveBeenCalled();
  });

  it("blocks a user without manage permission", async () => {
    prisma.team.findFirst.mockResolvedValue(activeTeam);
    permissionHelper.canManageTeam.mockResolvedValue({ canManage: false });

    await expect(teamService.deleteTeam("U_RANDOM", "t1")).rejects.toThrow(
      /admin permissions/
    );
    expect(prisma.team.delete).not.toHaveBeenCalled();
  });
});
