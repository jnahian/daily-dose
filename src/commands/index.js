const teamCommands = require("./team");
const leaveCommands = require("./leave");
const standupCommands = require("./standup");

function setupCommands(app) {
  // Team commands
  app.command("/dd-team-create", teamCommands.createTeam);
  app.command("/dd-team-join", teamCommands.joinTeam);
  app.command("/dd-team-leave", teamCommands.leaveTeam);
  app.command("/dd-team-list", teamCommands.listTeams);
  app.command("/dd-team-members", teamCommands.listMembers);

  // Leave commands
  app.command("/dd-leave-set", leaveCommands.setLeave);
  app.command("/dd-leave-cancel", leaveCommands.cancelLeave);
  app.command("/dd-leave-list", leaveCommands.listLeaves);

  // Work days commands
  app.command("/dd-workdays-set", leaveCommands.setWorkDays);
  app.command("/dd-workdays-show", leaveCommands.showWorkDays);

  // Standup commands
  app.command("/dd-standup", standupCommands.submitManual);

  // Button actions
  app.action(/open_standup_.*/, standupCommands.openStandupModal);
  app.view("standup_modal", standupCommands.handleStandupSubmission);

  console.log("✅ Commands registered");
}

module.exports = { setupCommands };
