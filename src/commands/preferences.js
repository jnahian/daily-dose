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
    // Parse command text: /dd-standup-reminder [TeamName] [on|off]
    const args = command.text.trim().split(" ");
    let team, teamName, action;

    // Determine if first argument is team name or action
    if (args.length === 0 || args[0] === "") {
      // No arguments, try to find team in current channel
      team = await teamService.findTeamByChannel(command.channel_id);
      action = undefined;
      
      if (!team) {
        await updateResponse({
          text: "❌ No team found in this channel. Usage: `/dd-standup-reminder [TeamName] [on|off]`\n- Run without team name to manage preferences for team in current channel\n- Or specify team name: `/dd-standup-reminder Engineering off`\n\nExamples:\n- `/dd-standup-reminder` - Show status for team in current channel\n- `/dd-standup-reminder off` - Opt out of non-responded list for current channel team\n- `/dd-standup-reminder Engineering on` - Opt back into non-responded list for Engineering team",
        });
        return;
      }
      teamName = team.name;
    } else if (args[0] === "on" || args[0] === "off") {
      // First argument is action, find team in current channel
      team = await teamService.findTeamByChannel(command.channel_id);
      action = args[0];
      
      if (!team) {
        await updateResponse({
          text: "❌ No team found in this channel. Please provide team name: `/dd-standup-reminder TeamName [on|off]`",
        });
        return;
      }
      teamName = team.name;
    } else {
      // First argument is team name
      teamName = args[0];
      action = args[1];
      
      // Find team by name
      team = await teamService.findTeamByName(teamName);

      if (!team) {
        await updateResponse({
          text: `❌ Team "${teamName}" not found`,
        });
        return;
      }
    }

    // Check if user is a member of the team
    const membership = await teamService.getUserTeamMembership(command.user_id, team.id);

    if (!membership) {
      await updateResponse({
        text: `❌ You are not a member of team "${teamName}"`,
      });
      return;
    }

    if (!action) {
      // Show current status
      const status = membership.hideFromNotResponded ? "OFF" : "ON";
      const description = membership.hideFromNotResponded 
        ? "You are opted out of the non-responded list (you can still submit standups)" 
        : "You will appear in the non-responded list if you don't submit standups";

      await updateResponse({
        blocks: [
          createSectionBlock(`*🔔 Standup Reminder Status for ${teamName}*\n\n*Status:* ${status}\n*Description:* ${description}\n\nUse \`/dd-standup-reminder ${teamName} on\` to opt in\nUse \`/dd-standup-reminder ${teamName} off\` to opt out`)
        ],
      });
      return;
    }

    if (action !== "on" && action !== "off") {
      await updateResponse({
        text: `❌ Invalid action "${action}". Use "on" to opt in or "off" to opt out.`,
      });
      return;
    }

    const hideFromNotResponded = action === "off";
    
    await teamService.updateTeamMemberPreferences(
      command.user_id, 
      team.id, 
      { hideFromNotResponded },
      client
    );

    const statusText = hideFromNotResponded ? "opted out of" : "opted into";
    const description = hideFromNotResponded 
      ? "You won't appear in the non-responded list, but can still submit standups" 
      : "You will appear in the non-responded list if you don't submit standups";

    await updateResponse({
      text: `✅ You have ${statusText} standup reminder notifications for team "${teamName}"\n\n${description}`,
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