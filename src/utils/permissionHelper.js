const prisma = require("../config/prisma");

/**
 * Check if a user is the owner of an organization
 * @param {number} userId - The user ID to check
 * @param {number} organizationId - The organization ID to check against
 * @returns {Promise<boolean>} True if user is the organization owner
 */
async function isOrganizationOwner(userId, organizationId) {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { createdBy: true },
    });

    return organization && organization.createdBy === userId;
  } catch (error) {
    console.error("Error checking organization owner:", error);
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
    console.error("Error checking team admin:", error);
    return false;
  }
}

/**
 * Check if a user can manage a team (either as owner or admin)
 * @param {number} userId - The user ID to check
 * @param {number} teamId - The team ID to check against
 * @returns {Promise<{canManage: boolean, role: string|null, reason: string|null}>} Permission result with role information
 */
async function canManageTeam(userId, teamId) {
  try {
    // Get team with organization info
    const team = await prisma.team.findUnique({
      where: { id: teamId },
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
    console.error("Error checking team management permission:", error);
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
      include: {
        organization: true,
      },
    });

    return user;
  } catch (error) {
    console.error("Error fetching user by Slack ID:", error);
    return null;
  }
}

module.exports = {
  isOrganizationOwner,
  isTeamAdmin,
  canManageTeam,
  getUserBySlackId,
};
