const standupService = require("../services/standupService");
const teamService = require("../services/teamService");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

async function submitManual({ command, ack, respond }) {
  await ack();

  try {
    // Get user's teams
    const teams = await teamService.listTeams(command.user_id);
    
    if (teams.length === 0) {
      await respond({
        text: "❌ You're not a member of any teams. Join a team first with `/dd-team-join TeamName`",
      });
      return;
    }

    // If user specified team name, use that; otherwise show team selection
    const teamName = command.text.trim();
    
    if (teamName) {
      const team = teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());
      
      if (!team) {
        await respond({
          text: `❌ Team "${teamName}" not found. Available teams: ${teams.map(t => t.name).join(", ")}`,
        });
        return;
      }

      // For manual standup submission, we need to create a mock body structure
      // This is a workaround since we don't have access to the full Slack client context
      await respond({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*📝 Submit standup for ${team.name}*`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "📝 Open Standup Form",
                },
                action_id: `open_standup_${team.id}`,
                style: "primary",
              },
            ],
          },
        ],
      });
    } else {
      // Show team selection
      const teamList = teams.map(t => `• ${t.name}`).join("\n");
      
      await respond({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*📝 Select a team for standup:*\n${teamList}`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Usage: `/dd-standup TeamName`",
            },
          },
        ],
      });
    }
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function openStandupModal({ body, client }, teamId = null) {
  try {
    // Extract team ID from action_id if not provided
    if (!teamId && body.actions?.[0]?.action_id) {
      teamId = body.actions[0].action_id.replace("open_standup_", "");
    }

    if (!teamId) {
      console.error("No team ID provided for standup modal");
      return;
    }

    // Get team info
    const teams = await teamService.listTeams(body.user.id);
    const team = teams.find(t => t.id === teamId);

    if (!team) {
      console.error(`Team ${teamId} not found for user ${body.user.id}`);
      return;
    }

    const today = dayjs().format("MMM dd, yyyy");

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "standup_modal",
        private_metadata: JSON.stringify({ teamId }),
        title: {
          type: "plain_text",
          text: "Daily Standup",
        },
        submit: {
          type: "plain_text",
          text: "Submit",
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
              text: `*📊 ${team.name} - ${today}*`,
            },
          },
          {
            type: "divider",
          },
          {
            type: "input",
            block_id: "yesterday_tasks",
            element: {
              type: "plain_text_input",
              action_id: "yesterday_input",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "What did you work on yesterday?",
              },
            },
            label: {
              type: "plain_text",
              text: "Yesterday's Tasks",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "today_tasks",
            element: {
              type: "plain_text_input",
              action_id: "today_input",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "What will you work on today?",
              },
            },
            label: {
              type: "plain_text",
              text: "Today's Tasks",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "blockers",
            element: {
              type: "plain_text_input",
              action_id: "blockers_input",
              multiline: true,
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
  } catch (error) {
    console.error("Error opening standup modal:", error);
  }
}

async function handleStandupSubmission({ ack, body, view, client }) {
  await ack();

  try {
    const { teamId } = JSON.parse(view.private_metadata);
    const values = view.state.values;

    const yesterdayTasks = values.yesterday_tasks?.yesterday_input?.value || "";
    const todayTasks = values.today_tasks?.today_input?.value || "";
    const blockers = values.blockers?.blockers_input?.value || "";

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
    const now = dayjs();
    const teams = await teamService.listTeams(body.user.id);
    const team = teams.find(t => t.id === teamId);
    
    let isLate = false;
    if (team) {
      const [postingHour, postingMinute] = team.postingTime.split(":").map(Number);
      const postingTime = now.startOf("day").hour(postingHour).minute(postingMinute);
      isLate = now.isAfter(postingTime);
    }

    // Save response
    await standupService.saveResponse(
      teamId,
      body.user.id,
      {
        date: now.toDate(),
        yesterdayTasks,
        todayTasks,
        blockers,
      },
      isLate
    );

    // Send confirmation DM
    await client.chat.postMessage({
      channel: body.user.id,
      text: `✅ Standup submitted for ${team?.name || "your team"}!${isLate ? " (marked as late)" : ""}`,
    });

    // If late, add to existing standup post as thread
    if (isLate && team) {
      const standupPost = await standupService.getStandupPost(teamId, now.toDate());
      
      if (standupPost?.slackMessageTs) {
        let responseText = `*👤 ${body.user.name || body.user.id}* (late submission):\n`;
        
        if (yesterdayTasks) {
          responseText += `*Yesterday:* ${yesterdayTasks}\n`;
        }
        if (todayTasks) {
          responseText += `*Today:* ${todayTasks}\n`;
        }
        if (blockers) {
          responseText += `*Blockers:* ${blockers}`;
        } else {
          responseText += `*Blockers:* None`;
        }

        await client.chat.postMessage({
          channel: standupPost.channelId,
          thread_ts: standupPost.slackMessageTs,
          text: responseText,
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

module.exports = {
  submitManual,
  openStandupModal,
  handleStandupSubmission,
};