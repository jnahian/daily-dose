#!/usr/bin/env node

require("dotenv").config();
const { App } = require("@slack/bolt");
const prisma = require("../config/prisma");
const standupService = require("../services/standupService");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
});

async function sendManualStandup(teamName, options = {}) {
  try {
    console.log(`📊 Sending manual standup for team: ${teamName}`);

    // Get team details by name
    const team = await prisma.team.findFirst({
      where: {
        name: {
          equals: teamName,
          mode: "insensitive",
        },
        isActive: true,
      },
      include: {
        organization: true,
      },
    });

    if (!team) {
      throw new Error(`Team "${teamName}" not found`);
    }

    console.log(`📋 Found team: ${team.name} (ID: ${team.id})`);
    console.log(`📍 Channel ID: ${team.slackChannelId}`);

    // Validate channel access
    try {
      const channelInfo = await app.client.conversations.info({
        channel: team.slackChannelId,
      });
      console.log(`✅ Channel validated: #${channelInfo.channel.name}`);
    } catch (channelError) {
      if (channelError.data?.error === "channel_not_found") {
        throw new Error(
          `Channel ${team.slackChannelId} not found. The bot may not have access to this channel or it may have been deleted.`
        );
      }
      throw new Error(`Channel validation failed: ${channelError.message}`);
    }

    const targetDate = options.date
      ? dayjs(options.date)
      : dayjs().tz(team.timezone);

    // Get all responses for the target date
    const responses = await standupService.getTeamResponses(
      team.id,
      targetDate.toDate()
    );

    const allMembers = await standupService.getActiveMembers(
      team.id,
      targetDate.toDate()
    );

    // Get members on leave for the target date
    const membersOnLeave = await prisma.teamMember.findMany({
      where: {
        teamId: team.id,
        isActive: true,
        user: {
          leaves: {
            some: {
              startDate: { lte: targetDate.toDate() },
              endDate: { gte: targetDate.toDate() },
            },
          },
        },
      },
      include: {
        user: true,
      },
    });

    // Calculate not submitted
    const respondedUserIds = new Set(responses.map(r => r.userId));
    const leaveUserIds = new Set(membersOnLeave.map(m => m.userId));

    const notSubmitted = allMembers
      .filter(m => !respondedUserIds.has(m.userId))
      .map(m => ({
        slackUserId: m.user.slackUserId,
        onLeave: leaveUserIds.has(m.userId),
      }));

    console.log(`📈 Standup Summary:`);
    console.log(`   - Responses: ${responses.length}`);
    console.log(`   - Not submitted: ${notSubmitted.length}`);
    console.log(`   - On leave: ${membersOnLeave.length}`);

    if (responses.length === 0 && notSubmitted.length === 0) {
      console.log("⚠️  No standup data found for this date. Skipping post.");
      return;
    }

    // Format and post message
    const message = await standupService.formatStandupMessage(
      responses,
      notSubmitted
    );

    // Add date to header if not today
    if (!targetDate.isSame(dayjs(), "day")) {
      message.blocks[0].text.text = `📊 Daily Standup - ${targetDate.format(
        "MMM DD, YYYY"
      )}`;
    }

    if (options.dryRun) {
      console.log("\n🔍 DRY RUN - Message that would be sent:");
      console.log(JSON.stringify(message, null, 2));
      return;
    }

    const result = await app.client.chat.postMessage({
      channel: team.slackChannelId,
      ...message,
    });

    // Save message timestamp for threading late responses
    await standupService.saveStandupPost(
      team.id,
      targetDate.toDate(),
      result.ts,
      team.slackChannelId
    );

    console.log(`✅ Standup posted successfully to ${team.slackChannelId}`);
    console.log(`📝 Message timestamp: ${result.ts}`);
  } catch (error) {
    console.error("❌ Error sending manual standup:", error.message);
    throw error;
  }
}

async function sendStandupReminders(teamName) {
  try {
    console.log(`🔔 Sending standup reminders for team: ${teamName}`);

    const team = await prisma.team.findFirst({
      where: {
        name: {
          equals: teamName,
          mode: "insensitive",
        },
        isActive: true,
      },
      include: {
        organization: true,
      },
    });

    if (!team) {
      throw new Error(`Team "${teamName}" not found`);
    }

    const now = dayjs().tz(team.timezone);
    const members = await standupService.getActiveMembers(
      team.id,
      now.toDate()
    );

    console.log(`📋 Sending reminders to ${members.length} active members`);

    let successCount = 0;
    let errorCount = 0;

    for (const member of members) {
      try {
        await app.client.chat.postMessage({
          channel: member.user.slackUserId,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `🌅 Good morning! Time for your daily standup for *${team.name}*`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "📝 Submit Standup",
                  },
                  action_id: `open_standup_${team.id}`,
                  style: "primary",
                },
              ],
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `⏰ Deadline: ${team.postingTime}`,
                },
              ],
            },
          ],
        });
        successCount++;
        console.log(
          `   ✅ Sent to ${member.user.name || member.user.slackUserId}`
        );
      } catch (error) {
        errorCount++;
        console.error(
          `   ❌ Failed to send to ${member.user.slackUserId}:`,
          error.message
        );
      }
    }

    console.log(`\n📊 Reminder Summary:`);
    console.log(`   - Successful: ${successCount}`);
    console.log(`   - Failed: ${errorCount}`);
  } catch (error) {
    console.error("❌ Error sending standup reminders:", error.message);
    throw error;
  }
}

async function listTeams() {
  try {
    console.log("📋 Available teams:\n");

    const teams = await prisma.team.findMany({
      where: { isActive: true },
      include: {
        organization: true,
        _count: {
          select: {
            members: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (teams.length === 0) {
      console.log("No active teams found.");
      return;
    }

    // Format data for table display with channel validation
    const tableData = [];

    for (const team of teams) {
      let channelStatus = team.slackChannelId;

      try {
        const channelInfo = await app.client.conversations.info({
          channel: team.slackChannelId,
        });
        channelStatus = `#${channelInfo.channel.name} ✅`;
      } catch (error) {
        if (error.data?.error === "channel_not_found") {
          channelStatus = `${team.slackChannelId} ❌ NOT FOUND`;
        } else {
          channelStatus = `${team.slackChannelId} ⚠️ ERROR`;
        }
      }

      tableData.push({
        "Team Name": team.name,
        Members: team._count.members,
        Channel: channelStatus,
        "Standup Time": team.standupTime,
        "Posting Time": team.postingTime,
        Timezone: team.timezone,
      });
    }

    console.table(tableData);
  } catch (error) {
    console.error("❌ Error listing teams:", error.message);
    throw error;
  }
}

async function updateTeamChannel(teamName, newChannelId) {
  try {
    console.log(`🔧 Updating channel for team: ${teamName}`);

    // Validate new channel first
    try {
      const channelInfo = await app.client.conversations.info({
        channel: newChannelId,
      });
      console.log(`✅ New channel validated: #${channelInfo.channel.name}`);
    } catch (channelError) {
      if (channelError.data?.error === "channel_not_found") {
        throw new Error(
          `Channel ${newChannelId} not found. Make sure the bot has access to this channel.`
        );
      }
      throw new Error(`Channel validation failed: ${channelError.message}`);
    }

    // Find and update team
    const team = await prisma.team.findFirst({
      where: {
        name: {
          equals: teamName,
          mode: "insensitive",
        },
        isActive: true,
      },
    });

    if (!team) {
      throw new Error(`Team "${teamName}" not found`);
    }

    const updatedTeam = await prisma.team.update({
      where: { id: team.id },
      data: { slackChannelId: newChannelId },
    });

    console.log(`✅ Team "${teamName}" channel updated to: ${newChannelId}`);
    return updatedTeam;
  } catch (error) {
    console.error("❌ Error updating team channel:", error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
📊 Manual Standup Script

Usage:
  node src/scripts/sendManualStandup.js <command> [options]

Commands:
  list                                    - List all active teams with channel status
  post "<teamName>"                       - Post standup summary for team
  post "<teamName>" --date YYYY-MM-DD    - Post standup for specific date
  post "<teamName>" --dry-run             - Preview message without sending
  remind "<teamName>"                     - Send standup reminders to team members
  fix-channel "<teamName>" <channelId>    - Update team's Slack channel ID

Examples:
  node src/scripts/sendManualStandup.js list
  node src/scripts/sendManualStandup.js post "Engineering Team"
  node src/scripts/sendManualStandup.js post "Marketing Team" --date 2025-01-15
  node src/scripts/sendManualStandup.js post "Product Team" --dry-run
  node src/scripts/sendManualStandup.js remind "Engineering Team"
  node src/scripts/sendManualStandup.js fix-channel "Engineering Team" C1234567890

Note: Use quotes around team names that contain spaces
      Channel IDs start with 'C' (e.g., C1234567890)
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "list":
        await listTeams();
        break;

      case "post": {
        const teamName = args[1];
        if (!teamName) {
          console.error("❌ Team name is required for post command");
          process.exit(1);
        }

        const options = {};

        // Parse additional options
        for (let i = 2; i < args.length; i++) {
          if (args[i] === "--date" && args[i + 1]) {
            options.date = args[i + 1];
            i++; // Skip next arg as it's the date value
          } else if (args[i] === "--dry-run") {
            options.dryRun = true;
          }
        }

        await sendManualStandup(teamName, options);
        break;
      }

      case "remind": {
        const teamName = args[1];
        if (!teamName) {
          console.error("❌ Team name is required for remind command");
          process.exit(1);
        }
        await sendStandupReminders(teamName);
        break;
      }

      case "fix-channel": {
        const teamName = args[1];
        const channelId = args[2];
        if (!teamName || !channelId) {
          console.error(
            "❌ Both team name and channel ID are required for fix-channel command"
          );
          console.log('Usage: fix-channel "Team Name" C1234567890');
          process.exit(1);
        }
        await updateTeamChannel(teamName, channelId);
        break;
      }

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log("Run without arguments to see usage help");
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Command failed:", error.message);
    process.exit(1);
  }

  // Clean up
  await prisma.$disconnect();
  process.exit(0);
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(async error => {
  console.error("❌ Unexpected error:", error);
  await prisma.$disconnect();
  process.exit(1);
});
