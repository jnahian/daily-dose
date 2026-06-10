/**
 * Logging utility for Daily Dose bot.
 * Levels: debug < info < warn < error. Set with LOG_LEVEL env var.
 * logger.error() also forwards to Sentry when src/config/sentry.js is wired.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function resolveThreshold() {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase();
  return LEVELS[raw] ?? LEVELS.info;
}

const THRESHOLD = resolveThreshold();

function shouldEmit(level) {
  return LEVELS[level] >= THRESHOLD;
}

function emit(level, args, sink) {
  if (!shouldEmit(level)) return;
  // Timestamp intentionally omitted — PM2 prepends one line-level timestamp
  // (ecosystem.config.js `time: true`). Emitting another here double-stamps.
  const prefix = `[${level.toUpperCase()}]`;
  if (typeof args[0] === "string") {
    sink(prefix + " " + args[0], ...args.slice(1));
  } else {
    sink(prefix, ...args);
  }
}

function debug(...args) {
  emit("debug", args, console.log);
}
function info(...args) {
  emit("info", args, console.log);
}
function warn(...args) {
  emit("warn", args, console.warn);
}

function error(...args) {
  emit("error", args, console.error);
  // Forward Error instances to Sentry if it's wired up. Lazy-required so
  // logger.js stays usable in tests that don't init Sentry.
  try {
    const sentry = require("../config/sentry");
    const client = sentry.getClient && sentry.getClient();
    if (client) {
      const err = args.find((a) => a instanceof Error);
      if (err) client.captureException(err);
    }
  } catch {
    // Sentry module not present or not initialized — ignore.
  }
}

// --- existing typed loggers (preserved) ---

// Command text is user input and can contain anything a user pastes into a
// slash command (including, by accident, sensitive data). Keep only a short
// prefix at the default log level so logs stay useful for debugging without
// retaining full payloads; the complete text is available at debug level.
const COMMAND_TEXT_LOG_MAX = 100;

function truncateCommandText(text) {
  if (typeof text !== "string") return text;
  if (text.length <= COMMAND_TEXT_LOG_MAX) return text;
  return `${text.slice(0, COMMAND_TEXT_LOG_MAX)}… (${text.length} chars)`;
}

function logCommand(payload) {
  if (!payload) {
    info("COMMAND: null payload");
    return;
  }
  info(`COMMAND ${payload.command || "unknown"}`, {
    user_id: payload.user_id,
    user_name: payload.user_name,
    channel_id: payload.channel_id,
    channel_name: payload.channel_name,
    team_id: payload.team_id,
    text: truncateCommandText(payload.text),
    trigger_id: payload.trigger_id,
  });
  if (
    typeof payload.text === "string" &&
    payload.text.length > COMMAND_TEXT_LOG_MAX
  ) {
    debug(`COMMAND ${payload.command || "unknown"} full text:`, payload.text);
  }
}

function logMessage(message) {
  info("MESSAGE:", {
    type: message.type,
    user: message.user,
    channel: message.channel,
    text: message.text,
    ts: message.ts,
    team: message.team,
    subtype: message.subtype,
  });
}

function logEvent(eventType, payload) {
  info("EVENT:", {
    type: eventType,
    user: payload.user?.id || payload.user,
    channel: payload.channel?.id || payload.channel,
    team: payload.team?.id || payload.team,
    trigger_id: payload.trigger_id,
    action_id: payload.action_id,
    callback_id: payload.callback_id,
    view_id: payload.view?.id,
  });
}

function logAction(action) {
  info("ACTION:", {
    action_id: action.action_id,
    block_id: action.block_id,
    type: action.type,
    value: action.value,
    selected_option: action.selected_option,
    user: action.user?.id,
    trigger_id: action.trigger_id,
  });
}

function logView(view) {
  info("VIEW:", {
    callback_id: view.callback_id,
    type: view.type,
    id: view.id,
    team_id: view.team_id,
    state: Object.keys(view.state?.values || {}),
  });
}

module.exports = {
  debug,
  info,
  warn,
  error,
  logCommand,
  logMessage,
  logEvent,
  logAction,
  logView,
};
