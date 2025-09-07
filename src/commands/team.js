const teamService = require("../services/teamService");
const { ackWithProcessing } = require("../utils/commandHelper");

async function createTeam({ command, ack, respond }) {
  const updateResponse = ackWithProcessing(ack, respond, "⏳ Creating team...");

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
      }
    );

    await updateResponse({
      text: `✅ Team "${name}" created successfully!\n• Standup reminder: ${standupTime}\n• Posting time: ${postingTime}`,
    });
  } catch (error) {
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function joinTeam({ command, ack, respond }) {
  const updateResponse = ackWithProcessing(ack, respond, "⏳ Joining team...");

  try {
    const teamName = command.text.trim();

    if (!teamName) {
      await updateResponse({
        text: "❌ Usage: `/dd-team-join TeamName`",
      });
      return;
    }

    // Find team by name
    const teams = await teamService.listTeams(command.user_id);
    const team = teams.find(
      (t) => t.name.toLowerCase() === teamName.toLowerCase()
    );

    if (!team) {
      await updateResponse({
        text: `❌ Team "${teamName}" not found`,
      });
      return;
    }

    await teamService.joinTeam(command.user_id, team.id);

    await updateResponse({
      text: `✅ You've joined team "${team.name}"!`,
    });
  } catch (error) {
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function leaveTeam({ command, ack, respond }) {
  const updateResponse = ackWithProcessing(ack, respond, "⏳ Leaving team...");

  try {
    const teamName = command.text.trim();

    if (!teamName) {
      await updateResponse({
        text: "❌ Usage: `/dd-team-leave TeamName`",
      });
      return;
    }

    // Find team by name
    const teams = await teamService.listTeams(command.user_id);
    const team = teams.find(
      (t) => t.name.toLowerCase() === teamName.toLowerCase()
    );

    if (!team) {
      await updateResponse({
        text: `❌ Team "${teamName}" not found`,
      });
      return;
    }

    await teamService.leaveTeam(command.user_id, team.id);

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
  const updateResponse = ackWithProcessing(ack, respond, "⏳ Loading teams...");

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
          `• *${t.name}* (${t._count.members} members) - Standup: ${t.standupTime}`
      )
      .join("\n");

    await updateResponse({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📋 Teams in your organization:*\n${teamList}`,
          },
        },
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
    "⏳ Loading team members..."
  );

  try {
    const teamName = command.text.trim();

    if (!teamName) {
      await updateResponse({
        text: "❌ Usage: `/dd-team-members TeamName`",
      });
      return;
    }

    // Find team by name
    const teams = await teamService.listTeams(command.user_id);
    const team = teams.find(
      (t) => t.name.toLowerCase() === teamName.toLowerCase()
    );

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
        return `${roleIcon} <@${
          member.user.slackUserId
        }> (${member.role.toLowerCase()})`;
      })
      .join("\n");

    await updateResponse({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*👥 Members of team "${team.name}":*\n${memberList}`,
          },
        },
      ],
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
};
