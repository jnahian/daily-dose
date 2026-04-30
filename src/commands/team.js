const teamService = require("../services/teamService");
const schedulerService = require("../services/schedulerService");
const { ackWithProcessing, getChannelName } = require("../utils/commandHelper");
const { getDisplayName } = require("../utils/userHelper");
const { formatTime12Hour } = require("../utils/dateHelper");
const {
  createSectionBlock,
  createCommandErrorBlocks,
} = require("../utils/blockHelper");

async function createTeam({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Creating team...",
    command
  );

  try {
    // Parse command text: /dd-team-create [TeamName] HH:MM HH:MM
    const args = command.text.split(" ");
    let name, standupTime, postingTime;

    // Check if we have 2 or 3 arguments to determine if team name was provided
    if (args.length === 2) {
      // No team name provided, use channel name as default
      [standupTime, postingTime] = args;

      // Get channel name as team name
      try {
        name = await getChannelName(client, command.channel_id);
      } catch (error) {
        await updateResponse({
          text: error.message,
        });
        return;
      }
    } else if (args.length === 3) {
      // Team name provided
      [name, standupTime, postingTime] = args;
    } else {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "Usage: `/dd-team-create [TeamName] HH:MM HH:MM`",
          [
            "`/dd-team-create 09:30 10:00` (uses channel name)",
            "`/dd-team-create Engineering 09:30 10:00`",
          ]
        ),
      });
      return;
    }

    if (!standupTime || !postingTime) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "Usage: `/dd-team-create [TeamName] HH:MM HH:MM`",
          [
            "`/dd-team-create 09:30 10:00` (uses channel name)",
            "`/dd-team-create Engineering 09:30 10:00`",
          ]
        ),
      });
      return;
    }

    const team = await teamService.createTeam(
      command.user_id,
      command.channel_id,
      {
        name,
        standupTime,
        postingTime,
      },
      client
    );

    // Refresh the scheduler to include the new team
    await schedulerService.refreshTeamSchedule(team.id);

    await updateResponse({
      text: `✅ Team "${name}" created successfully!\n- Standup reminder: ${formatTime12Hour(
        standupTime
      )}\n- Posting time: ${formatTime12Hour(postingTime)}\n- Timezone: ${
        team.timezone
      }\n- Cron jobs scheduled ✓`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(`Error: ${error.message}`),
    });
  }
}

async function joinTeam({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Joining team...",
    command
  );

  try {
    const teamName = command.text.trim();
    let team;

    if (!teamName) {
      // No team name provided, try to find team in current channel
      team = await teamService.findTeamByChannel(command.channel_id);

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks(
            "No team found in this channel.",
            [
              "Run `/dd-team-join [TeamName]` to join a specific team",
              "Or run `/dd-team-join` inside a team channel",
            ]
          ),
        });
        return;
      }
    } else {
      // Find team by name across all organizations
      team = await teamService.findTeamByName(teamName);

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks(`Team "${teamName}" not found`),
        });
        return;
      }
    }

    await teamService.joinTeam(command.user_id, team.id, client);

    await updateResponse({
      text: `✅ You've joined team "${
        team.name
      }"!\n- Standup reminder: ${formatTime12Hour(
        team.standupTime
      )}\n- Posting time: ${formatTime12Hour(team.postingTime)}\n-Timezone: ${
        team.timezone
      }`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(`Error: ${error.message}`),
    });
  }
}

async function leaveTeam({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Leaving team...",
    command
  );

  try {
    const teamName = command.text.trim();
    let team;

    if (!teamName) {
      // No team name provided, try to find team in current channel
      team = await teamService.findTeamByChannel(command.channel_id);

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks(
            "No team found in this channel.",
            [
              "Run `/dd-team-leave [TeamName]` to leave a specific team",
              "Or run `/dd-team-leave` inside a team channel",
            ]
          ),
        });
        return;
      }
    } else {
      // Find team by name across all organizations
      team = await teamService.findTeamByName(teamName);

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks(`Team "${teamName}" not found`),
        });
        return;
      }
    }

    await teamService.leaveTeam(command.user_id, team.id, client);

    await updateResponse({
      text: `✅ You've left team "${team.name}"`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(`Error: ${error.message}`),
    });
  }
}

async function listTeams({ command, ack, respond }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Loading teams...",
    command
  );

  try {
    const teams = await teamService.listTeams(command.user_id);

    if (teams.length === 0) {
      await updateResponse({
        text: "📋 No teams found in your organization",
      });
      return;
    }

    const teamList = teams
      .map(
        (t) =>
          `• *${t.name}* (${
            t._count.members
          } members)\n  🔔 Reminder: ${formatTime12Hour(
            t.standupTime
          )} | 📊 Posting: ${formatTime12Hour(t.postingTime)} | 🌍 ${
            t.timezone
          }`
      )
      .join("\n\n");

    await updateResponse({
      blocks: [
        createSectionBlock(`*📋 Teams in your organization:*\n\n${teamList}`),
      ],
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(`Error: ${error.message}`),
    });
  }
}

async function listMembers({ command, ack, respond }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Loading team members...",
    command
  );

  try {
    const teamName = command.text.trim();
    let team;

    if (!teamName) {
      // No team name provided, try to find team in current channel
      team = await teamService.findTeamByChannel(command.channel_id);

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks(
            "No team found in this channel.",
            [
              "Run `/dd-team-members [TeamName]` to view a specific team",
              "Or run `/dd-team-members` inside a team channel",
            ]
          ),
        });
        return;
      }
    } else {
      // Find team by name across all organizations
      team = await teamService.findTeamByName(teamName);

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks(`Team "${teamName}" not found`),
        });
        return;
      }
    }

    // Get team members
    const members = await teamService.getTeamMembers(team.id);

    if (members.length === 0) {
      await updateResponse({
        text: `📋 No members found in team "${team.name}"`,
      });
      return;
    }

    const memberList = members
      .map((member) => {
        const roleIcon = member.role === "ADMIN" ? "👑" : "👤";
        const displayName = getDisplayName(member.user);
        return `${roleIcon} <@${
          member.user.slackUserId
        }> (${displayName}) - ${member.role.toLowerCase()}`;
      })
      .join("\n");

    await updateResponse({
      blocks: [
        createSectionBlock(
          `*👥 Members of team "${team.name}":*\n${memberList}`
        ),
      ],
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(`Error: ${error.message}`),
    });
  }
}

async function updateTeam({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Updating team...",
    command
  );

  try {
    // Parse command text: /dd-team-update [TeamName] [name=NewName] [standup=09:30] [posting=10:00]
    const args = command.text.split(" ");
    let team, startIndex;

    if (args.length === 0 || args[0] === "") {
      // No arguments provided, try to find team in current channel
      team = await teamService.findTeamByChannel(command.channel_id);
      startIndex = 0;

      if (!team) {
        await updateResponse({
          blocks: createCommandErrorBlocks(
            "No team found in this channel.",
            [
              "Usage: `/dd-team-update [TeamName] [parameters]`",
              "Parameters: `name=NewName`, `standup=HH:MM`, `posting=HH:MM`, `notifications=true/false`",
              "Example: `/dd-team-update Engineering standup=09:00`",
            ]
          ),
        });
        return;
      }
    } else {
      // Check if first argument contains = (it's a parameter, not team name)
      if (args[0].includes("=")) {
        // First argument is a parameter, try to find team in current channel
        team = await teamService.findTeamByChannel(command.channel_id);
        startIndex = 0;

        if (!team) {
          await updateResponse({
            blocks: createCommandErrorBlocks(
              "No team found in this channel.",
              ["Provide team name: `/dd-team-update [TeamName] [parameters]`"]
            ),
          });
          return;
        }
      } else {
        // First argument is team name
        const teamName = args[0];
        team = await teamService.findTeamByName(teamName);
        startIndex = 1;

        if (!team) {
          await updateResponse({
            blocks: createCommandErrorBlocks(`Team "${teamName}" not found`),
          });
          return;
        }

        if (args.length < 2) {
          await updateResponse({
            blocks: createCommandErrorBlocks(
              "Usage: `/dd-team-update [TeamName] [parameters]`",
              [
                "Parameters: `name=NewName`, `standup=HH:MM`, `posting=HH:MM`, `notifications=true/false`",
                "Example: `/dd-team-update Engineering standup=09:00 posting=10:30 notifications=false`",
              ]
            ),
          });
          return;
        }
      }
    }

    // Parse update parameters
    const updateData = {};
    const updates = [];

    for (let i = startIndex; i < args.length; i++) {
      const [key, value] = args[i].split("=");
      if (!key || !value) {
        await updateResponse({
          blocks: createCommandErrorBlocks(
            `Invalid parameter format: ${args[i]}. Use key=value format.`
          ),
        });
        return;
      }

      switch (key.toLowerCase()) {
        case "name":
          updateData.name = value;
          updates.push(`Name: ${value}`);
          break;
        case "standup":
          updateData.standupTime = value;
          updates.push(`Standup time: ${formatTime12Hour(value)}`);
          break;
        case "posting":
          updateData.postingTime = value;
          updates.push(`Posting time: ${formatTime12Hour(value)}`);
          break;
        case "notifications":
          if (value !== "true" && value !== "false") {
            await updateResponse({
              blocks: createCommandErrorBlocks(
                `Invalid value for notifications: ${value}. Use true or false`
              ),
            });
            return;
          }
          updateData.receiveNotifications = value === "true";
          updates.push(
            `Admin notifications: ${value === "true" ? "enabled" : "disabled"}`
          );
          break;
        default:
          await updateResponse({
            blocks: createCommandErrorBlocks(
              `Unknown parameter: ${key}. Valid parameters: name, standup, posting, notifications`
            ),
          });
          return;
      }
    }

    if (Object.keys(updateData).length === 0) {
      await updateResponse({
        blocks: createCommandErrorBlocks("No valid updates provided"),
      });
      return;
    }

    await teamService.updateTeam(command.user_id, team.id, updateData, client);

    // If schedule-related updates were made, refresh the scheduler
    if (updateData.standupTime || updateData.postingTime) {
      await schedulerService.refreshTeamSchedule(team.id);
      updates.push("Cron jobs updated ✓");
    }

    await updateResponse({
      text: `✅ Team "${team.name}" updated successfully!\n- ${updates.join(
        "\n- "
      )}`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(`Error: ${error.message}`),
    });
  }
}

module.exports = {
  createTeam,
  joinTeam,
  leaveTeam,
  listTeams,
  listMembers,
  updateTeam,
};
