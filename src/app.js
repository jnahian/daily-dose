require("dotenv").config();
require("./config/sentry").init();
const { App, ExpressReceiver } = require("@slack/bolt");
const path = require("path");
const prisma = require("./config/prisma");
const { setupCommands } = require("./commands");
const { setupWorkflows } = require("./workflows");
const { setupEvents } = require("./events");
const schedulerService = require("./services/schedulerService");

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
setupEvents(app);

// Initialize scheduler
schedulerService.initialize(app);

// Health check endpoint - must be before static files to avoid SPA fallback
receiver.app.get('/health', (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "daily-dose",
  });
});

// Serve static files from web/dist directory (React SPA)
const express = require('express');

// Gate the /scripts route at the server level before the SPA fallback can
// hand out index.html to an unauthenticated user. The middleware factory
// throws at startup if SCRIPTS_AUTH_USERNAME / SCRIPTS_AUTH_PASSWORD are
// not set.
const { createBasicAuth } = require('./middleware/basicAuth');
const scriptsAuth = createBasicAuth();
receiver.app.use('/scripts', scriptsAuth);

receiver.app.use(express.static(path.join(__dirname, '../web/dist')));

// SPA fallback - serve index.html for all other routes (client-side routing)
receiver.app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../web/dist/index.html'));
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
