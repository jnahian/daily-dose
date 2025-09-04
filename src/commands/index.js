const teamCommands = require("./team");
const leaveCommands = require("./leave");

function setupCommands(app) {
  // Team commands
  app.command("/dd-team-create", teamCommands.createTeam);
  app.command("/dd-team-join", teamCommands.joinTeam);
  app.command("/dd-team-list", teamCommands.listTeams);

  // Leave commands
  app.command("/dd-leave-set", leaveCommands.setLeave);
  app.command("/dd-leave-cancel", leaveCommands.cancelLeave);

  // Work days commands
  app.command("/dd-workdays-set", leaveCommands.setWorkDays);
  app.command("/dd-workdays-show", leaveCommands.showWorkDays);

  console.log("✅ Commands registered");
}

module.exports = { setupCommands };