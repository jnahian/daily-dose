const teamCommands = require("./team");

function setupCommands(app) {
  // Team commands
  app.command("/dd-team-create", teamCommands.createTeam);
  app.command("/dd-team-join", teamCommands.joinTeam);
  app.command("/dd-team-list", teamCommands.listTeams);

  console.log("✅ Commands registered");
}

module.exports = { setupCommands };