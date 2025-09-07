const InputValidationService = require("../inputValidationService");

describe("InputValidationService", () => {
  let validationService;

  beforeEach(() => {
    validationService = new InputValidationService();
  });

  describe("validateTimeFormat", () => {
    it("should validate correct time formats", () => {
      const validTimes = ["09:30", "14:00", "00:00", "23:59", "12:45"];

      validTimes.forEach((time) => {
        const result = validationService.validateTimeFormat(time);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(time);
      });
    });

    it("should reject invalid time formats", () => {
      const invalidTimes = [
        "25:00", // Invalid hour
        "12:60", // Invalid minute
        "12:5", // Missing leading zero for minute
        "12-30", // Wrong separator
        "abc", // Non-numeric
        "", // Empty string
        null, // Null value
        undefined, // Undefined value
      ];

      invalidTimes.forEach((time) => {
        const result = validationService.validateTimeFormat(time);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it("should handle edge cases", () => {
      // Test with whitespace
      const result1 = validationService.validateTimeFormat("  09:30  ");
      expect(result1.valid).toBe(true);
      expect(result1.sanitized).toBe("09:30");

      // Test boundary values
      const result2 = validationService.validateTimeFormat("00:00");
      expect(result2.valid).toBe(true);

      const result3 = validationService.validateTimeFormat("23:59");
      expect(result3.valid).toBe(true);
    });
  });

  describe("validateDateFormat", () => {
    it("should validate correct date formats", () => {
      const currentYear = new Date().getFullYear();
      const validDates = [
        `${currentYear}-12-25`,
        `${currentYear + 1}-01-01`,
        `${currentYear}-02-28`,
      ];

      validDates.forEach((date) => {
        const result = validationService.validateDateFormat(date);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(date);
      });
    });

    it("should reject invalid date formats", () => {
      const invalidDates = [
        "2024/12/25", // Wrong separator
        "25-12-2024", // Wrong order
        "2024-13-01", // Invalid month
        "2024-02-30", // Invalid day for February
        "2023-02-29", // Not a leap year
        "abc", // Non-date string
        "", // Empty string
        null, // Null value
        undefined, // Undefined value
      ];

      invalidDates.forEach((date) => {
        const result = validationService.validateDateFormat(date);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it("should reject dates too far in past or future", () => {
      const currentYear = new Date().getFullYear();
      const tooOld = `${currentYear - 3}-01-01`; // More than 2 years ago
      const tooFuture = `${currentYear + 6}-01-01`; // More than 5 years in future

      const result1 = validationService.validateDateFormat(tooOld);
      expect(result1.valid).toBe(false);
      expect(result1.error).toContain("past");

      const result2 = validationService.validateDateFormat(tooFuture);
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain("future");
    });

    it("should handle whitespace", () => {
      const result = validationService.validateDateFormat("  2024-12-25  ");
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe("2024-12-25");
    });
  });

  describe("validateTeamName", () => {
    it("should validate correct team names", () => {
      const validNames = [
        "Engineering",
        "Team-Alpha",
        "Dev_Team",
        "Marketing 2024",
      ];

      validNames.forEach((name) => {
        const result = validationService.validateTeamName(name);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(name);
      });
    });

    it("should reject invalid team names", () => {
      const invalidNames = [
        "", // Empty
        "   ", // Only whitespace
        "a".repeat(51), // Too long
        "Team@Special", // Invalid characters
        "Team<script>", // Potentially malicious
        null, // Null
        undefined, // Undefined
      ];

      invalidNames.forEach((name) => {
        const result = validationService.validateTeamName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it("should reject reserved names", () => {
      const reservedNames = [
        "admin",
        "system",
        "bot",
        "api",
        "null",
        "undefined",
      ];

      reservedNames.forEach((name) => {
        const result = validationService.validateTeamName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("reserved");
      });
    });

    it("should handle case sensitivity for reserved names", () => {
      const result = validationService.validateTeamName("ADMIN");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("reserved");
    });

    it("should trim whitespace", () => {
      const result = validationService.validateTeamName("  Engineering  ");
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe("Engineering");
    });
  });

  describe("validateStandupText", () => {
    it("should validate normal standup text", () => {
      const validTexts = [
        "Worked on user authentication",
        "Fixed bugs in the payment system",
        "Meeting with stakeholders at 2pm",
        "", // Empty is valid (optional field)
        null, // Null is valid (optional field)
        undefined, // Undefined is valid (optional field)
      ];

      validTexts.forEach((text) => {
        const result = validationService.validateStandupText(text);
        expect(result.valid).toBe(true);
      });
    });

    it("should reject text that is too long", () => {
      const longText = "a".repeat(1001);
      const result = validationService.validateStandupText(longText);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceed");
    });

    it("should reject potentially malicious content", () => {
      const maliciousTexts = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<iframe src="evil.com"></iframe>',
        'onclick="alert(1)"',
        '<object data="evil.swf"></object>',
        '<embed src="evil.swf">',
      ];

      maliciousTexts.forEach((text) => {
        const result = validationService.validateStandupText(text);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("unsafe");
      });
    });

    it("should sanitize input", () => {
      const result = validationService.validateStandupText(
        "  Text with   extra   spaces  "
      );
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe("Text with extra spaces");
    });
  });

  describe("validateLeaveReason", () => {
    it("should validate normal leave reasons", () => {
      const validReasons = [
        "Vacation",
        "Medical appointment",
        "Family emergency",
        "Personal leave",
        "", // Empty should default
        null, // Null should default
        undefined, // Undefined should default
      ];

      validReasons.forEach((reason) => {
        const result = validationService.validateLeaveReason(reason);
        expect(result.valid).toBe(true);
      });
    });

    it("should provide default reason for empty input", () => {
      const emptyInputs = ["", null, undefined, "   "];

      emptyInputs.forEach((input) => {
        const result = validationService.validateLeaveReason(input);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe("Personal leave");
      });
    });

    it("should reject reasons that are too long", () => {
      const longReason = "a".repeat(201);
      const result = validationService.validateLeaveReason(longReason);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceed");
    });

    it("should reject invalid characters", () => {
      const invalidReason = "Vacation<script>alert(1)</script>";
      const result = validationService.validateLeaveReason(invalidReason);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("invalid characters");
    });
  });

  describe("validateLeaveId", () => {
    it("should validate correct leave IDs", () => {
      const validIds = [
        "12345678-1234-1234-1234-123456789012", // Full UUID
        "12345678", // Short ID (8 characters)
      ];

      validIds.forEach((id) => {
        const result = validationService.validateLeaveId(id);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(id);
      });
    });

    it("should reject invalid leave IDs", () => {
      const invalidIds = [
        { id: "", expectedError: "Leave ID is required" },
        { id: "invalid", expectedError: "Invalid leave ID format" },
        { id: "1234567", expectedError: "Invalid leave ID format" },
        { id: "123456789", expectedError: "Invalid leave ID format" },
        { id: "not-a-uuid", expectedError: "Invalid leave ID format" },
        { id: null, expectedError: "Leave ID is required" },
        { id: undefined, expectedError: "Leave ID is required" },
      ];

      invalidIds.forEach(({ id, expectedError }) => {
        const result = validationService.validateLeaveId(id);
        expect(result.valid).toBe(false);
        expect(result.error).toContain(expectedError);
      });
    });
  });

  describe("validateWorkDays", () => {
    it("should validate correct work days as string", () => {
      const validWorkDays = ["1,2,3,4,5", "1,3,5", "7", "1,2,3,4,6,7"];

      validWorkDays.forEach((days) => {
        const result = validationService.validateWorkDays(days);
        expect(result.valid).toBe(true);
        expect(Array.isArray(result.sanitized)).toBe(true);
      });
    });

    it("should validate correct work days as array", () => {
      const validWorkDays = [
        [1, 2, 3, 4, 5],
        [1, 3, 5],
        [7],
        [1, 2, 3, 4, 6, 7],
      ];

      validWorkDays.forEach((days) => {
        const result = validationService.validateWorkDays(days);
        expect(result.valid).toBe(true);
        expect(Array.isArray(result.sanitized)).toBe(true);
      });
    });

    it("should reject invalid work days", () => {
      const invalidWorkDays = [
        "0,1,2", // 0 is invalid
        "1,8", // 8 is invalid
        "a,b,c", // Non-numeric
        "", // Empty
        [], // Empty array
        null, // Null
        undefined, // Undefined
      ];

      invalidWorkDays.forEach((days) => {
        const result = validationService.validateWorkDays(days);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it("should remove duplicates and sort", () => {
      const result = validationService.validateWorkDays("5,1,3,1,5");
      expect(result.valid).toBe(true);
      expect(result.sanitized).toEqual([1, 3, 5]);
    });

    it("should handle whitespace in string format", () => {
      const result = validationService.validateWorkDays(" 1 , 2 , 3 ");
      expect(result.valid).toBe(true);
      expect(result.sanitized).toEqual([1, 2, 3]);
    });
  });

  describe("validateCommand", () => {
    it("should validate team:create command", () => {
      const input = {
        name: "Engineering",
        standupTime: "09:30",
        postingTime: "10:00",
      };

      const result = validationService.validateCommand("team:create", input);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedInput).toEqual(input);
    });

    it("should reject team:create with missing parameters", () => {
      const input = {
        name: "Engineering",
        // Missing standupTime and postingTime
      };

      const result = validationService.validateCommand("team:create", input);
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Missing required parameter: standupTime"
      );
      expect(result.errors).toContain(
        "Missing required parameter: postingTime"
      );
    });

    it("should validate team:join command", () => {
      const input = { teamName: "Engineering" };
      const result = validationService.validateCommand("team:join", input);
      expect(result.success).toBe(true);
      expect(result.sanitizedInput.teamName).toBe("Engineering");
    });

    it("should validate standup:submit command with optional fields", () => {
      const input = {
        teamName: "Engineering",
        yesterdayTasks: "Fixed bugs",
        todayTasks: "Write tests",
        // blockers is optional and not provided
      };

      const result = validationService.validateCommand("standup:submit", input);
      expect(result.success).toBe(true);
      expect(result.sanitizedInput.teamName).toBe("Engineering");
      expect(result.sanitizedInput.yesterdayTasks).toBe("Fixed bugs");
      expect(result.sanitizedInput.todayTasks).toBe("Write tests");
    });

    it("should validate leave:set command", () => {
      const input = {
        startDate: "2024-12-25",
        endDate: "2024-12-26",
        reason: "Holiday break",
      };

      const result = validationService.validateCommand("leave:set", input);
      expect(result.success).toBe(true);
      expect(result.sanitizedInput.startDate).toBe("2024-12-25");
      expect(result.sanitizedInput.endDate).toBe("2024-12-26");
      expect(result.sanitizedInput.reason).toBe("Holiday break");
    });

    it("should reject unknown command types", () => {
      const result = validationService.validateCommand("unknown:command", {});
      expect(result.success).toBe(false);
      expect(result.errors).toContain("Unknown command type: unknown:command");
    });
  });

  describe("sanitizeInput", () => {
    it("should remove null bytes and control characters", () => {
      const input = "Text\x00with\x01control\x1Fcharacters";
      const result = validationService.sanitizeInput(input);
      expect(result).toBe("Textwithcontrolcharacters");
    });

    it("should normalize whitespace", () => {
      const input = "Text   with    multiple   spaces";
      const result = validationService.sanitizeInput(input);
      expect(result).toBe("Text with multiple spaces");
    });

    it("should trim leading and trailing whitespace", () => {
      const input = "   Text with spaces   ";
      const result = validationService.sanitizeInput(input);
      expect(result).toBe("Text with spaces");
    });

    it("should handle empty and null inputs", () => {
      expect(validationService.sanitizeInput("")).toBe("");
      expect(validationService.sanitizeInput(null)).toBe("");
      expect(validationService.sanitizeInput(undefined)).toBe("");
    });
  });

  describe("validateDateRange", () => {
    it("should validate correct date ranges", () => {
      const result = validationService.validateDateRange(
        "2024-12-25",
        "2024-12-26"
      );
      expect(result.valid).toBe(true);
      expect(result.sanitized.startDate).toBe("2024-12-25");
      expect(result.sanitized.endDate).toBe("2024-12-26");
    });

    it("should reject when start date is after end date", () => {
      const result = validationService.validateDateRange(
        "2024-12-26",
        "2024-12-25"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain(
        "Start date must be before or equal to end date"
      );
    });

    it("should reject date ranges longer than 1 year", () => {
      const currentYear = new Date().getFullYear();
      const result = validationService.validateDateRange(
        `${currentYear}-01-01`,
        `${currentYear + 2}-01-01`
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot exceed 1 year");
    });

    it("should allow same start and end date", () => {
      const result = validationService.validateDateRange(
        "2024-12-25",
        "2024-12-25"
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("validateTimeRange", () => {
    it("should validate correct time ranges", () => {
      const result = validationService.validateTimeRange("09:30", "10:00");
      expect(result.valid).toBe(true);
      expect(result.sanitized.standupTime).toBe("09:30");
      expect(result.sanitized.postingTime).toBe("10:00");
    });

    it("should reject when standup time is after posting time", () => {
      const result = validationService.validateTimeRange("10:00", "09:30");
      expect(result.valid).toBe(false);
      expect(result.error).toContain(
        "Standup time must be before posting time"
      );
    });

    it("should reject when times are equal", () => {
      const result = validationService.validateTimeRange("09:30", "09:30");
      expect(result.valid).toBe(false);
      expect(result.error).toContain(
        "Standup time must be before posting time"
      );
    });

    it("should require at least 30 minutes gap", () => {
      const result = validationService.validateTimeRange("09:30", "09:45");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least 30 minutes");
    });

    it("should allow exactly 30 minutes gap", () => {
      const result = validationService.validateTimeRange("09:30", "10:00");
      expect(result.valid).toBe(true);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle non-string inputs gracefully", () => {
      const nonStringInputs = [123, {}, [], true, false];

      nonStringInputs.forEach((input) => {
        const timeResult = validationService.validateTimeFormat(input);
        expect(timeResult.valid).toBe(false);

        const dateResult = validationService.validateDateFormat(input);
        expect(dateResult.valid).toBe(false);

        const teamResult = validationService.validateTeamName(input);
        expect(teamResult.valid).toBe(false);
      });
    });

    it("should handle extremely long inputs", () => {
      const veryLongString = "a".repeat(10000);

      const teamResult = validationService.validateTeamName(veryLongString);
      expect(teamResult.valid).toBe(false);

      const textResult = validationService.validateStandupText(veryLongString);
      expect(textResult.valid).toBe(false);

      const reasonResult =
        validationService.validateLeaveReason(veryLongString);
      expect(reasonResult.valid).toBe(false);
    });

    it("should handle special characters in various inputs", () => {
      const specialChars = "!@#$%^&*()[]{}|;:,.<>?";

      // Team names should reject most special characters
      const teamResult = validationService.validateTeamName(specialChars);
      expect(teamResult.valid).toBe(false);

      // Leave reasons should reject some special characters
      const reasonResult = validationService.validateLeaveReason(specialChars);
      expect(reasonResult.valid).toBe(false);
    });
  });
});
