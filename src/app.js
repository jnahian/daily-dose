require("dotenv").config();
const { App } = require("@slack/bolt");
const prisma = require("./config/prisma");
const { setupCommands } = require("./commands");
const schedulerService = require("./services/schedulerService");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
});

// Setup commands
setupCommands(app);

// Initialize scheduler
schedulerService.initialize(app);

// Basic health check
app.message("hello", async ({ message, say }) => {
  await say(`Hey there <@${message.user}>! Daily Dose bot is running.`);
});

// Start app
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log("⚡️ Daily Dose bot is running!");
})();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});