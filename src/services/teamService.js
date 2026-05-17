const prisma = require("../config/prisma");
const userService = require("./userService");
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
  async createTeam(slackUserId, channelId, teamData, slackClient = null) {
    // Get user and their organization
    const userData = await userService.fetchSlackUserData(
      slackUserId,
      slackClient
    );
    const user = await userService.findOrCreateUser(slackUserId, userData);
    const org = await userService.getUserOrganization(slackUserId);

    if (!org) {
      throw new Error("You must belong to an organization to create teams");
    }

    // Check permissions
    const canCreate = await userService.canCreateTeam(user.id, org.id);
    if (!canCreate) {
      throw new Error("You need admin permissions to create teams");
    }

    // Check if channel already has a team
    const existingTeam = await prisma.team.findUnique({
      where: { slackChannelId: channelId },
    });

    if (existingTeam) {
      throw new Error("This channel already has a team");
    }

    // Create team with transaction
    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          organizationId: org.id,
          name: teamData.name,
          slackChannelId: channelId,
          standupTime: validateTimeString(teamData.standupTime),
          postingTime: validateTimeString(teamData.postingTime),
          timezone: teamData.timezone || org.defaultTimezone,
        },
      });

      // Add creator as team admin
      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: user.id,
          role: "ADMIN",
        },
      });

      return team;
    });
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

  async findTeamByName(teamName) {
    return await prisma.team.findFirst({
      where: {
        name: {
          equals: teamName,
          mode: "insensitive",
        },
        isActive: true,
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
        members: {
          where: { userId: user.id, isActive: true },
        },
      },
    });

    if (!team) {
      throw new Error("Team not found");
    }

    // Check if user is an admin of this team
    const membership = team.members[0];
    if (!membership || membership.role !== "ADMIN") {
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
      updateFields.timezone = updateData.timezone;
    }

    // Handle notification preference update for the admin
    if (updateData.receiveNotifications !== undefined) {
      await prisma.teamMember.update({
        where: {
          teamId_userId: {
            teamId: teamId,
            userId: user.id
          }
        },
        data: {
          receiveNotifications: updateData.receiveNotifications
        }
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

  async updateTeamMemberPreferences(slackUserId, teamId, preferences, slackClient = null) {
    const userData = await userService.fetchSlackUserData(slackUserId, slackClient);
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
    const userData = await userService.fetchSlackUserData(slackUserId, slackClient);
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

  async setTeamMemberActive(adminSlackUserId, targetSlackUserId, teamId, isActive, slackClient = null) {
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
      adminMembership && adminMembership.isActive && adminMembership.role === "ADMIN";
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

  async getUserTeams(slackUserId, slackClient = null) {
    const userData = await userService.fetchSlackUserData(slackUserId, slackClient);
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

    return memberships.map(m => m.team);
  }
}

module.exports = new TeamService();
