const InputValidationService = require("../services/inputValidationService");

/**
 * Example usage of InputValidationService
 * This demonstrates how to use the validation service in command handlers
 */

const validationService = new InputValidationService();

// Example 1: Validating team creation command
console.log("=== Team Creation Validation ===");
const teamCreateInput = {
  name: "Engineering",
  standupTime: "09:30",
  postingTime: "10:00",
};

const teamCreateResult = validationService.validateCommand(
  "team:create",
  teamCreateInput
);
console.log("Valid team creation:", teamCreateResult.success);
console.log("Sanitized input:", teamCreateResult.sanitizedInput);

// Example 2: Invalid team creation (missing posting time)
const invalidTeamInput = {
  name: "Engineering",
  standupTime: "09:30",
  // Missing postingTime
};

const invalidResult = validationService.validateCommand(
  "team:create",
  invalidTeamInput
);
console.log("\nInvalid team creation:", invalidResult.success);
console.log("Errors:", invalidResult.errors);

// Example 3: Validating individual fields
console.log("\n=== Individual Field Validation ===");

// Time validation
const timeResult = validationService.validateTimeFormat("14:30");
console.log("Time validation (14:30):", timeResult);

const invalidTimeResult = validationService.validateTimeFormat("25:00");
console.log("Invalid time (25:00):", invalidTimeResult);

// Date validation
const dateResult = validationService.validateDateFormat("2024-12-25");
console.log("Date validation (2024-12-25):", dateResult);

// Team name validation
const teamNameResult = validationService.validateTeamName("My-Team_123");
console.log("Team name validation:", teamNameResult);

// Example 4: Standup text validation
console.log("\n=== Standup Text Validation ===");
const standupInput = {
  teamName: "Engineering",
  yesterdayTasks: "Fixed authentication bugs",
  todayTasks: "Implement new features",
  blockers: "", // Empty blockers (optional)
};

const standupResult = validationService.validateCommand(
  "standup:submit",
  standupInput
);
console.log("Standup validation:", standupResult.success);
console.log("Sanitized standup:", standupResult.sanitizedInput);

// Example 5: Leave validation
console.log("\n=== Leave Validation ===");
const leaveInput = {
  startDate: "2024-12-25",
  endDate: "2024-12-26",
  reason: "Holiday break",
};

const leaveResult = validationService.validateCommand("leave:set", leaveInput);
console.log("Leave validation:", leaveResult.success);
console.log("Sanitized leave:", leaveResult.sanitizedInput);

// Example 6: Date range validation
console.log("\n=== Date Range Validation ===");
const dateRangeResult = validationService.validateDateRange(
  "2024-12-25",
  "2024-12-26"
);
console.log("Date range validation:", dateRangeResult);

// Example 7: Time range validation
console.log("\n=== Time Range Validation ===");
const timeRangeResult = validationService.validateTimeRange("09:30", "10:00");
console.log("Time range validation:", timeRangeResult);

// Example 8: Input sanitization
console.log("\n=== Input Sanitization ===");
const dirtyInput = "  Text with   extra   spaces  \x00\x01";
const sanitized = validationService.sanitizeInput(dirtyInput);
console.log("Original:", JSON.stringify(dirtyInput));
console.log("Sanitized:", JSON.stringify(sanitized));

console.log("\n=== Validation Complete ===");
