const teamCommands = require("./team");
const leaveCommands = require("./leave");
const standupCommands = require("./standup");
const { withFormattingRemoval } = require("../utils/commandHelper");

function setupCommands(app) {
  // Team commands - wrapped with formatting removal middleware
  app.command(
    "/dd-team-create",
    withFormattingRemoval(teamCommands.createTeam)
  );
  app.command("/dd-team-join", withFormattingRemoval(teamCommands.joinTeam));
  app.command("/dd-team-leave", withFormattingRemoval(teamCommands.leaveTeam));
  app.command("/dd-team-list", withFormattingRemoval(teamCommands.listTeams));
  app.command(
    "/dd-team-members",
    withFormattingRemoval(teamCommands.listMembers)
  );
  app.command(
    "/dd-team-update",
    withFormattingRemoval(teamCommands.updateTeam)
  );

  // Leave commands - wrapped with formatting removal middleware
  app.command("/dd-leave-set", withFormattingRemoval(leaveCommands.setLeave));
  app.command(
    "/dd-leave-cancel",
    withFormattingRemoval(leaveCommands.cancelLeave)
  );
  app.command(
    "/dd-leave-list",
    withFormattingRemoval(leaveCommands.listLeaves)
  );

  // Work days commands - wrapped with formatting removal middleware
  app.command(
    "/dd-workdays-set",
    withFormattingRemoval(leaveCommands.setWorkDays)
  );
  app.command(
    "/dd-workdays-show",
    withFormattingRemoval(leaveCommands.showWorkDays)
  );

  // Standup commands - wrapped with formatting removal middleware
  app.command(
    "/dd-standup",
    withFormattingRemoval(standupCommands.submitManual)
  );

  // Button actions (no formatting removal needed for these)
  app.action(/open_standup_.*/, standupCommands.openStandupModal);
  app.view("standup_modal", standupCommands.handleStandupSubmission);

  console.log("✅ Commands registered with formatting removal middleware");
}

module.exports = { setupCommands };
