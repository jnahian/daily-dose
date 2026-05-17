const prisma = require("../config/prisma");

class UserService {
  async fetchSlackUserData(slackUserId, slackClient) {
    if (!slackClient) return {};

    try {
      const slackUserInfo = await slackClient.users.info({
        user: slackUserId,
      });

      if (slackUserInfo.ok && slackUserInfo.user) {
        const slackUser = slackUserInfo.user;
        return {
          name: slackUser.real_name || slackUser.name,
          username: slackUser.name,
          email: slackUser.profile?.email,
          timezone: slackUser.tz || slackUser.profile?.timezone,
        };
      }
    } catch (error) {
      console.warn(
        `Failed to fetch user info from Slack for ${slackUserId}:`,
        error.message
      );
    }

    return {};
  }
  async findOrCreateUser(slackUserId, userData = {}) {
    const updateData = {};
    const createData = { slackUserId };

    // Only update/create fields that have values
    if (userData.name) {
      updateData.name = userData.name;
      createData.name = userData.name;
    }
    if (userData.username) {
      updateData.username = userData.username;
      createData.username = userData.username;
    }
    if (userData.email) {
      updateData.email = userData.email;
      createData.email = userData.email;
    }
    if (userData.timezone) {
      updateData.timezone = userData.timezone;
      createData.timezone = userData.timezone;
    } else {
      // Only set default timezone on create, not update
      createData.timezone = process.env.DEFAULT_TIMEZONE || "America/New_York";
    }

    return await prisma.user.upsert({
      where: { slackUserId },
      update: updateData,
      create: createData,
    });
  }

  async getUserOrganization(slackUserId) {
    const user = await prisma.user.findUnique({
      where: { slackUserId },
      include: {
        organizations: {
          where: { isActive: true },
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user || user.organizations.length === 0) {
      return null;
    }

    return user.organizations[0].organization;
  }

  async canCreateTeam(userId, organizationId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    return membership && ["OWNER", "ADMIN"].includes(membership.role);
  }

  async setLeave(slackUserId, startDate, endDate, reason, slackClient = null) {
    const userData = await this.fetchSlackUserData(slackUserId, slackClient);
    const user = await this.findOrCreateUser(slackUserId, userData);

    return await prisma.leave.create({
      data: {
        userId: user.id,
        startDate,
        endDate,
        reason,
      },
    });
  }

  async cancelLeave(slackUserId, leaveId) {
    const user = await prisma.user.findUnique({
      where: { slackUserId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Handle partial IDs - find leaves that start with the provided ID
    const matchingLeaves = await prisma.leave.findMany({
      where: {
        userId: user.id,
        id: {
          startsWith: leaveId,
        },
      },
    });

    if (matchingLeaves.length === 0) {
      throw new Error("Leave record not found or doesn't belong to you");
    }

    if (matchingLeaves.length > 1) {
      throw new Error(
        "Multiple leaves match this ID. Please provide a more specific ID"
      );
    }

    const leaveToDelete = matchingLeaves[0];

    return await prisma.leave.delete({
      where: {
        id: leaveToDelete.id,
      },
    });
  }

  async getActiveLeaves(userId, date) {
    return await prisma.leave.findMany({
      where: {
        userId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
  }

  async setWorkDays(slackUserId, workDays, slackClient = null) {
    const userData = await this.fetchSlackUserData(slackUserId, slackClient);
    const user = await this.findOrCreateUser(slackUserId, userData);

    return await prisma.user.update({
      where: { id: user.id },
      data: { workDays },
    });
  }

  async getWorkDays(slackUserId) {
    const user = await prisma.user.findUnique({
      where: { slackUserId },
      include: {
        organizations: {
          where: { isActive: true },
          include: {
            organization: {
              select: { settings: true },
            },
          },
        },
      },
    });

    if (!user) return null;

    // Return user-specific work days or organization default
    if (user.workDays) {
      return user.workDays;
    }

    const org = user.organizations[0]?.organization;
    return org?.settings?.defaultWorkDays || [1, 2, 3, 4, 7];
  }

  async addUserToOrganization(userId, organizationId, role = "MEMBER") {
    // Check if user is already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (existingMember) {
      // If inactive, reactivate them
      if (!existingMember.isActive) {
        return await prisma.organizationMember.update({
          where: {
            organizationId_userId: {
              organizationId,
              userId,
            },
          },
          data: {
            isActive: true,
            role,
          },
        });
      }
      return existingMember;
    }

    // Add user to organization
    return await prisma.organizationMember.create({
      data: {
        organizationId,
        userId,
        role,
      },
    });
  }

  async setOrganizationMemberActive(adminSlackUserId, targetSlackUserId, isActive, slackClient = null) {
    const adminUserData = await this.fetchSlackUserData(adminSlackUserId, slackClient);
    const adminUser = await this.findOrCreateUser(adminSlackUserId, adminUserData);

    const adminOrg = await this.getUserOrganization(adminSlackUserId);
    if (!adminOrg) {
      throw new Error("You must belong to an organization to manage members");
    }

    const adminOrgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: adminOrg.id,
          userId: adminUser.id,
        },
      },
    });

    if (
      !adminOrgMembership ||
      !adminOrgMembership.isActive ||
      !["OWNER", "ADMIN"].includes(adminOrgMembership.role)
    ) {
      throw new Error(
        "You need organization owner or admin permissions for this action"
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { slackUserId: targetSlackUserId },
    });

    if (!targetUser) {
      throw new Error("Target user not found");
    }

    if (targetUser.id === adminUser.id) {
      throw new Error("You cannot suspend yourself");
    }

    const targetOrgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: adminOrg.id,
          userId: targetUser.id,
        },
      },
    });

    if (!targetOrgMembership) {
      throw new Error("Target user is not a member of your organization");
    }

    // Owners can only be suspended by other owners
    if (targetOrgMembership.role === "OWNER" && adminOrgMembership.role !== "OWNER") {
      throw new Error("Only organization owners can suspend another owner");
    }

    if (targetOrgMembership.isActive === isActive) {
      throw new Error(
        isActive
          ? "Member is already active in this organization"
          : "Member is already suspended from this organization"
      );
    }

    // Cascade: update org membership and all team memberships in this org
    const orgTeams = await prisma.team.findMany({
      where: { organizationId: adminOrg.id },
      select: { id: true },
    });
    const teamIds = orgTeams.map((t) => t.id);

    const [orgUpdate, teamUpdate] = await prisma.$transaction([
      prisma.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId: adminOrg.id,
            userId: targetUser.id,
          },
        },
        data: { isActive },
      }),
      prisma.teamMember.updateMany({
        where: {
          userId: targetUser.id,
          teamId: { in: teamIds },
        },
        data: { isActive },
      }),
    ]);

    return {
      organizationMember: orgUpdate,
      teamMembershipsUpdated: teamUpdate.count,
      organization: adminOrg,
    };
  }

  async setMemberLeave(targetSlackUserId, startDate, endDate, reason, slackClient = null) {
    const userData = await this.fetchSlackUserData(targetSlackUserId, slackClient);
    const user = await this.findOrCreateUser(targetSlackUserId, userData);

    return await prisma.leave.create({
      data: {
        userId: user.id,
        startDate,
        endDate,
        reason,
      },
    });
  }

  async cancelMemberLeave(targetSlackUserId, leaveId) {
    const user = await prisma.user.findUnique({
      where: { slackUserId: targetSlackUserId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Handle partial IDs - find leaves that start with the provided ID
    const matchingLeaves = await prisma.leave.findMany({
      where: {
        userId: user.id,
        id: {
          startsWith: leaveId,
        },
      },
    });

    if (matchingLeaves.length === 0) {
      throw new Error("Leave record not found");
    }

    if (matchingLeaves.length > 1) {
      throw new Error(
        "Multiple leaves match this ID. Please provide a more specific ID"
      );
    }

    const leaveToDelete = matchingLeaves[0];

    return await prisma.leave.delete({
      where: {
        id: leaveToDelete.id,
      },
    });
  }

  async listMemberLeaves(targetSlackUserId, slackClient = null) {
    const userData = await this.fetchSlackUserData(targetSlackUserId, slackClient);
    const user = await this.findOrCreateUser(targetSlackUserId, userData);

    return await prisma.leave.findMany({
      where: {
        userId: user.id,
        endDate: { gte: new Date() }, // Only show current and future leaves
      },
      orderBy: {
        startDate: "asc",
      },
    });
  }
}

module.exports = new UserService();
