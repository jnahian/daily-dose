require("dotenv").config();
const { App } = require("@slack/bolt");
const prisma = require("./config/prisma");
const { setupCommands } = require("./commands");
const { setupWorkflows } = require("./workflows");
const schedulerService = require("./services/schedulerService");
const {
  logCommandMiddleware,
  logMessageMiddleware,
  logEventMiddleware,
  logActionMiddleware,
  logViewMiddleware,
} = require("./middleware/logging");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
});

// Setup global logging middleware
app.use(logCommandMiddleware());
app.use(logMessageMiddleware());
app.use(logEventMiddleware());
app.use(logActionMiddleware());
app.use(logViewMiddleware());

console.log("✅ Global logging middleware enabled");

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
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || "localhost";
  await app.start(port);
  console.log(`⚡️ Daily Dose bot is running on ${host}:${port}`);
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
