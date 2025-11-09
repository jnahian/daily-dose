const prisma = require("../config/prisma");

/**
 * Resolve team from context (channel or team name)
 * Context-aware resolution:
 * - If teamName is provided, find team by name
 * - If no teamName but channelId provided, find team by channel
 * - Returns null if team not found
 *
 * @param {string|null} channelId - The Slack channel ID (optional)
 * @param {string|null} teamName - The team name to search for (optional)
 * @param {number|null} userId - The user ID for additional context (optional)
 * @returns {Promise<{team: object|null, error: string|null}>} Team object and error message
 */
async function resolveTeamFromContext(channelId = null, teamName = null, userId = null) {
  try {
    let team = null;

    // Priority 1: If team name is provided, search by name
    if (teamName && teamName.trim()) {
      team = await prisma.team.findFirst({
        where: {
          name: {
            equals: teamName.trim(),
            mode: "insensitive",
          },
          isActive: true,
        },
        include: {
          organization: true,
        },
      });

      if (!team) {
        return {
          team: null,
          error: `Team "${teamName}" not found. Please check the team name and try again.`,
        };
      }

      return { team, error: null };
    }

    // Priority 2: If no team name, try to find by channel ID
    if (channelId) {
      team = await prisma.team.findFirst({
        where: {
          slackChannelId: channelId,
          isActive: true,
        },
        include: {
          organization: true,
        },
      });

      if (!team) {
        return {
          team: null,
          error: "This channel is not associated with any team. Please provide a team name.",
        };
      }

      return { team, error: null };
    }

    // No context provided
    return {
      team: null,
      error: "Please provide a team name or run this command in a team channel.",
    };
  } catch (error) {
    console.error("Error resolving team from context:", error);
    return {
      team: null,
      error: "An error occurred while finding the team. Please try again.",
    };
  }
}

/**
 * Get all teams for an organization
 * @param {number} organizationId - The organization ID
 * @returns {Promise<Array<object>>} Array of team objects
 */
async function getTeamsByOrganization(organizationId) {
  try {
    const teams = await prisma.team.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            members: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return teams;
  } catch (error) {
    console.error("Error fetching teams by organization:", error);
    return [];
  }
}

/**
 * Get team by ID with full details
 * @param {number} teamId - The team ID
 * @returns {Promise<object|null>} Team object or null
 */
async function getTeamById(teamId) {
  try {
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        isActive: true,
      },
      include: {
        organization: true,
      },
    });

    return team;
  } catch (error) {
    console.error("Error fetching team by ID:", error);
    return null;
  }
}
  }
}

/**
 * Parse team name from command text
 * Handles team names with or without quotes
 * @param {string} commandText - The command text to parse
 * @returns {string|null} Parsed team name or null
 */
function parseTeamName(commandText) {
  if (!commandText || !commandText.trim()) {
    return null;
  }

  const text = commandText.trim();

  // Check if text is wrapped in quotes
  const quotedMatch = text.match(/^["'](.+)["']$/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Return the text as-is (might be multi-word without quotes)
  return text;
}

/**
 * Parse command arguments for date and team name
 * Supports formats:
 * - "team name"
 * - 2025-01-15
 * - 2025-01-15 "team name"
 * - "team name" 2025-01-15
 *
 * @param {string} commandText - The command text to parse
 * @returns {{date: string|null, teamName: string|null}} Parsed date and team name
 */
function parseCommandArguments(commandText) {
  if (!commandText || !commandText.trim()) {
    return { date: null, teamName: null };
  }

  const text = commandText.trim();
  let date = null;
  let teamName = null;

  // Date pattern: YYYY-MM-DD
  const datePattern = /\b(\d{4}-\d{2}-\d{2})\b/;
  const dateMatch = text.match(datePattern);

  if (dateMatch) {
    date = dateMatch[1];
    // Remove date from text to extract team name
    const remainingText = text.replace(dateMatch[0], "").trim();
    if (remainingText) {
      teamName = parseTeamName(remainingText);
    }
  } else {
    // No date, entire text is team name
    teamName = parseTeamName(text);
  }

  return { date, teamName };
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} dateStr - The date string to validate
 * @returns {{isValid: boolean, error: string|null}} Validation result
 */
function validateDateFormat(dateStr) {
  if (!dateStr) {
    return { isValid: true, error: null };
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(dateStr)) {
    return {
      isValid: false,
      error: "Invalid date format. Please use YYYY-MM-DD format (e.g., 2025-01-15).",
    };
  }

  // Check if date is valid
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error: "Invalid date. Please provide a valid date in YYYY-MM-DD format.",
    };
  }

  return { isValid: true, error: null };
}

module.exports = {
  resolveTeamFromContext,
  getTeamsByOrganization,
  getTeamById,
  parseTeamName,
  parseCommandArguments,
  validateDateFormat,
};
