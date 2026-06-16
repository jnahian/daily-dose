const { removeFormatting } = require("../utils/commandHelper");
const logger = require("../utils/logger");

function stripFormatting() {
  return async ({ command, next }) => {
    logger.logCommand(command);
    if (command.text) {
      // remove Slack-style formatting
      const clean = removeFormatting(command.text);
      command.text = clean;
    }

    await next();
  };
}

module.exports = { stripFormatting };
