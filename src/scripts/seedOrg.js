const prisma = require("../config/prisma");

async function seedOrganization() {
  try {
    // Create or get organization
    const org = await prisma.organization.upsert({
      where: { name: "Startise" },
      update: {},
      create: {
        name: "Startise",
        slackWorkspaceId: "startise", // Get from Slack
        slackWorkspaceName: "Startise",
        defaultTimezone: "Asia/Dhaka",
        settings: {
          defaultWorkDays: [1, 2, 3, 4, 7], // Mon-Thu, Sun (organization default)
          holidayCountry: "BD",
          standupWindowMinutes: 30,
        },
      },
    });

    console.log("✅ Organization created:", org.name);
    console.log("Organization ID:", org.id);

    // Optionally create initial admin user
    const adminSlackId = "UQS8FT0EN"; // Your Slack user ID
    if (adminSlackId) {
      const user = await prisma.user.upsert({
        where: { slackUserId: adminSlackId },
        update: {},
        create: {
          slackUserId: adminSlackId,
          name: "Sh Julkar Naen Nahian",
          email: "nahian@wpdeveloper.com",
        },
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
          where: { slackChannelId: "C04JPB43NFJ" },
          update: {},
          create: {
            organizationId: org.id,
            name: "TestTeam",
            slackChannelId: "C04JPB43NFJ",
            standupTime: "10:00",
            postingTime: "10:30",
            timezone: "Asia/Dhaka"
          }
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
