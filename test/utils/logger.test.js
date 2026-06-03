describe("logger levels", () => {
  const ORIG_ENV = { ...process.env };
  let logger;
  let consoleSpy;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIG_ENV };
    consoleSpy = {
      log: jest.spyOn(console, "log").mockImplementation(() => {}),
      warn: jest.spyOn(console, "warn").mockImplementation(() => {}),
      error: jest.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  afterAll(() => {
    process.env = ORIG_ENV;
  });

  it("default level is info: debug suppressed, info/warn/error emit", () => {
    delete process.env.LOG_LEVEL;
    logger = require("../../src/utils/logger");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(consoleSpy.log).toHaveBeenCalledTimes(1); // info uses console.log
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it("LOG_LEVEL=debug emits all four", () => {
    process.env.LOG_LEVEL = "debug";
    logger = require("../../src/utils/logger");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(consoleSpy.log).toHaveBeenCalledTimes(2); // debug + info
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it("LOG_LEVEL=error suppresses info and warn", () => {
    process.env.LOG_LEVEL = "error";
    logger = require("../../src/utils/logger");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it("invalid LOG_LEVEL falls back to info without throwing", () => {
    process.env.LOG_LEVEL = "garbage";
    logger = require("../../src/utils/logger");
    logger.info("i");
    expect(consoleSpy.log).toHaveBeenCalled();
  });

  it("prefixes output with [LEVEL] and no timestamp (PM2 supplies the timestamp)", () => {
    delete process.env.LOG_LEVEL;
    logger = require("../../src/utils/logger");
    logger.info("hello");
    const arg = consoleSpy.log.mock.calls[0][0];
    expect(arg).toBe("[INFO] hello");
  });

  it("LOG_LEVEL=warn suppresses debug and info, emits warn and error", () => {
    process.env.LOG_LEVEL = "warn";
    logger = require("../../src/utils/logger");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it("error() forwards to Sentry.captureException when wired", () => {
    jest.resetModules();
    const captureException = jest.fn();
    jest.doMock("../../src/config/sentry", () => ({
      getClient: () => ({ captureException }),
    }));
    logger = require("../../src/utils/logger");
    const err = new Error("boom");
    logger.error("explosion", err);
    expect(captureException).toHaveBeenCalledWith(err);
  });
});

describe("typed loggers still export", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("logCommand / logMessage / logEvent / logAction / logView are present", () => {
    const logger = require("../../src/utils/logger");
    expect(typeof logger.logCommand).toBe("function");
    expect(typeof logger.logMessage).toBe("function");
    expect(typeof logger.logEvent).toBe("function");
    expect(typeof logger.logAction).toBe("function");
    expect(typeof logger.logView).toBe("function");
  });
});
