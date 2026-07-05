jest.mock("../../../src/config/prisma", () => ({
  zohoUserMapping: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
}));
jest.mock("../../../src/services/userService", () => ({
  fetchSlackUserData: jest.fn().mockResolvedValue({}),
  findOrCreateUser: jest.fn(),
}));

const prisma = require("../../../src/config/prisma");
const userService = require("../../../src/services/userService");
const zohoMappingService = require("../../../src/services/zoho/zohoMappingService");

describe("zohoMappingService", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("mapMember", () => {
    it("upserts a mapping keyed on organizationId+userId", async () => {
      userService.findOrCreateUser.mockResolvedValue({ id: "user-1" });
      prisma.zohoUserMapping.findUnique.mockResolvedValue(null);
      prisma.zohoUserMapping.upsert.mockResolvedValue({ id: "map-1" });

      await zohoMappingService.mapMember("org-1", "U123", "4506000000012345");

      expect(prisma.zohoUserMapping.upsert).toHaveBeenCalledWith({
        where: {
          organizationId_userId: { organizationId: "org-1", userId: "user-1" },
        },
        update: { zohoEmployeeId: "4506000000012345" },
        create: {
          organizationId: "org-1",
          userId: "user-1",
          zohoEmployeeId: "4506000000012345",
        },
      });
    });

    it("rejects a Zoho employee ID already mapped to a different Slack user", async () => {
      userService.findOrCreateUser.mockResolvedValue({ id: "user-1" });
      prisma.zohoUserMapping.findUnique.mockResolvedValue({
        userId: "user-2",
      });

      await expect(
        zohoMappingService.mapMember("org-1", "U123", "emp-1")
      ).rejects.toThrow(/already mapped/);
      expect(prisma.zohoUserMapping.upsert).not.toHaveBeenCalled();
    });

    it("allows re-mapping the same user to the same employee ID (idempotent)", async () => {
      userService.findOrCreateUser.mockResolvedValue({ id: "user-1" });
      prisma.zohoUserMapping.findUnique.mockResolvedValue({
        userId: "user-1",
      });
      prisma.zohoUserMapping.upsert.mockResolvedValue({ id: "map-1" });

      await expect(
        zohoMappingService.mapMember("org-1", "U123", "emp-1")
      ).resolves.toBeDefined();
    });

    it("rejects a non-string employee ID", async () => {
      await expect(
        zohoMappingService.mapMember("org-1", "U123", null)
      ).rejects.toThrow(/Zoho employee ID is required/);
    });
  });

  describe("unmapMember", () => {
    it("deletes the mapping for the target user", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      prisma.zohoUserMapping.deleteMany.mockResolvedValue({ count: 1 });

      await zohoMappingService.unmapMember("org-1", "U123");

      expect(prisma.zohoUserMapping.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", userId: "user-1" },
      });
    });

    it("throws when the user has no mapping", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      prisma.zohoUserMapping.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        zohoMappingService.unmapMember("org-1", "U123")
      ).rejects.toThrow(/no Zoho mapping/);
    });

    it("throws when the user doesn't exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        zohoMappingService.unmapMember("org-1", "U123")
      ).rejects.toThrow(/User not found/);
    });
  });

  describe("getUserIdsByEmployeeId", () => {
    it("returns a Map keyed by the (string) Zoho employee ID", async () => {
      prisma.zohoUserMapping.findMany.mockResolvedValue([
        { zohoEmployeeId: "emp-1", userId: "user-1" },
        { zohoEmployeeId: "emp-2", userId: "user-2" },
      ]);

      const map = await zohoMappingService.getUserIdsByEmployeeId("org-1");

      expect(map.get("emp-1")).toBe("user-1");
      expect(map.get("emp-2")).toBe("user-2");
      expect(map.size).toBe(2);
    });
  });
});
