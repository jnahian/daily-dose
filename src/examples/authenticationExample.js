const authenticationMiddleware = require("../middleware/authenticationMiddleware");

/**
 * Example of how to use the authentication middleware
 */

// Example 1: Direct authentication
async function exampleDirectAuthentication() {
  console.log("=== Direct Authentication Example ===");

  // This would fail because user ID is missing
  const result1 = await authenticationMiddleware.authenticateUser(
    null,
    "T123456"
  );
  console.log("Missing user ID result:", result1);

  // This would fail because workspace ID is missing
  const result2 = await authenticationMiddleware.authenticateUser(
    "U123456",
    null
  );
  console.log("Missing workspace ID result:", result2);
}

// Example 2: Wrapping a command handler
function exampleCommandWrapper() {
  console.log("=== Command Wrapper Example ===");

  // Original command handler
  const originalHandler = async ({ command, ack, respond, auth }) => {
    await ack();

    if (auth) {
      await respond({
        text: `✅ Authenticated as ${auth.user.name} in ${auth.organization.name}`,
        response_type: "ephemeral",
      });
    } else {
      await respond({
        text: "❌ No authentication context",
        response_type: "ephemeral",
      });
    }
  };

  // Wrap with authentication
  const protectedHandler =
    authenticationMiddleware.wrapCommand(originalHandler);

  console.log("Protected handler created:", typeof protectedHandler);
  return protectedHandler;
}

// Example 3: Session validation (placeholder)
async function exampleSessionValidation() {
  console.log("=== Session Validation Example ===");

  const result = await authenticationMiddleware.validateSession("dummy-token");
  console.log("Session validation result:", result);
}

// Run examples if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      await exampleDirectAuthentication();
      console.log();

      exampleCommandWrapper();
      console.log();

      await exampleSessionValidation();
    } catch (error) {
      console.error("Example error:", error);
    }
  })();
}

module.exports = {
  exampleDirectAuthentication,
  exampleCommandWrapper,
  exampleSessionValidation,
};
