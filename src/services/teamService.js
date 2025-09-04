const prisma = require("../config/prisma");
const userService = require("./userService");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(customParseFormat);

// Helper function to validate and convert time string to Date object
function validateTimeString(timeString) {
  const time = dayjs(timeString, "HH:mm", true);
  if (!time.isValid()) {
    throw new Error(`Invalid time format: ${timeString}. Expected HH:MM format (e.g., 09:30)`);
  }
  return timeString;
}

class TeamService {
  async createTeam(slackUserId, channelId, teamData) {
    // Get user and their organization
    const user = await userService.findOrCreateUser(slackUserId);
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

  async joinTeam(slackUserId, teamId) {
    const user = await userService.findOrCreateUser(slackUserId);

    // Check if team exists and user's org matches
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { organization: true },
    });

    if (!team) {
      throw new Error("Team not found");
    }

    // Verify user belongs to same organization
    const userOrg = await userService.getUserOrganization(slackUserId);
    if (!userOrg || userOrg.id !== team.organizationId) {
      throw new Error("You can only join teams in your organization");
    }

    // Check if already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: team.id,
          userId: user.id,
        },
      },
    });

    if (existingMember) {
      throw new Error("You are already a member of this team");
    }

    // Add as member
    return await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        role: "MEMBER",
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
}

module.exports = new TeamService();