#!/usr/bin/env node

require("dotenv").config();
const { WebClient } = require("@slack/web-api");
const prisma = require("../src/config/prisma");
const channelService = require("../src/services/channelService");
const logger = require("../src/utils/logger");

const DRY_RUN = process.argv.includes("--dry-run");
const SLEEP_MS = 1200; // Slack ~1 req/sec/channel — stay under the limit.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.BOT_TOKEN) {
    logger.error("Backfill failed: BOT_TOKEN is required.");
    process.exitCode = 1;
    return;
  }
  const client = new WebClient(process.env.BOT_TOKEN);

  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    include: {
      teams: {
        where: { deletedAt: null },
        include: {
          members: {
            where: { isActive: true },
            include: { user: true },
          },
        },
      },
    },
  });

  logger.info(`Backfill${DRY_RUN ? " (dry-run)" : ""}: ${orgs.length} org(s)`);

  for (const org of orgs) {
    logger.info(`Org "${org.name}" (${org.id})`);

    let channelId = org.botChannelId;
    if (!channelId) {
      if (DRY_RUN) {
        logger.info("  [dry-run] would create daily-dose-bot channel");
      } else {
        channelId = await channelService.ensureOrgChannel(client, org);
        await sleep(SLEEP_MS);
        if (!channelId) {
          logger.warn("  could not create channel; skipping invites");
          continue;
        }
      }
    }

    const slackUserIds = new Set();
    for (const team of org.teams) {
      for (const m of team.members) {
        if (m.user?.slackUserId) slackUserIds.add(m.user.slackUserId);
      }
    }

    for (const uid of slackUserIds) {
      if (DRY_RUN) {
        logger.info(`  [dry-run] would invite ${uid}`);
        continue;
      }
      await channelService.inviteUserToOrgChannel(client, org.id, uid);
      await sleep(SLEEP_MS);
    }
    logger.info(`  ${slackUserIds.size} member(s) processed`);
  }

  logger.info("Backfill complete.");
}

main()
  .catch((err) => {
    logger.error("Backfill failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
