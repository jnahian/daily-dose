const prisma = require("../config/prisma");
const logger = require("../utils/logger");

const BASE_CHANNEL_NAME = "daily-dose-bot";
const MAX_NAME_ATTEMPTS = 5;

/**
 * Create (or reuse) the org's "daily-dose-bot" Slack channel and persist its
 * ID on the Organization. Idempotent and best-effort: never throws.
 * @param {object} client - Slack WebClient
 * @param {{id: string, botChannelId: ?string}} org
 * @returns {Promise<string|null>} channel ID, or null on failure
 */
async function ensureOrgChannel(client, org) {
  if (!client || !org) return null;
  if (org.botChannelId) return org.botChannelId;

  for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
    const name =
      attempt === 1 ? BASE_CHANNEL_NAME : `${BASE_CHANNEL_NAME}-${attempt}`;
    try {
      const result = await client.conversations.create({
        name,
        is_private: false,
      });
      const channelId = result.channel.id;
      await prisma.organization.update({
        where: { id: org.id },
        data: { botChannelId: channelId },
      });
      return channelId;
    } catch (err) {
      if (err.data?.error === "name_taken") continue;
      logger.warn(
        `ensureOrgChannel failed for org ${org.id}:`,
        err.data?.error || err.message
      );
      return null;
    }
  }
  logger.warn(`ensureOrgChannel: exhausted name attempts for org ${org.id}`);
  return null;
}

/**
 * Invite a user to the org's daily-dose-bot channel. Best-effort: never throws.
 * Looks up the org's botChannelId itself so callers needn't preload it.
 * @param {object} client - Slack WebClient
 * @param {string} orgId
 * @param {string} slackUserId
 * @returns {Promise<boolean>} true if invited or already a member
 */
async function inviteUserToOrgChannel(client, orgId, slackUserId) {
  if (!client || !orgId || !slackUserId) return false;
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { botChannelId: true },
    });
    if (!org?.botChannelId) return false;
    await client.conversations.invite({
      channel: org.botChannelId,
      users: slackUserId,
    });
    return true;
  } catch (err) {
    if (err.data?.error === "already_in_channel") return true;
    logger.warn(
      `inviteUserToOrgChannel failed (org ${orgId}, user ${slackUserId}):`,
      err.data?.error || err.message
    );
    return false;
  }
}

module.exports = { ensureOrgChannel, inviteUserToOrgChannel };
