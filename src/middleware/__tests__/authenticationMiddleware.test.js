const authenticationMiddleware = require("../authenticationMiddleware");

describe("AuthenticationMiddleware", () => {
  it("should be defined", () => {
    expect(authenticationMiddleware).toBeDefined();
  });

  it("should have required methods", () => {
    expect(typeof authenticationMiddleware.authenticateUser).toBe("function");
    expect(typeof authenticationMiddleware.wrapCommand).toBe("function");
    expect(typeof authenticationMiddleware.findOrganizationByWorkspace).toBe(
      "function"
    );
    expect(typeof authenticationMiddleware.verifyOrganizationMembership).toBe(
      "function"
    );
    expect(typeof authenticationMiddleware.validateSession).toBe("function");
  });

  describe("authenticateUser", () => {
    it("should fail when slackUserId is missing", async () => {
      const result = await authenticationMiddleware.authenticateUser(
        null,
        "T123456"
      );

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("authentication");
      expect(result.error.code).toBe("MISSING_USER_ID");
      expect(result.error.message).toBe(
        "User ID is required for authentication"
      );
    });

    it("should fail when slackWorkspaceId is missing", async () => {
      const result = await authenticationMiddleware.authenticateUser(
        "U123456",
        null
      );

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("authentication");
      expect(result.error.code).toBe("MISSING_WORKSPACE_ID");
      expect(result.error.message).toBe(
        "Workspace ID is required for authentication"
      );
    });
  });

  describe("validateSession", () => {
    it("should return not implemented error", async () => {
      const result = await authenticationMiddleware.validateSession("token123");

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("authentication");
      expect(result.error.code).toBe("NOT_IMPLEMENTED");
      expect(result.error.message).toBe("Session validation not implemented");
    });
  });
});
