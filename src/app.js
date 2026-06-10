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
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

// Setup commands and workflows
setupCommands(app);
setupWorkflows(app);
setupEvents(app);

// Initialize scheduler
schedulerService.initialize(app);

// Health check endpoint - must be before static files to avoid SPA fallback
receiver.app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "daily-dose",
  });
});

// Serve static files from web/dist directory (React SPA)
const express = require("express");
const logger = require("./utils/logger");
const { createContactNotificationBlocks } = require("./utils/blockHelper");

// --- Contact form endpoint ---------------------------------------------
// Forwards website contact-form submissions to the Slack channel (or user
// DM) configured via CONTACT_SLACK_CHANNEL. Unauthenticated and public, so
// inputs are length-capped and rate-limited per IP.
const CONTACT_LIMITS = { name: 200, email: 320, subject: 200, message: 2900 };
const CONTACT_RATE_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_RATE_MAX = 5;
const contactHits = new Map(); // ip -> [timestamps]

function isContactRateLimited(ip) {
  const now = Date.now();
  const hits = (contactHits.get(ip) || []).filter(
    (t) => now - t < CONTACT_RATE_WINDOW_MS
  );
  if (hits.length >= CONTACT_RATE_MAX) return true;
  hits.push(now);
  contactHits.set(ip, hits);
  // Opportunistic prune so the map can't grow unbounded.
  if (contactHits.size > 1000) {
    for (const [key, stamps] of contactHits) {
      if (stamps.every((t) => now - t >= CONTACT_RATE_WINDOW_MS)) {
        contactHits.delete(key);
      }
    }
  }
  return false;
}

receiver.app.post(
  "/api/contact",
  express.json({ limit: "16kb" }),
  (req, res) => {
    (async () => {
      const channel = process.env.CONTACT_SLACK_CHANNEL;
      if (!channel) {
        return res.status(503).json({
          error:
            "Contact form is not configured. Please open an issue on GitHub instead.",
        });
      }

      if (isContactRateLimited(req.ip)) {
        return res
          .status(429)
          .json({ error: "Too many messages. Please try again later." });
      }

      const fields = {};
      for (const [field, max] of Object.entries(CONTACT_LIMITS)) {
        const value = req.body?.[field];
        if (typeof value !== "string" || value.trim().length === 0) {
          return res.status(400).json({ error: `Missing field: ${field}` });
        }
        if (value.length > max) {
          return res.status(400).json({
            error: `Field too long: ${field} (max ${max} characters)`,
          });
        }
        fields[field] = value.trim();
      }

      await app.client.chat.postMessage({
        channel,
        text: `📬 Contact form: ${fields.subject} — from ${fields.name} (${fields.email})`,
        blocks: createContactNotificationBlocks(fields),
      });

      res.status(200).json({ ok: true });
    })().catch((error) => {
      logger.error("Contact form submission failed:", error);
      res.status(500).json({
        error: "Failed to send your message. Please try again later.",
      });
    });
  }
);

// Gate the /scripts route at the server level before the SPA fallback can
// hand out index.html to an unauthenticated user. The middleware factory
// throws at startup if SCRIPTS_AUTH_USERNAME / SCRIPTS_AUTH_PASSWORD are
// not set.
const { createBasicAuth } = require("./middleware/basicAuth");
const scriptsAuth = createBasicAuth();
receiver.app.use("/scripts", scriptsAuth);

receiver.app.use(express.static(path.join(__dirname, "../web/dist")));

// SPA fallback - serve index.html for all other routes (client-side routing)
receiver.app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../web/dist/index.html"));
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
