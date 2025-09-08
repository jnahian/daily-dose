/**
 * Utility functions for handling standup reminder messages
 */

const STANDUP_REMINDER_MESSAGES = [
  "Hey <@USER_ID>! 👋 Daily Dose here – time to post your daily standup updates. Please share:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Hey <@USER_ID>! 👋 Daily Dose reminding you to post your standup for today! Don't forget:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Hello <@USER_ID>! 👋 Daily Dose here – time to share your daily standup updates. Please update:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Hi <@USER_ID>! 👋 Daily Dose here – don't forget to post your standup updates. Your checklist:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Hey <@USER_ID>! 👋 Daily Dose here – time for your daily standup! Make sure to share:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
];

const FOLLOWUP_REMINDER_MESSAGES = [
  "⏰ Hey <@USER_ID>! Just a friendly reminder from Daily Dose – your standup is still pending. Don't forget to submit it!",
  "🔔 Hi <@USER_ID>! Daily Dose here with a gentle nudge – we're still waiting for your standup update.",
  "⏰ <@USER_ID>, this is Daily Dose checking in – looks like your standup hasn't been submitted yet. Quick reminder!",
  "🕐 Hey <@USER_ID>! Daily Dose here – just making sure you didn't miss submitting your standup today.",
  "⏰ Hi <@USER_ID>! Daily Dose with a friendly follow-up – your standup is still needed before the deadline.",
];

/**
 * Get a random standup reminder message
 * @param {string} userId - The Slack user ID to mention
 * @returns {string} A random reminder message with the user ID inserted
 */
function getRandomStandupMessage(userId) {
  const randomIndex = Math.floor(
    Math.random() * STANDUP_REMINDER_MESSAGES.length
  );
  const message = STANDUP_REMINDER_MESSAGES[randomIndex];
  return message.replace("<@USER_ID>", `<@${userId}>`);
}

/**
 * Get a random followup reminder message
 * @param {string} userId - The Slack user ID to mention
 * @returns {string} A random followup message with the user ID inserted
 */
function getRandomFollowupMessage(userId) {
  const randomIndex = Math.floor(
    Math.random() * FOLLOWUP_REMINDER_MESSAGES.length
  );
  const message = FOLLOWUP_REMINDER_MESSAGES[randomIndex];
  return message.replace("<@USER_ID>", `<@${userId}>`);
}

module.exports = {
  getRandomStandupMessage,
  getRandomFollowupMessage,
  STANDUP_REMINDER_MESSAGES,
  FOLLOWUP_REMINDER_MESSAGES,
};
