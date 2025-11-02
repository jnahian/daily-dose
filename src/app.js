require("dotenv").config();
const { App, ExpressReceiver } = require("@slack/bolt");
const path = require("path");
const prisma = require("./config/prisma");
const { setupCommands } = require("./commands");
const { setupWorkflows } = require("./workflows");
const schedulerService = require("./services/schedulerService");
const { basicAuth } = require("./middleware/basicAuth");

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver
});

// Setup commands and workflows
setupCommands(app);
setupWorkflows(app);

// Initialize scheduler
schedulerService.initialize(app);

// Serve static files from public directory
receiver.app.use(require('express').static(path.join(__dirname, '../public')));

// Landing page route
receiver.app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Documentation page route
receiver.app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/docs.html'));
});

// Changelog page route
receiver.app.get('/changelog', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/changelog.html'));
});

// Protected scripts documentation route
receiver.app.get('/scripts-docs', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/scripts-docs.html'));
});

// Health check endpoint
receiver.app.get('/health', (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "daily-dose",
  });
});

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
