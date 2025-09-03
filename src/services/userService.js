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
}

module.exports = new UserService();