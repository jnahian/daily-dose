jest.mock("../../src/config/prisma", () => ({
  zohoCredential: { findUnique: jest.fn() },
  zohoSyncRun: { findMany: jest.fn() },
}));
jest.mock("../../src/services/userService", () => ({
  fetchSlackUserData: jest.fn().mockResolvedValue({}),
  findOrCreateUser: jest.fn(),
  getUserOrganization: jest.fn(),
  canCreateTeam: jest.fn(),
}));
jest.mock("../../src/services/zoho/zohoMappingService", () => ({
  mapMember: jest.fn(),
  unmapMember: jest.fn(),
  listMappings: jest.fn(),
}));

const prisma = require("../../src/config/prisma");
const userService = require("../../src/services/userService");
const zohoMappingService = require("../../src/services/zoho/zohoMappingService");
const zohoCommands = require("../../src/commands/zoho");

function makeCommand(text) {
  return { user_id: "U_ADMIN", command: "/dd-zoho-map-member", text };
}

describe("zoho commands", () => {
  let ack, respond;

  beforeEach(() => {
    jest.clearAllMocks();
    ack = jest.fn().mockResolvedValue();
    respond = jest.fn().mockResolvedValue();
    userService.findOrCreateUser.mockResolvedValue({ id: "user-1" });
    userService.getUserOrganization.mockResolvedValue({ id: "org-1" });
  });

  describe("mapMember", () => {
    it("rejects non-admins before touching the mapping service", async () => {
      userService.canCreateTeam.mockResolvedValue(false);

      await zohoCommands.mapMember({
        command: makeCommand("<@U123|john> emp-1"),
        ack,
        respond,
        client: {},
      });

      expect(zohoMappingService.mapMember).not.toHaveBeenCalled();
      const response = respond.mock.calls[0][0];
      expect(response.blocks[0].text.text).toMatch(/admin permissions/);
    });

    it("maps the mentioned user to the given Zoho employee ID", async () => {
      userService.canCreateTeam.mockResolvedValue(true);
      zohoMappingService.mapMember.mockResolvedValue({});

      await zohoCommands.mapMember({
        command: makeCommand("<@U123|john> ZP-0012345"),
        ack,
        respond,
        client: {},
      });

      expect(zohoMappingService.mapMember).toHaveBeenCalledWith(
        "org-1",
        "U123",
        "ZP-0012345",
        {}
      );
      expect(respond.mock.calls[0][0].text).toMatch(/Mapped/);
    });

    it("shows a usage error for an invalid mention", async () => {
      userService.canCreateTeam.mockResolvedValue(true);

      await zohoCommands.mapMember({
        command: makeCommand("not-a-mention emp-1"),
        ack,
        respond,
        client: {},
      });

      expect(zohoMappingService.mapMember).not.toHaveBeenCalled();
      expect(respond.mock.calls[0][0].blocks[0].text.text).toMatch(
        /Invalid user mention/
      );
    });
  });

  describe("unmapMember", () => {
    it("removes the mapping for the mentioned user", async () => {
      userService.canCreateTeam.mockResolvedValue(true);
      zohoMappingService.unmapMember.mockResolvedValue({ count: 1 });

      await zohoCommands.unmapMember({
        command: makeCommand("<@U123|john>"),
        ack,
        respond,
        client: {},
      });

      expect(zohoMappingService.unmapMember).toHaveBeenCalledWith(
        "org-1",
        "U123"
      );
    });
  });

  describe("listMappings", () => {
    it("formats each mapping as a mention + employee ID line", async () => {
      userService.canCreateTeam.mockResolvedValue(true);
      zohoMappingService.listMappings.mockResolvedValue([
        { zohoEmployeeId: "emp-1", user: { slackUserId: "U123" } },
      ]);

      await zohoCommands.listMappings({
        command: makeCommand(""),
        ack,
        respond,
        client: {},
      });

      expect(respond.mock.calls[0][0].blocks[0].text.text).toContain(
        "<@U123> → Zoho employee ID emp-1"
      );
    });
  });

  describe("syncStatus", () => {
    it("reports when Zoho isn't connected yet", async () => {
      userService.canCreateTeam.mockResolvedValue(true);
      prisma.zohoCredential.findUnique.mockResolvedValue(null);

      await zohoCommands.syncStatus({
        command: makeCommand(""),
        ack,
        respond,
        client: {},
      });

      expect(respond.mock.calls[0][0].text).toMatch(/isn't connected/);
    });

    it("summarizes the latest run per sync type", async () => {
      userService.canCreateTeam.mockResolvedValue(true);
      prisma.zohoCredential.findUnique.mockResolvedValue({
        enabled: true,
        dataCenter: "com",
      });
      prisma.zohoSyncRun.findMany.mockResolvedValue([
        {
          syncType: "HOLIDAY",
          status: "SUCCESS",
          recordsSynced: 3,
          startedAt: new Date(),
          error: null,
        },
      ]);

      await zohoCommands.syncStatus({
        command: makeCommand(""),
        ack,
        respond,
        client: {},
      });

      const text = respond.mock.calls[0][0].blocks[0].text.text;
      expect(text).toContain("HOLIDAY");
      expect(text).toContain("LEAVE: never synced");
    });
  });
});
