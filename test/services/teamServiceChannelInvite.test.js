jest.mock("../../src/config/prisma", () => ({
  team: { findUnique: jest.fn(), create: jest.fn() },
  teamMember: { findUnique: jest.fn(), upsert: jest.fn(), create: jest.fn() },
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
jest.mock("../../src/services/channelService", () => ({
  inviteUserToOrgChannel: jest.fn().mockResolvedValue(true),
  ensureOrgChannel: jest.fn(),
}));

const prisma = require("../../src/config/prisma");
const userService = require("../../src/services/userService");
const channelService = require("../../src/services/channelService");
const teamService = require("../../src/services/teamService");

beforeEach(() => {
  jest.clearAllMocks();
  userService.findOrCreateUser.mockResolvedValue({ id: "u1" });
});

it("joinTeam invites the user to the org channel", async () => {
  prisma.team.findUnique.mockResolvedValue({
    id: "t1",
    organizationId: "o1",
    organization: { id: "o1" },
  });
  userService.getUserOrganization.mockResolvedValue({ id: "o1" });
  prisma.teamMember.findUnique.mockResolvedValue(null);
  prisma.teamMember.upsert.mockResolvedValue({ id: "tm1" });

  const client = { conversations: {} };
  await teamService.joinTeam("U1", "t1", client);

  expect(channelService.inviteUserToOrgChannel).toHaveBeenCalledWith(
    client,
    "o1",
    "U1"
  );
});

it("createTeam invites the creator to the org channel", async () => {
  userService.getUserOrganization.mockResolvedValue({
    id: "o1",
    defaultTimezone: "UTC",
  });
  userService.canCreateTeam.mockResolvedValue(true);
  prisma.team.findUnique.mockResolvedValue(null); // no existing team for channel
  prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
  prisma.team.create.mockResolvedValue({ id: "t1" });
  prisma.teamMember.create.mockResolvedValue({});

  const client = { conversations: {} };
  await teamService.createTeam(
    "U1",
    "C1",
    { name: "Eng", standupTime: "09:30", postingTime: "10:00" },
    "W1",
    client
  );

  expect(channelService.inviteUserToOrgChannel).toHaveBeenCalledWith(
    client,
    "o1",
    "U1"
  );
});
