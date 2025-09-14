const { removeFormatting } = require("../utils/commandHelper");

function stripFormatting() {
  return async ({ command, next }) => {
    console.log("Command:", command);
    if (command.text) {
      // remove Slack-style formatting
      let clean = removeFormatting(command.text);
      command.text = clean;
    }

    await next();
  };
}

module.exports = { stripFormatting };
