describe("src/config/sentry", () => {
  const ORIG_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIG_ENV };
  });

  afterAll(() => {
    process.env = ORIG_ENV;
  });

  it("init() is a no-op when SENTRY_DSN is unset", () => {
    delete process.env.SENTRY_DSN;
    const sentry = require("../../src/config/sentry");
    expect(() => sentry.init()).not.toThrow();
    expect(sentry.getClient()).toBeNull();
  });

  it("init() returns the configured client when SENTRY_DSN is set", () => {
    process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
    const sentry = require("../../src/config/sentry");
    sentry.init();
    const client = sentry.getClient();
    expect(client).not.toBeNull();
    expect(typeof client.captureException).toBe("function");
  });

  it("init() is idempotent — calling it twice does not re-init", () => {
    process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
    const sentry = require("../../src/config/sentry");
    sentry.init();
    const first = sentry.getClient();
    sentry.init();
    expect(sentry.getClient()).toBe(first);
  });
});
