const teamService = require("../services/teamService");
const schedulerService = require("../services/schedulerService");
const { ackWithProcessing, getChannelName } = require("../utils/commandHelper");
const { getDisplayName } = require("../utils/userHelper");
const { formatTime12Hour } = require("../utils/dateHelper");
const { createSectionBlock } = require("../utils/blockHelper");

async function createTeam({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
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
        text: "❌ Usage: `/dd-team-create [TeamName] HH:MM HH:MM`\nExamples:\n- `/dd-team-create 09:30 10:00` (uses channel name)\n- `/dd-team-create Engineering 09:30 10:00`",
      });
      return;
    }

    if (!standupTime || !postingTime) {
      await updateResponse({
        text: "❌ Usage: `/dd-team-create [TeamName] HH:MM HH:MM`\nExamples:\n- `/dd-team-create 09:30 10:00` (uses channel name)\n- `/dd-team-create Engineering 09:30 10:00`",
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
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function joinTeam({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
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
          text: "❌ No team found in this channel. Usage: `/dd-team-join [TeamName]`\n- Run without team name to join the team in current channel\n- Or specify team name: `/dd-team-join Engineering`",
        });
        return;
      }
    } else {
      // Find team by name across all organizations
      team = await teamService.findTeamByName(teamName);

      if (!team) {
        await updateResponse({
          text: `❌ Team "${teamName}" not found`,
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
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function leaveTeam({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
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
          text: "❌ No team found in this channel. Usage: `/dd-team-leave [TeamName]`\n- Run without team name to leave the team in current channel\n- Or specify team name: `/dd-team-leave Engineering`",
        });
        return;
      }
    } else {
      // Find team by name across all organizations
      team = await teamService.findTeamByName(teamName);

      if (!team) {
        await updateResponse({
          text: `❌ Team "${teamName}" not found`,
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
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function listTeams({ command, ack, respond }) {
  const updateResponse = ackWithProcessing(
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
          } members) - Standup: ${formatTime12Hour(t.standupTime)}`
      )
      .join("\n");

    await updateResponse({
      blocks: [
        createSectionBlock(`*📋 Teams in your organization:*\n${teamList}`),
      ],
    });
  } catch (error) {
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function listMembers({ command, ack, respond }) {
  const updateResponse = ackWithProcessing(
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
          text: "❌ No team found in this channel. Usage: `/dd-team-members [TeamName]`\n- Run without team name to show members of the team in current channel\n- Or specify team name: `/dd-team-members Engineering`",
        });
        return;
      }
    } else {
      // Find team by name across all organizations
      team = await teamService.findTeamByName(teamName);

      if (!team) {
        await updateResponse({
          text: `❌ Team "${teamName}" not found`,
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
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function updateTeam({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
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
          text: "❌ No team found in this channel. Usage: `/dd-team-update [TeamName] [parameters]`\n- Run without team name to update the team in current channel\n- Or specify team name: `/dd-team-update Engineering standup=09:00`\n\nParameters: `name=NewName`, `standup=HH:MM`, `posting=HH:MM`, `notifications=true/false`",
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
            text: "❌ No team found in this channel. Please provide team name: `/dd-team-update [TeamName] [parameters]`",
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
            text: `❌ Team "${teamName}" not found`,
          });
          return;
        }

        if (args.length < 2) {
          await updateResponse({
            text: "❌ Usage: `/dd-team-update [TeamName] [parameters]`\nParameters: `name=NewName`, `standup=HH:MM`, `posting=HH:MM`, `notifications=true/false`\nExample: `/dd-team-update Engineering standup=09:00 posting=10:30 notifications=false`",
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
          text: `❌ Invalid parameter format: ${args[i]}. Use key=value format.`,
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
              text: `❌ Invalid value for notifications: ${value}. Use true or false`,
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
            text: `❌ Unknown parameter: ${key}. Valid parameters: name, standup, posting, notifications`,
          });
          return;
      }
    }

    if (Object.keys(updateData).length === 0) {
      await updateResponse({
        text: "❌ No valid updates provided",
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
      text: `❌ Error: ${error.message}`,
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
