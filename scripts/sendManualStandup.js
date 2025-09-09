#!/usr/bin/env node

require("dotenv").config();
const { App } = require("@slack/bolt");
const prisma = require("../config/prisma");
const standupService = require("../services/standupService");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { getUserLogIdentifier, getUserMention } = require("../utils/userHelper");
const { formatTime12Hour } = require("../utils/dateHelper");

dayjs.extend(utc);
dayjs.extend(timezone);

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
});

async function sendTroubleshootingMessage(team, channelError) {
  const troubleshootingBlocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🔧 Channel Access Issue",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `❌ Cannot access channel for team *${team.name}*\nChannel ID: \`${team.slackChannelId}\``,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*🔍 Troubleshooting Steps:*",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*1. Check if the channel exists:*\n- Search for the channel in Slack\n- Verify the channel ID is correct",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*2. Add the bot to the channel:*\n- Go to the channel in Slack\n- Type: `/invite @your-bot-name`\n- Or use channel settings → Integrations → Add apps",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*3. Update the channel ID:*\n- Right-click the channel → Copy link\n- Channel IDs start with 'C' (e.g., C1234567890)\n- Update the team record in your database",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*4. Verify bot permissions:*\n- Ensure bot has `chat:write` and `channels:read` scopes\n- Check if bot is properly installed in workspace",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Error: ${channelError.data?.error || channelError.message}`,
        },
      ],
    },
  ];

  // Try to send to team members as DM since we can't access the main channel
  try {
    const members = await prisma.teamMember.findMany({
      where: {
        teamId: team.id,
        isActive: true,
        role: "ADMIN", // Send to admins first
      },
      include: {
        user: true,
      },
    });

    if (members.length === 0) {
      // If no admins, send to all members
      const allMembers = await prisma.teamMember.findMany({
        where: {
          teamId: team.id,
          isActive: true,
        },
        include: {
          user: true,
        },
      });
      members.push(...allMembers);
    }

    let sentCount = 0;
    for (const member of members.slice(0, 3)) {
      // Limit to first 3 to avoid spam
      try {
        await app.client.chat.postMessage({
          channel: member.user.slackUserId,
          blocks: troubleshootingBlocks,
          text: "Troubleshooting steps for channel access issue",
        });
        sentCount++;
        console.log(
          `📤 Sent troubleshooting steps to ${getUserLogIdentifier(
            member.user
          )}`
        );
      } catch (dmError) {
        console.error(
          `Failed to send DM to ${member.user.slackUserId}:`,
          dmError.message
        );
      }
    }

    if (sentCount > 0) {
      console.log(
        `✅ Troubleshooting steps sent to ${sentCount} team member(s)`
      );
    } else {
      console.log(
        "⚠️ Could not send troubleshooting steps to any team members"
      );
    }
  } catch (error) {
    console.error("Failed to send troubleshooting messages:", error.message);
  }
}

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
        console.error(`\n❌ Channel ${team.slackChannelId} not found!`);
        console.log(`� Sendiung troubleshooting steps to team members...`);

        // Send troubleshooting steps to team members via DM
        await sendTroubleshootingMessage(team, channelError);

        throw new Error(
          `Cannot access channel ${team.slackChannelId}. Troubleshooting steps sent to team members.`
        );
      }
      throw new Error(`Channel validation failed: ${channelError.message}`);
    }

    const targetDate = options.date
      ? dayjs(options.date)
      : dayjs().tz(team.timezone);

    if (options.dryRun) {
      // For dry run, we need to get the data to show preview
      const responses = await standupService.getTeamResponses(
        team.id,
        targetDate.toDate()
      );
      const lateResponses = await standupService.getLateResponses(
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
      const respondedUserIds = new Set(responses.map((r) => r.userId));
      const leaveUserIds = new Set(membersOnLeave.map((m) => m.userId));

      const notSubmitted = allMembers
        .filter(
          (m) => !respondedUserIds.has(m.userId) && !leaveUserIds.has(m.userId)
        )
        .map((m) => ({
          slackUserId: m.user.slackUserId,
          user: m.user,
          onLeave: false,
        }));

      // Format on-leave members
      const onLeave = membersOnLeave.map((m) => ({
        slackUserId: m.user.slackUserId,
        user: m.user,
        onLeave: true,
      }));

      console.log(`📈 Standup Summary:`);
      console.log(`   - Responses: ${responses.length}`);
      console.log(`   - Late responses: ${lateResponses.length}`);
      console.log(`   - Not submitted: ${notSubmitted.length}`);
      console.log(`   - On leave: ${membersOnLeave.length}`);

      if (
        responses.length === 0 &&
        lateResponses.length === 0 &&
        notSubmitted.length === 0
      ) {
        console.log("⚠️  No standup data found for this date. Skipping post.");
        return;
      }

      // Format message for preview
      const message = await standupService.formatStandupMessage(
        responses,
        notSubmitted,
        onLeave,
        targetDate
      );

      // Add date to header if not today
      if (!targetDate.isSame(dayjs(), "day")) {
        message.blocks[0].text.text = `📊 Daily Standup - ${targetDate.format(
          "MMM DD, YYYY"
        )}`;
      }

      console.log("\n🔍 DRY RUN - Message that would be sent:");
      console.log(JSON.stringify(message, null, 2));

      if (lateResponses.length > 0) {
        console.log(
          `\n🕐 Late responses that would be posted as threaded replies (${lateResponses.length}):`
        );
        for (const lateResponse of lateResponses) {
          const lateMessage = await standupService.formatLateResponseMessage(
            lateResponse
          );
          console.log(
            `\n--- Late Response from ${getUserLogIdentifier(
              lateResponse.user
            )} ---`
          );
          console.log(JSON.stringify(lateMessage, null, 2));
        }
      }
      return;
    }

    // Use the new postTeamStandup method from standupService
    const result = await standupService.postTeamStandup(team, targetDate.toDate(), app);
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
                  text: `⏰ Deadline: ${formatTime12Hour(team.postingTime)}`,
                },
              ],
            },
          ],
        });
        successCount++;
        console.log(`   ✅ Sent to ${getUserLogIdentifier(member.user)}`);
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
        "Standup Time": formatTime12Hour(team.standupTime),
        "Posting Time": formatTime12Hour(team.postingTime),
        Timezone: team.timezone,
      });
    }

    console.table(tableData);
  } catch (error) {
    console.error("❌ Error listing teams:", error.message);
    throw error;
  }
}

async function sendTroubleshootingSteps(teamName) {
  try {
    console.log(`🔧 Sending troubleshooting steps for team: ${teamName}`);

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

    // Create a mock channel error for the troubleshooting message
    const mockError = {
      data: { error: "channel_not_found" },
      message: "Manual troubleshooting request",
    };

    await sendTroubleshootingMessage(team, mockError);
    console.log(`✅ Troubleshooting steps sent for team: ${team.name}`);
  } catch (error) {
    console.error("❌ Error sending troubleshooting steps:", error.message);
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
  post "<teamName>"                       - Post standup summary for team (includes late responses)
  post "<teamName>" --date YYYY-MM-DD    - Post standup for specific date (includes late responses)
  post "<teamName>" --dry-run             - Preview message without sending (shows late responses)
  remind "<teamName>"                     - Send standup reminders to team members
  troubleshoot "<teamName>"               - Send troubleshooting steps to team members

Examples:
  node src/scripts/sendManualStandup.js list
  node src/scripts/sendManualStandup.js post "Engineering Team"
  node src/scripts/sendManualStandup.js post "Marketing Team" --date 2025-01-15
  node src/scripts/sendManualStandup.js post "Product Team" --dry-run
  node src/scripts/sendManualStandup.js remind "Engineering Team"
  node src/scripts/sendManualStandup.js troubleshoot "Engineering Team"

Note: Use quotes around team names that contain spaces
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

      case "troubleshoot": {
        const teamName = args[1];
        if (!teamName) {
          console.error("❌ Team name is required for troubleshoot command");
          process.exit(1);
        }
        await sendTroubleshootingSteps(teamName);
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

main().catch(async (error) => {
  console.error("❌ Unexpected error:", error);
  await prisma.$disconnect();
  process.exit(1);
});
