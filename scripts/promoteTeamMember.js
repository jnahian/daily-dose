#!/usr/bin/env node

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function promoteTeamMember(teamNameOrId, slackUserId) {
  try {
    console.log(`🔍 Looking for team: ${teamNameOrId}...`);

    // Find the team
    let team;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamNameOrId);

    if (isUUID) {
      team = await prisma.team.findFirst({
        where: { id: teamNameOrId, isActive: true },
        include: { organization: true },
      });
    } else {
      team = await prisma.team.findFirst({
        where: {
          name: { contains: teamNameOrId, mode: "insensitive" },
          isActive: true,
        },
        include: { organization: true },
      });
    }

    if (!team) {
      console.log(`❌ No active team found matching: ${teamNameOrId}`);
      return;
    }

    console.log(`✅ Found team: ${team.name} (${team.organization.name})`);

    // Find the user
    console.log(`🔍 Looking for user: ${slackUserId}...`);
    const user = await prisma.user.findUnique({
      where: { slackUserId: slackUserId },
    });

    if (!user) {
      console.log(`❌ No user found with Slack ID: ${slackUserId}`);
      return;
    }

    console.log(`✅ Found user: ${user.name || "Unknown"} (${user.slackUserId})`);

    // Check if user is a member of the team
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId: team.id,
        userId: user.id,
        isActive: true,
      },
    });

    if (!teamMember) {
      console.log(`❌ User is not an active member of team: ${team.name}`);
      return;
    }

    // Check current role
    if (teamMember.role === 'ADMIN') {
      console.log(`ℹ️  User is already an admin of team: ${team.name}`);
      return;
    }

    console.log(`🔄 Promoting user from ${teamMember.role} to ADMIN...`);

    // Promote to admin
    const updatedMember = await prisma.teamMember.update({
      where: { id: teamMember.id },
      data: { role: 'ADMIN' },
      include: {
        user: true,
        team: {
          include: {
            organization: true,
          },
        },
      },
    });

    console.log(`🎉 Successfully promoted user to team admin!`);
    console.log(`   👑 ${updatedMember.user.name || "Unknown"} (${updatedMember.user.slackUserId})`);
    console.log(`   📋 Team: ${updatedMember.team.name}`);
    console.log(`   🏢 Organization: ${updatedMember.team.organization.name}`);
    console.log(`   📅 Updated at: ${new Date().toISOString()}`);

    // Show current team admins
    console.log(`\n👥 Current team admins:`);
    const allAdmins = await prisma.teamMember.findMany({
      where: {
        teamId: team.id,
        isActive: true,
        role: 'ADMIN',
      },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });

    allAdmins.forEach((admin, index) => {
      console.log(`   ${index + 1}. 👑 ${admin.user.name || "Unknown"} (${admin.user.slackUserId})`);
    });

  } catch (error) {
    console.error("❌ Error promoting team member:", error);
    
    if (error.code === 'P2025') {
      console.log("💡 This usually means the record was not found or has been deleted.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const teamNameOrId = args[0];
const slackUserId = args[1];

if (args.includes("--help") || args.includes("-h") || !teamNameOrId || !slackUserId) {
  console.log(`
👑 Team Member Promotion Script

Usage:
  node scripts/promoteTeamMember.js <team-name-or-id> <slack-user-id>

Examples:
  node scripts/promoteTeamMember.js "ShopifyDev" "U1234567890"
  node scripts/promoteTeamMember.js HaJaBaRaLa U9876543210
  node scripts/promoteTeamMember.js "550e8400-e29b-41d4-a716-446655440000" U1111111111

Parameters:
  team-name-or-id  Team name (partial match, case insensitive) or team UUID
  slack-user-id    Slack user ID (e.g., U1234567890)

Description:
  This script promotes a team member to team admin role.
  - Finds the specified team and user
  - Verifies the user is an active team member  
  - Updates their role from MEMBER to ADMIN
  - Shows confirmation and current list of team admins

Note:
  - The user must already be an active member of the team
  - If the user is already an admin, the script will notify and exit
  - Only works with active teams and users
`);
  process.exit(0);
}

// Run the script
console.log("🚀 Starting team member promotion...\n");
promoteTeamMember(teamNameOrId, slackUserId);