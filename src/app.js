require("dotenv").config();

// Initialize Sentry first, before any other imports
const { initializeSentry } = require("./config/sentry");
initializeSentry();

const { App } = require("@slack/bolt");
const prisma = require("./config/prisma");
const { setupCommands } = require("./commands");
const { setupWorkflows } = require("./workflows");
const schedulerService = require("./services/schedulerService");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
});

// Setup commands and workflows
setupCommands(app);
setupWorkflows(app);

// Initialize scheduler
schedulerService.initialize(app);

// Basic health check
app.message("hello", async ({ message, say }) => {
  await say(`Hey there <@${message.user}>! Daily Dose bot is running.`);
});

// Start app
(async () => {
  try {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || "localhost";
    await app.start(port);
    console.log(`⚡️ Daily Dose bot is running on ${host}:${port}`);
  } catch (error) {
    console.error("Failed to start the app:", error);

    // Log to Sentry if available
    const Sentry = require("@sentry/node");
    if (Sentry.getCurrentHub().getClient()) {
      Sentry.captureException(error);
      await Sentry.flush(2000);
    }

    process.exit(1);
  }
})();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  await prisma.$disconnect();

  // Close Sentry client
  const Sentry = require("@sentry/node");
  const client = Sentry.getCurrentHub().getClient();
  if (client) {
    await client.close(2000);
  }

  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  await prisma.$disconnect();

  // Close Sentry client
  const Sentry = require("@sentry/node");
  const client = Sentry.getCurrentHub().getClient();
  if (client) {
    await client.close(2000);
  }

  process.exit(0);
});
