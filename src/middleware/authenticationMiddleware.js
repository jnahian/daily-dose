const prisma = require("../config/prisma");
const userService = require("../services/userService");

/**
 * Authentication middleware for Slack commands
 * Verifies user identity and workspace membership
 */
class AuthenticationMiddleware {
  /**
   * Authenticate a Slack user and verify workspace membership
   * @param {string} slackUserId - Slack user ID from command context
   * @param {string} slackWorkspaceId - Slack workspace ID from command context
   * @param {Object} userInfo - Additional user information from Slack (optional)
   * @returns {Promise<Object>} Authentication result with user and organization data
   */
  async authenticateUser(slackUserId, slackWorkspaceId, userInfo = {}) {
    try {
      // Validate required parameters
      if (!slackUserId) {
        return {
          success: false,
          error: {
            type: "authentication",
            message: "User ID is required for authentication",
            code: "MISSING_USER_ID",
            details: {},
          },
        };
      }

      if (!slackWorkspaceId) {
        return {
          success: false,
          error: {
            type: "authentication",
            message: "Workspace ID is required for authentication",
            code: "MISSING_WORKSPACE_ID",
            details: {},
          },
        };
      }

      // Find or create user
      const user = await userService.findOrCreateUser(slackUserId, {
        name: userInfo.name,
        email: userInfo.email,
        timezone: userInfo.timezone,
      });

      if (!user) {
        return {
          success: false,
          error: {
            type: "authentication",
            message: "Failed to authenticate user. Please try again.",
            code: "USER_CREATION_FAILED",
            details: {},
          },
        };
      }

      // Verify workspace membership by finding organization
      const organization = await this.findOrganizationByWorkspace(
        slackWorkspaceId
      );

      if (!organization) {
        return {
          success: false,
          error: {
            type: "authentication",
            message:
              "This workspace is not registered with Daily Dose. Please contact your administrator.",
            code: "WORKSPACE_NOT_REGISTERED",
            details: {
              workspaceId: slackWorkspaceId,
            },
          },
        };
      }

      // Verify user is a member of the organization
      const membership = await this.verifyOrganizationMembership(
        user.id,
        organization.id
      );

      if (!membership) {
        return {
          success: false,
          error: {
            type: "authentication",
            message:
              "You are not a member of this organization. Please contact your administrator to be added.",
            code: "NOT_ORGANIZATION_MEMBER",
            details: {
              organizationName: organization.name,
            },
          },
        };
      }

      // Check if membership is active
      if (!membership.isActive) {
        return {
          success: false,
          error: {
            type: "authentication",
            message:
              "Your access has been deactivated. Please contact your administrator.",
            code: "MEMBERSHIP_INACTIVE",
            details: {},
          },
        };
      }

      // Authentication successful
      return {
        success: true,
        user: {
          id: user.id,
          slackUserId: user.slackUserId,
          name: user.name,
          email: user.email,
          timezone: user.timezone,
        },
        organization: {
          id: organization.id,
          name: organization.name,
          slackWorkspaceId: organization.slackWorkspaceId,
          defaultTimezone: organization.defaultTimezone,
        },
        membership: {
          role: membership.role,
          joinedAt: membership.joinedAt,
        },
      };
    } catch (error) {
      // Log error for debugging but don't expose internal details
      console.error("Authentication error:", error);

      return {
        success: false,
        error: {
          type: "authentication",
          message:
            "Authentication failed due to a system error. Please try again.",
          code: "SYSTEM_ERROR",
          details: {},
        },
      };
    }
  }

  /**
   * Find organization by Slack workspace ID
   * @param {string} slackWorkspaceId - Slack workspace ID
   * @returns {Promise<Object|null>} Organization or null if not found
   */
  async findOrganizationByWorkspace(slackWorkspaceId) {
    try {
      return await prisma.organization.findUnique({
        where: {
          slackWorkspaceId: slackWorkspaceId,
        },
        select: {
          id: true,
          name: true,
          slackWorkspaceId: true,
          slackWorkspaceName: true,
          defaultTimezone: true,
          isActive: true,
        },
      });
    } catch (error) {
      console.error("Error finding organization by workspace:", error);
      return null;
    }
  }

  /**
   * Verify user membership in organization
   * @param {string} userId - User ID
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object|null>} Membership or null if not found
   */
  async verifyOrganizationMembership(userId, organizationId) {
    try {
      return await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
        select: {
          role: true,
          isActive: true,
          joinedAt: true,
        },
      });
    } catch (error) {
      console.error("Error verifying organization membership:", error);
      return null;
    }
  }

  /**
   * Middleware wrapper for Slack Bolt commands
   * @param {Function} handler - Original command handler
   * @returns {Function} Wrapped handler with authentication
   */
  wrapCommand(handler) {
    return async (args) => {
      const { command, ack, respond } = args;

      try {
        // Extract authentication info from Slack command
        const slackUserId = command.user_id;
        const slackWorkspaceId = command.team_id;

        // Authenticate user
        const authResult = await this.authenticateUser(
          slackUserId,
          slackWorkspaceId
        );

        if (!authResult.success) {
          // Acknowledge the command first
          await ack();

          // Send error response
          await respond({
            text: `🔒 ${authResult.error.message}`,
            response_type: "ephemeral",
          });

          return;
        }

        // Add authentication context to args
        args.auth = authResult;

        // Call original handler
        return await handler(args);
      } catch (error) {
        console.error("Authentication middleware error:", error);

        // Acknowledge the command
        await ack();

        // Send generic error response
        await respond({
          text: "🔒 Authentication failed. Please try again or contact support.",
          response_type: "ephemeral",
        });
      }
    };
  }

  /**
   * Validate session (for future use with session tokens)
   * @param {string} sessionToken - Session token
   * @returns {Promise<Object>} Validation result
   */
  async validateSession(sessionToken) {
    // Placeholder for future session validation implementation
    // Currently Slack Bolt handles session management
    return {
      success: false,
      error: {
        type: "authentication",
        message: "Session validation not implemented",
        code: "NOT_IMPLEMENTED",
        details: {},
      },
    };
  }
}

module.exports = new AuthenticationMiddleware();
