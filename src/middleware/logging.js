const {
  logCommand,
  logMessage,
  logEvent,
  logAction,
  logView,
} = require("../utils/logger");

/**
 * Middleware to log all incoming commands
 */
function logCommandMiddleware() {
  return async ({ command, next }) => {
    logCommand(command);
    await next();
  };
}

/**
 * Middleware to log all incoming messages
 */
function logMessageMiddleware() {
  return async ({ message, next }) => {
    logMessage(message);
    await next();
  };
}

/**
 * Middleware to log all incoming events
 */
function logEventMiddleware() {
  return async ({ event, next }) => {
    logEvent(event.type, event);
    await next();
  };
}

/**
 * Middleware to log all button/action interactions
 */
function logActionMiddleware() {
  return async ({ action, body, next }) => {
    logAction(action);
    await next();
  };
}

/**
 * Middleware to log all view submissions
 */
function logViewMiddleware() {
  return async ({ view, body, next }) => {
    logView(view);
    await next();
  };
}

module.exports = {
  logCommandMiddleware,
  logMessageMiddleware,
  logEventMiddleware,
  logActionMiddleware,
  logViewMiddleware,
};
