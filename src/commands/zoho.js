const userService = require("../services/userService");
const prisma = require("../config/prisma");
const dayjs = require("dayjs");
const { ackWithProcessing } = require("../utils/commandHelper");
const {
  createSectionBlock,
  createCommandErrorBlocks,
} = require("../utils/blockHelper");
const { sanitizeError, UserFacingError } = require("../utils/errorHelper");
const zohoMappingService = require("../services/zoho/zohoMappingService");

// Zoho mapping/sync-status are organization-wide config, same permission
// bar as holiday management (userService.canCreateTeam checks OWNER/ADMIN
// org membership) rather than a per-team admin check.
async function requireOrgAdmin(slackUserId, client) {
  const userData = await userService.fetchSlackUserData(slackUserId, client);
  const user = await userService.findOrCreateUser(slackUserId, userData);
  const org = await userService.getUserOrganization(slackUserId);

  if (!org) {
    throw new UserFacingError(
      "You must belong to an organization to manage Zoho sync"
    );
  }

  const canManage = await userService.canCreateTeam(user.id, org.id);
  if (!canManage) {
    throw new UserFacingError("You need admin permissions to manage Zoho sync");
  }

  return org;
}

function extractSlackUserId(mention) {
  const match = mention?.match(/<@([A-Z0-9]+)(\|[^>]+)?>/);
  return match ? match[1] : null;
}

async function mapMember({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Mapping Zoho employee...",
    command
  );

  try {
    const org = await requireOrgAdmin(command.user_id, client);

    // /dd-zoho-map-member @user zoho-employee-id
    const parts = command.text.trim().split(/\s+/);
    if (parts.length < 2) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "Usage: `/dd-zoho-map-member @user zoho-employee-id`",
          ["`/dd-zoho-map-member @john 4506000000012345`"]
        ),
      });
      return;
    }

    const targetSlackUserId = extractSlackUserId(parts[0]);
    if (!targetSlackUserId) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "Invalid user mention. Please use @mention format (e.g., @john)"
        ),
      });
      return;
    }

    const zohoEmployeeId = parts[1];

    await zohoMappingService.mapMember(
      org.id,
      targetSlackUserId,
      zohoEmployeeId,
      client
    );

    await updateResponse({
      text: `✅ Mapped <@${targetSlackUserId}> to Zoho employee ID ${zohoEmployeeId}`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

async function unmapMember({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Removing Zoho mapping...",
    command
  );

  try {
    const org = await requireOrgAdmin(command.user_id, client);

    const targetSlackUserId = extractSlackUserId(command.text.trim());
    if (!targetSlackUserId) {
      await updateResponse({
        blocks: createCommandErrorBlocks(
          "Usage: `/dd-zoho-unmap-member @user`"
        ),
      });
      return;
    }

    await zohoMappingService.unmapMember(org.id, targetSlackUserId);

    await updateResponse({
      text: `✅ Removed Zoho mapping for <@${targetSlackUserId}>`,
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

async function listMappings({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Loading Zoho mappings...",
    command
  );

  try {
    const org = await requireOrgAdmin(command.user_id, client);
    const mappings = await zohoMappingService.listMappings(org.id);

    if (mappings.length === 0) {
      await updateResponse({
        text: "📋 No Zoho employee mappings configured yet",
      });
      return;
    }

    const list = mappings
      .map(
        (m) =>
          `• <@${m.user.slackUserId}> → Zoho employee ID ${m.zohoEmployeeId}`
      )
      .join("\n");

    await updateResponse({
      blocks: [createSectionBlock(`*📋 Zoho Employee Mappings:*\n${list}`)],
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

async function syncStatus({ command, ack, respond, client }) {
  const updateResponse = await ackWithProcessing(
    ack,
    respond,
    "Loading Zoho sync status...",
    command
  );

  try {
    const org = await requireOrgAdmin(command.user_id, client);

    const credential = await prisma.zohoCredential.findUnique({
      where: { organizationId: org.id },
    });

    if (!credential) {
      await updateResponse({
        text: "⚠️ Zoho isn't connected for this organization yet. Run `scripts/zohoAuthSetup.js` to authorize it.",
      });
      return;
    }

    const lastRuns = await prisma.zohoSyncRun.findMany({
      where: { organizationId: org.id },
      orderBy: { startedAt: "desc" },
      take: 10,
    });

    const latestByType = {};
    for (const run of lastRuns) {
      if (!latestByType[run.syncType]) latestByType[run.syncType] = run;
    }

    const lines = ["HOLIDAY", "LEAVE"].map((type) => {
      const run = latestByType[type];
      if (!run) return `• ${type}: never synced`;
      const status = run.status === "SUCCESS" ? "✅" : "❌";
      const when = dayjs(run.startedAt).format("MMM DD, YYYY h:mm A");
      return `• ${type}: ${status} ${run.recordsSynced} record(s) at ${when}${
        run.error ? ` — ${run.error}` : ""
      }`;
    });

    await updateResponse({
      blocks: [
        createSectionBlock(
          `*🔄 Zoho Sync Status* (${credential.enabled ? "enabled" : "disabled"}, dc: ${credential.dataCenter})\n${lines.join("\n")}`
        ),
      ],
    });
  } catch (error) {
    await updateResponse({
      blocks: createCommandErrorBlocks(sanitizeError(error)),
    });
  }
}

module.exports = {
  mapMember,
  unmapMember,
  listMappings,
  syncStatus,
};
