const standupService = require("../services/standupService");
const teamService = require("../services/teamService");
const userService = require("../services/userService");
const notificationService = require("../services/notificationService");
const prisma = require("../config/prisma");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { ackWithProcessing } = require("../utils/commandHelper");
const { getUserMention } = require("../utils/userHelper");
const { extractRichTextValue } = require("../utils/messageHelper");
const {
  createStandupModal,
  createTeamSelectionBlocks,
  createButton,
  createActionsBlock,
  createSectionBlock,
} = require("../utils/blockHelper");

dayjs.extend(utc);
dayjs.extend(timezone);

async function submitManual({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Loading standup form...",
    command
  );

  try {
    // Get user's teams
    const teams = await teamService.listTeams(command.user_id);

    if (teams.length === 0) {
      await updateResponse({
        text: "❌ You're not a member of any teams. Join a team first with `/dd-team-join TeamName`",
      });
      return;
    }

    // If user specified team name, use that; otherwise show team selection
    const teamName = command.text.trim();

    if (teamName) {
      const team = teams.find(
        (t) => t.name.toLowerCase() === teamName.toLowerCase()
      );

      if (!team) {
        await updateResponse({
          text: `❌ Team "${teamName}" not found. Available teams: ${teams
            .map((t) => t.name)
            .join(", ")}`,
        });
        return;
      }

      // Open modal directly using the command's trigger_id
      const today = dayjs().format("MMM DD, YYYY");

      try {
        const modalView = createStandupModal(team.name, team.id, today);
        await client.views.open({
          trigger_id: command.trigger_id,
          view: modalView,
        });
      } catch (modalError) {
        console.error("Error opening modal directly:", modalError);

        // Fallback to button approach if modal fails
        await updateResponse({
          blocks: [
            createSectionBlock(`*📝 Submit standup for ${team.name}*`),
            createActionsBlock([
              createButton("📝 Open Standup Form", `open_standup_${team.id}`, team.id.toString(), "primary")
            ])
          ],
        });
      }
    } else {
      // Show team selection
      await updateResponse({
        blocks: [
          ...createTeamSelectionBlocks(teams, "select_team_standup"),
          createSectionBlock("Usage: `/dd-standup TeamName`")
        ],
      });
    }
  } catch (error) {
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function openStandupModal({ body, ack, client }, teamId = null) {
  try {
    // Extract team ID from action_id if not provided
    if (!teamId && body.actions?.[0]?.action_id) {
      teamId = body.actions[0].action_id.replace("open_standup_", "");
    }

    if (!teamId) {
      console.error("No team ID provided for standup modal");
      await ack({
        text: "❌ Error: Team not found. Please try the command again.",
      });
      return;
    }

    // Get team info
    const teams = await teamService.listTeams(body.user.id);
    const team = teams.find((t) => t.id === teamId);

    if (!team) {
      console.error(`Team ${teamId} not found for user ${body.user.id}`);
      await ack({
        text: "❌ Error: Team not found. Please try the command again.",
      });
      return;
    }

    const today = dayjs().format("MMM DD, YYYY");

    // Check if trigger_id is available and not expired
    if (!body.trigger_id) {
      console.error("No trigger_id available for modal");
      await ack({
        text: "❌ Error: Session expired. Please try the command again.",
      });
      return;
    }

    // Acknowledge the button interaction and open modal in one go
    await ack();

    const modalView = createStandupModal(team.name, teamId, today);
    await client.views.open({
      trigger_id: body.trigger_id,
      view: modalView,
    });
  } catch (error) {
    console.error("Error opening standup modal:", error);

    // Handle specific Slack API errors
    if (error.code === "slack_webapi_platform_error") {
      if (error.data?.error === "expired_trigger_id") {
        console.error(
          "Trigger ID expired - user needs to click the button again"
        );

        // Try to send a follow-up message to the user
        try {
          await client.chat.postEphemeral({
            channel: body.channel?.id || body.user.id,
            user: body.user.id,
            text: "⏰ Session expired. Please run the `/dd-standup` command again to open the form.",
          });
        } catch (msgError) {
          console.error("Failed to send expiry message:", msgError);
        }
      }
    }
  }
}

async function handleStandupSubmission({ ack, body, view, client }) {
  await ack();

  try {
    const { teamId } = JSON.parse(view.private_metadata);
    const values = view.state.values;

    const yesterdayTasks =
      extractRichTextValue(values.yesterday_tasks?.yesterday_input) || "";
    const todayTasks =
      extractRichTextValue(values.today_tasks?.today_input) || "";
    const blockers =
      extractRichTextValue(values.blockers?.blockers_input) || "";

    // Check if at least one field is filled
    if (!yesterdayTasks && !todayTasks && !blockers) {
      // Re-open modal with error
      await client.views.update({
        view_id: body.view.id,
        view: {
          ...view,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "❌ Please fill in at least one field",
              },
            },
            ...view.blocks,
          ],
        },
      });
      return;
    }

    // Determine if submission is late
    const team = await teamService.getTeamById(teamId);
    const now = dayjs().tz(team.timezone);

    let isLate = false;
    if (team) {
      const [postingHour, postingMinute] = team.postingTime
        .split(":")
        .map(Number);
      const postingTime = dayjs()
        .tz(team.timezone)
        .startOf("day")
        .hour(postingHour)
        .minute(postingMinute);
      const nowInTeamTz = dayjs().tz(team.timezone);
      isLate = nowInTeamTz.isAfter(postingTime);
    }

    // Save response
    const responseData = {
      date: now.toDate(),
      yesterdayTasks,
      todayTasks,
      blockers,
    };

    await standupService.saveResponse(
      teamId,
      body.user.id,
      responseData,
      isLate,
      client
    );

    // Send confirmation as ephemeral message to the channel
    await client.chat.postEphemeral({
      channel: team.slackChannelId,
      user: body.user.id,
      text: `✅ Standup submitted for ${team?.name || "your team"}!${
        isLate ? " (marked as late)" : ""
      }`,
    });

    // Notify team admins about the submission
    await notificationService.notifyAdminsOfStandupSubmission({
      teamId,
      user: body.user,
      team,
      client,
      options: { isLate }
    });

    // If late, add to existing standup post as thread
    if (isLate && team) {
      const standupPost = await standupService.getStandupPost(
        teamId,
        now.toDate()
      );

      if (standupPost?.slackMessageTs) {
        // Create a response object that matches the expected format
        const lateResponse = {
          user: {
            name: body.user.name || body.user.id,
            slackUserId: body.user.id,
          },
          yesterdayTasks,
          todayTasks,
          blockers,
        };

        const message = await standupService.formatLateResponseMessage(
          lateResponse
        );

        await client.chat.postMessage({
          channel: standupPost.channelId,
          thread_ts: standupPost.slackMessageTs,
          reply_broadcast: true, // Send to channel flag - makes the threaded reply visible in the channel
          text: `🕐 *Late Submission* of ${getUserMention(lateResponse.user)}`,
          ...message,
        });
      }
    }
  } catch (error) {
    console.error("Error handling standup submission:", error);

    // Send error message to user
    await client.chat.postMessage({
      channel: body.user.id,
      text: `❌ Error submitting standup: ${error.message}`,
    });
  }
}

async function updateStandup({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Loading standup update...",
    command
  );

  try {
    // Parse command: /dd-standup-update TeamName [YYYY-MM-DD]
    const args = command.text.trim().split(" ");
    
    // Get user's teams
    const teams = await teamService.listTeams(command.user_id);

    if (teams.length === 0) {
      await updateResponse({
        text: "❌ You're not a member of any teams. Join a team first with `/dd-team-join TeamName`",
      });
      return;
    }

    // Team name is required
    if (!args[0]) {
      const teamList = teams.map((t) => t.name).join(", ");
      await updateResponse({
        text: `❌ Team name is required.\nUsage: \`/dd-standup-update TeamName [YYYY-MM-DD]\`\nAvailable teams: ${teamList}`,
      });
      return;
    }

    let targetTeam = null;
    let targetDate = dayjs().format("YYYY-MM-DD"); // Default to today

    // First arg must be team name
    const teamName = args[0];
    targetTeam = teams.find(
      (t) => t.name.toLowerCase() === teamName.toLowerCase()
    );
    
    if (!targetTeam) {
      await updateResponse({
        text: `❌ Team "${teamName}" not found. Available teams: ${teams
          .map((t) => t.name)
          .join(", ")}`,
      });
      return;
    }

    // Second arg is optional date
    if (args.length >= 2 && args[1]) {
      const isDate = /^\d{4}-\d{2}-\d{2}$/.test(args[1]);
      if (isDate) {
        targetDate = args[1];
      } else {
        await updateResponse({
          text: `❌ Invalid date format: ${args[1]}. Use YYYY-MM-DD format.\nUsage: \`/dd-standup-update ${teamName} [YYYY-MM-DD]\``,
        });
        return;
      }
    }

    // Validate date
    const parsedDate = dayjs(targetDate, "YYYY-MM-DD", true);
    if (!parsedDate.isValid()) {
      await updateResponse({
        text: `❌ Invalid date format: ${targetDate}. Use YYYY-MM-DD format.`,
      });
      return;
    }

    // Get user record first
    const userData = await userService.fetchSlackUserData(command.user_id, client);
    const user = await userService.findOrCreateUser(command.user_id, userData);

    // Check if user has existing standup for this date
    const existingResponse = await prisma.standupResponse.findUnique({
      where: {
        teamId_userId_standupDate: {
          teamId: targetTeam.id,
          userId: user.id,
          standupDate: parsedDate.toDate(),
        },
      },
    });

    // Open modal with existing data if available
    const today = parsedDate.format("MMM DD, YYYY");

    try {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: {
          type: "modal",
          callback_id: "standup_update_modal",
          private_metadata: JSON.stringify({ 
            teamId: targetTeam.id, 
            standupDate: targetDate,
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
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*📊 ${targetTeam.name} - ${today}*${existingResponse ? " (Update)" : ""}`,
              },
            },
            {
              type: "divider",
            },
            {
              type: "input",
              block_id: "yesterday_tasks",
              element: {
                type: "rich_text_input",
                action_id: "yesterday_input",
                initial_value: existingResponse?.yesterdayTasks ? {
                  type: "rich_text",
                  elements: [
                    {
                      type: "rich_text_section",
                      elements: [
                        {
                          type: "text",
                          text: existingResponse.yesterdayTasks
                        }
                      ]
                    }
                  ]
                } : undefined,
                placeholder: {
                  type: "plain_text",
                  text: "What did you work on yesterday?",
                },
              },
              label: {
                type: "plain_text",
                text: "Yesterday's Tasks",
              },
              optional: false,
            },
            {
              type: "input",
              block_id: "today_tasks",
              element: {
                type: "rich_text_input",
                action_id: "today_input",
                initial_value: existingResponse?.todayTasks ? {
                  type: "rich_text",
                  elements: [
                    {
                      type: "rich_text_section",
                      elements: [
                        {
                          type: "text",
                          text: existingResponse.todayTasks
                        }
                      ]
                    }
                  ]
                } : undefined,
                placeholder: {
                  type: "plain_text",
                  text: "What will you work on today?",
                },
              },
              label: {
                type: "plain_text",
                text: "Today's Tasks",
              },
              optional: false,
            },
            {
              type: "input",
              block_id: "blockers",
              element: {
                type: "rich_text_input",
                action_id: "blockers_input",
                initial_value: existingResponse?.blockers ? {
                  type: "rich_text",
                  elements: [
                    {
                      type: "rich_text_section",
                      elements: [
                        {
                          type: "text",
                          text: existingResponse.blockers
                        }
                      ]
                    }
                  ]
                } : undefined,
                placeholder: {
                  type: "plain_text",
                  text: "Any blockers or help needed?",
                },
              },
              label: {
                type: "plain_text",
                text: "Blockers",
              },
              optional: true,
            },
          ],
        },
      });
    } catch (modalError) {
      console.error("Error opening update modal:", modalError);
      await updateResponse({
        text: `❌ Error opening update form: ${modalError.message}`,
      });
    }

  } catch (error) {
    console.error("Error in standup update:", error);
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function handleStandupUpdateSubmission({ ack, body, view, client }) {
  await ack();

  try {
    const metadata = JSON.parse(view.private_metadata);
    const { teamId, standupDate, isUpdate } = metadata;
    const values = view.state.values;

    const yesterdayTasks =
      extractRichTextValue(values.yesterday_tasks?.yesterday_input) || "";
    const todayTasks =
      extractRichTextValue(values.today_tasks?.today_input) || "";
    const blockers =
      extractRichTextValue(values.blockers?.blockers_input) || "";

    // Check if at least one field is filled
    if (!yesterdayTasks && !todayTasks && !blockers) {
      await client.views.update({
        view_id: body.view.id,
        view: {
          ...view,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "❌ Please fill in at least one field",
              },
            },
            ...view.blocks,
          ],
        },
      });
      return;
    }

    const team = await teamService.getTeamById(teamId);
    const targetDate = dayjs(standupDate, "YYYY-MM-DD");
    
    // Determine if submission is late (only if it's for today or future)
    let isLate = false;
    if ((targetDate.isSame(dayjs().startOf('day')) || targetDate.isAfter(dayjs().startOf('day'))) && team) {
      const [postingHour, postingMinute] = team.postingTime
        .split(":")
        .map(Number);
      const postingTime = dayjs()
        .tz(team.timezone)
        .startOf("day")
        .hour(postingHour)
        .minute(postingMinute);
      const nowInTeamTz = dayjs().tz(team.timezone);
      isLate = nowInTeamTz.isAfter(postingTime);
    }

    // Save or update response
    const responseData = {
      date: targetDate.toDate(),
      yesterdayTasks,
      todayTasks,
      blockers,
    };

    await standupService.saveResponse(
      teamId,
      body.user.id,
      responseData,
      isLate,
      client
    );

    const updateText = isUpdate ? "updated" : "submitted";
    
    // Send confirmation as ephemeral message to the channel
    await client.chat.postEphemeral({
      channel: team.slackChannelId,
      user: body.user.id,
      text: `✅ Standup ${updateText} for ${team?.name || "your team"} (${targetDate.format("MMM DD, YYYY")})!${
        isLate ? " (marked as late)" : ""
      }`,
    });

    // Notify team admins about the submission/update
    await notificationService.notifyAdminsOfStandupSubmission({
      teamId,
      user: body.user,
      team,
      client,
      options: { 
        isUpdate, 
        isLate, 
        date: targetDate.format("MMM DD, YYYY") 
      }
    });

    // If this is an update for today and it's after posting time, post to thread
    if (isUpdate && isLate && targetDate.isSame(dayjs(), 'day') && team) {
      const standupPost = await standupService.getStandupPost(
        teamId,
        targetDate.toDate()
      );

      if (standupPost?.slackMessageTs) {
        const updateResponse = {
          user: {
            name: body.user.name || body.user.id,
            slackUserId: body.user.id,
          },
          yesterdayTasks,
          todayTasks,
          blockers,
        };

        const message = await standupService.formatLateResponseMessage(
          updateResponse
        );

        await client.chat.postMessage({
          channel: standupPost.channelId,
          thread_ts: standupPost.slackMessageTs,
          reply_broadcast: true,
          text: `🔄 *Update* from ${getUserMention(updateResponse.user)}`,
          ...message,
        });
      }
    }
  } catch (error) {
    console.error("Error handling standup update submission:", error);

    await client.chat.postMessage({
      channel: body.user.id,
      text: `❌ Error ${isUpdate ? "updating" : "submitting"} standup: ${error.message}`,
    });
  }
}

module.exports = {
  submitManual,
  openStandupModal,
  handleStandupSubmission,
  updateStandup,
  handleStandupUpdateSubmission,
};
