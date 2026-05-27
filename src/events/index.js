const userService = require("../services/userService");
const { createHomeTabView } = require("../utils/blockHelper");

function setupEvents(app) {
  app.event("app_home_opened", async ({ event, client }) => {
    if (event.tab !== "home") {
      return;
    }
    try {
      await client.views.publish({
        user_id: event.user,
        view: createHomeTabView(process.env.APP_URL),
      });
    } catch (error) {
      console.error("[app_home_opened] Failed to publish home view", error);
    }
  });

  app.action("home_open_video", async ({ ack }) => ack());
  app.action("home_open_website", async ({ ack }) => ack());
  app.action("home_open_docs", async ({ ack }) => ack());
  app.action("home_open_changelog", async ({ ack }) => ack());

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
