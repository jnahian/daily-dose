const {
  UserFacingError,
  sanitizeError,
} = require("../../src/utils/errorHelper");

describe("UserFacingError", () => {
  it("preserves message and flags userFacing", () => {
    const err = new UserFacingError("nope");
    expect(err.message).toBe("nope");
    expect(err.userFacing).toBe(true);
    expect(err.name).toBe("UserFacingError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("sanitizeError", () => {
  let consoleErrorSpy;
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns the message of a UserFacingError verbatim", () => {
    const err = new UserFacingError("Team not found");
    expect(sanitizeError(err)).toBe("Team not found");
  });

  it("returns the message of any error with userFacing=true", () => {
    const err = new Error("custom");
    err.userFacing = true;
    expect(sanitizeError(err)).toBe("custom");
  });

  it("returns a generic message with a correlation id for unknown errors", () => {
    const err = new Error("database exploded with secrets in the message");
    const out = sanitizeError(err);
    expect(out).not.toContain("database exploded");
    expect(out).toMatch(/ref:\s[a-f0-9]{8}/);
  });

  it("logs the full error server-side with the same correlation id", () => {
    const err = new Error("internal detail");
    const out = sanitizeError(err);
    const ref = out.match(/ref:\s([a-f0-9]{8})/)[1];
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(ref),
      err
    );
  });

  it("accepts a custom fallback message", () => {
    const out = sanitizeError(new Error("x"), "Could not save your standup.");
    expect(out).toContain("Could not save your standup.");
  });

  it("handles null/undefined gracefully", () => {
    expect(sanitizeError(null)).toMatch(/ref:\s[a-f0-9]{8}/);
    expect(sanitizeError(undefined)).toMatch(/ref:\s[a-f0-9]{8}/);
  });
});
