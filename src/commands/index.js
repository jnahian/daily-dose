const teamCommands = require("./team");
const leaveCommands = require("./leave");
const standupCommands = require("./standup");
const holidayCommands = require("./holiday");
const { stripFormatting } = require("../middleware/command");

function setupCommands(app) {
  // Standup commands (primary functionality) - wrapped with formatting removal middleware
  app.command("/dd-standup", stripFormatting(), standupCommands.submitManual);
  app.command("/dd-standup-update", stripFormatting(), standupCommands.updateStandup);

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

  // Holiday management commands - wrapped with formatting removal middleware
  app.command("/dd-holiday-set", stripFormatting(), holidayCommands.setHoliday);
  app.command("/dd-holiday-update", stripFormatting(), holidayCommands.updateHoliday);
  app.command("/dd-holiday-delete", stripFormatting(), holidayCommands.deleteHoliday);
  app.command("/dd-holiday-list", stripFormatting(), holidayCommands.listHolidays);

  // Interactive components (no formatting removal needed for these)
  app.action(/open_standup_.*/, standupCommands.openStandupModal);
  app.view("standup_modal", standupCommands.handleStandupSubmission);
  app.view("standup_update_modal", standupCommands.handleStandupUpdateSubmission);

  console.log("✅ Commands registered with formatting removal middleware");
}

module.exports = { setupCommands };
