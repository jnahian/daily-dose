#!/usr/bin/env node

require("dotenv").config();
const prisma = require("../src/config/prisma");
const zohoAuthService = require("../src/services/zoho/zohoAuthService");

/**
 * One-time Zoho People authorization for an organization.
 *
 * Generate a "grant token" (self-client) from the Zoho API console
 * (https://api-console.zoho.<dc>/) with the ZOHOPEOPLE.leave.ALL scope, then
 * exchange it here for a refresh token — Zoho grant tokens expire in a few
 * minutes, so run this immediately after generating one.
 *
 * Usage:
 *   node scripts/zohoAuthSetup.js "<organization-name>" <grant-token>
 */

async function main() {
  const orgName = process.argv[2];
  const grantToken = process.argv[3];

  if (!orgName || !grantToken) {
    console.error(
      '❌ Usage: node scripts/zohoAuthSetup.js "<organization-name>" <grant-token>'
    );
    process.exit(1);
  }

  const organization = await prisma.organization.findUnique({
    where: { name: orgName },
  });

  if (!organization) {
    console.error(`❌ Organization "${orgName}" not found`);
    console.log("\nAvailable organizations:");
    const orgs = await prisma.organization.findMany({
      select: { name: true, id: true },
    });
    orgs.forEach((org) => console.log(`   - ${org.name} (${org.id})`));
    process.exit(1);
  }

  console.log(
    `🔐 Exchanging grant token for organization "${organization.name}"...`
  );

  const credential = await zohoAuthService.exchangeGrantToken(
    organization.id,
    grantToken
  );

  console.log("✅ Zoho credential saved:");
  console.log(`   Organization: ${organization.name}`);
  console.log(`   Data center: ${credential.dataCenter}`);
  console.log(
    `   Access token expires: ${credential.accessTokenExpiresAt?.toISOString()}`
  );
  console.log(
    "\nNext: map team members to their Zoho employee IDs with " +
      "`/dd-zoho-map-member @user zoho-employee-id`, then run " +
      "`npm run zoho:sync` to test."
  );
}

main()
  .catch((error) => {
    console.error("❌ Error setting up Zoho authorization:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
