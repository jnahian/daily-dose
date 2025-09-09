#!/usr/bin/env node

require("dotenv").config();
const { App } = require("@slack/bolt");
const prisma = require("../src/config/prisma");
const schedulerService = require("../src/services/schedulerService");

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
});

async function triggerStandupReminder(teamName) {
  try {
    console.log(`🚀 Triggering standup reminder for team: ${teamName}`);

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

    // Initialize scheduler with app instance
    await schedulerService.initialize(app);

    // Send standup reminders
    await schedulerService.sendStandupReminders(team);

    console.log(`✅ Standup reminders sent for team: ${team.name}`);
  } catch (error) {
    console.error("❌ Error triggering standup reminder:", error.message);
    process.exit(1);
  }
}

async function triggerFollowupReminder(teamName) {
  try {
    console.log(`🔔 Triggering follow-up reminder for team: ${teamName}`);

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

    await schedulerService.initialize(app);
    await schedulerService.sendFollowupReminders(team);

    console.log(`✅ Follow-up reminders sent for team: ${team.name}`);
  } catch (error) {
    console.error("❌ Error triggering follow-up reminder:", error.message);
    process.exit(1);
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

    // Format data for table display
    const tableData = teams.map((team) => ({
      "Team Name": team.name,
      Members: team._count.members,
      Channel: team.slackChannelId,
      "Standup Time": team.standupTime,
      "Posting Time": team.postingTime,
      Timezone: team.timezone,
    }));

    console.table(tableData);
  } catch (error) {
    console.error("❌ Error listing teams:", error.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const teamName = args.slice(1).join(" "); // Join remaining args to handle team names with spaces

  if (!command) {
    console.log(`
📝 Manual Standup Trigger Script

Usage:
  node src/scripts/triggerStandup.js <command> [teamName]

Commands:
  list                      - List all active teams
  reminder "<teamName>"     - Send standup reminders to team members
  followup "<teamName>"     - Send follow-up reminders to pending members

Examples:
  node src/scripts/triggerStandup.js list
  node src/scripts/triggerStandup.js reminder "Engineering Team"
  node src/scripts/triggerStandup.js followup "Marketing Team"

Note: Use quotes around team names that contain spaces
    `);
    process.exit(0);
  }

  switch (command) {
    case "list":
      await listTeams();
      break;
    case "reminder":
      if (!teamName) {
        console.error("❌ Team name is required for reminder command");
        process.exit(1);
      }
      await triggerStandupReminder(teamName);
      break;
    case "followup":
      if (!teamName) {
        console.error("❌ Team name is required for followup command");
        process.exit(1);
      }
      await triggerFollowupReminder(teamName);
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
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
