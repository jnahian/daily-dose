/**
 * Utility functions for handling Slack commands with processing indicators
 */

/**
 * Remove Slack formatting from text input
 * Removes bold (*text*), italic (_text_), code (`text`), links (<url|text>),
 * user mentions (<@USER123>), channel mentions (<#CHANNEL123>), and other formatting
 * Preserves: letters, numbers, spaces, hyphens (-), colons (:), periods (.), commas (,), underscores (_), forward slashes (/)
 * @param {string} text - Text that may contain Slack formatting
 * @returns {string} Clean text without formatting
 */
function removeFormatting(text) {
  if (!text || typeof text !== "string") return "";

  return (
    text
      // Remove code blocks first (```text```) - match any content between triple backticks
      .replace(/```[\s\S]*?```/g, "")
      // Remove inline code formatting (`text`)
      .replace(/`([^`]+)`/g, "$1")
      // Remove bold formatting (*text*)
      .replace(/\*([^*]+)\*/g, "$1")
      // Remove italic formatting (_text_)
      .replace(/_([^_]+)_/g, "$1")
      // Remove strikethrough formatting (~text~)
      .replace(/~([^~]+)~/g, "$1")
      // Remove links (<url|text> -> text, <url> -> url)
      .replace(/<([^|>]+)\|([^>]+)>/g, "$2")
      .replace(/<([^>]+)>/g, "$1")
      // Remove user mentions (<@USER123> -> USER123)
      .replace(/<@([^>]+)>/g, "$1")
      // Remove channel mentions (<#CHANNEL123> -> CHANNEL123)
      .replace(/<#([^>]+)>/g, "$1")
      // Remove special characters, keeping only letters, numbers, spaces, hyphens, colons, periods, commas, and forward slashes
      .replace(/[^\w\s\-.:,/]/g, "")
      .trim()
  );
}

/**
 * Middleware to remove formatting from command text before passing to handlers
 * @param {Function} handler - The original command handler function
 * @returns {Function} Wrapped handler with formatting removal
 */
function withFormattingRemoval(handler) {
  return async (args) => {
    // Clean the command text if it exists
    if (args.command && args.command.text) {
      args.command.text = removeFormatting(args.command.text);
    }

    // Call the original handler with cleaned args
    return handler(args);
  };
}

/**
 * Simple approach: Always acknowledge immediately, then send response
 * This ensures users always see immediate feedback
 * @param {Object} ack - Slack ack function
 * @param {Object} respond - Slack respond function
 * @param {string} processingMessage - Custom processing message (optional)
 * @returns {Function} updateResponse - Function to send the final response
 */
function ackWithProcessing(
  ack,
  respond,
  processingMessage = "⏳ Processing..."
) {
  // Acknowledge immediately with processing message
  ack({
    text: processingMessage,
    response_type: "ephemeral",
  });

  // Return function to send the final response as a follow-up
  return async (finalResponse) => {
    await respond({
      ...finalResponse,
      response_type: "ephemeral",
    });
  };
}

module.exports = {
  ackWithProcessing,
  removeFormatting,
  withFormattingRemoval,
};
