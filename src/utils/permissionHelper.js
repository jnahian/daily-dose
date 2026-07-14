const prisma = require("../config/prisma");
const logger = require("../utils/logger");

/**
 * Check if a user is the owner of an organization
 * @param {number} userId - The user ID to check
 * @param {number} organizationId - The organization ID to check against
 * @returns {Promise<boolean>} True if user is the organization owner
 */
async function isOrganizationOwner(userId, organizationId) {
  try {
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true, isActive: true },
    });

    return !!membership && membership.isActive && membership.role === "OWNER";
  } catch (error) {
    logger.error(
      `Error checking organization owner (userId=${userId}, organizationId=${organizationId}):`,
      error
    );
    return false;
  }
}

/**
 * Check if a user is an admin of an organization
 * @param {string} userId - The user ID to check
 * @param {string} organizationId - The organization ID to check against
 * @returns {Promise<boolean>} True if user is an organization admin
 */
async function isOrganizationAdmin(userId, organizationId) {
  try {
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true, isActive: true },
    });

    return !!membership && membership.isActive && membership.role === "ADMIN";
  } catch (error) {
    logger.error(
      `Error checking organization admin (userId=${userId}, organizationId=${organizationId}):`,
      error
    );
    return false;
  }
}

/**
 * Check if a user is an admin of a specific team
 * @param {number} userId - The user ID to check
 * @param {number} teamId - The team ID to check against
 * @returns {Promise<boolean>} True if user is a team admin
 */
async function isTeamAdmin(userId, teamId) {
  try {
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        userId,
        teamId,
        isActive: true,
        role: "ADMIN",
      },
    });

    return !!teamMember;
  } catch (error) {
    logger.error(
      `Error checking team admin (userId=${userId}, teamId=${teamId}):`,
      error
    );
    return false;
  }
}

/**
 * Check if a user can manage a team (either as owner or admin)
 * @param {number} userId - The user ID to check
 * @param {number} teamId - The team ID to check against
 * @param {object} [options] - Options
 * @param {boolean} [options.requireActive=true] - Require the team to be active.
 *   Set false when acting on an already-disabled team (e.g. re-enabling it).
 * @returns {Promise<{canManage: boolean, role: string|null, reason: string|null}>} Permission result with role information
 */
async function canManageTeam(userId, teamId, { requireActive = true } = {}) {
  try {
    // Get team with organization info
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        deletedAt: null,
        ...(requireActive ? { isActive: true } : {}),
      },
      select: { organizationId: true },
    });

    if (!team) {
      return {
        canManage: false,
        role: null,
        reason: "Team not found",
      };
    }

    // Check if user is organization owner
    const isOwner = await isOrganizationOwner(userId, team.organizationId);
    if (isOwner) {
      return {
        canManage: true,
        role: "OWNER",
        reason: null,
      };
    }

    // Check if user is an organization admin
    const isOrgAdmin = await isOrganizationAdmin(userId, team.organizationId);
    if (isOrgAdmin) {
      return {
        canManage: true,
        role: "ORG_ADMIN",
        reason: null,
      };
    }

    // Check if user is team admin
    const isAdmin = await isTeamAdmin(userId, teamId);
    if (isAdmin) {
      return {
        canManage: true,
        role: "ADMIN",
        reason: null,
      };
    }

    return {
      canManage: false,
      role: null,
      reason: "User is not an admin or owner",
    };
  } catch (error) {
    logger.error(
      `Error checking team management permission (userId=${userId}, teamId=${teamId}):`,
      error
    );
    return {
      canManage: false,
      role: null,
      reason: "Error checking permissions",
    };
  }
}

/**
 * Get user by Slack user ID
 * @param {string} slackUserId - The Slack user ID
 * @returns {Promise<object|null>} User object or null if not found
 */
async function getUserBySlackId(slackUserId) {
  try {
    const user = await prisma.user.findUnique({
      where: { slackUserId },
    });

    return user;
  } catch (error) {
    logger.error(
      `Error fetching user by Slack ID (slackUserId=${slackUserId}):`,
      error
    );
    return null;
  }
}

module.exports = {
  isOrganizationOwner,
  isOrganizationAdmin,
  isTeamAdmin,
  canManageTeam,
  getUserBySlackId,
};
