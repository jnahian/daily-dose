const prisma = require("../config/prisma");
const userService = require("./userService");
const permissionHelper = require("../utils/permissionHelper");
const { UserFacingError } = require("../utils/errorHelper");
const { validateTimezone } = require("../utils/timeHelper");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(customParseFormat);

// Helper function to validate and convert time string to Date object
function validateTimeString(timeString) {
  const time = dayjs(timeString, "HH:mm", true);
  if (!time.isValid()) {
    throw new Error(
      `Invalid time format: ${timeString}. Expected HH:MM format (e.g., 09:30)`
    );
  }
  return timeString;
}

class TeamService {
  /**
   * Create a team for a Slack channel, auto-onboarding the creator into the
   * workspace's organization if they aren't a member yet. Org owners/admins get
   * an ACTIVE team immediately; everyone else gets a PENDING team that an org
   * admin must approve before it is scheduled.
   * @param {string} slackUserId - Slack user ID of the creator
   * @param {string} channelId - Slack channel ID the team posts to
   * @param {Object} teamData - { name, standupTime, postingTime, timezone? }
   * @param {string|null} slackWorkspaceId - Slack workspace ID (command.team_id) used to resolve the org for non-members
   * @param {Object|null} slackClient - Slack web client for fetching user info
   * @returns {Promise<{team: Object, status: string, organization: Object, creatorSlackUserId: string}>}
   */
  async createTeam(
    slackUserId,
    channelId,
    teamData,
    slackWorkspaceId = null,
    slackClient = null
  ) {
    // Get user and their organization
    const userData = await userService.fetchSlackUserData(
      slackUserId,
      slackClient
    );
    const user = await userService.findOrCreateUser(slackUserId, userData);
    let org = await userService.getUserOrganization(slackUserId);

    // If the creator isn't an organization member yet, place them in the org
    // that owns this Slack workspace and add them as a MEMBER (mirrors how
    // joinTeam auto-onboards). This removes the "ask an admin to add you"
    // barrier — anyone in the workspace can propose a team.
    if (!org) {
      org = await userService.getOrganizationByWorkspaceId(slackWorkspaceId);
      if (!org) {
        throw new Error(
          "This Slack workspace isn't set up with Daily Dose yet. Please ask an organization admin to set it up."
        );
      }
      await userService.addUserToOrganization(user.id, org.id);
    }

    // Org owners/admins create teams that are active immediately. Everyone else
    // creates a team that stays PENDING until an org admin approves it.
    const isPrivileged = await userService.canCreateTeam(user.id, org.id);
    const status = isPrivileged ? "ACTIVE" : "PENDING";

    // Check if channel already has a team
    const existingTeam = await prisma.team.findUnique({
      where: { slackChannelId: channelId },
    });

    if (existingTeam) {
      throw new Error("This channel already has a team");
    }

    // Create team with transaction
    const team = await prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          organizationId: org.id,
          name: teamData.name,
          slackChannelId: channelId,
          standupTime: validateTimeString(teamData.standupTime),
          postingTime: validateTimeString(teamData.postingTime),
          timezone: validateTimezone(teamData.timezone || org.defaultTimezone),
          status,
        },
      });

      // Add creator as team admin
      await tx.teamMember.create({
        data: {
          teamId: created.id,
          userId: user.id,
          role: "ADMIN",
        },
      });

      return created;
    });

    return { team, status, organization: org, creatorSlackUserId: slackUserId };
  }

  /**
   * Resolve and authorize an org admin acting on a PENDING team, returning the
   * team (with its creator) for approve/reject handlers. Throws if the team is
   * missing, the actor isn't an org owner/admin, or the team isn't PENDING.
   * @param {string} adminSlackUserId - Slack user ID of the acting admin
   * @param {string} teamId - Team ID under decision
   * @param {Object|null} slackClient - Slack web client for fetching user info
   * @returns {Promise<{team: Object, creatorSlackUserId: string|undefined}>}
   */
  async getPendingTeamForDecision(
    adminSlackUserId,
    teamId,
    slackClient = null
  ) {
    const userData = await userService.fetchSlackUserData(
      adminSlackUserId,
      slackClient
    );
    const adminUser = await userService.findOrCreateUser(
      adminSlackUserId,
      userData
    );

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        organization: true,
        members: {
          where: { role: "ADMIN" },
          include: { user: true },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!team) {
      throw new Error("Team not found");
    }

    const isOwner = await permissionHelper.isOrganizationOwner(
      adminUser.id,
      team.organizationId
    );
    const isOrgAdmin = await permissionHelper.isOrganizationAdmin(
      adminUser.id,
      team.organizationId
    );
    if (!isOwner && !isOrgAdmin) {
      throw new Error("Only organization admins can approve or reject teams");
    }

    if (team.status !== "PENDING") {
      throw new Error(
        `This team has already been ${team.status.toLowerCase()}`
      );
    }

    return { team, creatorSlackUserId: team.members[0]?.user?.slackUserId };
  }

  /**
   * Approve a PENDING team: transition it to ACTIVE so it can be scheduled.
   * @param {string} adminSlackUserId - Slack user ID of the approving admin
   * @param {string} teamId - Team ID to approve
   * @param {Object|null} slackClient - Slack web client for fetching user info
   * @returns {Promise<{team: Object, creatorSlackUserId: string|undefined}>}
   */
  async approveTeam(adminSlackUserId, teamId, slackClient = null) {
    const { creatorSlackUserId } = await this.getPendingTeamForDecision(
      adminSlackUserId,
      teamId,
      slackClient
    );

    // Guard against a concurrent decision (two admins clicking at once): only
    // flip a team that is still PENDING, so a stale click can't re-process it.
    const { count } = await prisma.team.updateMany({
      where: { id: teamId, status: "PENDING" },
      data: { status: "ACTIVE" },
    });
    if (count === 0) {
      throw new Error("This team has already been processed");
    }

    const updated = await prisma.team.findUnique({ where: { id: teamId } });

    return { team: updated, creatorSlackUserId };
  }

  /**
   * Reject a PENDING team: delete it so the channel is freed for a fresh
   * proposal. Returns the team snapshot and creator for notifying the proposer.
   * @param {string} adminSlackUserId - Slack user ID of the rejecting admin
   * @param {string} teamId - Team ID to reject
   * @param {Object|null} slackClient - Slack web client for fetching user info
   * @returns {Promise<{team: Object, creatorSlackUserId: string|undefined}>}
   */
  async rejectTeam(adminSlackUserId, teamId, slackClient = null) {
    const { team, creatorSlackUserId } = await this.getPendingTeamForDecision(
      adminSlackUserId,
      teamId,
      slackClient
    );

    // Delete the rejected team so the channel is freed for a fresh proposal.
    // Cascade deletes remove the creator's TeamMember record. Scope the delete
    // to PENDING so a concurrent decision can't remove a just-approved team.
    const { count } = await prisma.team.deleteMany({
      where: { id: teamId, status: "PENDING" },
    });
    if (count === 0) {
      throw new Error("This team has already been processed");
    }

    return { team, creatorSlackUserId };
  }

  async joinTeam(slackUserId, teamId, slackClient = null) {
    const userData = await userService.fetchSlackUserData(
      slackUserId,
      slackClient
    );
    const user = await userService.findOrCreateUser(slackUserId, userData);

    // Check if team exists and user's org matches
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { organization: true },
    });

    if (!team) {
      throw new Error("Team not found");
    }

    // Check if user belongs to the organization
    let userOrg = await userService.getUserOrganization(slackUserId);

    if (!userOrg) {
      // User is not in any organization, add them to the team's organization
      await userService.addUserToOrganization(user.id, team.organizationId);
      userOrg = team.organization;
    } else if (userOrg.id !== team.organizationId) {
      throw new Error("You can only join teams in your organization");
    }

    // Check if already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: team.id,
          userId: user.id,
        },
        isActive: true,
      },
    });

    if (existingMember) {
      throw new Error("You are already a member of this team");
    }

    // Add as member
    return await prisma.teamMember.upsert({
      where: {
        teamId_userId: {
          teamId: team.id,
          userId: user.id,
        },
      },
      update: {
        isActive: true,
      },
      create: {
        teamId: team.id,
        userId: user.id,
        role: "MEMBER",
        isActive: true,
      },
    });
  }

  async listTeams(slackUserId) {
    const userOrg = await userService.getUserOrganization(slackUserId);

    if (!userOrg) {
      return [];
    }

    return await prisma.team.findMany({
      where: {
        organizationId: userOrg.id,
        isActive: true,
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });
  }

  // Scoped variant for /dd-team-list: privileged users (org OWNER/ADMIN or
  // active super admin) see every team in the org; regular members and team
  // admins see only the teams they are an active member of. Returns the org
  // so the command can use its name in the response heading.
  async listTeamsForUser(slackUserId) {
    const user = await prisma.user.findUnique({
      where: { slackUserId },
      include: {
        super_admins: true,
        organizations: {
          where: { isActive: true },
          include: { organization: true },
        },
      },
    });

    if (!user || user.organizations.length === 0) {
      return { teams: [], scope: "own", organization: null };
    }

    const membership = user.organizations[0];
    const organization = membership.organization;
    const isSuperAdmin =
      !!user.super_admins && user.super_admins.revoked_at === null;
    const isOrgPrivileged = ["OWNER", "ADMIN"].includes(membership.role);
    const seeAll = isSuperAdmin || isOrgPrivileged;

    const teams = await prisma.team.findMany({
      where: {
        organizationId: organization.id,
        isActive: true,
        ...(seeAll
          ? {}
          : {
              members: {
                some: { userId: user.id, isActive: true },
              },
            }),
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return { teams, scope: seeAll ? "all" : "own", organization };
  }

  async getTeamMembers(teamId) {
    return await prisma.teamMember.findMany({
      where: {
        teamId,
        isActive: true,
      },
      include: {
        user: true,
      },
    });
  }

  async getTeamAdmins(teamId) {
    return await prisma.teamMember.findMany({
      where: {
        teamId,
        role: "ADMIN",
        isActive: true,
      },
      include: {
        user: true,
      },
    });
  }

  async getActiveTeamsForScheduling() {
    return await prisma.team.findMany({
      where: {
        isActive: true,
        status: "ACTIVE",
        organization: {
          isActive: true,
        },
      },
      include: {
        organization: true,
      },
    });
  }

  async leaveTeam(slackUserId, teamId, slackClient = null) {
    const userData = await userService.fetchSlackUserData(
      slackUserId,
      slackClient
    );
    const user = await userService.findOrCreateUser(slackUserId, userData);

    // Check if team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        organization: true,
        members: {
          where: { role: "ADMIN", isActive: true },
        },
      },
    });

    if (!team) {
      throw new Error("Team not found");
    }

    // Check if user is a member
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: team.id,
          userId: user.id,
        },
      },
    });

    if (!membership || !membership.isActive) {
      throw new Error("You are not a member of this team");
    }

    // Check if user is the only admin
    if (membership.role === "ADMIN" && team.members.length === 1) {
      throw new Error(
        "You cannot leave the team as you are the only admin. Transfer admin rights first or delete the team."
      );
    }

    // Remove user from team
    return await prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId: team.id,
          userId: user.id,
        },
      },
      data: {
        isActive: false,
      },
    });
  }

  async getTeamById(teamId) {
    return await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        organization: true,
      },
    });
  }

  async findTeamByName(teamName, organizationId = null) {
    return await prisma.team.findFirst({
      where: {
        name: {
          equals: teamName,
          mode: "insensitive",
        },
        isActive: true,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        organization: true,
      },
    });
  }

  async findTeamByChannel(channelId) {
    return await prisma.team.findUnique({
      where: {
        slackChannelId: channelId,
        isActive: true,
      },
      include: {
        organization: true,
      },
    });
  }

  async updateTeam(slackUserId, teamId, updateData, slackClient = null) {
    const userData = await userService.fetchSlackUserData(
      slackUserId,
      slackClient
    );
    const user = await userService.findOrCreateUser(slackUserId, userData);

    // Check if team exists and get current data
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        organization: true,
      },
    });

    if (!team) {
      throw new Error("Team not found");
    }

    // Permission: team admin or organization owner
    const permission = await permissionHelper.canManageTeam(user.id, teamId);
    if (!permission.canManage) {
      throw new Error("You need admin permissions to update this team");
    }

    // Validate times if provided
    const updateFields = {};
    if (updateData.standupTime) {
      updateFields.standupTime = validateTimeString(updateData.standupTime);
    }
    if (updateData.postingTime) {
      updateFields.postingTime = validateTimeString(updateData.postingTime);
    }
    if (updateData.name) {
      updateFields.name = updateData.name;
    }
    if (updateData.timezone) {
      updateFields.timezone = validateTimezone(updateData.timezone);
    }

    // Handle notification preference update for the admin
    if (updateData.receiveNotifications !== undefined) {
      await prisma.teamMember.update({
        where: {
          teamId_userId: {
            teamId: teamId,
            userId: user.id,
          },
        },
        data: {
          receiveNotifications: updateData.receiveNotifications,
        },
      });
    }

    // Update team
    return await prisma.team.update({
      where: { id: teamId },
      data: updateFields,
    });
  }

  async getUserTeamMembership(slackUserId, teamId) {
    const userData = await userService.fetchSlackUserData(slackUserId);
    const user = await userService.findOrCreateUser(slackUserId, userData);

    return await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: teamId,
          userId: user.id,
        },
        isActive: true,
      },
    });
  }

  async updateTeamMemberPreferences(
    slackUserId,
    teamId,
    preferences,
    slackClient = null
  ) {
    const userData = await userService.fetchSlackUserData(
      slackUserId,
      slackClient
    );
    const user = await userService.findOrCreateUser(slackUserId, userData);

    // Check if user is a member of the team
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: teamId,
          userId: user.id,
        },
        isActive: true,
      },
    });

    if (!membership) {
      throw new Error("You are not a member of this team");
    }

    // Update preferences
    return await prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId: teamId,
          userId: user.id,
        },
      },
      data: preferences,
    });
  }

  async isTeamAdmin(slackUserId, teamId, slackClient = null) {
    const userData = await userService.fetchSlackUserData(
      slackUserId,
      slackClient
    );
    const user = await userService.findOrCreateUser(slackUserId, userData);

    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: teamId,
          userId: user.id,
        },
        isActive: true,
      },
    });

    return membership && membership.role === "ADMIN";
  }

  async setTeamMemberActive(
    adminSlackUserId,
    targetSlackUserId,
    teamId,
    isActive,
    slackClient = null
  ) {
    const adminUserData = await userService.fetchSlackUserData(
      adminSlackUserId,
      slackClient
    );
    const adminUser = await userService.findOrCreateUser(
      adminSlackUserId,
      adminUserData
    );

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { organization: true },
    });

    if (!team) {
      throw new Error("Team not found");
    }

    // Permission: team admin or org owner/admin
    const adminMembership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: adminUser.id },
      },
    });

    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: team.organizationId,
          userId: adminUser.id,
        },
      },
    });

    const isTeamAdmin =
      adminMembership &&
      adminMembership.isActive &&
      adminMembership.role === "ADMIN";
    const isOrgManager =
      orgMembership &&
      orgMembership.isActive &&
      ["OWNER", "ADMIN"].includes(orgMembership.role);

    if (!isTeamAdmin && !isOrgManager) {
      throw new Error(
        "You need team admin or organization owner/admin permissions for this action"
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { slackUserId: targetSlackUserId },
    });

    if (!targetUser) {
      throw new Error("Target user not found");
    }

    if (targetUser.id === adminUser.id) {
      throw new Error("You cannot change your own team membership status");
    }

    const targetMembership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: targetUser.id },
      },
    });

    if (!targetMembership) {
      throw new Error("Target user is not a member of this team");
    }

    const targetOrgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: team.organizationId,
          userId: targetUser.id,
        },
      },
    });

    // Block reactivating a team membership when the user is org-suspended
    if (isActive && targetOrgMembership && !targetOrgMembership.isActive) {
      throw new Error(
        "This member is suspended from the organization. Use /dd-org-unsuspend first."
      );
    }

    // Only org owners can change an org owner's team membership
    if (
      targetOrgMembership &&
      targetOrgMembership.role === "OWNER" &&
      (!orgMembership || orgMembership.role !== "OWNER")
    ) {
      throw new Error(
        "Only organization owners can change an organization owner's team membership"
      );
    }

    if (targetMembership.isActive === isActive) {
      throw new Error(
        isActive
          ? "Member is already active in this team"
          : "Member is already suspended from this team"
      );
    }

    // Prevent removing the only active admin
    if (!isActive && targetMembership.role === "ADMIN") {
      const otherActiveAdmins = await prisma.teamMember.count({
        where: {
          teamId,
          role: "ADMIN",
          isActive: true,
          userId: { not: targetUser.id },
        },
      });
      if (otherActiveAdmins === 0) {
        throw new Error(
          "Cannot suspend the only active admin of this team. Promote another admin first."
        );
      }
    }

    return await prisma.teamMember.update({
      where: {
        teamId_userId: { teamId, userId: targetUser.id },
      },
      data: { isActive },
    });
  }

  async promoteTeamMember(
    adminSlackUserId,
    targetSlackUserId,
    teamId,
    slackClient = null
  ) {
    const adminUserData = await userService.fetchSlackUserData(
      adminSlackUserId,
      slackClient
    );
    const adminUser = await userService.findOrCreateUser(
      adminSlackUserId,
      adminUserData
    );

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { organization: true },
    });

    if (!team) {
      throw new UserFacingError("Team not found");
    }

    // Permission: org owner or org admin only (per /dd-org-promote requirements)
    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: team.organizationId,
          userId: adminUser.id,
        },
      },
    });

    if (
      !orgMembership ||
      !orgMembership.isActive ||
      !["OWNER", "ADMIN"].includes(orgMembership.role)
    ) {
      throw new UserFacingError(
        "You need organization owner or admin permissions for this action"
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { slackUserId: targetSlackUserId },
    });

    if (!targetUser) {
      throw new UserFacingError("Target user not found");
    }

    if (targetUser.id === adminUser.id) {
      throw new UserFacingError("You cannot promote yourself");
    }

    const targetMembership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: targetUser.id },
      },
    });

    if (!targetMembership || !targetMembership.isActive) {
      throw new UserFacingError(
        "Target user is not an active member of this team"
      );
    }

    const targetOrgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: team.organizationId,
          userId: targetUser.id,
        },
      },
    });

    if (targetOrgMembership?.role === "OWNER") {
      throw new UserFacingError(
        "Target user is the organization owner and cannot be promoted further"
      );
    }

    if (targetMembership.role === "ADMIN") {
      throw new UserFacingError("Target user is already a team admin");
    }

    const updated = await prisma.teamMember.update({
      where: {
        teamId_userId: { teamId, userId: targetUser.id },
      },
      data: { role: "ADMIN" },
    });

    return {
      teamMember: updated,
      team,
      previousRole: targetMembership.role,
    };
  }

  async getUserTeams(slackUserId, slackClient = null) {
    const userData = await userService.fetchSlackUserData(
      slackUserId,
      slackClient
    );
    const user = await userService.findOrCreateUser(slackUserId, userData);

    const memberships = await prisma.teamMember.findMany({
      where: {
        userId: user.id,
        isActive: true,
        team: {
          isActive: true,
        },
      },
      include: {
        team: true,
      },
    });

    return memberships.map((m) => m.team);
  }
}

module.exports = new TeamService();
