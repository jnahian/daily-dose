require("dotenv").config();
const { WebClient } = require("@slack/web-api");

// Initialize Slack Web API client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

async function getSlackTeamInfo() {
  try {
    console.log("🔍 Fetching team information from Slack...\n");

    // Get team/workspace info
    const teamInfo = await slack.team.info();
    const team = teamInfo.team;

    console.log("🏢 Workspace Information:");
    console.log(`   • Name: ${team.name}`);
    console.log(`   • ID: ${team.id}`);
    console.log(`   • Domain: ${team.domain}`);
    console.log(`   • Email Domain: ${team.email_domain || "Not set"}`);
    console.log(`   • Icon: ${team.icon?.image_68 || "No icon"}`);
    console.log("");

    // Get all users in the workspace
    console.log("👥 Fetching workspace members...");
    const usersResponse = await slack.users.list();
    const users = usersResponse.members.filter((user) => !user.deleted);

    const activeUsers = users.filter(
      (user) => !user.is_bot && user.id !== "USLACKBOT"
    );
    const botUsers = users.filter(
      (user) => user.is_bot && user.id !== "USLACKBOT"
    );
    const adminUsers = activeUsers.filter(
      (user) => user.is_admin || user.is_owner
    );

    console.log(`   • Total Members: ${users.length}`);
    console.log(`   • Active Users: ${activeUsers.length}`);
    console.log(`   • Bot Users: ${botUsers.length}`);
    console.log(`   • Admins/Owners: ${adminUsers.length}`);
    console.log("");

    // Get all channels
    console.log("📺 Fetching channels...");
    const channelsResponse = await slack.conversations.list({
      types: "public_channel,private_channel",
      limit: 1000,
    });

    const channels = channelsResponse.channels;
    const publicChannels = channels.filter((ch) => !ch.is_private);
    const privateChannels = channels.filter((ch) => ch.is_private);

    console.log(`   • Total Channels: ${channels.length}`);
    console.log(`   • Public Channels: ${publicChannels.length}`);
    console.log(`   • Private Channels: ${privateChannels.length}`);
    console.log("");

    // Show detailed user information if requested
    const args = process.argv.slice(2);
    if (args.includes("--users") || args.includes("-u")) {
      console.log("👤 Active Users Details:");
      activeUsers.forEach((user, index) => {
        const status = user.is_owner
          ? "👑 Owner"
          : user.is_admin
          ? "🛡️ Admin"
          : "👤 Member";
        const realName = user.real_name || user.name;
        const email = user.profile?.email || "No email";
        const timezone = user.tz_label || "Unknown timezone";

        console.log(`   ${index + 1}. ${status} - ${realName} (@${user.name})`);
        console.log(`      • Email: ${email}`);
        console.log(`      • Timezone: ${timezone}`);
        console.log(`      • ID: ${user.id}`);
        console.log("");
      });
    }

    // Show detailed channel information if requested
    if (args.includes("--channels") || args.includes("-c")) {
      console.log("📺 Channel Details:");

      if (publicChannels.length > 0) {
        console.log("   🌐 Public Channels:");
        for (const channel of publicChannels.slice(0, 20)) {
          // Limit to first 20
          try {
            const channelInfo = await slack.conversations.info({
              channel: channel.id,
            });
            const memberCount = channelInfo.channel.num_members || 0;
            console.log(
              `      • #${channel.name} (${memberCount} members) - ${channel.id}`
            );
            if (channel.topic?.value) {
              console.log(`        Topic: ${channel.topic.value}`);
            }
          } catch (error) {
            console.log(
              `      • #${channel.name} - ${channel.id} (Error getting details)`
            );
          }
        }
        if (publicChannels.length > 20) {
          console.log(
            `      ... and ${publicChannels.length - 20} more public channels`
          );
        }
        console.log("");
      }

      if (privateChannels.length > 0) {
        console.log("   🔒 Private Channels:");
        privateChannels.slice(0, 10).forEach((channel) => {
          console.log(`      • ${channel.name} - ${channel.id}`);
        });
        if (privateChannels.length > 10) {
          console.log(
            `      ... and ${privateChannels.length - 10} more private channels`
          );
        }
        console.log("");
      }
    }

    // Show bot information if requested
    if (args.includes("--bots") || args.includes("-b")) {
      console.log("🤖 Bot Users:");
      botUsers.forEach((bot, index) => {
        console.log(
          `   ${index + 1}. ${bot.real_name || bot.name} (@${bot.name})`
        );
        console.log(`      • ID: ${bot.id}`);
        console.log(`      • App ID: ${bot.profile?.app_id || "Unknown"}`);
        console.log("");
      });
    }

    // Get workspace stats
    console.log("📊 Workspace Statistics:");
    console.log(
      `   • Created: ${new Date(team.date_create * 1000).toLocaleDateString()}`
    );
    console.log(`   • Plan: ${team.plan || "Unknown"}`);

    // Try to get additional stats
    try {
      const statsResponse = await slack.team.billableInfo();
      if (statsResponse.billable_info) {
        const billableUsers = Object.keys(statsResponse.billable_info).length;
        console.log(`   • Billable Users: ${billableUsers}`);
      }
    } catch (error) {
      // Billable info might not be available for all plans
    }
  } catch (error) {
    console.error("❌ Error fetching Slack team information:", error.message);

    if (error.data?.error === "missing_scope") {
      console.error(
        "💡 This error usually means the bot needs additional OAuth scopes."
      );
      console.error(
        "   Required scopes: team:read, users:read, channels:read, groups:read"
      );
    } else if (error.data?.error === "invalid_auth") {
      console.error("💡 Check your SLACK_BOT_TOKEN in the .env file.");
    }
  }
}

// Show help
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
🏢 Slack Team Information Viewer

Usage: npm run slack:info [options]

Options:
  --users, -u      Show detailed user information
  --channels, -c   Show detailed channel information  
  --bots, -b       Show bot users information
  --help, -h       Show this help message

Examples:
  npm run slack:info                    # Basic team info
  npm run slack:info --users            # Include user details
  npm run slack:info --channels         # Include channel details
  npm run slack:info --users --channels # Include both users and channels
  npm run slack:info --bots             # Include bot information
  `);
  process.exit(0);
}

getSlackTeamInfo();
