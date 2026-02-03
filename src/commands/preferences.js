const teamService = require("../services/teamService");
const { ackWithProcessing } = require("../utils/commandHelper");
const { createSectionBlock } = require("../utils/blockHelper");

async function toggleStandupReminder({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Updating standup reminder preferences...",
    command
  );

  try {
    // Parse command text: /dd-standup-reminder [TeamName] mention=on/off notify=on/off
    const args = command.text.trim().split(" ");
    let team, teamName, mentionParam, notifyParam;

    // Parse arguments
    let teamNameIndex = -1;
    let mentionIndex = -1;
    let notifyIndex = -1;

    // Find parameters in arguments
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith("mention=")) {
        mentionIndex = i;
      } else if (args[i].startsWith("notify=")) {
        notifyIndex = i;
      } else if (!args[i].startsWith("mention=") && !args[i].startsWith("notify=") && teamNameIndex === -1) {
        // First non-parameter argument is team name
        teamNameIndex = i;
      }
    }

    // Extract parameters
    if (mentionIndex !== -1) {
      const mentionValue = args[mentionIndex].split("=")[1];
      if (mentionValue !== "on" && mentionValue !== "off") {
        await updateResponse({
          text: "❌ Invalid mention parameter. Use `mention=on` or `mention=off`",
        });
        return;
      }
      mentionParam = mentionValue;
    }

    if (notifyIndex !== -1) {
      const notifyValue = args[notifyIndex].split("=")[1];
      if (notifyValue !== "on" && notifyValue !== "off") {
        await updateResponse({
          text: "❌ Invalid notify parameter. Use `notify=on` or `notify=off`",
        });
        return;
      }
      notifyParam = notifyValue;
    }

    // Validate that at least one of mention or notify is provided
    if (mentionParam === undefined && notifyParam === undefined) {
      await updateResponse({
        text: "❌ You must specify at least one parameter: `mention=on/off` or `notify=on/off`\n\nUsage examples:\n- `/dd-standup-reminder mention=off` - Stop being mentioned in non-responded list\n- `/dd-standup-reminder notify=off` - Stop receiving reminders AND admin submission notifications\n- `/dd-standup-reminder TeamName mention=on notify=off` - Be mentioned but don't receive notifications\n- `/dd-standup-reminder mention=on notify=on` - Enable all notifications",
      });
      return;
    }

    // Determine team
    if (teamNameIndex !== -1) {
      teamName = args[teamNameIndex];
      team = await teamService.findTeamByName(teamName);
      if (!team) {
        await updateResponse({
          text: `❌ Team "${teamName}" not found`,
        });
        return;
      }
    } else {
      // No team name provided, use current channel
      team = await teamService.findTeamByChannel(command.channel_id);
      if (!team) {
        await updateResponse({
          text: "❌ No team found in this channel. Please specify team name or run from team channel.\n\nUsage: `/dd-standup-reminder [TeamName] mention=on/off notify=on/off`",
        });
        return;
      }
      teamName = team.name;
    }

    // Check if user is a member of the team
    const membership = await teamService.getUserTeamMembership(command.user_id, team.id);

    if (!membership) {
      await updateResponse({
        text: `❌ You are not a member of team "${teamName}"`,
      });
      return;
    }

    // Build update object based on provided parameters
    const updates = {};
    const statusMessages = [];

    if (mentionParam !== undefined) {
      updates.hideFromNotResponded = mentionParam === "off";
      const mentionStatus = mentionParam === "on" ? "enabled" : "disabled";
      statusMessages.push(`Mentions in non-responded list: *${mentionStatus}*`);
    }

    if (notifyParam !== undefined) {
      updates.receiveNotifications = notifyParam === "on";
      const notifyStatus = notifyParam === "on" ? "enabled" : "disabled";
      statusMessages.push(`Notifications (reminders + team submissions): *${notifyStatus}*`);
    }

    // Update preferences
    await teamService.updateTeamMemberPreferences(
      command.user_id,
      team.id,
      updates,
      client
    );

    // Get current status after update
    const updatedMembership = await teamService.getUserTeamMembership(command.user_id, team.id);

    const currentMentionStatus = updatedMembership.hideFromNotResponded ? "disabled" : "enabled";
    const currentNotifyStatus = updatedMembership.receiveNotifications ? "enabled" : "disabled";

    await updateResponse({
      blocks: [
        createSectionBlock(
          `*🔔 Standup Preferences Updated for ${teamName}*\n\n` +
          statusMessages.join("\n") +
          `\n\n*Current Settings:*\n` +
          `• Mentions in non-responded list: *${currentMentionStatus}*\n` +
          `• Notifications (reminders + submissions): *${currentNotifyStatus}*\n\n` +
          `*Note:* When notifications are disabled, you won't receive standup reminders or admin notifications about team member submissions. You can still submit standups manually.`
        )
      ],
    });
  } catch (error) {
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

module.exports = {
  toggleStandupReminder,
};