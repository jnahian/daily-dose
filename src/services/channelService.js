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

module.exports = { ensureOrgChannel };
