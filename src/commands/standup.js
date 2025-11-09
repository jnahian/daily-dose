const standupService = require("../services/standupService");
const teamService = require("../services/teamService");
const userService = require("../services/userService");
const notificationService = require("../services/notificationService");
const schedulerService = require("../services/schedulerService");
const prisma = require("../config/prisma");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { ackWithProcessing } = require("../utils/commandHelper");
const { getUserMention, getUserLogIdentifier } = require("../utils/userHelper");
const { extractRichTextValue } = require("../utils/messageHelper");
const { canManageTeam, getUserBySlackId } = require("../utils/permissionHelper");
const {
  resolveTeamFromContext,
  parseCommandArguments,
  validateDateFormat,
} = require("../utils/teamHelper");
const {
  createStandupModal,
  createStandupUpdateModal,
  createTeamSelectionBlocks,
  createButton,
  createActionsBlock,
  createSectionBlock,
  createCommandSuccessBlocks,
  createCommandErrorBlocks,
  createPermissionDeniedBlocks,
  createStandupPreviewHeaderBlocks,
  createNoDataBlocks,
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
        text: "❌ You're not a member of any teams. Join a team first with `/dd-team-join [TeamName]`",
      });
      return;
    }

    const teamName = command.text.trim();
    let team;

    if (!teamName) {
      // No team name provided, try to find team in current channel
      team = await teamService.findTeamByChannel(command.channel_id);

      if (!team) {
        // Show team selection if no team found in channel
        await updateResponse({
          blocks: [
            ...createTeamSelectionBlocks(teams, "select_team_standup"),
            createSectionBlock("Usage: `/dd-standup [TeamName]`\n- Run without team name to submit standup for the team in current channel\n- Or specify team name: `/dd-standup Engineering`"),
          ],
        });
        return;
      }
    } else {
      // Find team by name
      team = teams.find(
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
    }

    // Open modal directly using the command's trigger_id
    const today = dayjs().format("MMM DD, YYYY");

    try {
      // Get user's last standup response to prefill today's tasks
      const lastResponse = await standupService.getLastStandupResponse(team.id, command.user_id);

      const modalView = createStandupModal(team.name, team.id, today, null, lastResponse);
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
            createButton(
              "📝 Open Standup Form",
              `open_standup_${team.id}`,
              team.id.toString(),
              "primary"
            ),
          ]),
        ],
      });
    }
  } catch (error) {
    console.error("Error in submitManual:", error);
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

    // Get user's last standup response to prefill today's tasks
    const lastResponse = await standupService.getLastStandupResponse(teamId, body.user.id);

    const modalView = createStandupModal(team.name, teamId, today, null, lastResponse);
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
      options: { isLate },
    });

    // If late, add to existing standup post as thread or create parent if doesn't exist
    if (isLate && team) {
      const standupPost = await standupService.getStandupPost(
        teamId,
        now.toDate()
      );

      if (standupPost?.slackMessageTs) {
        // Parent post exists - add as thread reply
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
      } else {
        // No parent post exists - create the full standup post (first late submission becomes parent)
        console.log(
          `📝 No parent standup post found for ${team.name}. Creating full standup post from late submission...`
        );
        await standupService.postStandupOnDemand(team, now.toDate(), { client });
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
    // Parse command: /dd-standup-update [TeamName] [YYYY-MM-DD]
    const args = command.text.trim().split(" ");

    // Get user's teams
    const teams = await teamService.listTeams(command.user_id);

    if (teams.length === 0) {
      await updateResponse({
        text: "❌ You're not a member of any teams. Join a team first with `/dd-team-join [TeamName]`",
      });
      return;
    }

    let targetTeam = null;
    let targetDate = dayjs().format("YYYY-MM-DD"); // Default to today
    let startIndex = 0;

    // Determine if first arg is team name or date
    if (args.length === 0 || args[0] === "") {
      // No arguments provided, try to find team in current channel
      targetTeam = await teamService.findTeamByChannel(command.channel_id);

      if (!targetTeam) {
        const teamList = teams.map((t) => t.name).join(", ");
        await updateResponse({
          text: `❌ No team found in this channel. Usage: \`/dd-standup-update [TeamName] [YYYY-MM-DD]\`\n- Run without team name to update standup for the team in current channel\n- Or specify team name: \`/dd-standup-update Engineering\`\nAvailable teams: ${teamList}`,
        });
        return;
      }
      startIndex = 0;
    } else {
      // Check if first argument is a date (YYYY-MM-DD format)
      const isDate = /^\d{4}-\d{2}-\d{2}$/.test(args[0]);
      
      if (isDate) {
        // First arg is a date, try to find team in current channel
        targetTeam = await teamService.findTeamByChannel(command.channel_id);
        
        if (!targetTeam) {
          await updateResponse({
            text: "❌ No team found in this channel. Please provide team name: `/dd-standup-update [TeamName] [YYYY-MM-DD]`",
          });
          return;
        }
        
        targetDate = args[0];
        startIndex = 1;
      } else {
        // First arg is team name
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
        startIndex = 1;
      }
    }

    // Parse optional date argument
    if (args.length > startIndex && args[startIndex]) {
      const isDate = /^\d{4}-\d{2}-\d{2}$/.test(args[startIndex]);
      if (isDate) {
        targetDate = args[startIndex];
      } else {
        await updateResponse({
          text: `❌ Invalid date format: ${args[startIndex]}. Use YYYY-MM-DD format.\nUsage: \`/dd-standup-update ${targetTeam.name} [YYYY-MM-DD]\``,
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
    const userData = await userService.fetchSlackUserData(
      command.user_id,
      client
    );
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
      const modalView = createStandupUpdateModal(
        targetTeam.name,
        targetTeam.id,
        today,
        targetDate,
        existingResponse
      );

      await client.views.open({
        trigger_id: command.trigger_id,
        view: modalView,
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

    // If this is for today and it's after posting time, post to thread or create parent if doesn't exist
    if (isLate && targetDate.isSame(dayjs(), 'day') && team) {
      const standupPost = await standupService.getStandupPost(
        teamId,
        targetDate.toDate()
      );

      if (standupPost?.slackMessageTs) {
        // Parent post exists - add as thread reply
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
          reply_broadcast: true,
          text: isUpdate
            ? `🔄 *Update* from ${getUserMention(lateResponse.user)}`
            : `🕐 *Late Submission* from ${getUserMention(lateResponse.user)}`,
          ...message,
        });
      } else {
        // No parent post exists - create the full standup post
        console.log(
          `📝 No parent standup post found for ${team.name}. Creating full standup post from late ${isUpdate ? 'update' : 'submission'}...`
        );
        await standupService.postStandupOnDemand(team, targetDate.toDate(), { client });
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

/**
 * Admin/Owner command: Send standup reminders to team members
 * Usage: /dd-standup-remind [team-name]
 */
async function sendReminders({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Sending standup reminders...",
    command
  );

  try {
    // Get user from database
    const user = await getUserBySlackId(command.user_id);
    if (!user) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "User not found. Please ensure you're registered in the system."
        ),
      });
      return;
    }

    // Parse team name from command text
    const teamName = command.text.trim() || null;

    // Resolve team from context
    const { team, error } = await resolveTeamFromContext(
      command.channel_id,
      teamName,
      user.id
    );

    if (error || !team) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          error || "Team not found",
          [
            "Ensure you're in a team channel or provide a team name",
            "Use `/dd-team-list` to see available teams",
          ]
        ),
      });
      return;
    }

    // Check permissions
    const permission = await canManageTeam(user.id, team.id);
    if (!permission.canManage) {
      await updateResponse({
        blocks: createPermissionDeniedBlocks(),
      });
      return;
    }

    // Initialize scheduler service and send reminders
    await schedulerService.initialize(client);
    await schedulerService.sendStandupReminders(team);

    // Get count of active members for confirmation
    const now = dayjs().tz(team.timezone);
    const members = await standupService.getActiveMembers(team.id, now.toDate());

    await updateResponse({
      blocks: createCommandSuccessBlocks(
        `Standup reminders sent for *${team.name}*`,
        {
          "Team": team.name,
          "Members notified": members.length,
          "Your role": permission.role,
        }
      ),
    });

    console.log(
      `📧 ${getUserLogIdentifier(user)} sent standup reminders for team ${team.name} (${members.length} members)`
    );
  } catch (error) {
    console.error("Error in sendReminders command:", error);
    await updateResponse({
      blocks: createCommandErrorBlocks(
        `Failed to send reminders: ${error.message}`,
        ["Check team configuration", "Verify bot permissions in team channel"]
      ),
    });
  }
}

/**
 * Admin/Owner command: Post standup summary to channel
 * Usage: /dd-standup-post [date] [team-name]
 */
async function postStandup({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Posting standup summary...",
    command
  );

  try {
    // Get user from database
    const user = await getUserBySlackId(command.user_id);
    if (!user) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "User not found. Please ensure you're registered in the system."
        ),
      });
      return;
    }

    // Parse command arguments (date and/or team name)
    const { date: dateStr, teamName } = parseCommandArguments(command.text);

    // Validate date format if provided
    if (dateStr) {
      const validation = validateDateFormat(dateStr);
      if (!validation.isValid) {
        await updateResponse({
          blocks: createCommandErrorBlocks(validation.error, [
            "Use format: YYYY-MM-DD (e.g., 2025-01-15)",
          ]),
        });
        return;
      }
    }

    // Resolve team from context
    const { team, error } = await resolveTeamFromContext(
      command.channel_id,
      teamName,
      user.id
    );

    if (error || !team) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          error || "Team not found",
          [
            "Ensure you're in a team channel or provide a team name",
            "Use `/dd-team-list` to see available teams",
          ]
        ),
      });
      return;
    }

    // Check permissions
    const permission = await canManageTeam(user.id, team.id);
    if (!permission.canManage) {
      await updateResponse({
        blocks: createPermissionDeniedBlocks(),
      });
      return;
    }

    // Determine target date
    const targetDate = dateStr
      ? dayjs(dateStr).tz(team.timezone)
      : dayjs().tz(team.timezone);

    // Check if responses exist
    const responses = await standupService.getTeamResponses(
      team.id,
      targetDate.toDate()
    );
    const lateResponses = await standupService.getLateResponses(
      team.id,
      targetDate.toDate()
    );
    const allMembers = await standupService.getActiveMembers(
      team.id,
      targetDate.toDate()
    );

    if (responses.length === 0 && lateResponses.length === 0) {
      await updateResponse({
        blocks: createNoDataBlocks(
          "standup responses",
          targetDate.format("MMM DD, YYYY")
        ),
      });
      return;
    }

    // Post standup using service
    const result = await standupService.postTeamStandup(
      team,
      targetDate.toDate(),
      client
    );

    await updateResponse({
      blocks: createCommandSuccessBlocks(
        `Standup posted for *${team.name}*`,
        {
          "Date": targetDate.format("MMM DD, YYYY"),
          "Responses": responses.length,
          "Late responses": lateResponses.length,
          "Message timestamp": result.ts,
        }
      ),
    });

    console.log(
      `📊 ${getUserLogIdentifier(user)} posted standup for team ${team.name} (${targetDate.format("YYYY-MM-DD")})`
    );
  } catch (error) {
    console.error("Error in postStandup command:", error);
    await updateResponse({
      blocks: createCommandErrorBlocks(
        `Failed to post standup: ${error.message}`,
        [
          "Check if bot has access to team channel",
          "Verify standup responses exist for the date",
        ]
      ),
    });
  }
}

/**
 * Admin/Owner command: Preview standup summary
 * Usage: /dd-standup-preview [date] [team-name]
 */
async function previewStandup({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Generating standup preview...",
    command
  );

  try {
    // Get user from database
    const user = await getUserBySlackId(command.user_id);
    if (!user) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "User not found. Please ensure you're registered in the system."
        ),
        response_type: "ephemeral",
      });
      return;
    }

    // Parse command arguments
    const { date: dateStr, teamName } = parseCommandArguments(command.text);

    // Validate date format if provided
    if (dateStr) {
      const validation = validateDateFormat(dateStr);
      if (!validation.isValid) {
        await updateResponse({
          blocks: createCommandErrorBlocks(validation.error, [
            "Use format: YYYY-MM-DD (e.g., 2025-01-15)",
          ]),
          response_type: "ephemeral",
        });
        return;
      }
    }

    // Resolve team from context
    const { team, error } = await resolveTeamFromContext(
      command.channel_id,
      teamName,
      user.id
    );

    if (error || !team) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          error || "Team not found",
          [
            "Ensure you're in a team channel or provide a team name",
            "Use `/dd-team-list` to see available teams",
          ]
        ),
        response_type: "ephemeral",
      });
      return;
    }

    // Check permissions
    const permission = await canManageTeam(user.id, team.id);
    if (!permission.canManage) {
      await updateResponse({
        blocks: createPermissionDeniedBlocks(),
        response_type: "ephemeral",
      });
      return;
    }

    // Determine target date
    const targetDate = dateStr
      ? dayjs(dateStr).tz(team.timezone)
      : dayjs().tz(team.timezone);

    // Get standup data
    const responses = await standupService.getTeamResponses(
      team.id,
      targetDate.toDate()
    );
    const lateResponses = await standupService.getLateResponses(
      team.id,
      targetDate.toDate()
    );
    const allMembers = await standupService.getActiveMembers(
      team.id,
      targetDate.toDate()
    );

    // Get members on leave
    const membersOnLeave = await prisma.teamMember.findMany({
      where: {
        teamId: team.id,
        isActive: true,
        user: {
          leaves: {
            some: {
              startDate: { lte: targetDate.toDate() },
              endDate: { gte: targetDate.toDate() },
            },
          },
        },
      },
      include: {
        user: true,
      },
    });

    // Calculate not submitted
    const respondedUserIds = new Set(responses.map((r) => r.userId));
    const leaveUserIds = new Set(membersOnLeave.map((m) => m.userId));

    const notSubmitted = allMembers
      .filter(
        (m) => !respondedUserIds.has(m.userId) && !leaveUserIds.has(m.userId)
      )
      .map((m) => ({
        slackUserId: m.user.slackUserId,
        user: m.user,
        onLeave: false,
      }));

    const onLeave = membersOnLeave.map((m) => ({
      slackUserId: m.user.slackUserId,
      user: m.user,
      onLeave: true,
    }));

    if (responses.length === 0 && lateResponses.length === 0) {
      await updateResponse({
        blocks: createNoDataBlocks(
          "standup responses",
          targetDate.format("MMM DD, YYYY")
        ),
        response_type: "ephemeral",
      });
      return;
    }

    // Format message
    const message = await standupService.formatStandupMessage(
      responses,
      notSubmitted,
      onLeave,
      targetDate
    );

    // Add preview header
    const isToday = targetDate.isSame(dayjs(), "day");
    const previewBlocks = [
      ...createStandupPreviewHeaderBlocks(
        team.name,
        targetDate.format("MMM DD, YYYY"),
        isToday
      ),
      ...message.blocks,
    ];

    await updateResponse({
      blocks: previewBlocks,
      response_type: "ephemeral",
    });

    console.log(
      `🔍 ${getUserLogIdentifier(user)} previewed standup for team ${team.name} (${targetDate.format("YYYY-MM-DD")})`
    );
  } catch (error) {
    console.error("Error in previewStandup command:", error);
    await updateResponse({
      blocks: createCommandErrorBlocks(
        `Failed to generate preview: ${error.message}`
      ),
      response_type: "ephemeral",
    });
  }
}

/**
 * Admin/Owner command: Send followup reminders to non-responders
 * Usage: /dd-standup-followup [team-name]
 */
async function sendFollowupReminders({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Sending followup reminders...",
    command
  );

  try {
    // Get user from database
    const user = await getUserBySlackId(command.user_id);
    if (!user) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "User not found. Please ensure you're registered in the system."
        ),
      });
      return;
    }

    // Parse team name from command text
    const teamName = command.text.trim() || null;

    // Resolve team from context
    const { team, error } = await resolveTeamFromContext(
      command.channel_id,
      teamName,
      user.id
    );

    if (error || !team) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          error || "Team not found",
          [
            "Ensure you're in a team channel or provide a team name",
            "Use `/dd-team-list` to see available teams",
          ]
        ),
      });
      return;
    }

    // Check permissions
    const permission = await canManageTeam(user.id, team.id);
    if (!permission.canManage) {
      await updateResponse({
        blocks: createPermissionDeniedBlocks(),
      });
      return;
    }

    // Initialize scheduler service and send followup reminders
    await schedulerService.initialize(client);
    await schedulerService.sendFollowupReminders(team);

    // Get count of pending members for confirmation
    const now = dayjs().tz(team.timezone);
    const allMembers = await standupService.getActiveMembers(team.id, now.toDate());
    const responses = await standupService.getTeamResponses(team.id, now.toDate());
    const respondedUserIds = new Set(responses.map((r) => r.userId));
    const pendingCount = allMembers.filter((m) => !respondedUserIds.has(m.userId)).length;

    await updateResponse({
      blocks: createCommandSuccessBlocks(
        `Followup reminders sent for *${team.name}*`,
        {
          "Team": team.name,
          "Pending members": pendingCount,
          "Your role": permission.role,
        }
      ),
    });

    console.log(
      `🔔 ${getUserLogIdentifier(user)} sent followup reminders for team ${team.name} (${pendingCount} pending)`
    );
  } catch (error) {
    console.error("Error in sendFollowupReminders command:", error);
    await updateResponse({
      blocks: createCommandErrorBlocks(
        `Failed to send followup reminders: ${error.message}`,
        ["Check team configuration", "Verify bot permissions"]
      ),
    });
  }
}

module.exports = {
  submitManual,
  openStandupModal,
  handleStandupSubmission,
  updateStandup,
  handleStandupUpdateSubmission,
  sendReminders,
  postStandup,
  previewStandup,
  sendFollowupReminders,
};
