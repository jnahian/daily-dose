const teamService = require("../services/teamService");

/**
 * Resolve a team identifier (UUID or case-insensitive name) to a team the
 * given Slack user can submit standups for, within their organization.
 * @returns {Promise<{team?: object, error?: string}>}
 */
async function resolveTeam(slackUserId, identifier) {
  const teams = await teamService.listTeams(slackUserId);
  if (teams.length === 0) {
    return { error: "You are not a member of any teams." };
  }

  const needle = String(identifier || "")
    .trim()
    .toLowerCase();
  const team = teams.find(
    (t) => t.id === identifier || t.name.toLowerCase() === needle
  );

  if (!team) {
    const names = teams.map((t) => t.name).join(", ");
    return {
      error: `Team "${identifier}" not found. Available teams: ${names}`,
    };
  }
  return { team };
}

module.exports = { resolveTeam };
