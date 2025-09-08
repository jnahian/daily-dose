const standupService = require("../services/standupService");
const teamService = require("../services/teamService");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { ackWithProcessing } = require("../utils/commandHelper");

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
        await client.views.open({
          trigger_id: command.trigger_id,
          view: {
            type: "modal",
            callback_id: "standup_modal",
            private_metadata: JSON.stringify({ teamId: team.id }),
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
                  type: "rich_text_input",
                  action_id: "yesterday_input",
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
        console.error("Error opening modal directly:", modalError);

        // Fallback to button approach if modal fails
        await updateResponse({
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
      }
    } else {
      // Show team selection
      const teamList = teams.map((t) => `- ${t.name}`).join("\n");

      await updateResponse({
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

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
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
              type: "rich_text_input",
              action_id: "yesterday_input",
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

    // Extract rich text values and convert to plain text
    const extractRichTextValue = (richTextValue) => {
      if (!richTextValue?.rich_text_value?.elements) return "";

      return richTextValue.rich_text_value.elements
        .map((element) => {
          if (element.type === "rich_text_section") {
            return element.elements
              .map((el) => {
                if (el.type === "text") return el.text;
                if (el.type === "link") return el.url;
                if (el.type === "user") return `<@${el.user_id}>`;
                if (el.type === "channel") return `<#${el.channel_id}>`;
                return "";
              })
              .join("");
          }
          if (element.type === "rich_text_list") {
            return element.elements
              .map((item) => {
                if (item.type === "rich_text_section") {
                  return (
                    "- " +
                    item.elements
                      .map((el) => (el.type === "text" ? el.text : ""))
                      .join("")
                  );
                }
                return "";
              })
              .join("\n");
          }
          return "";
        })
        .join("\n");
    };

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
    const now = dayjs();
    const teams = await teamService.listTeams(body.user.id);
    const team = teams.find((t) => t.id === teamId);

    let isLate = false;
    if (team) {
      const [postingHour, postingMinute] = team.postingTime
        .split(":")
        .map(Number);
      const postingTime = now
        .startOf("day")
        .hour(postingHour)
        .minute(postingMinute);
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
      isLate,
      client
    );

    // Send confirmation DM
    await client.chat.postMessage({
      channel: body.user.id,
      text: `✅ Standup submitted for ${team?.name || "your team"}!${
        isLate ? " (marked as late)" : ""
      }`,
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

module.exports = {
  submitManual,
  openStandupModal,
  handleStandupSubmission,
};
