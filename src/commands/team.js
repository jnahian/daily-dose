const teamService = require("../services/teamService");

async function createTeam({ command, ack, respond }) {
  await ack();

  try {
    // Parse command text: /dd-team-create TeamName 09:30 10:00
    const [name, standupTime, postingTime] = command.text.split(" ");

    if (!name || !standupTime || !postingTime) {
      await respond({
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

    await respond({
      text: `✅ Team "${name}" created successfully!\n• Standup reminder: ${standupTime}\n• Posting time: ${postingTime}`,
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function joinTeam({ command, ack, respond }) {
  await ack();

  try {
    const teamName = command.text.trim();

    if (!teamName) {
      await respond({
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
      await respond({
        text: `❌ Team "${teamName}" not found`,
      });
      return;
    }

    await teamService.joinTeam(command.user_id, team.id);

    await respond({
      text: `✅ You've joined team "${team.name}"!`,
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function leaveTeam({ command, ack, respond }) {
  await ack();

  try {
    const teamName = command.text.trim();

    if (!teamName) {
      await respond({
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
      await respond({
        text: `❌ Team "${teamName}" not found`,
      });
      return;
    }

    await teamService.leaveTeam(command.user_id, team.id);

    await respond({
      text: `✅ You've left team "${team.name}"`,
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function listTeams({ command, ack, respond }) {
  await ack();

  try {
    const teams = await teamService.listTeams(command.user_id);

    if (teams.length === 0) {
      await respond({
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

    await respond({
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
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

module.exports = {
  createTeam,
  joinTeam,
  leaveTeam,
  listTeams,
};
