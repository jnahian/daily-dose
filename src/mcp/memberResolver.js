const prisma = require("../config/prisma");

// Matches a Slack mention wrapper an agent might paste, e.g. "<@U123>" or
// "<@U123|alice>". Capture group 1 is the Slack user id.
const MENTION_RE = /^<@([A-Z0-9]+)(?:\|[^>]*)?>$/i;

/**
 * Resolve a free-text member identifier to an active member of a team.
 * Accepts a Slack user id (case-sensitive), a display name, or a username
 * (both case-insensitive), and tolerates a "<@U…>" / "@U…" wrapper.
 * @returns {Promise<{member?: object, error?: string}>} the matched User row.
 */
async function resolveMember(teamId, identifier) {
  const members = await prisma.teamMember.findMany({
    where: { teamId, isActive: true },
    include: { user: true },
  });

  if (members.length === 0) {
    return { error: "This team has no active members." };
  }

  const raw = String(identifier || "").trim();
  const mention = raw.match(MENTION_RE);
  // Slack ids are case-sensitive; preserve case for the id comparison.
  const idNeedle = mention ? mention[1] : raw.replace(/^@/, "");
  const nameNeedle = idNeedle.toLowerCase();

  const match = members.find((m) => {
    const u = m.user;
    return (
      u.slackUserId === idNeedle ||
      (u.name && u.name.toLowerCase() === nameNeedle) ||
      (u.username && u.username.toLowerCase() === nameNeedle)
    );
  });

  if (!match) {
    return { error: `Member "${identifier}" not found in this team.` };
  }
  return { member: match.user };
}

module.exports = { resolveMember };
