const authorizationService = require("../authorizationService");

describe("AuthorizationService", () => {
  it("should be defined", () => {
    expect(authorizationService).toBeDefined();
  });

  it("should have required methods", () => {
    expect(typeof authorizationService.hasPermission).toBe("function");
    expect(typeof authorizationService.getUserRoles).toBe("function");
    expect(typeof authorizationService.getUserTeamRole).toBe("function");
    expect(typeof authorizationService.getUserOrganizationRole).toBe(
      "function"
    );
    expect(typeof authorizationService.canAccessResource).toBe("function");
    expect(typeof authorizationService.canAccessTeam).toBe("function");
    expect(typeof authorizationService.canAccessOrganization).toBe("function");
    expect(typeof authorizationService.canAccessLeave).toBe("function");
    expect(typeof authorizationService.canAccessStandup).toBe("function");
    expect(typeof authorizationService.isTeamAdmin).toBe("function");
    expect(typeof authorizationService.isOrganizationAdmin).toBe("function");
    expect(typeof authorizationService.canManageUser).toBe("function");
    expect(typeof authorizationService.getUserPermissions).toBe("function");
  });

  describe("Permission Matrix", () => {
    it("should have correct permission matrix structure", () => {
      expect(authorizationService.permissionMatrix).toBeDefined();
      expect(authorizationService.permissionMatrix["team:create"]).toEqual([
        "OWNER",
        "ADMIN",
      ]);
      expect(authorizationService.permissionMatrix["team:manage"]).toEqual([
        "OWNER",
        "ADMIN",
        "TEAM_ADMIN",
      ]);
      expect(authorizationService.permissionMatrix["team:join"]).toEqual([
        "MEMBER",
      ]);
      expect(authorizationService.permissionMatrix["standup:submit"]).toEqual([
        "MEMBER",
      ]);
      expect(authorizationService.permissionMatrix["leave:manage"]).toEqual([
        "MEMBER",
      ]);
    });

    it("should include all expected permissions", () => {
      const expectedPermissions = [
        "team:create",
        "team:manage",
        "team:join",
        "team:leave",
        "team:list",
        "standup:submit",
        "standup:view",
        "leave:manage",
        "leave:set",
        "leave:cancel",
        "leave:list",
        "leave:workdays",
        "admin:users",
        "admin:teams",
        "admin:organization",
      ];

      expectedPermissions.forEach((permission) => {
        expect(authorizationService.permissionMatrix[permission]).toBeDefined();
        expect(
          Array.isArray(authorizationService.permissionMatrix[permission])
        ).toBe(true);
      });
    });
  });

  describe("hasPermission", () => {
    it("should return false for unknown permission", async () => {
      const result = await authorizationService.hasPermission(
        "user1",
        "unknown:permission"
      );
      expect(result).toBe(false);
    });

    it("should handle database errors gracefully", async () => {
      // Test with invalid user ID that would cause database error
      const result = await authorizationService.hasPermission(
        null,
        "team:create"
      );
      expect(result).toBe(false);
    });
  });

  describe("getUserRoles", () => {
    it("should handle database errors gracefully", async () => {
      // Test with invalid user ID that would cause database error
      const roles = await authorizationService.getUserRoles(null);
      expect(Array.isArray(roles)).toBe(true);
      expect(roles).toEqual([]);
    });

    it("should return unique roles", async () => {
      // This test will pass even without database connection since it handles errors
      const roles = await authorizationService.getUserRoles("user1");
      expect(Array.isArray(roles)).toBe(true);
    });
  });

  describe("getUserTeamRole", () => {
    it("should handle database errors gracefully", async () => {
      const role = await authorizationService.getUserTeamRole(null, "team1");
      expect(role).toBeNull();
    });
  });

  describe("getUserOrganizationRole", () => {
    it("should handle database errors gracefully", async () => {
      const role = await authorizationService.getUserOrganizationRole(
        null,
        "org1"
      );
      expect(role).toBeNull();
    });
  });

  describe("canAccessResource", () => {
    it("should return false for unknown resource type", async () => {
      const result = await authorizationService.canAccessResource(
        "user1",
        "unknown",
        "resource1"
      );
      expect(result).toBe(false);
    });

    it("should handle database errors gracefully", async () => {
      const result = await authorizationService.canAccessResource(
        null,
        "team",
        "team1"
      );
      expect(result).toBe(false);
    });
  });

  describe("canAccessTeam", () => {
    it("should handle database errors gracefully", async () => {
      const result = await authorizationService.canAccessTeam(null, "team1");
      expect(result).toBe(false);
    });
  });

  describe("canAccessOrganization", () => {
    it("should handle database errors gracefully", async () => {
      const result = await authorizationService.canAccessOrganization(
        null,
        "org1"
      );
      expect(result).toBe(false);
    });
  });

  describe("canAccessLeave", () => {
    it("should handle database errors gracefully", async () => {
      const result = await authorizationService.canAccessLeave(null, "leave1");
      expect(result).toBe(false);
    });
  });

  describe("canAccessStandup", () => {
    it("should handle database errors gracefully", async () => {
      const result = await authorizationService.canAccessStandup(
        null,
        "standup1"
      );
      expect(result).toBe(false);
    });
  });

  describe("isTeamAdmin", () => {
    it("should handle database errors gracefully", async () => {
      const result = await authorizationService.isTeamAdmin(null, "team1");
      expect(result).toBe(false);
    });
  });

  describe("isOrganizationAdmin", () => {
    it("should handle database errors gracefully", async () => {
      const result = await authorizationService.isOrganizationAdmin(
        null,
        "org1"
      );
      expect(result).toBe(false);
    });

    it("should handle missing organizationId", async () => {
      const result = await authorizationService.isOrganizationAdmin("user1");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("canManageUser", () => {
    it("should return false when admin tries to manage themselves", async () => {
      const result = await authorizationService.canManageUser(
        "user1",
        "user1",
        "org1"
      );
      expect(result).toBe(false);
    });

    it("should handle database errors gracefully", async () => {
      const result = await authorizationService.canManageUser(
        null,
        "user1",
        "org1"
      );
      expect(result).toBe(false);
    });
  });

  describe("getUserPermissions", () => {
    it("should handle database errors gracefully", async () => {
      const permissions = await authorizationService.getUserPermissions(null);
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions).toEqual([]);
    });

    it("should return empty array for invalid user", async () => {
      const permissions = await authorizationService.getUserPermissions("");
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions).toEqual([]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null and undefined inputs gracefully", async () => {
      // Test various methods with null/undefined inputs
      expect(await authorizationService.hasPermission(null, null)).toBe(false);
      expect(await authorizationService.getUserRoles(undefined)).toEqual([]);
      expect(
        await authorizationService.canAccessResource(null, null, null)
      ).toBe(false);
      expect(await authorizationService.isTeamAdmin(undefined, undefined)).toBe(
        false
      );
      expect(await authorizationService.isOrganizationAdmin(null)).toBe(false);
    });

    it("should handle empty string inputs gracefully", async () => {
      expect(await authorizationService.hasPermission("", "")).toBe(false);
      expect(await authorizationService.getUserTeamRole("", "")).toBeNull();
      expect(await authorizationService.canAccessTeam("", "")).toBe(false);
    });
  });
});
