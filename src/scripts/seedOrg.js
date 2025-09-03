const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function seedOrganization() {
  try {
    // Create organization
    const org = await prisma.organization.create({
      data: {
        name: "Your Company Name",
        slackWorkspaceId: "T0123ABCD", // Get from Slack
        slackWorkspaceName: "your-workspace",
        defaultTimezone: "America/New_York",
        settings: {
          workDays: [1, 2, 3, 4, 5], // Mon-Fri
          holidayCountry: "US",
          standupWindowMinutes: 30,
        },
      },
    });

    console.log("✅ Organization created:", org.name);
    console.log("Organization ID:", org.id);

    // Optionally create initial admin user
    const adminSlackId = "U0123ADMIN"; // Your Slack user ID
    if (adminSlackId) {
      const user = await prisma.user.upsert({
        where: { slackUserId: adminSlackId },
        update: {},
        create: {
          slackUserId: adminSlackId,
          name: "Admin Name",
          email: "admin@company.com",
        },
      });

      await prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      console.log("✅ Admin user added");
    }
  } catch (error) {
    console.error("Error seeding organization:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedOrganization();
