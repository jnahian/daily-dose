/**
 * Rate limiting service for command protection
 * Implements configurable rate limits per user per command type with time windows
 */
class RateLimitService {
  constructor(config = {}) {
    // Default rate limit configuration
    const defaultConfig = {
      limits: {
        "team:create": { count: 10, window: "1h" },
        "team:join": { count: 100, window: "1h" },
        "team:leave": { count: 100, window: "1h" },
        "team:list": { count: 200, window: "1h" },
        "standup:submit": { count: 200, window: "1d" },
        "standup:modal": { count: 300, window: "1h" },
        "leave:set": { count: 30, window: "1d" },
        "leave:cancel": { count: 30, window: "1d" },
        "leave:list": { count: 50, window: "1h" },
        "workdays:set": { count: 50, window: "1d" },
        default: { count: 50, window: "1h" },
      },
      blockDuration: "15m",
      warningThreshold: 0.8,
    };

    this.config = {
      ...defaultConfig,
      ...config,
      limits: {
        ...defaultConfig.limits,
        ...(config.limits || {}),
      },
    };

    // In-memory storage for rate limit tracking
    // Structure: { userId: { commandType: { count, resetTime, blocked, blockUntil } } }
    this.storage = new Map();

    // Cleanup interval to remove expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  /**
   * Check if a user can execute a command (rate limit check)
   * @param {string} userId - User ID
   * @param {string} commandType - Command type (e.g., 'team:create')
   * @returns {Promise<object>} Rate limit check result
   */
  async checkLimit(userId, commandType) {
    if (!userId || !commandType) {
      throw new Error("userId and commandType are required");
    }

    const now = Date.now();
    const userLimits = this.getUserLimits(userId);
    const commandLimit =
      userLimits.get(commandType) || this.createNewLimit(commandType, now);

    // Check if user is currently blocked
    if (commandLimit.blocked && commandLimit.blockUntil > now) {
      return {
        allowed: false,
        reason: "blocked",
        resetTime: new Date(commandLimit.blockUntil),
        remaining: 0,
        limit: this.getLimitConfig(commandType).count,
        retryAfter: Math.ceil((commandLimit.blockUntil - now) / 1000),
      };
    }

    // Clear block if expired
    if (commandLimit.blocked && commandLimit.blockUntil <= now) {
      commandLimit.blocked = false;
      commandLimit.blockUntil = null;
      commandLimit.count = 0;
      commandLimit.resetTime =
        now + this.parseTimeWindow(this.getLimitConfig(commandType).window);
    }

    // Reset count if window has expired
    if (now >= commandLimit.resetTime) {
      commandLimit.count = 0;
      commandLimit.resetTime =
        now + this.parseTimeWindow(this.getLimitConfig(commandType).window);
    }

    const limitConfig = this.getLimitConfig(commandType);
    const remaining = Math.max(0, limitConfig.count - commandLimit.count);

    // Check if limit would be exceeded
    if (commandLimit.count >= limitConfig.count) {
      // Block the user temporarily
      commandLimit.blocked = true;
      commandLimit.blockUntil =
        now + this.parseTimeWindow(this.config.blockDuration);

      return {
        allowed: false,
        reason: "rate_limit_exceeded",
        resetTime: new Date(commandLimit.resetTime),
        remaining: 0,
        limit: limitConfig.count,
        retryAfter: Math.ceil((commandLimit.blockUntil - now) / 1000),
      };
    }

    // Update storage
    userLimits.set(commandType, commandLimit);
    this.storage.set(userId, userLimits);

    return {
      allowed: true,
      remaining: remaining - 1, // Account for the current request
      limit: limitConfig.count,
      resetTime: new Date(commandLimit.resetTime),
      warning:
        remaining <=
        Math.ceil(limitConfig.count * (1 - this.config.warningThreshold)),
    };
  }

  /**
   * Record command usage (increment counter)
   * @param {string} userId - User ID
   * @param {string} commandType - Command type
   * @returns {Promise<void>}
   */
  async recordUsage(userId, commandType) {
    if (!userId || !commandType) {
      throw new Error("userId and commandType are required");
    }

    const userLimits = this.getUserLimits(userId);
    const commandLimit = userLimits.get(commandType);

    if (commandLimit && !commandLimit.blocked) {
      commandLimit.count += 1;
      userLimits.set(commandType, commandLimit);
      this.storage.set(userId, userLimits);
    }
  }

  /**
   * Check if a user is currently blocked
   * @param {string} userId - User ID
   * @param {string} commandType - Optional command type to check specific block
   * @returns {Promise<boolean>}
   */
  async isBlocked(userId, commandType = null) {
    if (!userId) {
      throw new Error("userId is required");
    }

    const now = Date.now();
    const userLimits = this.getUserLimits(userId);

    if (commandType) {
      const commandLimit = userLimits.get(commandType);
      return !!(
        commandLimit &&
        commandLimit.blocked &&
        commandLimit.blockUntil > now
      );
    }

    // Check if user is blocked for any command
    for (const [, limit] of userLimits) {
      if (limit.blocked && limit.blockUntil > now) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get current usage statistics for a user
   * @param {string} userId - User ID
   * @param {string} commandType - Optional command type for specific stats
   * @returns {Promise<object>} Usage statistics
   */
  async getUsageStats(userId, commandType = null) {
    if (!userId) {
      throw new Error("userId is required");
    }

    const now = Date.now();
    const userLimits = this.getUserLimits(userId);

    if (commandType) {
      const commandLimit = userLimits.get(commandType);
      if (!commandLimit) {
        const limitConfig = this.getLimitConfig(commandType);
        return {
          commandType,
          count: 0,
          limit: limitConfig.count,
          remaining: limitConfig.count,
          resetTime: null,
          blocked: false,
        };
      }

      // Reset if window expired
      if (now >= commandLimit.resetTime) {
        return {
          commandType,
          count: 0,
          limit: this.getLimitConfig(commandType).count,
          remaining: this.getLimitConfig(commandType).count,
          resetTime: new Date(
            now + this.parseTimeWindow(this.getLimitConfig(commandType).window)
          ),
          blocked: false,
        };
      }

      const limitConfig = this.getLimitConfig(commandType);
      return {
        commandType,
        count: commandLimit.count,
        limit: limitConfig.count,
        remaining: Math.max(0, limitConfig.count - commandLimit.count),
        resetTime: new Date(commandLimit.resetTime),
        blocked: commandLimit.blocked && commandLimit.blockUntil > now,
        blockUntil: commandLimit.blockUntil
          ? new Date(commandLimit.blockUntil)
          : null,
      };
    }

    // Return stats for all commands
    const stats = {};
    for (const [cmdType, limit] of userLimits) {
      const limitConfig = this.getLimitConfig(cmdType);

      // Reset if window expired
      if (now >= limit.resetTime) {
        stats[cmdType] = {
          count: 0,
          limit: limitConfig.count,
          remaining: limitConfig.count,
          resetTime: new Date(now + this.parseTimeWindow(limitConfig.window)),
          blocked: false,
        };
      } else {
        stats[cmdType] = {
          count: limit.count,
          limit: limitConfig.count,
          remaining: Math.max(0, limitConfig.count - limit.count),
          resetTime: new Date(limit.resetTime),
          blocked: limit.blocked && limit.blockUntil > now,
          blockUntil: limit.blockUntil ? new Date(limit.blockUntil) : null,
        };
      }
    }

    return stats;
  }

  /**
   * Reset rate limits for a user (admin function)
   * @param {string} userId - User ID
   * @param {string} commandType - Optional command type to reset specific limit
   * @returns {Promise<void>}
   */
  async resetLimits(userId, commandType = null) {
    if (!userId) {
      throw new Error("userId is required");
    }

    const userLimits = this.getUserLimits(userId);

    if (commandType) {
      userLimits.delete(commandType);
    } else {
      userLimits.clear();
    }

    if (userLimits.size === 0) {
      this.storage.delete(userId);
    } else {
      this.storage.set(userId, userLimits);
    }
  }

  /**
   * Get user's rate limit storage, creating if it doesn't exist
   * @param {string} userId - User ID
   * @returns {Map} User's rate limit map
   */
  getUserLimits(userId) {
    if (!this.storage.has(userId)) {
      this.storage.set(userId, new Map());
    }
    return this.storage.get(userId);
  }

  /**
   * Create a new rate limit entry for a command
   * @param {string} commandType - Command type
   * @param {number} now - Current timestamp
   * @returns {object} New rate limit entry
   */
  createNewLimit(commandType, now) {
    const limitConfig = this.getLimitConfig(commandType);
    return {
      count: 0,
      resetTime: now + this.parseTimeWindow(limitConfig.window),
      blocked: false,
      blockUntil: null,
    };
  }

  /**
   * Get rate limit configuration for a command type
   * @param {string} commandType - Command type
   * @returns {object} Rate limit configuration
   */
  getLimitConfig(commandType) {
    return this.config.limits[commandType] || this.config.limits.default;
  }

  /**
   * Parse time window string to milliseconds
   * @param {string} window - Time window (e.g., '1h', '30m', '1d')
   * @returns {number} Milliseconds
   */
  parseTimeWindow(window) {
    // Support milliseconds for testing
    const msMatch = window.match(/^(\d+)ms$/);
    if (msMatch) {
      return parseInt(msMatch[1]);
    }

    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid time window format: ${window}`);
    }

    const [, amount, unit] = match;
    const multipliers = {
      s: 1000, // seconds
      m: 60 * 1000, // minutes
      h: 60 * 60 * 1000, // hours
      d: 24 * 60 * 60 * 1000, // days
    };

    return parseInt(amount) * multipliers[unit];
  }

  /**
   * Clean up expired entries from storage
   */
  cleanup() {
    const now = Date.now();

    for (const [userId, userLimits] of this.storage) {
      const expiredCommands = [];

      for (const [commandType, limit] of userLimits) {
        // Remove if both reset time and block time have passed
        if (
          now >= limit.resetTime &&
          (!limit.blockUntil || now >= limit.blockUntil)
        ) {
          expiredCommands.push(commandType);
        }
      }

      // Remove expired command limits
      for (const commandType of expiredCommands) {
        userLimits.delete(commandType);
      }

      // Remove user entry if no limits remain
      if (userLimits.size === 0) {
        this.storage.delete(userId);
      }
    }
  }

  /**
   * Get current storage size (for monitoring)
   * @returns {object} Storage statistics
   */
  getStorageStats() {
    let totalEntries = 0;
    for (const [, userLimits] of this.storage) {
      totalEntries += userLimits.size;
    }

    return {
      users: this.storage.size,
      totalEntries,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  /**
   * Update configuration (for runtime configuration changes)
   * @param {object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
      limits: {
        ...this.config.limits,
        ...(newConfig.limits || {}),
      },
    };
  }

  /**
   * Destroy the service and cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.storage.clear();
  }
}

module.exports = RateLimitService;
