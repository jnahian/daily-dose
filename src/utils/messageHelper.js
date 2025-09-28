/**
 * Utility functions for handling standup reminder messages
 */

const STANDUP_REMINDER_MESSAGES = [
  "Hey <@USER_ID>!\n 👋 Time to post your daily standup updates. Please share:\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
  "Hello <@USER_ID>!\n 👋 Time to share your daily standup updates. Please update:\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
  "Hi <@USER_ID>!\n ⏰ Just a reminder to post your standup updates. Your checklist:\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
  "Hey <@USER_ID>!\n 🔔 Standup time! Make sure to share:\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
  "What’s up <@USER_ID>? 🚀 Time to get today rolling with your standup:\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
  "Heads up <@USER_ID>!\n 📣 Your standup update is due. Remember to include:\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
];

const FOLLOWUP_REMINDER_MESSAGES = [
  "Reminder <@USER_ID>!\n 👋 Your standup is still pending. Please update:\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
  "Hey <@USER_ID>!\n 🚀 Still waiting for your standup update. Please share:\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
  "Hi <@USER_ID>!\n 🙌 Quick follow-up — your standup isn’t in yet. Share:\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
  "Heads up <@USER_ID>!\n 📣 We’re missing your standup update. Please post:\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
  "Hey <@USER_ID>!\n 👀 Don’t forget your standup today! Please update:\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
  "Hi <@USER_ID>!\n ⚡ Just a reminder, your standup is still due. Please include:\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
  "Hello <@USER_ID>!\n 📝 Following up — can you share your standup update?\n• Last working day's tasks\n• Today's tasks\n• Any blockers",
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
                element.style === "ordered" ? `${index + 1}. ` : "• ";
              const content = item.elements
                .map((el) => formatElement(el))
                .join("");
              return prefix + content;
            }
            if (item.type === "rich_text_list") {
              // Handle nested lists with proper indentation
              const nestedContent = item.elements
                .map((nestedItem, nestedIndex) => {
                  if (nestedItem.type === "rich_text_section") {
                    const nestedPrefix =
                      item.style === "ordered" ? `${nestedIndex + 1}. ` : "• ";
                    const nestedText = nestedItem.elements
                      .map((el) => formatElement(el))
                      .join("");
                    return `  ${nestedPrefix}${nestedText}`;
                  }
                  return "";
                })
                .join("\n");
              return nestedContent;
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
}

/**
 * Convert markdown text to Slack rich text format for modal prefilling
 * @param {string} text - Markdown formatted text
 * @returns {object} Slack rich text value object
 */
function convertTextToRichText(text) {
  if (!text || typeof text !== "string") return null;

  const elements = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Handle code blocks (```...```)
    if (line.trim().startsWith("```")) {
      const codeLines = [];
      i++; // Skip opening ```
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // Skip closing ```

      elements.push({
        type: "rich_text_preformatted",
        elements: [
          {
            type: "rich_text_section",
            elements: [
              {
                type: "text",
                text: codeLines.join("\n"),
              },
            ],
          },
        ],
      });
      continue;
    }

    // Handle block quotes (> ...)
    if (line.trim().startsWith("> ")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].replace(/^>\s*/, ""));
        i++;
      }

      elements.push({
        type: "rich_text_quote",
        elements: [
          {
            type: "rich_text_section",
            elements: [
              {
                type: "text",
                text: quoteLines.join("\n"),
              },
            ],
          },
        ],
      });
      continue;
    }

    // Handle lists (both bulleted and numbered) with multi-level support
    const listInfo = getListItemInfo(line);
    if (listInfo) {
      // Parse the entire list structure recursively
      const { listElement, nextIndex } = parseListStructure(
        lines,
        i,
        listInfo.type,
        listInfo.indentLevel
      );
      elements.push(listElement);
      i = nextIndex;
      continue;
    }

    // Handle regular text lines - convert to list if multiple lines exist
    if (line.trim()) {
      // Check if we have multiple non-empty lines that should be converted to a list
      const remainingLines = lines.slice(i).filter((l) => l.trim());

      if (
        remainingLines.length > 1 &&
        !line.trim().startsWith("```") &&
        !line.trim().startsWith("> ") &&
        !line.trim().startsWith("• ") &&
        !line.trim().match(/^\d+\.\s/)
      ) {
        // Collect consecutive non-empty lines for list conversion
        const listItems = [];
        while (
          i < lines.length &&
          lines[i].trim() &&
          !lines[i].trim().startsWith("```") &&
          !lines[i].trim().startsWith("> ") &&
          !lines[i].trim().startsWith("• ") &&
          !lines[i].trim().match(/^\d+\.\s/)
        ) {
          listItems.push({
            type: "rich_text_section",
            elements: parseInlineFormatting(lines[i].trim()),
          });
          i++;
        }

        // If we collected multiple items, create a bulleted list
        if (listItems.length > 1) {
          elements.push({
            type: "rich_text_list",
            style: "bullet",
            elements: listItems,
          });
          continue;
        } else if (listItems.length === 1) {
          // Single item, add as regular section
          elements.push({
            type: "rich_text_section",
            elements: parseInlineFormatting(line.trim()),
          });
        }
      } else {
        // Single line or already formatted, add as section
        elements.push({
          type: "rich_text_section",
          elements: parseInlineFormatting(line),
        });
      }
    }

    i++;
  }

  return {
    type: "rich_text",
    elements:
      elements.length > 0
        ? elements
        : [
            {
              type: "rich_text_section",
              elements: [
                {
                  type: "text",
                  text: text,
                },
              ],
            },
          ],
  };
}

/**
 * Get the indentation level of a line
 * @param {string} line - The line to check
 * @returns {number} The indentation level (number of spaces/tabs)
 */
function getIndentLevel(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/**
 * Recursively parse list structure with unlimited nesting levels
 * @param {Array} lines - Array of lines to parse
 * @param {number} startIndex - Starting index in the lines array
 * @param {string} listType - Type of list ("bullet" or "ordered")
 * @param {number} baseIndentLevel - Base indentation level for this list
 * @returns {object} Object with listElement and nextIndex
 */
function parseListStructure(lines, startIndex, listType, baseIndentLevel) {
  const listItems = [];
  let i = startIndex;

  while (i < lines.length) {
    const currentListInfo = getListItemInfo(lines[i]);

    // Stop if not a list item or different type
    if (!currentListInfo || currentListInfo.type !== listType) {
      break;
    }

    // Stop if less indented than base level
    if (currentListInfo.indentLevel < baseIndentLevel) {
      break;
    }

    if (currentListInfo.indentLevel === baseIndentLevel) {
      // Same level item
      listItems.push({
        type: "rich_text_section",
        elements: parseInlineFormatting(currentListInfo.text),
      });
      i++;
    } else if (currentListInfo.indentLevel > baseIndentLevel) {
      // Nested list - recursively parse it
      const { listElement: nestedList, nextIndex } = parseListStructure(
        lines,
        i,
        currentListInfo.type,
        currentListInfo.indentLevel
      );
      listItems.push(nestedList);
      i = nextIndex;
    }
  }

  return {
    listElement: {
      type: "rich_text_list",
      style: listType === "bullet" ? "bullet" : "ordered",
      elements: listItems,
    },
    nextIndex: i,
  };
}

/**
 * Check if a line is a list item (bulleted or numbered)
 * @param {string} line - The line to check
 * @returns {object|null} Object with type and indent level, or null if not a list item
 */
function getListItemInfo(line) {
  const trimmed = line.trim();
  const indentLevel = getIndentLevel(line);

  if (trimmed.startsWith("• ")) {
    return { type: "bullet", indentLevel, text: trimmed.replace(/^•\s*/, "") };
  }

  if (/^\d+\.\s/.test(trimmed)) {
    return {
      type: "ordered",
      indentLevel,
      text: trimmed.replace(/^\d+\.\s*/, ""),
    };
  }

  return null;
}

/**
 * Parse inline formatting (bold, italic, strikethrough, code, links) in text
 * @param {string} text - Text with inline markdown formatting
 * @returns {Array} Array of text elements with formatting
 */
function parseInlineFormatting(text) {
  const elements = [];
  let currentPos = 0;

  // Regex patterns for different formatting
  const patterns = [
    { regex: /\*([^*]+)\*/g, style: { bold: true } }, // Bold: *text*
    { regex: /_([^_]+)_/g, style: { italic: true } }, // Italic: _text_
    { regex: /~([^~]+)~/g, style: { strike: true } }, // Strikethrough: ~text~
    { regex: /`([^`]+)`/g, style: { code: true } }, // Inline code: `text`
    { regex: /<([^|>]+)\|([^>]+)>/g, type: "link" }, // Links: <url|text>
    { regex: /<@([^>]+)>/g, type: "user" }, // User mentions: <@U123>
    { regex: /<#([^>]+)>/g, type: "channel" }, // Channel mentions: <#C123>
  ];

  // Find all matches and their positions
  const matches = [];
  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        fullMatch: match[0],
        style: pattern.style,
        type: pattern.type,
        url: pattern.type === "link" ? match[1] : undefined,
        linkText: pattern.type === "link" ? match[2] : undefined,
      });
    }
  });

  // Sort matches by position
  matches.sort((a, b) => a.start - b.start);

  // Process text with formatting
  matches.forEach((match) => {
    // Add plain text before this match
    if (match.start > currentPos) {
      const plainText = text.substring(currentPos, match.start);
      if (plainText) {
        elements.push({
          type: "text",
          text: plainText,
        });
      }
    }

    // Add formatted element
    if (match.type === "link") {
      elements.push({
        type: "link",
        url: match.url,
        text: match.linkText,
      });
    } else if (match.type === "user") {
      elements.push({
        type: "user",
        user_id: match.content,
      });
    } else if (match.type === "channel") {
      elements.push({
        type: "channel",
        channel_id: match.content,
      });
    } else if (match.style) {
      elements.push({
        type: "text",
        text: match.content,
        style: match.style,
      });
    }

    currentPos = match.end;
  });

  // Add remaining plain text
  if (currentPos < text.length) {
    const remainingText = text.substring(currentPos);
    if (remainingText) {
      elements.push({
        type: "text",
        text: remainingText,
      });
    }
  }

  // If no formatting was found, return plain text
  if (elements.length === 0) {
    elements.push({
      type: "text",
      text: text,
    });
  }

  return elements;
}

module.exports = {
  getRandomStandupMessage,
  getRandomFollowupMessage,
  STANDUP_REMINDER_MESSAGES,
  FOLLOWUP_REMINDER_MESSAGES,
  formatTasks,
  extractRichTextValue,
  convertTextToRichText,
  parseInlineFormatting,
  getIndentLevel,
  getListItemInfo,
  parseListStructure,
};
