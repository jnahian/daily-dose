#!/usr/bin/env node

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { isWorkingDay } = require("../src/utils/dateHelper");

dayjs.extend(utc);
dayjs.extend(timezone);

const prisma = new PrismaClient();

async function checkTeamMembers(teamNameOrId = null, date = null) {
  try {
    const checkDate = date ? dayjs(date).toDate() : new Date();

    console.log(
      `🔍 Checking team members for date: ${dayjs(checkDate).format(
        "YYYY-MM-DD"
      )}\n`
    );

    // Get teams to check
    let teams;
    if (teamNameOrId) {
      // Check if it's a UUID (team ID) or team name
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          teamNameOrId
        );

      if (isUUID) {
        teams = await prisma.team.findMany({
          where: { id: teamNameOrId, isActive: true },
          include: { organization: true },
        });
      } else {
        teams = await prisma.team.findMany({
          where: {
            name: { contains: teamNameOrId, mode: "insensitive" },
            isActive: true,
          },
          include: { organization: true },
        });
      }

      if (teams.length === 0) {
        console.log(`❌ No active teams found matching: ${teamNameOrId}`);
        return;
      }
    } else {
      // Get all active teams
      teams = await prisma.team.findMany({
        where: {
          isActive: true,
          organization: { isActive: true },
        },
        include: { organization: true },
      });
    }

    for (const team of teams) {
      console.log(`📋 Team: ${team.name}`);
      console.log(`   Organization: ${team.organization.name}`);
      console.log(
        `   Standup: ${team.standupTime} | Posting: ${team.postingTime}`
      );
      console.log(`   Timezone: ${team.timezone}`);
      console.log(`   Channel ID: ${team.slackChannelId}\n`);

      // Get all team members (without filters)
      const allMembers = await prisma.teamMember.findMany({
        where: {
          teamId: team.id,
          isActive: true,
        },
        include: {
          user: true,
        },
        orderBy: {
          role: "desc", // ADMIN first, then MEMBER
        },
      });

      console.log(`   👥 All Active Members (${allMembers.length}):`);

      if (allMembers.length === 0) {
        console.log(`      ❌ No active members found\n`);
        continue;
      }

      // Check each member's status for the given date
      const startOfDay = dayjs(checkDate).startOf("day").toDate();
      const endOfDay = dayjs(checkDate).endOf("day").toDate();

      for (const member of allMembers) {
        const roleIcon = member.role === "ADMIN" ? "👑" : "👤";
        console.log(
          `      ${roleIcon} ${member.user.name || "Unknown"} (${
            member.user.slackUserId
          })`
        );
        console.log(`         Role: ${member.role}`);

        // Check if on leave
        const leaves = await prisma.leave.findMany({
          where: {
            userId: member.userId,
            AND: [
              { startDate: { lte: endOfDay } },
              { endDate: { gte: startOfDay } },
            ],
          },
        });

        if (leaves.length > 0) {
          console.log(
            `         🏖️  ON LEAVE: ${leaves
              .map(
                (l) =>
                  `${dayjs(l.startDate).format("MMM D")} - ${dayjs(
                    l.endDate
                  ).format("MMM D")}`
              )
              .join(", ")}`
          );
        } else {
          console.log(`         ✅ Not on leave`);
        }

        // Check work day
        try {
          const isWorking = await isWorkingDay(
            checkDate,
            team.organizationId,
            member.userId
          );
          console.log(
            `         ${isWorking ? "💼" : "🏠"} Working day: ${
              isWorking ? "Yes" : "No"
            }`
          );
        } catch (error) {
          console.log(`         ❌ Work day check error: ${error.message}`);
        }

        console.log("");
      }

      // Now get the filtered active members (same logic as scheduler)
      console.log(`   🎯 Active Members for Reminders:`);

      const activeMembers = await prisma.teamMember.findMany({
        where: {
          teamId: team.id,
          isActive: true,
          user: {
            leaves: {
              none: {
                AND: [
                  { startDate: { lte: endOfDay } },
                  { endDate: { gte: startOfDay } },
                ],
              },
            },
          },
        },
        include: {
          user: true,
          team: {
            include: {
              organization: true,
            },
          },
        },
      });

      // Filter by work days
      const finalActiveMembers = [];
      for (const member of activeMembers) {
        try {
          const isWorking = await isWorkingDay(
            checkDate,
            team.organizationId,
            member.userId
          );
          if (isWorking) {
            finalActiveMembers.push(member);
          }
        } catch (error) {
          console.log(
            `      ❌ Error checking work day for ${member.user.slackUserId}: ${error.message}`
          );
        }
      }

      if (finalActiveMembers.length === 0) {
        console.log(`      ❌ No members eligible for reminders\n`);
      } else {
        console.log(
          `      ✅ ${finalActiveMembers.length} member(s) will receive reminders:`
        );
        finalActiveMembers.forEach((member) => {
          const roleIcon = member.role === "ADMIN" ? "👑" : "👤";
          console.log(
            `         ${roleIcon} ${member.user.name || "Unknown"} (${
              member.user.slackUserId
            })`
          );
        });
        console.log("");
      }

      console.log("─".repeat(60) + "\n");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const teamNameOrId = args[0];
const date = args[1];

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
📋 Team Members Checker

Usage:
  node scripts/check-team-members.js [team-name-or-id] [date]

Examples:
  node scripts/check-team-members.js                    # Check all teams for today
  node scripts/check-team-members.js "ShopifyDev"      # Check specific team for today  
  node scripts/check-team-members.js HaJaBaRaLa        # Check team (case insensitive)
  node scripts/check-team-members.js ShopifyDev 2025-09-10  # Check team for specific date
  node scripts/check-team-members.js "" 2025-09-10     # Check all teams for specific date

Parameters:
  team-name-or-id  Team name (partial match, case insensitive) or team UUID
  date            Date in YYYY-MM-DD format (defaults to today)
  
The script shows:
  - All active team members with their roles
  - Leave status for the specified date  
  - Work day status
  - Final list of members who would receive reminders
`);
  process.exit(0);
}

// Run the script
console.log("🚀 Starting team members check...\n");
checkTeamMembers(teamNameOrId, date);
