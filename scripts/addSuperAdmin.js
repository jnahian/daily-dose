require("dotenv").config();
const { App } = require("@slack/bolt");
const prisma = require("../src/config/prisma");
const crypto = require("crypto");

/**
 * Script to add a super admin user
 * Usage: node scripts/addSuperAdmin.js <slack-user-id> [notes]
 *
 * Example:
 *   node scripts/addSuperAdmin.js U123456789
 *   node scripts/addSuperAdmin.js U123456789 "Platform owner"
 */

async function addSuperAdmin() {
  try {
    const slackUserId = process.argv[2];
    const notes = process.argv[3] || null;

    if (!slackUserId) {
      console.error("❌ Error: Slack user ID is required");
      console.log("Usage: node scripts/addSuperAdmin.js <slack-user-id> [notes]");
      process.exit(1);
    }

    const app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    });

    console.log(`\n🔍 Fetching user data from Slack for: ${slackUserId}`);

    const slackUserInfo = await app.client.users.info({
      token: process.env.SLACK_BOT_TOKEN,
      user: slackUserId,
    });

    if (!slackUserInfo.ok || !slackUserInfo.user) {
      console.error("❌ Failed to fetch user info from Slack");
      process.exit(1);
    }

    const slackUser = slackUserInfo.user;
    const userData = {
      name: slackUser.real_name || slackUser.name,
      username: slackUser.name,
      email: slackUser.profile?.email,
      timezone: slackUser.tz || process.env.DEFAULT_TIMEZONE || "America/New_York",
    };

    console.log(`✅ Found: ${userData.name} (@${userData.username})`);

    // Upsert user
    const user = await prisma.user.upsert({
      where: { slackUserId },
      update: { name: userData.name, username: userData.username, email: userData.email },
      create: {
        slackUserId,
        name: userData.name,
        username: userData.username,
        email: userData.email,
        timezone: userData.timezone,
      },
    });

    // Check if already a super admin
    const existing = await prisma.super_admins.findFirst({
      where: { user_id: user.id },
    });

    if (existing) {
      if (!existing.revoked_at) {
        console.log(`\n⚠️  ${userData.name} is already a super admin.`);
        process.exit(0);
      }
      // Re-grant if previously revoked
      await prisma.super_admins.update({
        where: { id: existing.id },
        data: { revoked_at: null, granted_at: new Date(), notes },
      });
    } else {
      await prisma.super_admins.create({
        data: {
          id: crypto.randomUUID(),
          user_id: user.id,
          granted_at: new Date(),
          notes,
        },
      });
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ SUCCESS - Super Admin Added");
    console.log("=".repeat(50));
    console.log(`User:         ${user.name} (@${user.username})`);
    console.log(`Slack User ID: ${slackUserId}`);
    if (notes) console.log(`Notes:        ${notes}`);
    console.log("=".repeat(50) + "\n");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addSuperAdmin();
