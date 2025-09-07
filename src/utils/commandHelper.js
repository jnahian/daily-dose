/**
 * Utility functions for handling Slack commands with processing indicators
 */

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
};
