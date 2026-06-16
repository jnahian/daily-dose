jest.mock("../../src/config/prisma", () => ({
  team: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  teamMember: { create: jest.fn() },
  $transaction: jest.fn(),
}));

jest.mock("../../src/services/userService", () => ({
  fetchSlackUserData: jest.fn().mockResolvedValue({}),
  findOrCreateUser: jest.fn(),
  getUserOrganization: jest.fn(),
  getOrganizationByWorkspaceId: jest.fn(),
  addUserToOrganization: jest.fn(),
  canCreateTeam: jest.fn(),
}));

jest.mock("../../src/utils/permissionHelper", () => ({
  isOrganizationOwner: jest.fn(),
  isOrganizationAdmin: jest.fn(),
}));

const prisma = require("../../src/config/prisma");
const userService = require("../../src/services/userService");
const permissionHelper = require("../../src/utils/permissionHelper");
const teamService = require("../../src/services/teamService");

const org = { id: "o1", defaultTimezone: "America/New_York" };
const teamData = { name: "Eng", standupTime: "09:30", postingTime: "10:00" };

beforeEach(() => {
  jest.clearAllMocks();
  userService.findOrCreateUser.mockResolvedValue({ id: "u1" });
  // $transaction runs the callback against the prisma mock itself
  prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
  prisma.team.findUnique.mockResolvedValue(null);
  prisma.team.create.mockImplementation(async ({ data }) => ({
    id: "t1",
    ...data,
  }));
  prisma.teamMember.create.mockResolvedValue({});
});

describe("teamService.createTeam approval gating", () => {
  it("auto-onboards a non-member and creates a PENDING team", async () => {
    userService.getUserOrganization.mockResolvedValue(null);
    userService.getOrganizationByWorkspaceId.mockResolvedValue(org);
    userService.canCreateTeam.mockResolvedValue(false);

    const result = await teamService.createTeam(
      "U_NEW",
      "C123",
      teamData,
      "T_WORKSPACE"
    );

    expect(userService.getOrganizationByWorkspaceId).toHaveBeenCalledWith(
      "T_WORKSPACE"
    );
    expect(userService.addUserToOrganization).toHaveBeenCalledWith("u1", "o1");
    expect(result.status).toBe("PENDING");
    expect(result.team.status).toBe("PENDING");
    expect(result.creatorSlackUserId).toBe("U_NEW");
  });

  it("creates an ACTIVE team for an org admin without auto-onboarding", async () => {
    userService.getUserOrganization.mockResolvedValue(org);
    userService.canCreateTeam.mockResolvedValue(true);

    const result = await teamService.createTeam("U_ADMIN", "C123", teamData);

    expect(userService.addUserToOrganization).not.toHaveBeenCalled();
    expect(result.status).toBe("ACTIVE");
    expect(result.team.status).toBe("ACTIVE");
  });

  it("throws when the workspace has no organization", async () => {
    userService.getUserOrganization.mockResolvedValue(null);
    userService.getOrganizationByWorkspaceId.mockResolvedValue(null);

    await expect(
      teamService.createTeam("U_NEW", "C123", teamData, "T_UNKNOWN")
    ).rejects.toThrow(/isn't set up with Daily Dose/);
  });

  it("rejects creation when the channel already has a team", async () => {
    userService.getUserOrganization.mockResolvedValue(org);
    userService.canCreateTeam.mockResolvedValue(true);
    prisma.team.findUnique.mockResolvedValue({ id: "existing" });

    await expect(
      teamService.createTeam("U_ADMIN", "C123", teamData)
    ).rejects.toThrow(/already has a team/);
  });
});

describe("teamService.approveTeam / rejectTeam", () => {
  const pendingTeam = {
    id: "t1",
    name: "Eng",
    slackChannelId: "C123",
    status: "PENDING",
    organizationId: "o1",
    organization: org,
    members: [{ user: { slackUserId: "U_CREATOR" } }],
  };

  it("approves a pending team as an org admin", async () => {
    prisma.team.findUnique.mockResolvedValue(pendingTeam);
    permissionHelper.isOrganizationOwner.mockResolvedValue(false);
    permissionHelper.isOrganizationAdmin.mockResolvedValue(true);
    prisma.team.update.mockResolvedValue({
      ...pendingTeam,
      status: "ACTIVE",
    });

    const result = await teamService.approveTeam("U_ADMIN", "t1");

    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { status: "ACTIVE" },
    });
    expect(result.team.status).toBe("ACTIVE");
    expect(result.creatorSlackUserId).toBe("U_CREATOR");
  });

  it("blocks approval from a non-admin", async () => {
    prisma.team.findUnique.mockResolvedValue(pendingTeam);
    permissionHelper.isOrganizationOwner.mockResolvedValue(false);
    permissionHelper.isOrganizationAdmin.mockResolvedValue(false);

    await expect(teamService.approveTeam("U_RANDOM", "t1")).rejects.toThrow(
      /Only organization admins/
    );
    expect(prisma.team.update).not.toHaveBeenCalled();
  });

  it("rejects (deletes) a pending team as an org admin", async () => {
    prisma.team.findUnique.mockResolvedValue(pendingTeam);
    permissionHelper.isOrganizationOwner.mockResolvedValue(true);
    permissionHelper.isOrganizationAdmin.mockResolvedValue(false);

    const result = await teamService.rejectTeam("U_OWNER", "t1");

    expect(prisma.team.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(result.creatorSlackUserId).toBe("U_CREATOR");
  });

  it("refuses to act on a team that is not pending", async () => {
    prisma.team.findUnique.mockResolvedValue({
      ...pendingTeam,
      status: "ACTIVE",
    });
    permissionHelper.isOrganizationOwner.mockResolvedValue(true);
    permissionHelper.isOrganizationAdmin.mockResolvedValue(false);

    await expect(teamService.approveTeam("U_OWNER", "t1")).rejects.toThrow(
      /already been active/
    );
  });
});
