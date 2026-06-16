const readline = require("readline");
const prisma = require("../src/config/prisma");

// Hardcoded seed data — review before running.
const SEED = {
  org: {
    name: "Startise",
    slackWorkspaceId: "TD04Y26UB", // Get from Slack
    slackWorkspaceName: "Startise",
    defaultTimezone: "Asia/Dhaka",
    settings: {
      defaultWorkDays: [7, 1, 2, 3, 4], // Mon-Thu, Sun (organization default)
      holidayCountry: "BD",
    },
  },
  admin: {
    slackUserId: "UQS8FT0EN", // Your Slack user ID
    name: "Sh Julkar Naen Nahian",
    username: "nahian.wpdev",
    email: "nahian@wpdeveloper.com",
  },
  testTeam: {
    name: "TestTeam",
    slackChannelId: "C04JPB43NFJ",
    standupTime: "10:00",
    postingTime: "10:30",
    timezone: "Asia/Dhaka",
  },
};

function describeDatabaseTarget() {
  try {
    const url = new URL(process.env.DATABASE_URL || "");
    return `${url.hostname}${url.pathname}`;
  } catch {
    return "(DATABASE_URL not set or unparseable)";
  }
}

// Upserts run against whatever DATABASE_URL points at — require explicit
// confirmation (or --confirm for non-interactive use) so an accidental run
// can't silently write seed data into production.
async function confirmOrAbort() {
  console.log("This will upsert the following into the database:");
  console.log(`  Database:     ${describeDatabaseTarget()}`);
  console.log(
    `  Organization: ${SEED.org.name} (workspace ${SEED.org.slackWorkspaceId})`
  );
  console.log(`  Owner user:   ${SEED.admin.name} (${SEED.admin.slackUserId})`);
  console.log(
    `  Test team:    ${SEED.testTeam.name} (channel ${SEED.testTeam.slackChannelId})`
  );

  if (process.argv.includes("--confirm")) return;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await new Promise((resolve) =>
    rl.question('Proceed? Type "yes" to continue: ', resolve)
  );
  rl.close();

  if (answer.trim().toLowerCase() !== "yes") {
    console.log("Aborted — no changes made.");
    process.exit(0);
  }
}

async function seedOrganization() {
  try {
    await confirmOrAbort();

    // Create or get organization
    const org = await prisma.organization.upsert({
      where: { name: SEED.org.name },
      update: {},
      create: SEED.org,
    });

    console.log("✅ Organization created:", org.name);
    console.log("Organization ID:", org.id);

    // Optionally create initial admin user
    if (SEED.admin.slackUserId) {
      const user = await prisma.user.upsert({
        where: { slackUserId: SEED.admin.slackUserId },
        update: {},
        create: SEED.admin,
      });

      await prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: user.id,
          },
        },
        update: {},
        create: {
          organizationId: org.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      console.log("✅ Admin user added");

      // Test team creation with time format
      try {
        const testTeam = await prisma.team.upsert({
          where: { slackChannelId: SEED.testTeam.slackChannelId },
          update: {},
          create: {
            organizationId: org.id,
            ...SEED.testTeam,
          },
        });
        console.log("✅ Test team created:", testTeam.name);
      } catch (teamError) {
        console.error("Error creating test team:", teamError);
      }
    }
  } catch (error) {
    console.error("Error seeding organization:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedOrganization();
