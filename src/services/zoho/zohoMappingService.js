const prisma = require("../../config/prisma");
const userService = require("../userService");
const { UserFacingError } = require("../../utils/errorHelper");

// Slack user <-> Zoho employee mapping is scoped per organization, since a
// Slack user could in principle belong to more than one Zoho-enabled org.
// zohoEmployeeId is always handled as a string end-to-end — never coerce it
// to Number, Zoho employee IDs overflow JS's safe integer range.
async function mapMember(
  organizationId,
  targetSlackUserId,
  zohoEmployeeId,
  slackClient = null
) {
  if (!zohoEmployeeId || typeof zohoEmployeeId !== "string") {
    throw new UserFacingError("A Zoho employee ID is required");
  }

  const userData = await userService.fetchSlackUserData(
    targetSlackUserId,
    slackClient
  );
  const user = await userService.findOrCreateUser(targetSlackUserId, userData);

  const existingForEmployee = await prisma.zohoUserMapping.findUnique({
    where: {
      organizationId_zohoEmployeeId: { organizationId, zohoEmployeeId },
    },
  });
  if (existingForEmployee && existingForEmployee.userId !== user.id) {
    throw new UserFacingError(
      `Zoho employee ID ${zohoEmployeeId} is already mapped to another Slack member`
    );
  }

  try {
    return await prisma.zohoUserMapping.upsert({
      where: { organizationId_userId: { organizationId, userId: user.id } },
      update: { zohoEmployeeId },
      create: { organizationId, userId: user.id, zohoEmployeeId },
    });
  } catch (error) {
    // Race: two concurrent requests can both pass the findUnique check above
    // before either writes — the loser hits the organizationId_zohoEmployeeId
    // unique constraint here instead. Surface the same friendly message.
    if (error.code === "P2002") {
      throw new UserFacingError(
        `Zoho employee ID ${zohoEmployeeId} is already mapped to another Slack member`
      );
    }
    throw error;
  }
}

async function unmapMember(organizationId, targetSlackUserId) {
  const user = await prisma.user.findUnique({
    where: { slackUserId: targetSlackUserId },
  });
  if (!user) {
    throw new UserFacingError("User not found");
  }

  const deleted = await prisma.zohoUserMapping.deleteMany({
    where: { organizationId, userId: user.id },
  });

  if (deleted.count === 0) {
    throw new UserFacingError(
      "This member has no Zoho mapping in your organization"
    );
  }

  return deleted;
}

async function listMappings(organizationId) {
  return prisma.zohoUserMapping.findMany({
    where: { organizationId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
}

// Batch lookup used by the sync job: zohoEmployeeId (string) -> userId.
async function getUserIdsByEmployeeId(organizationId) {
  const mappings = await prisma.zohoUserMapping.findMany({
    where: { organizationId },
    select: { zohoEmployeeId: true, userId: true },
  });
  return new Map(mappings.map((m) => [m.zohoEmployeeId, m.userId]));
}

module.exports = {
  mapMember,
  unmapMember,
  listMappings,
  getUserIdsByEmployeeId,
};
