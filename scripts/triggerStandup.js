#!/usr/bin/env node

require("dotenv").config();
const { App } = require("@slack/bolt");
const prisma = require("../src/config/prisma");
const schedulerService = require("../src/services/schedulerService");
const readline = require("readline");

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
});

// Helper function to prompt for confirmation
async function confirmAction(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}

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

async function triggerAllTeamsReminders(type) {
  try {
    const actionType = type === "reminder" ? "standup reminders" : "follow-up reminders";
    console.log(`🚀 Preparing to send ${actionType} to all active teams...\n`);

    // Get all active teams with at least one active member
    const teams = await prisma.team.findMany({
      where: {
        isActive: true,
        members: {
          some: {
            isActive: true,
          },
        },
      },
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
      orderBy: {
        name: "asc",
      },
    });

    if (teams.length === 0) {
      console.log("⚠️  No active teams with active members found.");
      return;
    }

    // Display teams that will receive reminders
    console.log(`📋 Found ${teams.length} active team(s) with active members:\n`);
    const tableData = teams.map((team) => ({
      "Team Name": team.name,
      "Active Members": team._count.members,
      Channel: team.slackChannelId,
      Timezone: team.timezone,
    }));
    console.table(tableData);

    // Ask for confirmation
    console.log(`\n⚠️  This will send ${actionType} to ${teams.length} team(s).`);
    const confirmed = await confirmAction("Do you want to proceed?");

    if (!confirmed) {
      console.log("❌ Operation cancelled by user.");
      return;
    }

    console.log(`\n🚀 Starting to send ${actionType}...\n`);

    // Initialize scheduler
    await schedulerService.initialize(app);

    let successCount = 0;
    let failureCount = 0;

    // Process each team
    for (const team of teams) {
      try {
        console.log(`\n📤 Processing team: ${team.name}`);

        if (type === "reminder") {
          await schedulerService.sendStandupReminders(team);
        } else {
          await schedulerService.sendFollowupReminders(team);
        }

        successCount++;
        console.log(`   ✅ Successfully sent to ${team.name}`);
      } catch (error) {
        failureCount++;
        console.error(`   ❌ Failed for ${team.name}: ${error.message}`);
      }
    }

    // Summary
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 Summary:`);
    console.log(`   - Total teams: ${teams.length}`);
    console.log(`   - Successful: ${successCount}`);
    console.log(`   - Failed: ${failureCount}`);
    console.log(`${"=".repeat(60)}\n`);

    if (failureCount > 0) {
      console.log("⚠️  Some teams failed to receive reminders. Check logs above.");
    } else {
      console.log(`✅ All ${actionType} sent successfully!`);
    }
  } catch (error) {
    console.error("❌ Error sending reminders to all teams:", error.message);
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

  if (!command) {
    console.log(`
📝 Manual Standup Trigger Script

Usage:
  node scripts/triggerStandup.js <command> [options]

Commands:
  list                        - List all active teams
  reminder "<teamName>"       - Send standup reminders to specific team
  reminder --all              - Send standup reminders to all active teams (with confirmation)
  followup "<teamName>"       - Send follow-up reminders to specific team
  followup --all              - Send follow-up reminders to all active teams (with confirmation)

Examples:
  node scripts/triggerStandup.js list
  node scripts/triggerStandup.js reminder "Engineering Team"
  node scripts/triggerStandup.js reminder --all
  node scripts/triggerStandup.js followup "Marketing Team"
  node scripts/triggerStandup.js followup --all

Note:
  - Use quotes around team names that contain spaces
  - --all flag will prompt for confirmation before sending
  - Only teams with active members will receive reminders
    `);
    process.exit(0);
  }

  switch (command) {
    case "list":
      await listTeams();
      break;
    case "reminder": {
      // Check if --all flag is provided
      if (args[1] === "--all") {
        await triggerAllTeamsReminders("reminder");
      } else {
        const teamName = args.slice(1).join(" ");
        if (!teamName) {
          console.error("❌ Team name is required for reminder command");
          console.log("Use --all to send to all teams, or provide a team name");
          process.exit(1);
        }
        await triggerStandupReminder(teamName);
      }
      break;
    }
    case "followup": {
      // Check if --all flag is provided
      if (args[1] === "--all") {
        await triggerAllTeamsReminders("followup");
      } else {
        const teamName = args.slice(1).join(" ");
        if (!teamName) {
          console.error("❌ Team name is required for followup command");
          console.log("Use --all to send to all teams, or provide a team name");
          process.exit(1);
        }
        await triggerFollowupReminder(teamName);
      }
      break;
    }
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
