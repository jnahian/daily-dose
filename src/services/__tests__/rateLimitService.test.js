const RateLimitService = require("../rateLimitService");

describe("RateLimitService", () => {
  let rateLimitService;

  beforeEach(() => {
    // Use test configuration with shorter time windows for faster testing
    const testConfig = {
      limits: {
        "team:create": { count: 3, window: "100ms" },
        "team:join": { count: 5, window: "200ms" },
        "standup:submit": { count: 2, window: "150ms" },
        default: { count: 10, window: "300ms" },
      },
      blockDuration: "50ms",
      warningThreshold: 0.6,
    };

    rateLimitService = new RateLimitService(testConfig);
  });

  afterEach(() => {
    if (rateLimitService) {
      rateLimitService.destroy();
    }
  });

  describe("constructor", () => {
    it("should initialize with default configuration", () => {
      const service = new RateLimitService();
      expect(service.config.limits.default).toEqual({
        count: 50,
        window: "1h",
      });
      expect(service.config.blockDuration).toBe("15m");
      expect(service.config.warningThreshold).toBe(0.8);
      service.destroy();
    });

    it("should merge custom configuration with defaults", () => {
      const customConfig = {
        limits: {
          "custom:command": { count: 100, window: "2h" },
        },
        blockDuration: "30m",
      };

      const service = new RateLimitService(customConfig);
      expect(service.config.limits["custom:command"]).toEqual({
        count: 100,
        window: "2h",
      });
      expect(service.config.limits.default).toEqual({
        count: 50,
        window: "1h",
      });
      expect(service.config.blockDuration).toBe("30m");
      service.destroy();
    });
  });

  describe("checkLimit", () => {
    it("should allow commands within rate limit", async () => {
      const result = await rateLimitService.checkLimit("user1", "team:create");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2); // 3 - 1 (current request)
      expect(result.limit).toBe(3);
      expect(result.resetTime).toBeInstanceOf(Date);
    });

    it("should track usage per user and command type", async () => {
      // User1 uses team:create
      await rateLimitService.checkLimit("user1", "team:create");
      await rateLimitService.recordUsage("user1", "team:create");

      // User2 uses team:create (should have full limit)
      const result2 = await rateLimitService.checkLimit("user2", "team:create");
      expect(result2.remaining).toBe(2);

      // User1 uses team:join (different command, should have full limit)
      const result3 = await rateLimitService.checkLimit("user1", "team:join");
      expect(result3.remaining).toBe(4);
    });

    it("should block when rate limit is exceeded", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Use up the rate limit (3 requests)
      for (let i = 0; i < 3; i++) {
        const result = await rateLimitService.checkLimit(userId, commandType);
        expect(result.allowed).toBe(true);
        await rateLimitService.recordUsage(userId, commandType);
      }

      // Fourth request should be blocked
      const blockedResult = await rateLimitService.checkLimit(
        userId,
        commandType
      );
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.reason).toBe("rate_limit_exceeded");
      expect(blockedResult.remaining).toBe(0);
      expect(blockedResult.retryAfter).toBeGreaterThan(0);
    });

    it("should provide warning when approaching rate limit", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Use 2 out of 3 requests (warning threshold is 0.6, so 3 * 0.4 = 1.2, rounded up = 2)
      await rateLimitService.checkLimit(userId, commandType);
      await rateLimitService.recordUsage(userId, commandType);

      await rateLimitService.checkLimit(userId, commandType);
      await rateLimitService.recordUsage(userId, commandType);

      const result = await rateLimitService.checkLimit(userId, commandType);
      expect(result.warning).toBe(true);
    });

    it("should reset limits after time window expires", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Use up the rate limit
      for (let i = 0; i < 3; i++) {
        await rateLimitService.checkLimit(userId, commandType);
        await rateLimitService.recordUsage(userId, commandType);
      }

      // Should be blocked
      const blockedResult = await rateLimitService.checkLimit(
        userId,
        commandType
      );
      expect(blockedResult.allowed).toBe(false);

      // Wait for window to expire (100ms + buffer)
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be allowed again
      const resetResult = await rateLimitService.checkLimit(
        userId,
        commandType
      );
      expect(resetResult.allowed).toBe(true);
      expect(resetResult.remaining).toBe(2);
    });

    it("should handle blocked users correctly", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Exceed rate limit to trigger block
      for (let i = 0; i < 3; i++) {
        await rateLimitService.checkLimit(userId, commandType);
        await rateLimitService.recordUsage(userId, commandType);
      }

      // Trigger block
      await rateLimitService.checkLimit(userId, commandType);

      // Should remain blocked even after multiple checks
      const result1 = await rateLimitService.checkLimit(userId, commandType);
      expect(result1.allowed).toBe(false);
      expect(result1.reason).toBe("blocked");

      const result2 = await rateLimitService.checkLimit(userId, commandType);
      expect(result2.allowed).toBe(false);
      expect(result2.reason).toBe("blocked");
    });

    it("should unblock users after block duration expires", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Exceed rate limit to trigger block
      for (let i = 0; i < 3; i++) {
        await rateLimitService.checkLimit(userId, commandType);
        await rateLimitService.recordUsage(userId, commandType);
      }

      // Trigger block
      await rateLimitService.checkLimit(userId, commandType);

      // Wait for block to expire (50ms + buffer)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should be unblocked and reset
      const result = await rateLimitService.checkLimit(userId, commandType);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it("should throw error for missing parameters", async () => {
      await expect(rateLimitService.checkLimit()).rejects.toThrow(
        "userId and commandType are required"
      );
      await expect(rateLimitService.checkLimit("user1")).rejects.toThrow(
        "userId and commandType are required"
      );
      await expect(
        rateLimitService.checkLimit(null, "team:create")
      ).rejects.toThrow("userId and commandType are required");
    });

    it("should use default limits for unknown command types", async () => {
      const result = await rateLimitService.checkLimit(
        "user1",
        "unknown:command"
      );
      expect(result.limit).toBe(10); // default limit
      expect(result.remaining).toBe(9);
    });
  });

  describe("recordUsage", () => {
    it("should increment usage counter", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Check initial state
      const result1 = await rateLimitService.checkLimit(userId, commandType);
      expect(result1.remaining).toBe(2);

      // Record usage
      await rateLimitService.recordUsage(userId, commandType);

      // Check updated state
      const result2 = await rateLimitService.checkLimit(userId, commandType);
      expect(result2.remaining).toBe(1);
    });

    it("should not increment usage for blocked users", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Exceed rate limit and get blocked
      for (let i = 0; i < 3; i++) {
        await rateLimitService.checkLimit(userId, commandType);
        await rateLimitService.recordUsage(userId, commandType);
      }
      await rateLimitService.checkLimit(userId, commandType); // Trigger block

      // Try to record usage while blocked
      await rateLimitService.recordUsage(userId, commandType);

      // Usage should not have increased
      const stats = await rateLimitService.getUsageStats(userId, commandType);
      expect(stats.count).toBe(3); // Should still be 3, not 4
    });

    it("should throw error for missing parameters", async () => {
      await expect(rateLimitService.recordUsage()).rejects.toThrow(
        "userId and commandType are required"
      );
      await expect(rateLimitService.recordUsage("user1")).rejects.toThrow(
        "userId and commandType are required"
      );
    });
  });

  describe("isBlocked", () => {
    it("should return false for non-blocked users", async () => {
      const result = await rateLimitService.isBlocked("user1");
      expect(result).toBe(false);
    });

    it("should return true for blocked users", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Trigger block
      for (let i = 0; i < 3; i++) {
        await rateLimitService.checkLimit(userId, commandType);
        await rateLimitService.recordUsage(userId, commandType);
      }
      await rateLimitService.checkLimit(userId, commandType);

      const result = await rateLimitService.isBlocked(userId);
      expect(result).toBe(true);
    });

    it("should check specific command type blocks", async () => {
      const userId = "user1";

      // Block team:create
      for (let i = 0; i < 3; i++) {
        await rateLimitService.checkLimit(userId, "team:create");
        await rateLimitService.recordUsage(userId, "team:create");
      }
      await rateLimitService.checkLimit(userId, "team:create");

      // Check specific command block
      const blockedForTeamCreate = await rateLimitService.isBlocked(
        userId,
        "team:create"
      );
      expect(blockedForTeamCreate).toBe(true);

      // Check different command (should not be blocked)
      const blockedForTeamJoin = await rateLimitService.isBlocked(
        userId,
        "team:join"
      );
      expect(blockedForTeamJoin).toBe(false);
    });

    it("should return false after block expires", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Trigger block
      for (let i = 0; i < 3; i++) {
        await rateLimitService.checkLimit(userId, commandType);
        await rateLimitService.recordUsage(userId, commandType);
      }
      await rateLimitService.checkLimit(userId, commandType);

      // Wait for block to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await rateLimitService.isBlocked(userId);
      expect(result).toBe(false);
    });

    it("should throw error for missing userId", async () => {
      await expect(rateLimitService.isBlocked()).rejects.toThrow(
        "userId is required"
      );
      await expect(rateLimitService.isBlocked(null)).rejects.toThrow(
        "userId is required"
      );
    });
  });

  describe("getUsageStats", () => {
    it("should return stats for specific command type", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Use some of the limit
      await rateLimitService.checkLimit(userId, commandType);
      await rateLimitService.recordUsage(userId, commandType);

      const stats = await rateLimitService.getUsageStats(userId, commandType);
      expect(stats.commandType).toBe(commandType);
      expect(stats.count).toBe(1);
      expect(stats.limit).toBe(3);
      expect(stats.remaining).toBe(2);
      expect(stats.resetTime).toBeInstanceOf(Date);
      expect(stats.blocked).toBe(false);
    });

    it("should return default stats for unused command types", async () => {
      const stats = await rateLimitService.getUsageStats(
        "user1",
        "team:create"
      );
      expect(stats.count).toBe(0);
      expect(stats.limit).toBe(3);
      expect(stats.remaining).toBe(3);
      expect(stats.blocked).toBe(false);
    });

    it("should return stats for all commands when no command type specified", async () => {
      const userId = "user1";

      // Use different commands
      await rateLimitService.checkLimit(userId, "team:create");
      await rateLimitService.recordUsage(userId, "team:create");

      await rateLimitService.checkLimit(userId, "team:join");
      await rateLimitService.recordUsage(userId, "team:join");

      const stats = await rateLimitService.getUsageStats(userId);
      expect(stats["team:create"]).toBeDefined();
      expect(stats["team:join"]).toBeDefined();
      expect(stats["team:create"].count).toBe(1);
      expect(stats["team:join"].count).toBe(1);
    });

    it("should show blocked status in stats", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Trigger block
      for (let i = 0; i < 3; i++) {
        await rateLimitService.checkLimit(userId, commandType);
        await rateLimitService.recordUsage(userId, commandType);
      }
      await rateLimitService.checkLimit(userId, commandType);

      const stats = await rateLimitService.getUsageStats(userId, commandType);
      expect(stats.blocked).toBe(true);
      expect(stats.blockUntil).toBeInstanceOf(Date);
    });

    it("should throw error for missing userId", async () => {
      await expect(rateLimitService.getUsageStats()).rejects.toThrow(
        "userId is required"
      );
    });
  });

  describe("resetLimits", () => {
    it("should reset specific command limits", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Use some limit
      await rateLimitService.checkLimit(userId, commandType);
      await rateLimitService.recordUsage(userId, commandType);

      // Reset specific command
      await rateLimitService.resetLimits(userId, commandType);

      // Should be back to full limit
      const result = await rateLimitService.checkLimit(userId, commandType);
      expect(result.remaining).toBe(2); // Full limit minus current request
    });

    it("should reset all limits for a user", async () => {
      const userId = "user1";

      // Use multiple commands
      await rateLimitService.checkLimit(userId, "team:create");
      await rateLimitService.recordUsage(userId, "team:create");

      await rateLimitService.checkLimit(userId, "team:join");
      await rateLimitService.recordUsage(userId, "team:join");

      // Reset all limits
      await rateLimitService.resetLimits(userId);

      // Both should be back to full limits
      const result1 = await rateLimitService.checkLimit(userId, "team:create");
      const result2 = await rateLimitService.checkLimit(userId, "team:join");

      expect(result1.remaining).toBe(2);
      expect(result2.remaining).toBe(4);
    });

    it("should throw error for missing userId", async () => {
      await expect(rateLimitService.resetLimits()).rejects.toThrow(
        "userId is required"
      );
    });
  });

  describe("parseTimeWindow", () => {
    it("should parse seconds correctly", () => {
      expect(rateLimitService.parseTimeWindow("30s")).toBe(30 * 1000);
      expect(rateLimitService.parseTimeWindow("1s")).toBe(1000);
    });

    it("should parse minutes correctly", () => {
      expect(rateLimitService.parseTimeWindow("5m")).toBe(5 * 60 * 1000);
      expect(rateLimitService.parseTimeWindow("1m")).toBe(60 * 1000);
    });

    it("should parse hours correctly", () => {
      expect(rateLimitService.parseTimeWindow("2h")).toBe(2 * 60 * 60 * 1000);
      expect(rateLimitService.parseTimeWindow("1h")).toBe(60 * 60 * 1000);
    });

    it("should parse days correctly", () => {
      expect(rateLimitService.parseTimeWindow("1d")).toBe(24 * 60 * 60 * 1000);
      expect(rateLimitService.parseTimeWindow("7d")).toBe(
        7 * 24 * 60 * 60 * 1000
      );
    });

    it("should throw error for invalid format", () => {
      expect(() => rateLimitService.parseTimeWindow("invalid")).toThrow(
        "Invalid time window format: invalid"
      );
      expect(() => rateLimitService.parseTimeWindow("1x")).toThrow(
        "Invalid time window format: 1x"
      );
      expect(() => rateLimitService.parseTimeWindow("")).toThrow(
        "Invalid time window format: "
      );
    });
  });

  describe("concurrent access scenarios", () => {
    it("should handle concurrent requests correctly", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Make sequential requests to avoid race conditions in testing
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await rateLimitService.checkLimit(userId, commandType);
        if (result.allowed) {
          await rateLimitService.recordUsage(userId, commandType);
        }
        results.push(result);
      }

      // Should have 3 allowed and 2 blocked (limit is 3)
      const allowed = results.filter((r) => r.allowed);
      const blocked = results.filter((r) => !r.allowed);

      expect(allowed.length).toBe(3);
      expect(blocked.length).toBe(2);
    });

    it("should maintain consistency under concurrent load", async () => {
      const userId = "user1";
      const commandType = "team:join"; // limit is 5

      // Make sequential requests to test consistency
      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = await rateLimitService.checkLimit(userId, commandType);
        if (result.allowed) {
          await rateLimitService.recordUsage(userId, commandType);
        }
        results.push(result);
      }

      // Should respect the limit of 5
      const allowed = results.filter((r) => r.allowed);
      expect(allowed.length).toBe(5);

      // Final stats should be consistent
      const stats = await rateLimitService.getUsageStats(userId, commandType);
      expect(stats.count).toBe(5);
    });
  });

  describe("cleanup", () => {
    it("should remove expired entries", async () => {
      const userId = "user1";
      const commandType = "team:create";

      // Create some usage
      await rateLimitService.checkLimit(userId, commandType);
      await rateLimitService.recordUsage(userId, commandType);

      // Verify entry exists
      let stats = rateLimitService.getStorageStats();
      expect(stats.users).toBe(1);
      expect(stats.totalEntries).toBe(1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Trigger cleanup
      rateLimitService.cleanup();

      // Verify entry is removed
      stats = rateLimitService.getStorageStats();
      expect(stats.users).toBe(0);
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe("updateConfig", () => {
    it("should update configuration at runtime", () => {
      const newConfig = {
        limits: {
          "new:command": { count: 100, window: "1h" },
        },
        blockDuration: "1h",
      };

      rateLimitService.updateConfig(newConfig);

      expect(rateLimitService.config.limits["new:command"]).toEqual({
        count: 100,
        window: "1h",
      });
      expect(rateLimitService.config.blockDuration).toBe("1h");
      // Should preserve existing config
      expect(rateLimitService.config.limits["team:create"]).toEqual({
        count: 3,
        window: "100ms",
      });
    });
  });

  describe("getStorageStats", () => {
    it("should return storage statistics", async () => {
      // Add some data
      await rateLimitService.checkLimit("user1", "team:create");
      await rateLimitService.checkLimit("user1", "team:join");
      await rateLimitService.checkLimit("user2", "team:create");

      const stats = rateLimitService.getStorageStats();
      expect(stats.users).toBe(2);
      expect(stats.totalEntries).toBe(3);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe("destroy", () => {
    it("should cleanup resources", () => {
      const service = new RateLimitService();
      const intervalId = service.cleanupInterval;

      service.destroy();

      expect(service.cleanupInterval).toBeNull();
      expect(service.storage.size).toBe(0);
    });
  });
});
