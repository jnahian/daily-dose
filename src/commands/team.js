const teamService = require("../services/teamService");
const schedulerService = require("../services/schedulerService");
const { ackWithProcessing } = require("../utils/commandHelper");
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
    // Parse command text: /dd-team-create TeamName 09:30 10:00
    const [name, standupTime, postingTime] = command.text.split(" ");

    if (!name || !standupTime || !postingTime) {
      await updateResponse({
        text: "❌ Usage: `/dd-team-create TeamName HH:MM HH:MM`\nExample: `/dd-team-create Engineering 09:30 10:00`",
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

    if (!teamName) {
      await updateResponse({
        text: "❌ Usage: `/dd-team-join TeamName`",
      });
      return;
    }

    // Find team by name across all organizations
    const team = await teamService.findTeamByName(teamName);

    if (!team) {
      await updateResponse({
        text: `❌ Team "${teamName}" not found`,
      });
      return;
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

    if (!teamName) {
      await updateResponse({
        text: "❌ Usage: `/dd-team-leave TeamName`",
      });
      return;
    }

    // Find team by name across all organizations
    const team = await teamService.findTeamByName(teamName);

    if (!team) {
      await updateResponse({
        text: `❌ Team "${teamName}" not found`,
      });
      return;
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
          `- *${t.name}* (${
            t._count.members
          } members) - Standup: ${formatTime12Hour(t.standupTime)}`
      )
      .join("\n");

    await updateResponse({
      blocks: [
        createSectionBlock(`*📋 Teams in your organization:*\n${teamList}`)
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

    if (!teamName) {
      await updateResponse({
        text: "❌ Usage: `/dd-team-members TeamName`",
      });
      return;
    }

    // Find team by name across all organizations
    const team = await teamService.findTeamByName(teamName);

    if (!team) {
      await updateResponse({
        text: `❌ Team "${teamName}" not found`,
      });
      return;
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
        createSectionBlock(`*👥 Members of team "${team.name}":*\n${memberList}`)
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
    // Parse command text: /dd-team-update TeamName [name=NewName] [standup=09:30] [posting=10:00]
    const args = command.text.split(" ");
    const teamName = args[0];

    if (!teamName || args.length < 2) {
      await updateResponse({
        text: "❌ Usage: `/dd-team-update TeamName [name=NewName] [standup=HH:MM] [posting=HH:MM] [notifications=true/false]`\nExample: `/dd-team-update Engineering standup=09:00 posting=10:30 notifications=false`",
      });
      return;
    }

    // Find team by name across all organizations
    const team = await teamService.findTeamByName(teamName);

    if (!team) {
      await updateResponse({
        text: `❌ Team "${teamName}" not found`,
      });
      return;
    }

    // Parse update parameters
    const updateData = {};
    const updates = [];

    for (let i = 1; i < args.length; i++) {
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
          updates.push(`Admin notifications: ${value === "true" ? "enabled" : "disabled"}`);
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
      text: `✅ Team "${teamName}" updated successfully!\n- ${updates.join(
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
