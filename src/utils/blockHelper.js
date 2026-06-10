/**
 * Utility functions for generating Slack Block Kit components
 */

const { convertTextToRichText } = require("./messageHelper");

/**
 * Create a basic section block with markdown text
 * @param {string} text - The markdown text to display
 * @returns {object} Slack section block
 */
function createSectionBlock(text) {
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text,
    },
  };
}

/**
 * Create a section block with fields (for two-column layout)
 * @param {Array<object>} fields - Array of field objects with type and text
 * @returns {object} Slack section block with fields
 */
function createFieldsBlock(fields) {
  return {
    type: "section",
    fields,
  };
}

// Slack Block Kit limits: a section `fields[].text` caps at 2000 chars, a
// section `text` at 3000. Standup task lists with long pasted URLs can exceed
// the field cap, which makes Slack reject the whole message with
// `invalid_blocks`. Keep the compact two-column layout when everything fits;
// otherwise fall back to full-width sections and truncate only pathological
// content — on a line boundary, so links aren't cut mid-URL.
const SLACK_FIELD_MAX = 2000;
const SLACK_TEXT_MAX = 3000;

function truncateForSlack(text, max) {
  if (text.length <= max) return text;
  const marker = "\n… _(truncated)_";
  const slice = text.slice(0, max - marker.length);
  const lastNewline = slice.lastIndexOf("\n");
  const safe = lastNewline > 0 ? slice.slice(0, lastNewline) : slice;
  return safe + marker;
}

/**
 * Build the per-user task blocks (yesterday/today) within Slack's limits.
 * Two-column fields when each entry fits the 2000-char field cap; otherwise
 * full-width section blocks (3000-char cap, safely truncated).
 * @param {string} [yesterdayTasks]
 * @param {string} [todayTasks]
 * @returns {Array<object>} Slack blocks (possibly empty)
 */
function createTaskFieldBlocks(yesterdayTasks, todayTasks) {
  const entries = [];
  if (yesterdayTasks) entries.push(`*📄 Last Working Day*\n${yesterdayTasks}`);
  if (todayTasks) entries.push(`*🎯 Today*\n${todayTasks}`);
  if (entries.length === 0) return [];

  if (entries.every((text) => text.length <= SLACK_FIELD_MAX)) {
    return [
      createFieldsBlock(entries.map((text) => ({ type: "mrkdwn", text }))),
    ];
  }

  return entries.map((text) =>
    createSectionBlock(truncateForSlack(text, SLACK_TEXT_MAX))
  );
}

/**
 * Create a context block with a single mrkdwn element
 * @param {string} text - mrkdwn text
 * @returns {object} Slack context block
 */
function createContextBlock(text) {
  return {
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text,
      },
    ],
  };
}

/**
 * Create the DM blocks notifying a team admin that a member submitted or
 * updated their standup
 * @param {string} notificationText - Pre-formatted notification line
 * @param {object} team - Team with name and slackChannelId
 * @returns {Array<object>} Slack blocks
 */
function createAdminSubmissionNotificationBlocks(notificationText, team) {
  return [
    createSectionBlock(notificationText),
    createContextBlock(
      `Team: *${team.name}* | Channel: <#${team.slackChannelId}>`
    ),
  ];
}

/**
 * Create the Slack message blocks for a website contact-form submission.
 * All values are user input from an unauthenticated public endpoint, so they
 * are rendered as plain_text (never mrkdwn) — Slack treats plain_text
 * literally, which neutralises mention/link/formatting injection.
 * @param {object} submission
 * @param {string} submission.name
 * @param {string} submission.email
 * @param {string} submission.subject
 * @param {string} submission.message
 * @returns {Array<object>} Slack blocks
 */
function createContactNotificationBlocks({ name, email, subject, message }) {
  return [
    createSectionBlock("*📬 New contact form submission*"),
    createFieldsBlock([
      { type: "plain_text", text: `From: ${name}` },
      { type: "plain_text", text: `Email: ${email}` },
    ]),
    {
      type: "section",
      text: { type: "plain_text", text: `Subject: ${subject}` },
    },
    createDividerBlock(),
    {
      type: "section",
      text: { type: "plain_text", text: message },
    },
  ];
}

/**
 * Create a divider block
 * @returns {object} Slack divider block
 */
function createDividerBlock() {
  return {
    type: "divider",
  };
}

/**
 * Create an actions block with buttons
 * @param {Array<object>} elements - Array of button elements
 * @returns {object} Slack actions block
 */
function createActionsBlock(elements) {
  return {
    type: "actions",
    elements,
  };
}

/**
 * Create a button element
 * @param {string} text - Button text
 * @param {string} actionId - Action ID for the button
 * @param {string} value - Button value
 * @param {string} style - Button style (primary, danger, etc.)
 * @returns {object} Slack button element
 */
function createButton(text, actionId, value, style = null) {
  const button = {
    type: "button",
    text: {
      type: "plain_text",
      text,
    },
    action_id: actionId,
    value,
  };

  if (style) {
    button.style = style;
  }

  return button;
}

/**
 * Create an input block for forms/modals
 * @param {string} blockId - Block ID
 * @param {string} label - Input label
 * @param {string} actionId - Action ID for the input
 * @param {string} placeholder - Placeholder text
 * @param {boolean} optional - Whether the input is optional
 * @param {string} elementType - Type of input element (rich_text_input, plain_text_input, etc.)
 * @returns {object} Slack input block
 */
function createInputBlock(
  blockId,
  label,
  actionId,
  placeholder,
  optional = false,
  elementType = "rich_text_input"
) {
  return {
    type: "input",
    block_id: blockId,
    element: {
      type: elementType,
      action_id: actionId,
      placeholder: {
        type: "plain_text",
        text: placeholder,
      },
    },
    label: {
      type: "plain_text",
      text: label,
    },
    optional,
  };
}

/**
 * Create a standup modal structure
 * @param {string} teamName - Team name
 * @param {string} teamId - Team ID
 * @param {string} today - Today's date formatted string
 * @param {object} existingResponse - Existing response data (optional)
 * @param {object} lastResponse - Last standup response to prefill today's tasks (optional)
 * @returns {object} Complete modal view structure
 */
function createStandupModal(
  teamName,
  teamId,
  today,
  existingResponse = null,
  lastResponse = null
) {
  const blocks = [
    createSectionBlock(
      `*📊 ${teamName} - ${today}*${existingResponse ? " (Update)" : ""}`
    ),
    createDividerBlock(),
    createInputBlock(
      "yesterday_tasks",
      "Last Working Day's Tasks",
      "yesterday_input",
      "What did you work on your last working day?",
      false
    ),
    createInputBlock(
      "today_tasks",
      "Today's Tasks",
      "today_input",
      "What will you work on today?",
      false
    ),
    createInputBlock(
      "blockers",
      "Blockers",
      "blockers_input",
      "Any blockers or help needed?",
      true
    ),
  ];

  // Add initial values if lastResponse exists (prefill yesterday's tasks with last response's today's tasks)
  if (lastResponse && lastResponse.todayTasks) {
    const yesterdayTasksBlock = blocks.find(
      (block) => block.block_id === "yesterday_tasks"
    );
    if (yesterdayTasksBlock) {
      const richTextValue = convertTextToRichText(lastResponse.todayTasks);
      if (richTextValue) {
        yesterdayTasksBlock.element.initial_value = richTextValue;
      }
    }
  }

  return {
    type: "modal",
    callback_id: "standup_modal",
    private_metadata: JSON.stringify({ teamId }),
    title: {
      type: "plain_text",
      text: "Daily Dose",
    },
    submit: {
      type: "plain_text",
      text: "Submit",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks,
  };
}

/**
 * Create standup reminder message blocks
 * @param {string} message - The reminder message text
 * @param {string} teamName - Team name
 * @param {string} teamId - Team ID
 * @returns {Array<object>} Array of blocks for reminder message
 */
function createStandupReminderBlocks(message, teamName, teamId) {
  return [
    createSectionBlock(message),
    createActionsBlock([
      createButton("📝 Submit Standup", "submit_standup", teamId, "primary"),
    ]),
  ];
}

/**
 * Create standup summary header blocks
 * @param {string} teamName - Team name
 * @param {string} date - Date string
 * @param {number} totalMembers - Total number of team members
 * @param {number} submitted - Number of members who submitted
 * @returns {Array<object>} Array of blocks for summary header
 */
function createStandupSummaryHeader(teamName, date, totalMembers, submitted) {
  return [
    createSectionBlock(`*📊 Daily Standup — ${teamName}*`),
    createSectionBlock(`*📅 ${date}*`),
    createSectionBlock(`*👥 ${submitted}/${totalMembers} members responded*`),
    createDividerBlock(),
  ];
}

/**
 * Create user standup response blocks
 * @param {object} response - Response object with user data and tasks
 * @returns {Array<object>} Array of blocks for user response
 */
function createUserResponseBlocks(response) {
  const blocks = [createSectionBlock(`*👤 ${response.userMention}*`)];

  blocks.push(
    ...createTaskFieldBlocks(response.yesterdayTasks, response.todayTasks)
  );

  if (response.blockers && response.blockers.trim()) {
    blocks.push(createSectionBlock(`⚠️ *Blocker:* _${response.blockers}_`));
  }

  blocks.push(createDividerBlock());

  return blocks;
}

/**
 * Create late response message blocks
 * @param {object} response - Response object with user data and tasks
 * @returns {Array<object>} Array of blocks for late response
 */
function createLateResponseBlocks(response) {
  const blocks = [
    createSectionBlock(`🕐 *Late Submission*`),
    createSectionBlock(`*👤 ${response.userMention}*`),
  ];

  blocks.push(
    ...createTaskFieldBlocks(response.yesterdayTasks, response.todayTasks)
  );

  if (response.blockers && response.blockers.trim()) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `⚠️ *Blocker:* _${response.blockers}_`,
        },
      ],
    });
  }

  return blocks;
}

/**
 * Create not responded section blocks
 * @param {Array<object>} notResponded - Array of users who didn't respond
 * @returns {Array<object>} Array of blocks for not responded section
 */
function createNotRespondedBlocks(notResponded) {
  if (notResponded.length === 0) return [];

  const notRespondedText = notResponded
    .map((m) => `• <@${m.slackUserId}>`)
    .join("\n");

  return [createSectionBlock(`*📝 Not Responded*\n${notRespondedText}`)];
}

/**
 * Create on leave section blocks
 * @param {Array<object>} onLeave - Array of users who are on leave
 * @returns {Array<object>} Array of blocks for on leave section
 */
function createOnLeaveBlocks(onLeave) {
  if (onLeave.length === 0) return [];

  const onLeaveText = onLeave.map((m) => `• <@${m.slackUserId}>`).join("\n");

  return [createSectionBlock(`*🌴 On Leave*\n${onLeaveText}`)];
}

/**
 * Create team selection blocks
 * @param {Array<object>} teams - Array of team objects
 * @param {string} actionId - Action ID for team selection
 * @returns {Array<object>} Array of blocks for team selection
 */
function createTeamSelectionBlocks(teams, actionId = "select_team_standup") {
  const teamList = teams
    .map((team, index) => `${index + 1}. *${team.name}*`)
    .join("\n");

  return [
    createSectionBlock(`*📝 Select a team for standup:*\n${teamList}`),
    createActionsBlock(
      teams.map((team) => createButton(team.name, actionId, team.id.toString()))
    ),
  ];
}

/**
 * Create error message blocks
 * @param {string} message - Error message text
 * @returns {Array<object>} Array of blocks for error message
 */
function createErrorBlocks(message) {
  return [createSectionBlock(`❌ ${message}`)];
}

/**
 * Create success message blocks
 * @param {string} message - Success message text
 * @returns {Array<object>} Array of blocks for success message
 */
function createSuccessBlocks(message) {
  return [createSectionBlock(`✅ ${message}`)];
}

/**
 * Create standup update modal structure
 * @param {string} teamName - Team name
 * @param {string} teamId - Team ID
 * @param {string} today - Today's date formatted string
 * @param {string} standupDate - The standup date in YYYY-MM-DD format
 * @param {object} existingResponse - Existing response data (optional)
 * @returns {object} Complete modal view structure for updating
 */
function createStandupUpdateModal(
  teamName,
  teamId,
  today,
  standupDate,
  existingResponse = null
) {
  return {
    type: "modal",
    callback_id: "standup_update_modal",
    private_metadata: JSON.stringify({
      teamId,
      standupDate,
      isUpdate: !!existingResponse,
    }),
    title: {
      type: "plain_text",
      text: existingResponse ? "Update Standup" : "Daily Dose",
    },
    submit: {
      type: "plain_text",
      text: existingResponse ? "Update" : "Submit",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks: [
      createSectionBlock(
        `*📊 ${teamName} - ${today}*${existingResponse ? " (Update)" : ""}`
      ),
      createDividerBlock(),
      createInputBlock(
        "yesterday_tasks",
        "Last Working Day's Tasks",
        "yesterday_input",
        "What did you work on your last working day?",
        false,
        "rich_text_input"
      ),
      createInputBlock(
        "today_tasks",
        "Today's Tasks",
        "today_input",
        "What will you work on today?",
        false,
        "rich_text_input"
      ),
      createInputBlock(
        "blockers",
        "Blockers",
        "blockers_input",
        "Any blockers or help needed?",
        true,
        "rich_text_input"
      ),
    ].map((block) => {
      // Add initial values to input blocks if existingResponse exists
      if (block.type === "input" && existingResponse) {
        const blockId = block.block_id;
        let initialText = "";

        if (blockId === "yesterday_tasks" && existingResponse.yesterdayTasks) {
          initialText = existingResponse.yesterdayTasks;
        } else if (blockId === "today_tasks" && existingResponse.todayTasks) {
          initialText = existingResponse.todayTasks;
        } else if (blockId === "blockers" && existingResponse.blockers) {
          initialText = existingResponse.blockers;
        }

        if (initialText) {
          block.element.initial_value = {
            type: "rich_text",
            elements: [
              {
                type: "rich_text_section",
                elements: [
                  {
                    type: "text",
                    text: initialText,
                  },
                ],
              },
            ],
          };
        }
      }
      return block;
    }),
  };
}

/**
 * Create command success response blocks
 * @param {string} message - Success message text
 * @param {object} details - Optional details object with additional info
 * @returns {Array<object>} Array of blocks for success response
 */
function createCommandSuccessBlocks(message, details = null) {
  const blocks = [createSectionBlock(`✅ ${message}`)];

  if (details) {
    const detailsText = Object.entries(details)
      .map(([key, value]) => `• *${key}:* ${value}`)
      .join("\n");

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: detailsText,
        },
      ],
    });
  }

  return blocks;
}

/**
 * Create command error response blocks
 * @param {string} message - Error message text
 * @param {Array<string>} suggestions - Optional array of suggestion strings
 * @returns {Array<object>} Array of blocks for error response
 */
function createCommandErrorBlocks(message, suggestions = null) {
  const blocks = [createSectionBlock(`❌ ${message}`)];

  if (suggestions && suggestions.length > 0) {
    const suggestionsText = suggestions
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n");

    blocks.push(
      createDividerBlock(),
      createSectionBlock(`*💡 Suggestions:*\n${suggestionsText}`)
    );
  }

  return blocks;
}

/**
 * Create permission denied response blocks
 * @param {string} requiredRole - The required role (ADMIN or OWNER)
 * @returns {Array<object>} Array of blocks for permission denied response
 */
function createPermissionDeniedBlocks(requiredRole = "ADMIN") {
  const roleText =
    requiredRole === "OWNER"
      ? "organization owner"
      : "team admin or organization owner";

  return [
    createSectionBlock(`❌ *Permission Denied*`),
    createSectionBlock(`You need to be a ${roleText} to use this command.`),
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_Contact your team admin or organization owner for help._",
        },
      ],
    },
  ];
}

/**
 * Create standup preview header blocks
 * @param {string} teamName - Team name
 * @param {string} date - Date string
 * @param {boolean} isToday - Whether the preview is for today
 * @returns {Array<object>} Array of blocks for preview header
 */
function createStandupPreviewHeaderBlocks(teamName, date, isToday = true) {
  const dateLabel = isToday ? "Today" : date;

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🔍 Standup Preview - ${teamName}`,
      },
    },
    createSectionBlock(`*📅 ${dateLabel}*`),
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_This is a preview. Use `/dd-standup-post` to publish this standup._",
        },
      ],
    },
    createDividerBlock(),
  ];
}

/**
 * Create no data available blocks
 * @param {string} context - Context of what data is missing (e.g., "standup responses")
 * @param {string} date - Optional date string
 * @returns {Array<object>} Array of blocks for no data message
 */
function createHomeTabView(appUrl = "https://dd.jnahian.me") {
  const webUrl = appUrl.replace(/\/$/, "");
  const docsUrl = `${webUrl}/docs`;
  const changelogUrl = `${webUrl}/changelog`;
  const videoUrl = "https://www.youtube.com/watch?v=bQrJqBpSlBU";

  return {
    type: "home",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "👋 Welcome to Daily Dose",
          emoji: true,
        },
      },
      createSectionBlock(
        "Automated daily standups for your team — reminders, submissions, and channel summaries, all without a meeting."
      ),
      createActionsBlock([
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "▶️  Watch intro video",
            emoji: true,
          },
          url: videoUrl,
          action_id: "home_open_video",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "🌐  Website", emoji: true },
          url: webUrl,
          action_id: "home_open_website",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "📖  Docs", emoji: true },
          url: docsUrl,
          action_id: "home_open_docs",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "📝  Changelog", emoji: true },
          url: changelogUrl,
          action_id: "home_open_changelog",
        },
      ]),
      createDividerBlock(),
      {
        type: "header",
        text: { type: "plain_text", text: "🚀 Get started", emoji: true },
      },
      createSectionBlock(
        "*1.* Create a team in your standup channel:\n" +
          "`/dd-team-create [TeamName] 09:30 10:00`\n\n" +
          "*2.* Invite teammates to join:\n" +
          "`/dd-team-join [TeamName]`\n\n" +
          "*3.* Submit standups any time:\n" +
          "`/dd-standup [TeamName]`"
      ),
      createDividerBlock(),
      {
        type: "header",
        text: { type: "plain_text", text: "💡 Handy commands", emoji: true },
      },
      createSectionBlock(
        "• `/dd-team-list` — list teams in your org\n" +
          "• `/dd-standup-history` — view your past submissions\n" +
          "• `/dd-leave-set YYYY-MM-DD` — skip reminders for leave\n" +
          "• `/dd-workdays-set 1,2,3,4,5` — set your work days\n" +
          "• `/dd-standup-reminder notify=off` — pause reminder DMs"
      ),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Need more? See the <${docsUrl}|full docs> or visit <${webUrl}|${webUrl.replace(/^https?:\/\//, "")}>.`,
          },
        ],
      },
    ],
  };
}

function createNoDataBlocks(context = "data", date = null) {
  const dateText = date ? ` for ${date}` : "";

  return [
    createSectionBlock(`⚠️ *No ${context} found${dateText}*`),
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_Team members haven't submitted any responses yet._",
        },
      ],
    },
  ];
}

module.exports = {
  createSectionBlock,
  createFieldsBlock,
  createTaskFieldBlocks,
  createContextBlock,
  createAdminSubmissionNotificationBlocks,
  createContactNotificationBlocks,
  createDividerBlock,
  createActionsBlock,
  createButton,
  createInputBlock,
  createStandupModal,
  createStandupUpdateModal,
  createStandupReminderBlocks,
  createStandupSummaryHeader,
  createUserResponseBlocks,
  createLateResponseBlocks,
  createNotRespondedBlocks,
  createOnLeaveBlocks,
  createTeamSelectionBlocks,
  createErrorBlocks,
  createSuccessBlocks,
  createCommandSuccessBlocks,
  createCommandErrorBlocks,
  createPermissionDeniedBlocks,
  createStandupPreviewHeaderBlocks,
  createNoDataBlocks,
  createHomeTabView,
};
