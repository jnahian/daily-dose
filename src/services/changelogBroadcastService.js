const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const { createChangelogBroadcastBlocks } = require("../utils/blockHelper");

const SLEEP_MS = 1200; // Slack ~1 req/sec/channel — stay under the limit.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getWebUrl() {
  return (process.env.APP_URL || "https://dd.jnahian.me").replace(/\/+$/, "");
}

/**
 * Read the latest user-facing changelog entry. Best-effort: returns null
 * (and logs) if the file is unreadable or has no entries.
 * @returns {object|null}
 */
function getLatestEntry() {
  try {
    const changelog = require("../../web/src/data/changelog.json");
    const versions = (changelog && changelog.versions) || [];
    const entry = versions.find((v) => v.isLatest) || versions[0] || null;
    if (!entry) {
      logger.warn("Changelog broadcast: no changelog entry found");
      return null;
    }
    return entry;
  } catch (err) {
    logger.warn(
      "Changelog broadcast: failed to read changelog.json:",
      err.message
    );
    return null;
  }
}

/** @returns {string|null} latest changelog version, or null */
function getLatestVersion() {
  const entry = getLatestEntry();
  return entry ? entry.version : null;
}

/**
 * Post the latest changelog entry to every active org's bot channel that
 * hasn't seen it. Null marker = seed silently (no post). Never throws.
 * @param {object} client - Slack WebClient (app.client)
 * @param {{mode?: 'live'|'dry'|'off'}} [opts]
 */
async function broadcastOnDeploy(client, opts = {}) {
  const mode = (
    opts.mode ||
    process.env.CHANGELOG_BROADCAST ||
    "live"
  ).toLowerCase();

  if (mode === "off") {
    logger.info("Changelog broadcast: disabled (CHANGELOG_BROADCAST=off)");
    return;
  }
  if (!client) return;

  const entry = getLatestEntry();
  if (!entry) return;
  const latest = entry.version;
  const dryRun = mode === "dry";

  const orgs = await prisma.organization.findMany({
    where: { isActive: true, botChannelId: { not: null } },
    select: {
      id: true,
      name: true,
      botChannelId: true,
      lastBroadcastVersion: true,
    },
  });

  const blocks = createChangelogBroadcastBlocks(
    entry,
    `${getWebUrl()}/changelog`
  );
  const fallbackText = `What's new in Daily Dose v${latest}`;

  for (const org of orgs) {
    if (org.lastBroadcastVersion === latest) continue;

    // Never-seen org: seed the marker silently, don't post.
    if (org.lastBroadcastVersion === null) {
      if (!dryRun) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { lastBroadcastVersion: latest },
        });
      }
      logger.info(
        `Changelog broadcast: ${dryRun ? "would seed" : "seeded"} org "${org.name}" to v${latest} (no post)`
      );
      continue;
    }

    if (dryRun) {
      logger.info(
        `Changelog broadcast [dry]: would post v${latest} to ${org.botChannelId} (org "${org.name}")`
      );
      continue;
    }

    try {
      await client.chat.postMessage({
        channel: org.botChannelId,
        text: fallbackText,
        blocks,
      });
      await prisma.organization.update({
        where: { id: org.id },
        data: { lastBroadcastVersion: latest },
      });
      logger.info(
        `Changelog broadcast: posted v${latest} to org "${org.name}"`
      );
    } catch (err) {
      logger.warn(
        `Changelog broadcast: failed for org "${org.name}" (${org.botChannelId}):`,
        err.data?.error || err.message
      );
    }
    await sleep(SLEEP_MS);
  }
}

module.exports = { getLatestEntry, getLatestVersion, broadcastOnDeploy };
