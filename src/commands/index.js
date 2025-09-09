const teamCommands = require("./team");
const leaveCommands = require("./leave");
const standupCommands = require("./standup");
const { stripFormatting } = require("../middleware/command");

function setupCommands(app) {
  // Standup commands (primary functionality) - wrapped with formatting removal middleware
  app.command("/dd-standup", stripFormatting(), standupCommands.submitManual);

  // Team management commands - wrapped with formatting removal middleware
  app.command("/dd-team-list", stripFormatting(), teamCommands.listTeams);
  app.command("/dd-team-join", stripFormatting(), teamCommands.joinTeam);
  app.command("/dd-team-leave", stripFormatting(), teamCommands.leaveTeam);
  app.command("/dd-team-members", stripFormatting(), teamCommands.listMembers);
  app.command("/dd-team-create", stripFormatting(), teamCommands.createTeam);
  app.command("/dd-team-update", stripFormatting(), teamCommands.updateTeam);

  // Leave management commands - wrapped with formatting removal middleware
  app.command("/dd-leave-list", stripFormatting(), leaveCommands.listLeaves);
  app.command("/dd-leave-set", stripFormatting(), leaveCommands.setLeave);
  app.command("/dd-leave-cancel", stripFormatting(), leaveCommands.cancelLeave);

  // Work days configuration commands - wrapped with formatting removal middleware
  app.command(
    "/dd-workdays-show",
    stripFormatting(),
    leaveCommands.showWorkDays
  );
  app.command("/dd-workdays-set", stripFormatting(), leaveCommands.setWorkDays);

  // Interactive components (no formatting removal needed for these)
  app.action(/open_standup_.*/, standupCommands.openStandupModal);
  app.view("standup_modal", standupCommands.handleStandupSubmission);

  console.log("✅ Commands registered with formatting removal middleware");
}

module.exports = { setupCommands };
