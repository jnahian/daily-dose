/**
 * Utility functions for handling standup reminder messages
 */

const STANDUP_REMINDER_MESSAGES = [
  "Hey <@USER_ID>!\n 👋 Time to post your daily standup updates. Please share:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Hello <@USER_ID>!\n 👋 Time to share your daily standup updates. Please update:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Hi <@USER_ID>!\n ⏰ Just a reminder to post your standup updates. Your checklist:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Hey <@USER_ID>!\n 🔔 Standup time! Make sure to share:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "What’s up <@USER_ID>? 🚀 Time to get today rolling with your standup:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Heads up <@USER_ID>!\n 📣 Your standup update is due. Remember to include:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
];

const FOLLOWUP_REMINDER_MESSAGES = [
  "Reminder <@USER_ID>!\n 👋 Your standup is still pending. Please update:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Hey <@USER_ID>!\n 🚀 Still waiting for your standup update. Please share:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Hi <@USER_ID>!\n 🙌 Quick follow-up — your standup isn’t in yet. Share:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Heads up <@USER_ID>!\n 📣 We’re missing your standup update. Please post:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Hey <@USER_ID>!\n 👀 Don’t forget your standup today! Please update:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Hi <@USER_ID>!\n ⚡ Just a reminder, your standup is still due. Please include:\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
  "Hello <@USER_ID>!\n 📝 Following up — can you share your standup update?\n• Yesterday's tasks\n• Today's tasks\n• Any blockers",
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

/**
 * Preserve user formatting in tasks
 * @param {string} tasks - The tasks text from user input
 * @returns {string} Trimmed tasks preserving original formatting
 */
function formatTasks(tasks) {
  if (!tasks) return "";
  const result = tasks.trim();
  return result;
}

/**
 * Format a Slack rich text element for display
 * @param {*} el - The rich text element to format
 * @returns {string} The formatted text
 */
function formatElement(el) {
  if (el.type === "text") {
    let text = el.text;
    if (el.style?.bold) text = `*${text}*`;
    if (el.style?.italic) text = `_${text}_`;
    if (el.style?.strike) text = `~${text}~`;
    if (el.style?.code) text = `\`${text}\``;
    return text;
  }
  if (el.type === "link") {
    const linkText = el.text || el.url;
    return `<${el.url} ${el.text ? `|${linkText}` : ""}>`;
  }
  if (el.type === "user") return `<@${el.user_id}>`;
  if (el.type === "channel") return `<#${el.channel_id}>`;
  if (el.type === "emoji") return `:${el.name}:`;
  return "";
}

/**
 * Extract plain text from Slack rich text input while preserving formatting
 * @param {object} richTextValue - The rich text input object from Slack
 * @returns {string} The extracted plain text with formatting preserved
 */
function extractRichTextValue(richTextValue) {
  if (!richTextValue?.rich_text_value?.elements) return "";

  return richTextValue.rich_text_value.elements
    .map((element) => {
      if (element.type === "rich_text_section") {
        return element.elements.map((el) => formatElement(el)).join("");
      }
      if (element.type === "rich_text_list") {
        return element.elements
          .map((item, index) => {
            if (item.type === "rich_text_section") {
              const prefix =
                element.style === "ordered" ? `${index + 1}. ` : "- ";
              const content = item.elements
                .map((el) => formatElement(el))
                .join("");
              return prefix + content;
            }
            return "";
          })
          .join("\n");
      }
      if (element.type === "rich_text_quote") {
        return element.elements
          .map((section) => {
            if (section.type === "rich_text_section") {
              const content = section.elements
                .map((el) => {
                  if (el.type === "text") return el.text;
                  return "";
                })
                .join("");
              return `> ${content}`;
            }
            return "";
          })
          .join("\n");
      }
      if (element.type === "rich_text_preformatted") {
        const content = element.elements
          .map((section) => {
            if (section.type === "rich_text_section") {
              return section.elements
                .map((el) => (el.type === "text" ? el.text : ""))
                .join("");
            }
            return "";
          })
          .join("\n");
        return `\`\`\`\n${content}\n\`\`\``;
      }
      return "";
    })
    .join("\n");
};

module.exports = {
  getRandomStandupMessage,
  getRandomFollowupMessage,
  STANDUP_REMINDER_MESSAGES,
  FOLLOWUP_REMINDER_MESSAGES,
  formatTasks,
  extractRichTextValue,
};
