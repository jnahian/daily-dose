// validateRemote must surface every pointer/message Slack returns, and refuse
// to let an update proceed when validation fails.

process.env.SLACK_USER_TOKEN = "xoxe-test";
process.env.SLACK_APP_ID = "A123";
process.env.APP_URL = "https://dd.test/";

const Manager = require("../../scripts/updateSlackManifest");

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

const slackReply = (body) =>
  global.fetch.mockResolvedValueOnce({ json: async () => body });

describe("validateRemote", () => {
  it("passes app_id and the manifest to apps.manifest.validate", async () => {
    slackReply({ ok: true, errors: [] });
    await new Manager().validateRemote({ display_information: {} });

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe("https://slack.com/api/apps.manifest.validate");
    expect(JSON.parse(opts.body)).toEqual({
      manifest: { display_information: {} },
      app_id: "A123",
    });
  });

  it("lists every pointer Slack reports and throws", async () => {
    slackReply({
      ok: false,
      error: "invalid_manifest",
      errors: [
        { pointer: "/oauth_config/redirect_urls/1", message: "invalid url" },
        { pointer: "/features/slash_commands/3/command", message: "too long" },
      ],
    });
    await expect(new Manager().validateRemote({})).rejects.toThrow(
      "Manifest rejected by Slack (2 problems)"
    );
    const printed = console.error.mock.calls.map((c) => c[0]).join("\n");
    expect(printed).toContain("/oauth_config/redirect_urls/1: invalid url");
    expect(printed).toContain("/features/slash_commands/3/command: too long");
  });

  it("does not update when validation fails", async () => {
    slackReply({ ok: false, error: "invalid_manifest", errors: [] });
    jest.spyOn(process, "exit").mockImplementation(() => {});
    const m = new Manager();
    jest.spyOn(m, "loadManifest").mockReturnValue({
      display_information: {},
      features: {},
      oauth_config: {},
      settings: {},
    });
    await m.run({});
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

it("strips a trailing slash from APP_URL before substituting it", () => {
  expect(new Manager().appUrl).toBe("https://dd.test");
});

it("--export prints the manifest Slack holds and makes no other call", async () => {
  slackReply({
    ok: true,
    manifest: { oauth_config: { redirect_urls: ["x"] } },
  });
  await new Manager().run({ export: true });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
    app_id: "A123",
  });
  expect(console.log.mock.calls.map((c) => c[0]).join("\n")).toContain(
    '"redirect_urls"'
  );
});

it("--dry-run makes no Slack call", async () => {
  const m = new Manager();
  jest.spyOn(m, "loadManifest").mockReturnValue({
    display_information: {},
    features: {},
    oauth_config: {},
    settings: {},
  });
  await m.run({ dryRun: true });
  expect(global.fetch).not.toHaveBeenCalled();
});
