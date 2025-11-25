require("dotenv").config();
const { App } = require("@slack/bolt");
const prisma = require("../src/config/prisma");

/**
 * Script to add a new organization admin user
 * Usage: node scripts/addOrgAdmin.js <slack-user-id> [organization-name]
 * 
 * Example:
 *   node scripts/addOrgAdmin.js U123456789
 *   node scripts/addOrgAdmin.js U123456789 "Startise"
 */

async function addOrgAdmin() {
    try {
        // Get command line arguments
        const slackUserId = process.argv[2];
        const orgName = process.argv[3];

        if (!slackUserId) {
            console.error("❌ Error: Slack user ID is required");
            console.log("Usage: node scripts/addOrgAdmin.js <slack-user-id> [organization-name]");
            process.exit(1);
        }

        // Initialize Slack client
        const app = new App({
            token: process.env.SLACK_BOT_TOKEN,
            signingSecret: process.env.SLACK_SIGNING_SECRET,
        });

        console.log(`\n🔍 Fetching user data from Slack for: ${slackUserId}`);

        // Fetch user info from Slack
        let slackUserData = {};
        try {
            const slackUserInfo = await app.client.users.info({
                token: process.env.SLACK_BOT_TOKEN,
                user: slackUserId,
            });

            if (slackUserInfo.ok && slackUserInfo.user) {
                const slackUser = slackUserInfo.user;
                slackUserData = {
                    name: slackUser.real_name || slackUser.name,
                    username: slackUser.name,
                    email: slackUser.profile?.email,
                    timezone: slackUser.tz || slackUser.profile?.timezone || process.env.DEFAULT_TIMEZONE || "America/New_York",
                };

                console.log("✅ User data fetched from Slack:");
                console.log(`   Name: ${slackUserData.name}`);
                console.log(`   Username: ${slackUserData.username}`);
                console.log(`   Email: ${slackUserData.email || "N/A"}`);
                console.log(`   Timezone: ${slackUserData.timezone}`);
            } else {
                console.error("❌ Failed to fetch user info from Slack");
                process.exit(1);
            }
        } catch (error) {
            console.error("❌ Error fetching user from Slack:", error.message);
            process.exit(1);
        }

        // Get or create organization
        let organization;
        if (orgName) {
            // Find organization by name
            organization = await prisma.organization.findUnique({
                where: { name: orgName },
            });

            if (!organization) {
                console.error(`❌ Organization "${orgName}" not found`);
                console.log("\nAvailable organizations:");
                const orgs = await prisma.organization.findMany({
                    select: { name: true, id: true },
                });
                orgs.forEach((org) => console.log(`   - ${org.name} (${org.id})`));
                process.exit(1);
            }
        } else {
            // Get workspace info to find/create organization
            try {
                const teamInfo = await app.client.team.info({
                    token: process.env.SLACK_BOT_TOKEN,
                });

                if (teamInfo.ok && teamInfo.team) {
                    const workspaceId = teamInfo.team.id;
                    const workspaceName = teamInfo.team.name;

                    console.log(`\n🏢 Workspace: ${workspaceName} (${workspaceId})`);

                    // Find or create organization
                    organization = await prisma.organization.upsert({
                        where: { slackWorkspaceId: workspaceId },
                        update: {},
                        create: {
                            name: workspaceName,
                            slackWorkspaceId: workspaceId,
                            slackWorkspaceName: workspaceName,
                            defaultTimezone: slackUserData.timezone,
                        },
                    });

                    console.log(`✅ Organization: ${organization.name}`);
                } else {
                    console.error("❌ Failed to fetch workspace info from Slack");
                    process.exit(1);
                }
            } catch (error) {
                console.error("❌ Error fetching workspace info:", error.message);
                process.exit(1);
            }
        }

        // Create or update user
        console.log("\n👤 Creating/updating user in database...");
        const user = await prisma.user.upsert({
            where: { slackUserId },
            update: {
                name: slackUserData.name,
                username: slackUserData.username,
                email: slackUserData.email,
                timezone: slackUserData.timezone,
            },
            create: {
                slackUserId,
                name: slackUserData.name,
                username: slackUserData.username,
                email: slackUserData.email,
                timezone: slackUserData.timezone,
            },
        });

        console.log(`✅ User created/updated: ${user.name} (${user.id})`);

        // Add user to organization as ADMIN
        console.log("\n🔐 Adding user to organization as ADMIN...");
        const orgMember = await prisma.organizationMember.upsert({
            where: {
                organizationId_userId: {
                    organizationId: organization.id,
                    userId: user.id,
                },
            },
            update: {
                role: "ADMIN",
                isActive: true,
            },
            create: {
                organizationId: organization.id,
                userId: user.id,
                role: "ADMIN",
                isActive: true,
            },
        });

        console.log(`✅ User added to organization as ADMIN`);

        // Display summary
        console.log("\n" + "=".repeat(60));
        console.log("✅ SUCCESS - Organization Admin Added");
        console.log("=".repeat(60));
        console.log(`Organization: ${organization.name}`);
        console.log(`User: ${user.name} (@${user.username})`);
        console.log(`Email: ${user.email || "N/A"}`);
        console.log(`Role: ADMIN`);
        console.log(`User ID: ${user.id}`);
        console.log(`Slack User ID: ${user.slackUserId}`);
        console.log("=".repeat(60) + "\n");

    } catch (error) {
        console.error("\n❌ Error adding organization admin:", error);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

addOrgAdmin();
