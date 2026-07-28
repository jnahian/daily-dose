#!/usr/bin/env node

require("dotenv").config();
const prisma = require("../src/config/prisma");
const zohoSyncService = require("../src/services/zoho/zohoSyncService");

/**
 * Manually trigger the Zoho People holiday + leave sync, bypassing the
 * nightly cron schedule. Useful right after `zohoAuthSetup.js` or after
 * changing employee mappings.
 *
 * Usage:
 *   node scripts/zohoSyncNow.js                    - sync every enabled organization
 *   node scripts/zohoSyncNow.js "<organization-name>" - sync just one organization
 */

async function syncOrganization(organization) {
  console.log(`\n📋 Syncing "${organization.name}"...`);

  const holidayResult = await zohoSyncService.syncHolidaysForOrganization(
    organization.id
  );
  console.log(`   ✅ Holidays: ${holidayResult.recordsSynced} synced`);

  const leaveResult = await zohoSyncService.syncLeavesForOrganization(
    organization.id
  );
  console.log(`   ✅ Leaves: ${leaveResult.recordsSynced} synced`);
}

async function main() {
  const orgName = process.argv[2];

  if (orgName) {
    const organization = await prisma.organization.findUnique({
      where: { name: orgName },
    });

    if (!organization) {
      console.error(`❌ Organization "${orgName}" not found`);
      process.exit(1);
    }

    await syncOrganization(organization);
    return;
  }

  const organizations = await zohoSyncService.getEnabledOrganizations();

  if (organizations.length === 0) {
    console.log(
      "⚠️  No organization has Zoho enabled. Run `node scripts/zohoAuthSetup.js` first."
    );
    return;
  }

  for (const organization of organizations) {
    try {
      await syncOrganization(organization);
    } catch (error) {
      console.error(`   ❌ Failed for ${organization.name}: ${error.message}`);
    }
  }
}

main()
  .catch((error) => {
    console.error("❌ Error running Zoho sync:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
