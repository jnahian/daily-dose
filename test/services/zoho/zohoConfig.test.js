const {
  getConfig,
  accountsBaseUrl,
  peopleBaseUrl,
} = require("../../../src/services/zoho/zohoConfig");

describe("zohoConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("defaults ZOHO_DATA_CENTER to com", () => {
    delete process.env.ZOHO_DATA_CENTER;
    expect(getConfig().dataCenter).toBe("com");
  });

  it("accepts a documented data center", () => {
    process.env.ZOHO_DATA_CENTER = "in";
    expect(getConfig().dataCenter).toBe("in");
    expect(accountsBaseUrl("in")).toBe("https://accounts.zoho.in");
    expect(peopleBaseUrl("in")).toBe("https://people.zoho.in");
  });

  it("rejects an undocumented data center in getConfig", () => {
    process.env.ZOHO_DATA_CENTER = "evil.example.com";
    expect(() => getConfig()).toThrow(/Unsupported ZOHO_DATA_CENTER/);
  });

  it("rejects an undocumented data center passed straight to the URL builders", () => {
    expect(() => accountsBaseUrl("evil.example.com")).toThrow(
      /Unsupported ZOHO_DATA_CENTER/
    );
    expect(() => peopleBaseUrl("evil.example.com")).toThrow(
      /Unsupported ZOHO_DATA_CENTER/
    );
  });
});
