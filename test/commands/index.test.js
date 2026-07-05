const { setupCommands } = require("../../src/commands/index");

// Regression guard: commands that accept an @mention must NOT be wrapped with
// stripFormatting(), because removeFormatting() rewrites `<@U123|alice>` to
// `alice` before the handler runs, destroying the mention the parser needs.
// stripFormatting-wrapped commands register as (name, middleware, handler) — 3
// args; mention commands register as (name, handler) — 2 args.
describe("command registration: mention commands skip stripFormatting", () => {
  const registrations = {};

  beforeAll(() => {
    const app = {
      command: (name, ...rest) => {
        registrations[name] = rest; // everything after the command name
      },
      action: () => {},
      view: () => {},
    };
    setupCommands(app);
  });

  it.each([
    "/dd-standup-post",
    "/dd-standup-preview",
    "/dd-zoho-map-member",
    "/dd-zoho-unmap-member",
  ])(
    "%s is registered with only a handler (no stripFormatting middleware)",
    (cmd) => {
      expect(registrations[cmd]).toBeDefined();
      expect(registrations[cmd]).toHaveLength(1); // handler only
      expect(typeof registrations[cmd][0]).toBe("function");
    }
  );

  it("a non-mention admin command still keeps stripFormatting (control)", () => {
    // /dd-standup-remind has no @mention arg and stays wrapped: middleware + handler
    expect(registrations["/dd-standup-remind"]).toHaveLength(2);
  });
});
