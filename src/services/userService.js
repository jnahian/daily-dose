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
