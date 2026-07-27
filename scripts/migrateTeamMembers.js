#!/usr/bin/env node

require("dotenv").config();
const prisma = require("../src/config/prisma");
const readline = require("readline");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

async function findTeam(nameOrId) {
  if (UUID_RE.test(nameOrId)) {
    return prisma.team.findFirst({
      where: { id: nameOrId, isActive: true },
      include: { organization: true },
    });
  }

  return prisma.team.findFirst({
    where: { name: { equals: nameOrId, mode: "insensitive" }, isActive: true },
    include: { organization: true },
  });
}

async function migrateTeamMembers(sourceNameOrId, targetNameOrId, options) {
  try {
    console.log(`🔍 Looking for source team: ${sourceNameOrId}...`);
    const sourceTeam = await findTeam(sourceNameOrId);
    if (!sourceTeam) {
      console.log(`❌ No active team found matching: ${sourceNameOrId}`);
      return;
    }
    console.log(
      `✅ Source team: ${sourceTeam.name} (${sourceTeam.organization.name})`
    );

    console.log(`🔍 Looking for target team: ${targetNameOrId}...`);
    const targetTeam = await findTeam(targetNameOrId);
    if (!targetTeam) {
      console.log(`❌ No active team found matching: ${targetNameOrId}`);
      return;
    }
    console.log(
      `✅ Target team: ${targetTeam.name} (${targetTeam.organization.name})`
    );

    if (sourceTeam.id === targetTeam.id) {
      console.log("❌ Source and target team are the same team.");
      return;
    }

    const crossOrg = sourceTeam.organizationId !== targetTeam.organizationId;
    if (crossOrg && !options.allowCrossOrg) {
      console.log(
        `❌ Source team "${sourceTeam.name}" and target team "${targetTeam.name}" belong to different organizations.\n` +
          `   Re-run with --allow-cross-org to migrate anyway (missing target org membership will be created).`
      );
      return;
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId: sourceTeam.id, isActive: true },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    });

    if (members.length === 0) {
      console.log(`ℹ️  No active members found on team: ${sourceTeam.name}`);
      return;
    }

    console.log(
      `\n👥 ${members.length} active member(s) on "${sourceTeam.name}":`
    );
    members.forEach((member) => {
      const roleIcon = member.role === "ADMIN" ? "👑" : "👤";
      console.log(
        `   ${roleIcon} ${member.user.name || "Unknown"} (${member.user.slackUserId}) - ${member.role}`
      );
    });

    const existingTargetMembers = await prisma.teamMember.findMany({
      where: {
        teamId: targetTeam.id,
        isActive: true,
        userId: { in: members.map((member) => member.userId) },
      },
    });
    const alreadyOnTargetIds = new Set(
      existingTargetMembers.map((member) => member.userId)
    );

    const toMigrate = members.filter(
      (member) => !alreadyOnTargetIds.has(member.userId)
    );
    const alreadyOnTarget = members.filter((member) =>
      alreadyOnTargetIds.has(member.userId)
    );

    if (alreadyOnTarget.length > 0) {
      console.log(
        `\nℹ️  ${alreadyOnTarget.length} member(s) already active on target team (won't be duplicated):`
      );
      alreadyOnTarget.forEach((member) =>
        console.log(
          `   - ${member.user.name || "Unknown"} (${member.user.slackUserId})`
        )
      );
    }

    console.log(
      `\n📦 Plan: add ${toMigrate.length} member(s) to "${targetTeam.name}"` +
        `${options.keepSource ? "" : `, then remove all ${members.length} of them from "${sourceTeam.name}"`}.`
    );

    if (options.dryRun) {
      console.log("\n🧪 Dry run - no changes made.");
      return;
    }

    if (!options.yes) {
      const confirmed = await confirmAction(
        `\nProceed with migrating members from "${sourceTeam.name}" to "${targetTeam.name}"?`
      );
      if (!confirmed) {
        console.log("❌ Migration cancelled.");
        return;
      }
    }

    if (crossOrg) {
      for (const member of members) {
        const orgMember = await prisma.organizationMember.findFirst({
          where: {
            organizationId: targetTeam.organizationId,
            userId: member.userId,
          },
        });

        if (!orgMember) {
          await prisma.organizationMember.create({
            data: {
              organizationId: targetTeam.organizationId,
              userId: member.userId,
              role: "MEMBER",
            },
          });
          console.log(
            `   ➕ Added ${member.user.slackUserId} to organization "${targetTeam.organization.name}"`
          );
        } else if (!orgMember.isActive) {
          await prisma.organizationMember.update({
            where: { id: orgMember.id },
            data: { isActive: true, deletedAt: null },
          });
        }
      }
    }

    let migrated = 0;
    let removed = 0;
    let errors = 0;

    for (const member of toMigrate) {
      try {
        await prisma.$transaction(async (tx) => {
          const existing = await tx.teamMember.findUnique({
            where: {
              teamId_userId: { teamId: targetTeam.id, userId: member.userId },
            },
          });

          if (existing) {
            await tx.teamMember.update({
              where: { id: existing.id },
              data: {
                isActive: true,
                deletedAt: null,
                role: options.resetRole ? "MEMBER" : member.role,
                receiveNotifications: member.receiveNotifications,
                hideFromNotResponded: member.hideFromNotResponded,
              },
            });
          } else {
            await tx.teamMember.create({
              data: {
                teamId: targetTeam.id,
                userId: member.userId,
                role: options.resetRole ? "MEMBER" : member.role,
                receiveNotifications: member.receiveNotifications,
                hideFromNotResponded: member.hideFromNotResponded,
              },
            });
          }

          if (!options.keepSource) {
            await tx.teamMember.update({
              where: { id: member.id },
              data: { isActive: false, deletedAt: new Date() },
            });
          }
        });

        migrated++;
        if (!options.keepSource) removed++;
        console.log(
          `   ✅ Migrated ${member.user.name || member.user.slackUserId}`
        );
      } catch (error) {
        errors++;
        console.log(
          `   ❌ Failed to migrate ${member.user.slackUserId}: ${error.message}`
        );
      }
    }

    if (!options.keepSource && alreadyOnTarget.length > 0) {
      for (const member of alreadyOnTarget) {
        try {
          await prisma.teamMember.update({
            where: { id: member.id },
            data: { isActive: false, deletedAt: new Date() },
          });
          removed++;
          console.log(
            `   ✅ Removed ${member.user.slackUserId} from source (already on target)`
          );
        } catch (error) {
          errors++;
          console.log(
            `   ❌ Failed to remove ${member.user.slackUserId} from source: ${error.message}`
          );
        }
      }
    }

    console.log(
      `\n🎉 Migration complete: ${migrated} added to "${targetTeam.name}", ${removed} removed from "${sourceTeam.name}", ${errors} error(s).`
    );
  } catch (error) {
    console.error("❌ Error migrating team members:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith("--"));
const sourceNameOrId = positional[0];
const targetNameOrId = positional[1];

const options = {
  dryRun: args.includes("--dry-run"),
  keepSource: args.includes("--keep-source"),
  resetRole: args.includes("--reset-role"),
  allowCrossOrg: args.includes("--allow-cross-org"),
  yes: args.includes("--yes") || args.includes("-y"),
};

if (
  args.includes("--help") ||
  args.includes("-h") ||
  !sourceNameOrId ||
  !targetNameOrId
) {
  console.log(`
🚚 Team Member Migration Script

Usage:
  node scripts/migrateTeamMembers.js <source-team> <target-team> [options]

Examples:
  node scripts/migrateTeamMembers.js "Old Team" "New Team" --dry-run
  node scripts/migrateTeamMembers.js "Old Team" "New Team"
  node scripts/migrateTeamMembers.js "Old Team" "New Team" --keep-source
  node scripts/migrateTeamMembers.js "Old Team" "New Team" --reset-role --yes
  node scripts/migrateTeamMembers.js "550e8400-e29b-41d4-a716-446655440000" "New Team"

Parameters:
  source-team   Team name (exact match, case insensitive) or team UUID to migrate members from
  target-team   Team name (exact match, case insensitive) or team UUID to migrate members to

Options:
  --dry-run          Preview the migration without making any changes
  --keep-source       Copy members to the target team instead of moving them (keeps source membership active)
  --reset-role        Add every migrated member to the target team as MEMBER, ignoring their source role
  --allow-cross-org   Allow migrating between teams in different organizations (creates target org membership if missing)
  --yes, -y           Skip the confirmation prompt

Description:
  This script moves all active members of the source team to the target team:
  - Finds active TeamMember records for the source team
  - Creates (or reactivates) the matching TeamMember record on the target team,
    preserving role, receiveNotifications, and hideFromNotResponded by default
  - Deactivates (soft-deletes) the source team membership, unless --keep-source is passed
  - Members already active on the target team are not duplicated
  - Historical standup data (responses, posts) is left untouched — only team membership moves

Note:
  - Source and target teams must be different active teams
  - By default, teams must belong to the same organization; use --allow-cross-org to override
`);
  process.exit(0);
}

console.log("🚀 Starting team member migration...\n");
migrateTeamMembers(sourceNameOrId, targetNameOrId, options);
