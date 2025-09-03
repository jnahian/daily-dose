const teamCommands = require("./team");

function setupCommands(app) {
  // Team commands
  app.command("/team-create", teamCommands.createTeam);
  app.command("/team-join", teamCommands.joinTeam);
  app.command("/team-list", teamCommands.listTeams);

  console.log("✅ Commands registered");
}

module.exports = { setupCommands };