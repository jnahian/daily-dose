/**
 * User helper utilities for consistent user display and handling
 */

/**
 * Get display name for a user with proper fallback chain
 * @param {Object} user - User object from database
 * @returns {string} Display name
 */
function getDisplayName(user) {
  if (!user) return "Unknown User";

  // Priority: name > username > slackUserId
  return user.name || user.username || user.slackUserId;
}

/**
 * Get formatted user mention with display name
 * @param {Object} user - User object from database
 * @returns {string} Formatted user mention
 */
function getUserMention(user) {
  if (!user) return "Unknown User";

  //   const displayName = getDisplayName(user);
  return `<@${user.slackUserId}>`;
}

/**
 * Get user identifier for logging purposes
 * @param {Object} user - User object from database
 * @returns {string} User identifier for logs
 */
function getUserLogIdentifier(user) {
  if (!user) return "Unknown User";

  const displayName = getDisplayName(user);
  return displayName !== user.slackUserId
    ? `${displayName} (${user.slackUserId})`
    : user.slackUserId;
}

module.exports = {
  getDisplayName,
  getUserMention,
  getUserLogIdentifier,
};
