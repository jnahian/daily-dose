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
    // Parse command text: /dd-standup-reminder TeamName [on|off]
    const args = command.text.trim().split(" ");
    const teamName = args[0];
    const action = args[1];

    if (!teamName) {
      await updateResponse({
        text: "❌ Usage: `/dd-standup-reminder TeamName [on|off]`\nExample: `/dd-standup-reminder Engineering off` - Opt out of non-responded list\nExample: `/dd-standup-reminder Engineering on` - Opt back into non-responded list\nWithout action, shows current status.",
      });
      return;
    }

    // Find team by name
    const team = await teamService.findTeamByName(teamName);

    if (!team) {
      await updateResponse({
        text: `❌ Team "${teamName}" not found`,
      });
      return;
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
          createSectionBlock(`*🔔 Standup Reminder Status for ${teamName}*\n\n**Status:** ${status}\n**Description:** ${description}\n\nUse \`/dd-standup-reminder ${teamName} on\` to opt in\nUse \`/dd-standup-reminder ${teamName} off\` to opt out`)
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