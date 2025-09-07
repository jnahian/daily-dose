const prisma = require("../config/prisma");

/**
 * Authorization Service - Manages role-based permissions and access control
 *
 * This service implements the permission matrix and provides methods to check
 * user permissions for various commands and resources.
 */
class AuthorizationService {
  constructor() {
    // Permission matrix defining which roles can execute which commands
    this.permissionMatrix = {
      // Team management permissions
      "team:create": ["OWNER", "ADMIN"],
      "team:manage": ["OWNER", "ADMIN", "TEAM_ADMIN"],
      "team:join": ["MEMBER"],
      "team:leave": ["MEMBER"],
      "team:list": ["MEMBER"],

      // Standup permissions
      "standup:submit": ["MEMBER"],
      "standup:view": ["MEMBER"],

      // Leave management permissions
      "leave:manage": ["MEMBER"], // Users can only manage their own leaves
      "leave:set": ["MEMBER"],
      "leave:cancel": ["MEMBER"],
      "leave:list": ["MEMBER"],
      "leave:workdays": ["MEMBER"],

      // Admin permissions
      "admin:users": ["OWNER", "ADMIN"],
      "admin:teams": ["OWNER", "ADMIN"],
      "admin:organization": ["OWNER"],
    };
  }

  /**
   * Checks if a user has a specific permission
   * @param {string} userId - The user's ID
   * @param {string} permission - The permission to check (e.g., 'team:create')
   * @param {string} resourceId - Optional resource ID for resource-specific checks
   * @returns {Promise<boolean>} - Whether the user has the permission
   */
  async hasPermission(userId, permission, resourceId = null) {
    try {
      // Validate inputs
      if (
        !userId ||
        !permission ||
        typeof userId !== "string" ||
        typeof permission !== "string"
      ) {
        return false;
      }

      // Get required roles for this permission
      const requiredRoles = this.permissionMatrix[permission];
      if (!requiredRoles) {
        return false;
      }

      // Get user's roles in different contexts
      const userRoles = await this.getUserRoles(userId, resourceId);

      // Check if user has any of the required roles
      return requiredRoles.some((role) => userRoles.includes(role));
    } catch (error) {
      console.error("Error checking permission:", error);
      return false;
    }
  }

  /**
   * Gets all roles for a user in various contexts
   * @param {string} userId - The user's ID
   * @param {string} resourceId - Optional resource ID for context-specific roles
   * @returns {Promise<string[]>} - Array of user's roles
   */
  async getUserRoles(userId, resourceId = null) {
    const roles = [];

    try {
      // Validate userId
      if (!userId || typeof userId !== "string") {
        return roles;
      }

      // Get organization roles
      const orgMemberships = await prisma.organizationMember.findMany({
        where: {
          userId,
          isActive: true,
        },
        include: {
          organization: true,
        },
      });

      // Add organization roles
      orgMemberships.forEach((membership) => {
        roles.push(membership.role);
      });

      // Get team roles if resourceId is provided and it's a team
      if (resourceId) {
        const teamMembership = await prisma.teamMember.findFirst({
          where: {
            userId,
            teamId: resourceId,
            isActive: true,
          },
        });

        if (teamMembership) {
          if (teamMembership.role === "ADMIN") {
            roles.push("TEAM_ADMIN");
          }
          roles.push("MEMBER");
        }
      } else {
        // If no specific resource, check if user is a team admin anywhere
        const teamMemberships = await prisma.teamMember.findMany({
          where: {
            userId,
            isActive: true,
          },
        });

        const hasTeamAdminRole = teamMemberships.some(
          (tm) => tm.role === "ADMIN"
        );
        if (hasTeamAdminRole) {
          roles.push("TEAM_ADMIN");
        }

        // Add MEMBER role if user is member of any team
        if (teamMemberships.length > 0) {
          roles.push("MEMBER");
        }
      }

      return [...new Set(roles)]; // Remove duplicates
    } catch (error) {
      console.error("Error getting user roles:", error);
      return [];
    }
  }

  /**
   * Gets user's role in a specific team
   * @param {string} userId - The user's ID
   * @param {string} teamId - The team ID
   * @returns {Promise<string|null>} - The user's role in the team or null if not a member
   */
  async getUserTeamRole(userId, teamId) {
    try {
      // Validate inputs
      if (
        !userId ||
        !teamId ||
        typeof userId !== "string" ||
        typeof teamId !== "string"
      ) {
        return null;
      }

      const membership = await prisma.teamMember.findFirst({
        where: {
          userId,
          teamId,
          isActive: true,
        },
      });

      return membership ? membership.role : null;
    } catch (error) {
      console.error("Error getting user team role:", error);
      return null;
    }
  }

  /**
   * Gets user's role in a specific organization
   * @param {string} userId - The user's ID
   * @param {string} organizationId - The organization ID
   * @returns {Promise<string|null>} - The user's role in the organization or null if not a member
   */
  async getUserOrganizationRole(userId, organizationId) {
    try {
      // Validate inputs
      if (!userId || typeof userId !== "string") {
        return null;
      }

      // organizationId can be null for checking across all organizations
      if (organizationId && typeof organizationId !== "string") {
        return null;
      }

      const membership = await prisma.organizationMember.findFirst({
        where: {
          userId,
          organizationId,
          isActive: true,
        },
      });

      return membership ? membership.role : null;
    } catch (error) {
      console.error("Error getting user organization role:", error);
      return null;
    }
  }

  /**
   * Checks if user can access a specific resource
   * @param {string} userId - The user's ID
   * @param {string} resourceType - Type of resource ('team', 'organization', 'leave', 'standup')
   * @param {string} resourceId - The resource ID
   * @returns {Promise<boolean>} - Whether the user can access the resource
   */
  async canAccessResource(userId, resourceType, resourceId) {
    try {
      // Validate inputs
      if (
        !userId ||
        !resourceType ||
        !resourceId ||
        typeof userId !== "string" ||
        typeof resourceType !== "string" ||
        typeof resourceId !== "string"
      ) {
        return false;
      }

      switch (resourceType) {
        case "team":
          return await this.canAccessTeam(userId, resourceId);

        case "organization":
          return await this.canAccessOrganization(userId, resourceId);

        case "leave":
          return await this.canAccessLeave(userId, resourceId);

        case "standup":
          return await this.canAccessStandup(userId, resourceId);

        default:
          return false;
      }
    } catch (error) {
      console.error("Error checking resource access:", error);
      return false;
    }
  }

  /**
   * Checks if user can access a specific team
   * @param {string} userId - The user's ID
   * @param {string} teamId - The team ID
   * @returns {Promise<boolean>} - Whether the user can access the team
   */
  async canAccessTeam(userId, teamId) {
    try {
      // Validate inputs
      if (
        !userId ||
        !teamId ||
        typeof userId !== "string" ||
        typeof teamId !== "string"
      ) {
        return false;
      }

      // Check if user is a member of the team
      const membership = await prisma.teamMember.findFirst({
        where: {
          userId,
          teamId,
          isActive: true,
        },
      });

      if (membership) {
        return true;
      }

      // Check if user is an org admin for the team's organization
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { organizationId: true },
      });

      if (team) {
        const orgRole = await this.getUserOrganizationRole(
          userId,
          team.organizationId
        );
        return ["OWNER", "ADMIN"].includes(orgRole);
      }

      return false;
    } catch (error) {
      console.error("Error checking team access:", error);
      return false;
    }
  }

  /**
   * Checks if user can access a specific organization
   * @param {string} userId - The user's ID
   * @param {string} organizationId - The organization ID
   * @returns {Promise<boolean>} - Whether the user can access the organization
   */
  async canAccessOrganization(userId, organizationId) {
    try {
      // Validate inputs
      if (
        !userId ||
        !organizationId ||
        typeof userId !== "string" ||
        typeof organizationId !== "string"
      ) {
        return false;
      }

      const membership = await prisma.organizationMember.findFirst({
        where: {
          userId,
          organizationId,
          isActive: true,
        },
      });

      return !!membership;
    } catch (error) {
      console.error("Error checking organization access:", error);
      return false;
    }
  }

  /**
   * Checks if user can access a specific leave record
   * @param {string} userId - The user's ID
   * @param {string} leaveId - The leave record ID
   * @returns {Promise<boolean>} - Whether the user can access the leave record
   */
  async canAccessLeave(userId, leaveId) {
    try {
      // Validate inputs
      if (
        !userId ||
        !leaveId ||
        typeof userId !== "string" ||
        typeof leaveId !== "string"
      ) {
        return false;
      }

      const leave = await prisma.leave.findUnique({
        where: { id: leaveId },
        select: { userId: true },
      });

      // Users can only access their own leave records
      return leave && leave.userId === userId;
    } catch (error) {
      console.error("Error checking leave access:", error);
      return false;
    }
  }

  /**
   * Checks if user can access a specific standup response
   * @param {string} userId - The user's ID
   * @param {string} standupId - The standup response ID
   * @returns {Promise<boolean>} - Whether the user can access the standup response
   */
  async canAccessStandup(userId, standupId) {
    try {
      const standup = await prisma.standupResponse.findUnique({
        where: { id: standupId },
        select: {
          userId: true,
          teamId: true,
        },
      });

      if (!standup) {
        return false;
      }

      // Users can access their own standup responses
      if (standup.userId === userId) {
        return true;
      }

      // Team members can view each other's standup responses
      return await this.canAccessTeam(userId, standup.teamId);
    } catch (error) {
      console.error("Error checking standup access:", error);
      return false;
    }
  }

  /**
   * Checks if user is a team admin for a specific team
   * @param {string} userId - The user's ID
   * @param {string} teamId - The team ID
   * @returns {Promise<boolean>} - Whether the user is a team admin
   */
  async isTeamAdmin(userId, teamId) {
    try {
      // Validate inputs
      if (
        !userId ||
        !teamId ||
        typeof userId !== "string" ||
        typeof teamId !== "string"
      ) {
        return false;
      }

      const membership = await prisma.teamMember.findFirst({
        where: {
          userId,
          teamId,
          role: "ADMIN",
          isActive: true,
        },
      });

      return !!membership;
    } catch (error) {
      console.error("Error checking team admin status:", error);
      return false;
    }
  }

  /**
   * Checks if user is an organization admin
   * @param {string} userId - The user's ID
   * @param {string} organizationId - The organization ID (optional)
   * @returns {Promise<boolean>} - Whether the user is an organization admin
   */
  async isOrganizationAdmin(userId, organizationId = null) {
    try {
      // Validate inputs
      if (!userId || typeof userId !== "string") {
        return false;
      }

      // organizationId can be null for checking across all organizations
      if (organizationId && typeof organizationId !== "string") {
        return false;
      }

      const whereClause = {
        userId,
        role: { in: ["OWNER", "ADMIN"] },
        isActive: true,
      };

      if (organizationId) {
        whereClause.organizationId = organizationId;
      }

      const membership = await prisma.organizationMember.findFirst({
        where: whereClause,
      });

      return !!membership;
    } catch (error) {
      console.error("Error checking organization admin status:", error);
      return false;
    }
  }

  /**
   * Checks if user can manage another user (for admin operations)
   * @param {string} adminUserId - The admin user's ID
   * @param {string} targetUserId - The target user's ID
   * @param {string} organizationId - The organization context
   * @returns {Promise<boolean>} - Whether the admin can manage the target user
   */
  async canManageUser(adminUserId, targetUserId, organizationId) {
    try {
      // Users cannot manage themselves through admin operations
      if (adminUserId === targetUserId) {
        return false;
      }

      // Check if admin has admin privileges in the organization
      const adminRole = await this.getUserOrganizationRole(
        adminUserId,
        organizationId
      );
      if (!["OWNER", "ADMIN"].includes(adminRole)) {
        return false;
      }

      // Check if target user is in the same organization
      const targetRole = await this.getUserOrganizationRole(
        targetUserId,
        organizationId
      );
      if (!targetRole) {
        return false;
      }

      // Owners can manage anyone, admins cannot manage owners
      if (adminRole === "OWNER") {
        return true;
      }

      if (adminRole === "ADMIN" && targetRole !== "OWNER") {
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking user management permission:", error);
      return false;
    }
  }

  /**
   * Gets all permissions for a user (for debugging/admin purposes)
   * @param {string} userId - The user's ID
   * @returns {Promise<string[]>} - Array of permissions the user has
   */
  async getUserPermissions(userId) {
    try {
      // Validate input
      if (!userId || typeof userId !== "string") {
        return [];
      }

      const permissions = [];

      for (const [permission, requiredRoles] of Object.entries(
        this.permissionMatrix
      )) {
        const hasPermission = await this.hasPermission(userId, permission);
        if (hasPermission) {
          permissions.push(permission);
        }
      }

      return permissions;
    } catch (error) {
      console.error("Error getting user permissions:", error);
      return [];
    }
  }
}

module.exports = new AuthorizationService();
