const Sentry = require("@sentry/node");

let initialized = false;
let client = null;

function init() {
  if (initialized) return client;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    initialized = true;
    return null;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.npm_package_version || undefined,
    tracesSampleRate: 0,
  });

  client = {
    captureException: (err, hint) => Sentry.captureException(err, hint),
    captureMessage: (msg, level) => Sentry.captureMessage(msg, level),
  };
  initialized = true;
  return client;
}

function getClient() {
  return client;
}

module.exports = { init, getClient };
