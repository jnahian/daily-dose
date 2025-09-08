/**
 * Logging utility for Daily Dose bot
 * Provides structured logging for commands, messages, and events
 */

function formatTimestamp() {
  return new Date().toISOString();
}

function logCommand(payload) {
  console.log(`[${formatTimestamp()}] COMMAND:`, {
    command: payload.command,
    user_id: payload.user_id,
    user_name: payload.user_name,
    channel_id: payload.channel_id,
    channel_name: payload.channel_name,
    team_id: payload.team_id,
    text: payload.text,
    trigger_id: payload.trigger_id,
  });
}

function logMessage(message) {
  console.log(`[${formatTimestamp()}] MESSAGE:`, {
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
  console.log(`[${formatTimestamp()}] EVENT:`, {
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
  console.log(`[${formatTimestamp()}] ACTION:`, {
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
  console.log(`[${formatTimestamp()}] VIEW:`, {
    callback_id: view.callback_id,
    type: view.type,
    id: view.id,
    team_id: view.team_id,
    state: Object.keys(view.state?.values || {}),
  });
}

module.exports = {
  logCommand,
  logMessage,
  logEvent,
  logAction,
  logView,
};
