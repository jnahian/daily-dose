const prisma = require("../config/prisma");

class UserService {
  async findOrCreateUser(slackUserId, userData = {}) {
    return await prisma.user.upsert({
      where: { slackUserId },
      update: {
        name: userData.name,
        email: userData.email,
      },
      create: {
        slackUserId,
        name: userData.name,
        email: userData.email,
        timezone: userData.timezone || process.env.DEFAULT_TIMEZONE,
      },
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

  async setLeave(slackUserId, startDate, endDate, reason) {
    const user = await this.findOrCreateUser(slackUserId);

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

    if (!user) return null;

    return await prisma.leave.delete({
      where: {
        id: leaveId,
        userId: user.id,
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

  async setWorkDays(slackUserId, workDays) {
    const user = await this.findOrCreateUser(slackUserId);

    return await prisma.user.update({
      where: { id: user.id },
      data: { workDays },
    });
  }

  async getWorkDays(slackUserId) {
    const user = await prisma.user.findUnique({
      where: { slackUserId },
      select: { workDays: true },
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
}

module.exports = new UserService();