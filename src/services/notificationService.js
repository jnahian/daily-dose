const teamService = require("./teamService");
const userService = require("./userService");
const logger = require("../utils/logger");
const { escapeSlackText } = require("../utils/messageHelper");
const {
  createAdminSubmissionNotificationBlocks,
  createTeamApprovalRequestBlocks,
} = require("../utils/blockHelper");

class NotificationService {
  /**
   * Notify team admins about standup submission or update
   * @param {Object} params - Notification parameters
   * @param {string} params.teamId - Team ID
   * @param {Object} params.user - User object from Slack (body.user)
   * @param {Object} params.team - Team object
   * @param {Object} params.client - Slack client
   * @param {Object} params.options - Additional options
   * @param {boolean} params.options.isUpdate - Whether this is an update or new submission
   * @param {boolean} params.options.isLate - Whether the submission is late
   * @param {string} params.options.date - Formatted date string (optional, for updates)
   */
  async notifyAdminsOfStandupSubmission({
    teamId,
    user,
    team,
    client,
    options = {},
  }) {
    const { isUpdate = false, isLate = false, date = null } = options;

    try {
      const teamAdmins = await teamService.getTeamAdmins(teamId);

      for (const admin of teamAdmins) {
        // Don't notify the admin if they are the one submitting
        // Also check if the admin has notifications enabled
        if (admin.user.slackUserId !== user.id && admin.receiveNotifications) {
          await this.sendAdminNotification({
            admin,
            user,
            team,
            client,
            isUpdate,
            isLate,
            date,
          });
        }
      }
    } catch (error) {
      logger.error("Error notifying team admins:", error);
      // Don't throw here - submission was successful, notification failure shouldn't break the flow
    }
  }

  /**
   * Send individual admin notification
   * @param {Object} params - Notification parameters
   * @param {Object} params.admin - Admin team member object
   * @param {Object} params.user - User who submitted standup
   * @param {Object} params.team - Team object
   * @param {Object} params.client - Slack client
   * @param {boolean} params.isUpdate - Whether this is an update
   * @param {boolean} params.isLate - Whether the submission is late
   * @param {string} params.date - Formatted date string (optional)
   */
  async sendAdminNotification({
    admin,
    user,
    team,
    client,
    isUpdate,
    isLate,
    date,
  }) {
    const userName = user.real_name || user.name || user.id;
    const actionText = isUpdate ? "updated" : "submitted";
    const dateText = date ? ` (${date})` : "";
    const lateText = isLate ? " (late submission)" : "";

    const notificationText = `📝 ${userName} ${actionText} their standup for ${team.name}${dateText}${lateText}`;

    await client.chat.postMessage({
      channel: admin.user.slackUserId,
      text: notificationText,
      blocks: createAdminSubmissionNotificationBlocks(notificationText, team),
    });
  }

  /**
   * Notify team admins about any team-related event
   * @param {Object} params - General notification parameters
   * @param {string} params.teamId - Team ID
   * @param {string} params.excludeUserId - User ID to exclude from notifications
   * @param {Object} params.client - Slack client
   * @param {string} params.message - Notification message
   * @param {Array} params.blocks - Slack blocks for rich formatting (optional)
   */
  async notifyTeamAdmins({
    teamId,
    excludeUserId = null,
    client,
    message,
    blocks = null,
  }) {
    try {
      const teamAdmins = await teamService.getTeamAdmins(teamId);

      for (const admin of teamAdmins) {
        // Skip if this admin should be excluded or has notifications disabled
        if (
          (excludeUserId && admin.user.slackUserId === excludeUserId) ||
          !admin.receiveNotifications
        ) {
          continue;
        }

        const messagePayload = {
          channel: admin.user.slackUserId,
          text: message,
        };

        if (blocks) {
          messagePayload.blocks = blocks;
        }

        await client.chat.postMessage(messagePayload);
      }
    } catch (error) {
      logger.error("Error notifying team admins:", error);
      // Don't throw here - original operation should not be affected by notification failures
    }
  }

  /**
   * DM every org admin/owner to ask them to approve or reject a team proposed
   * by a non-admin member. The proposer is skipped if they happen to be an
   * admin (they aren't, in practice, since admins create active teams).
   * @param {Object} params
   * @param {Object} params.team - The pending team record
   * @param {Object} params.organization - The owning organization
   * @param {string} params.creatorSlackUserId - Slack user ID of the proposer
   * @param {Object} params.client - Slack client
   */
  async notifyOrgAdminsOfPendingTeam({
    team,
    organization,
    creatorSlackUserId,
    client,
  }) {
    try {
      const admins = await userService.getOrganizationAdmins(organization.id);
      const text = `🆕 <@${creatorSlackUserId}> proposed a new team "${escapeSlackText(
        team.name
      )}" that needs your approval.`;
      const blocks = createTeamApprovalRequestBlocks({
        team,
        creatorSlackUserId,
      });

      for (const admin of admins) {
        if (admin.user.slackUserId === creatorSlackUserId) {
          continue;
        }

        // Isolate per-recipient failures so one bad DM (e.g. a deactivated
        // admin) doesn't stop the rest of the fan-out.
        try {
          await client.chat.postMessage({
            channel: admin.user.slackUserId,
            text,
            blocks,
          });
        } catch (postError) {
          logger.error(
            `Failed pending-team DM to org admin ${admin.user.slackUserId}:`,
            postError
          );
        }
      }
    } catch (error) {
      logger.error("Error notifying org admins of pending team:", error);
      // Don't throw - team creation succeeded; notification failure shouldn't break the flow
    }
  }
}

module.exports = new NotificationService();
