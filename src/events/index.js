const userService = require("../services/userService");

function setupEvents(app) {
  // Slack fires `user_change` whenever a workspace user's profile changes,
  // including when they're deactivated (event.user.deleted === true).
  app.event("user_change", async ({ event }) => {
    try {
      const slackUser = event.user;
      if (!slackUser || !slackUser.deleted) {
        return;
      }

      const result = await userService.suspendUserSystemWide(slackUser.id);

      if (!result.found) {
        console.log(
          `[user_change] Deactivated Slack user ${slackUser.id} not present in DB; nothing to suspend`
        );
        return;
      }

      console.log(
        `[user_change] Auto-suspended deactivated Slack user ${slackUser.id}: ` +
          `${result.orgMembershipsSuspended} org membership(s), ` +
          `${result.teamMembershipsSuspended} team membership(s)`
      );
    } catch (error) {
      console.error("[user_change] Failed to auto-suspend user", error);
    }
  });

  console.log("✅ Events registered");
}

module.exports = { setupEvents };
