const dayjs = require("dayjs");

/**
 * Input validation service for command protection
 * Provides comprehensive validation for all command inputs
 */
class InputValidationService {
  constructor() {
    // Maximum input lengths for security
    this.MAX_TEXT_LENGTH = 1000;
    this.MAX_TEAM_NAME_LENGTH = 50;
    this.MAX_REASON_LENGTH = 200;

    // Allowed characters pattern (alphanumeric, spaces, common punctuation)
    this.SAFE_TEXT_PATTERN = /^[a-zA-Z0-9\s\-_.,!?@#$%^&*()]+$/;
    this.TEAM_NAME_PATTERN = /^[a-zA-Z0-9\s\-_]+$/;

    // Time format validation (H:MM or HH:MM in 24-hour format)
    this.TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    // Date format validation (YYYY-MM-DD)
    this.DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

    // Command validation schemas
    this.commandSchemas = {
      "team:create": {
        requiredParams: ["name", "standupTime", "postingTime"],
        validators: {
          name: this.validateTeamName.bind(this),
          standupTime: this.validateTimeFormat.bind(this),
          postingTime: this.validateTimeFormat.bind(this),
        },
      },
      "team:join": {
        requiredParams: ["teamName"],
        validators: {
          teamName: this.validateTeamName.bind(this),
        },
      },
      "team:leave": {
        requiredParams: ["teamName"],
        validators: {
          teamName: this.validateTeamName.bind(this),
        },
      },
      "standup:submit": {
        requiredParams: ["teamName"],
        optionalParams: ["yesterdayTasks", "todayTasks", "blockers"],
        validators: {
          teamName: this.validateTeamName.bind(this),
          yesterdayTasks: this.validateStandupText.bind(this),
          todayTasks: this.validateStandupText.bind(this),
          blockers: this.validateStandupText.bind(this),
        },
      },
      "leave:set": {
        requiredParams: ["startDate"],
        optionalParams: ["endDate", "reason"],
        validators: {
          startDate: this.validateDateFormat.bind(this),
          endDate: this.validateDateFormat.bind(this),
          reason: this.validateLeaveReason.bind(this),
        },
      },
      "leave:cancel": {
        requiredParams: ["leaveId"],
        validators: {
          leaveId: this.validateLeaveId.bind(this),
        },
      },
      "workdays:set": {
        requiredParams: ["workDays"],
        validators: {
          workDays: this.validateWorkDays.bind(this),
        },
      },
    };
  }

  /**
   * Main validation method for commands
   * @param {string} commandType - Type of command (e.g., 'team:create')
   * @param {object} input - Input parameters to validate
   * @returns {object} Validation result with success flag and errors
   */
  validateCommand(commandType, input) {
    const schema = this.commandSchemas[commandType];

    if (!schema) {
      return {
        success: false,
        errors: [`Unknown command type: ${commandType}`],
      };
    }

    const errors = [];
    const sanitizedInput = {};

    // Check required parameters
    for (const param of schema.requiredParams) {
      if (!input[param] || input[param].trim() === "") {
        errors.push(`Missing required parameter: ${param}`);
        continue;
      }

      // Validate and sanitize the parameter
      const validator = schema.validators[param];
      if (validator) {
        const result = validator(input[param]);
        if (!result.valid) {
          errors.push(`Invalid ${param}: ${result.error}`);
        } else {
          sanitizedInput[param] = result.sanitized || input[param];
        }
      } else {
        sanitizedInput[param] = this.sanitizeInput(input[param]);
      }
    }

    // Check optional parameters if provided
    if (schema.optionalParams) {
      for (const param of schema.optionalParams) {
        if (input[param] && input[param].trim() !== "") {
          const validator = schema.validators[param];
          if (validator) {
            const result = validator(input[param]);
            if (!result.valid) {
              errors.push(`Invalid ${param}: ${result.error}`);
            } else {
              sanitizedInput[param] = result.sanitized || input[param];
            }
          } else {
            sanitizedInput[param] = this.sanitizeInput(input[param]);
          }
        }
      }
    }

    return {
      success: errors.length === 0,
      errors,
      sanitizedInput,
    };
  }

  /**
   * Validates time format (HH:MM)
   * @param {string} timeString - Time string to validate
   * @returns {object} Validation result
   */
  validateTimeFormat(timeString) {
    if (!timeString || typeof timeString !== "string") {
      return { valid: false, error: "Time is required" };
    }

    const trimmed = timeString.trim();

    if (!this.TIME_PATTERN.test(trimmed)) {
      return {
        valid: false,
        error:
          "Invalid time format. Use HH:MM (24-hour format, e.g., 09:30, 14:00)",
      };
    }

    // Additional validation for logical time values
    const [hours, minutes] = trimmed.split(":").map(Number);

    if (hours < 0 || hours > 23) {
      return { valid: false, error: "Hours must be between 00 and 23" };
    }

    if (minutes < 0 || minutes > 59) {
      return { valid: false, error: "Minutes must be between 00 and 59" };
    }

    return { valid: true, sanitized: trimmed };
  }

  /**
   * Validates date format (YYYY-MM-DD)
   * @param {string} dateString - Date string to validate
   * @returns {object} Validation result
   */
  validateDateFormat(dateString) {
    if (!dateString || typeof dateString !== "string") {
      return { valid: false, error: "Date is required" };
    }

    const trimmed = dateString.trim();

    if (!this.DATE_PATTERN.test(trimmed)) {
      return {
        valid: false,
        error: "Invalid date format. Use YYYY-MM-DD (e.g., 2024-12-25)",
      };
    }

    // Validate using dayjs for actual date validity
    const date = dayjs(trimmed);
    if (!date.isValid()) {
      return {
        valid: false,
        error: "Invalid date. Please check the date is correct",
      };
    }

    // Check if dayjs auto-corrected the date (e.g., 2023-02-29 becomes 2023-03-01)
    if (date.format("YYYY-MM-DD") !== trimmed) {
      return {
        valid: false,
        error: "Invalid date. Please check the date is correct",
      };
    }

    // Check if date is not too far in the past (more than 2 years ago)
    const twoYearsAgo = dayjs().subtract(2, "years");
    if (date.isBefore(twoYearsAgo)) {
      return {
        valid: false,
        error: "Date cannot be more than 2 years in the past",
      };
    }

    // Check if date is not too far in the future (more than 5 years)
    const fiveYearsFromNow = dayjs().add(5, "years");
    if (date.isAfter(fiveYearsFromNow)) {
      return {
        valid: false,
        error: "Date cannot be more than 5 years in the future",
      };
    }

    return { valid: true, sanitized: trimmed };
  }

  /**
   * Validates team name
   * @param {string} teamName - Team name to validate
   * @returns {object} Validation result
   */
  validateTeamName(teamName) {
    if (!teamName || typeof teamName !== "string") {
      return { valid: false, error: "Team name is required" };
    }

    const trimmed = teamName.trim();

    if (trimmed.length === 0) {
      return { valid: false, error: "Team name cannot be empty" };
    }

    if (trimmed.length > this.MAX_TEAM_NAME_LENGTH) {
      return {
        valid: false,
        error: `Team name cannot exceed ${this.MAX_TEAM_NAME_LENGTH} characters`,
      };
    }

    if (!this.TEAM_NAME_PATTERN.test(trimmed)) {
      return {
        valid: false,
        error:
          "Team name can only contain letters, numbers, spaces, hyphens, and underscores",
      };
    }

    // Check for reserved names
    const reservedNames = [
      "admin",
      "system",
      "bot",
      "api",
      "null",
      "undefined",
    ];
    if (reservedNames.includes(trimmed.toLowerCase())) {
      return {
        valid: false,
        error: "This team name is reserved and cannot be used",
      };
    }

    return { valid: true, sanitized: trimmed };
  }

  /**
   * Validates standup text (yesterday tasks, today tasks, blockers)
   * @param {string} text - Text to validate
   * @returns {object} Validation result
   */
  validateStandupText(text) {
    if (!text || typeof text !== "string") {
      return { valid: true, sanitized: "" }; // Optional field
    }

    const trimmed = text.trim();

    if (trimmed.length > this.MAX_TEXT_LENGTH) {
      return {
        valid: false,
        error: `Text cannot exceed ${this.MAX_TEXT_LENGTH} characters`,
      };
    }

    // Check for potentially malicious content
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(trimmed)) {
        return {
          valid: false,
          error: "Text contains potentially unsafe content",
        };
      }
    }

    return { valid: true, sanitized: this.sanitizeInput(trimmed) };
  }

  /**
   * Validates leave reason
   * @param {string} reason - Leave reason to validate
   * @returns {object} Validation result
   */
  validateLeaveReason(reason) {
    if (!reason || typeof reason !== "string") {
      return { valid: true, sanitized: "Personal leave" }; // Default reason
    }

    const trimmed = reason.trim();

    if (trimmed.length === 0) {
      return { valid: true, sanitized: "Personal leave" }; // Default for empty string
    }

    if (trimmed.length > this.MAX_REASON_LENGTH) {
      return {
        valid: false,
        error: `Leave reason cannot exceed ${this.MAX_REASON_LENGTH} characters`,
      };
    }

    if (!this.SAFE_TEXT_PATTERN.test(trimmed)) {
      return {
        valid: false,
        error: "Leave reason contains invalid characters",
      };
    }

    return { valid: true, sanitized: this.sanitizeInput(trimmed) };
  }

  /**
   * Validates leave ID
   * @param {string} leaveId - Leave ID to validate
   * @returns {object} Validation result
   */
  validateLeaveId(leaveId) {
    if (!leaveId || typeof leaveId !== "string") {
      return { valid: false, error: "Leave ID is required" };
    }

    const trimmed = leaveId.trim();

    // Basic UUID pattern check (simplified)
    const uuidPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    const shortIdPattern = /^[0-9a-f]{8}$/i; // For shortened IDs

    if (!uuidPattern.test(trimmed) && !shortIdPattern.test(trimmed)) {
      return { valid: false, error: "Invalid leave ID format" };
    }

    return { valid: true, sanitized: trimmed };
  }

  /**
   * Validates work days array
   * @param {string|array} workDays - Work days to validate (comma-separated string or array)
   * @returns {object} Validation result
   */
  validateWorkDays(workDays) {
    if (!workDays) {
      return { valid: false, error: "Work days are required" };
    }

    let daysArray;

    if (typeof workDays === "string") {
      // Parse comma-separated string
      daysArray = workDays.split(",").map((day) => {
        const num = parseInt(day.trim());
        return isNaN(num) ? null : num;
      });
    } else if (Array.isArray(workDays)) {
      daysArray = workDays;
    } else {
      return {
        valid: false,
        error: "Work days must be a comma-separated string or array",
      };
    }

    // Validate each day
    const validDays = [];
    for (const day of daysArray) {
      if (day === null || day < 1 || day > 7) {
        return {
          valid: false,
          error: "Work days must be numbers between 1 (Monday) and 7 (Sunday)",
        };
      }
      validDays.push(day);
    }

    if (validDays.length === 0) {
      return { valid: false, error: "At least one work day must be specified" };
    }

    // Remove duplicates and sort
    const uniqueDays = [...new Set(validDays)].sort();

    return { valid: true, sanitized: uniqueDays };
  }

  /**
   * General input sanitization
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    if (!input || typeof input !== "string") {
      return "";
    }

    return (
      input
        .trim()
        // Remove null bytes
        .replace(/\0/g, "")
        // Remove control characters except newlines and tabs
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        // Normalize whitespace
        .replace(/\s+/g, " ")
        // Remove leading/trailing whitespace again after normalization
        .trim()
    );
  }

  /**
   * Validates date range (start date must be before or equal to end date)
   * @param {string} startDate - Start date string
   * @param {string} endDate - End date string
   * @returns {object} Validation result
   */
  validateDateRange(startDate, endDate) {
    const startResult = this.validateDateFormat(startDate);
    if (!startResult.valid) {
      return { valid: false, error: `Start date: ${startResult.error}` };
    }

    const endResult = this.validateDateFormat(endDate);
    if (!endResult.valid) {
      return { valid: false, error: `End date: ${endResult.error}` };
    }

    const start = dayjs(startResult.sanitized);
    const end = dayjs(endResult.sanitized);

    if (start.isAfter(end)) {
      return {
        valid: false,
        error: "Start date must be before or equal to end date",
      };
    }

    // Check for reasonable date range (not more than 1 year)
    const maxRange = start.add(1, "year");
    if (end.isAfter(maxRange)) {
      return { valid: false, error: "Date range cannot exceed 1 year" };
    }

    return {
      valid: true,
      sanitized: {
        startDate: startResult.sanitized,
        endDate: endResult.sanitized,
      },
    };
  }

  /**
   * Validates time range (standup time should be before posting time)
   * @param {string} standupTime - Standup time string
   * @param {string} postingTime - Posting time string
   * @returns {object} Validation result
   */
  validateTimeRange(standupTime, postingTime) {
    const standupResult = this.validateTimeFormat(standupTime);
    if (!standupResult.valid) {
      return { valid: false, error: `Standup time: ${standupResult.error}` };
    }

    const postingResult = this.validateTimeFormat(postingTime);
    if (!postingResult.valid) {
      return { valid: false, error: `Posting time: ${postingResult.error}` };
    }

    const [standupHour, standupMinute] = standupResult.sanitized
      .split(":")
      .map(Number);
    const [postingHour, postingMinute] = postingResult.sanitized
      .split(":")
      .map(Number);

    const standupMinutes = standupHour * 60 + standupMinute;
    const postingMinutes = postingHour * 60 + postingMinute;

    if (standupMinutes >= postingMinutes) {
      return {
        valid: false,
        error: "Standup time must be before posting time",
      };
    }

    // Ensure reasonable gap (at least 30 minutes)
    if (postingMinutes - standupMinutes < 30) {
      return {
        valid: false,
        error:
          "There must be at least 30 minutes between standup and posting time",
      };
    }

    return {
      valid: true,
      sanitized: {
        standupTime: standupResult.sanitized,
        postingTime: postingResult.sanitized,
      },
    };
  }
}

module.exports = InputValidationService;
