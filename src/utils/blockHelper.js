/**
 * Utility functions for generating Slack Block Kit components
 */

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
function createInputBlock(blockId, label, actionId, placeholder, optional = false, elementType = "rich_text_input") {
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
function createStandupModal(teamName, teamId, today, existingResponse = null, lastResponse = null) {
  const blocks = [
    createSectionBlock(`*📊 ${teamName} - ${today}*${existingResponse ? " (Update)" : ""}`),
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

  // Add initial values if lastResponse exists (prefill today's tasks with yesterday's tasks)
  if (lastResponse && lastResponse.todayTasks) {
    const todayTasksBlock = blocks.find(block => block.block_id === "today_tasks");
    if (todayTasksBlock) {
      todayTasksBlock.element.initial_value = {
        type: "rich_text",
        elements: [
          {
            type: "rich_text_section",
            elements: [
              {
                type: "text",
                text: lastResponse.todayTasks
              }
            ]
          }
        ]
      };
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
      createButton(
        "📝 Submit Standup",
        "submit_standup",
        teamId,
        "primary"
      ),
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
  const blocks = [
    createSectionBlock(`*👤 ${response.userMention}*`),
  ];

  const fields = [];
  
  if (response.yesterdayTasks) {
    fields.push({
      type: "mrkdwn",
      text: `*📄 Last Working Day*\n${response.yesterdayTasks}`,
    });
  }

  if (response.todayTasks) {
    fields.push({
      type: "mrkdwn",
      text: `*🎯 Today*\n${response.todayTasks}`,
    });
  }

  if (fields.length > 0) {
    blocks.push(createFieldsBlock(fields));
  }

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

  const fields = [];

  if (response.yesterdayTasks) {
    fields.push({
      type: "mrkdwn",
      text: `*📄 Last Working Day*\n${response.yesterdayTasks}`,
    });
  }

  if (response.todayTasks) {
    fields.push({
      type: "mrkdwn",
      text: `*🎯 Today*\n${response.todayTasks}`,
    });
  }

  if (fields.length > 0) {
    blocks.push(createFieldsBlock(fields));
  }

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

  return [
    createSectionBlock(`*📝 Not Responded*\n${notRespondedText}`),
  ];
}

/**
 * Create on leave section blocks
 * @param {Array<object>} onLeave - Array of users who are on leave
 * @returns {Array<object>} Array of blocks for on leave section
 */
function createOnLeaveBlocks(onLeave) {
  if (onLeave.length === 0) return [];

  const onLeaveText = onLeave
    .map((m) => `• <@${m.slackUserId}>`)
    .join("\n");

  return [
    createSectionBlock(`*🌴 On Leave*\n${onLeaveText}`),
  ];
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
      teams.map((team) =>
        createButton(team.name, actionId, team.id.toString())
      )
    ),
  ];
}

/**
 * Create error message blocks
 * @param {string} message - Error message text
 * @returns {Array<object>} Array of blocks for error message
 */
function createErrorBlocks(message) {
  return [
    createSectionBlock(`❌ ${message}`),
  ];
}

/**
 * Create success message blocks
 * @param {string} message - Success message text
 * @returns {Array<object>} Array of blocks for success message
 */
function createSuccessBlocks(message) {
  return [
    createSectionBlock(`✅ ${message}`),
  ];
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
function createStandupUpdateModal(teamName, teamId, today, standupDate, existingResponse = null) {
  return {
    type: "modal",
    callback_id: "standup_update_modal",
    private_metadata: JSON.stringify({ 
      teamId, 
      standupDate,
      isUpdate: !!existingResponse
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
      createSectionBlock(`*📊 ${teamName} - ${today}*${existingResponse ? " (Update)" : ""}`),
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
    ].map(block => {
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
                    text: initialText
                  }
                ]
              }
            ]
          };
        }
      }
      return block;
    }),
  };
}

module.exports = {
  createSectionBlock,
  createFieldsBlock,
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
};