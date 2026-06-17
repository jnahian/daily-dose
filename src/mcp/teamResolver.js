const prisma = require("../config/prisma");

/**
 * Resolve a team identifier (UUID or case-insensitive name) to a team the
 * given Slack user is an active member of.
 * @returns {Promise<{team?: object, error?: string}>}
 */
async function resolveTeam(slackUserId, identifier) {
  const memberships = await prisma.teamMember.findMany({
    where: {
      isActive: true,
      team: { isActive: true },
      user: { slackUserId },
    },
    include: { team: true },
  });

  if (memberships.length === 0) {
    return { error: "You are not a member of any teams." };
  }

  const needle = String(identifier || "")
    .trim()
    .toLowerCase();
  const membership = memberships.find(
    (m) => m.team.id === identifier || m.team.name.toLowerCase() === needle
  );

  if (!membership) {
    const names = memberships.map((m) => m.team.name).join(", ");
    return {
      error: `Team "${identifier}" not found. Available teams: ${names}`,
    };
  }
  return { team: membership.team };
}

module.exports = { resolveTeam };
