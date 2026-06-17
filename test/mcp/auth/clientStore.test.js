jest.mock("../../../src/config/prisma", () => ({
  oauth_clients: { findUnique: jest.fn(), create: jest.fn() },
}));

const prisma = require("../../../src/config/prisma");
const { clientStore } = require("../../../src/mcp/auth/clientStore");

describe("clientStore", () => {
  beforeEach(() => jest.clearAllMocks());

  it("getClient maps a row to OAuthClientInformationFull", async () => {
    prisma.oauth_clients.findUnique.mockResolvedValue({
      id: "c1",
      client_secret: null,
      client_name: "Claude",
      redirect_uris: ["https://claude.ai/cb"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "mcp",
      token_endpoint_auth_method: "none",
      client_id_issued_at: 123,
      client_secret_expires_at: null,
    });
    const c = await clientStore.getClient("c1");
    expect(c).toEqual(
      expect.objectContaining({
        client_id: "c1",
        client_name: "Claude",
        redirect_uris: ["https://claude.ai/cb"],
        token_endpoint_auth_method: "none",
      })
    );
  });

  it("getClient returns undefined when not found", async () => {
    prisma.oauth_clients.findUnique.mockResolvedValue(null);
    expect(await clientStore.getClient("nope")).toBeUndefined();
  });

  it("registerClient persists the SDK-provided client and returns it", async () => {
    prisma.oauth_clients.create.mockResolvedValue({});
    const input = {
      client_id: "c2",
      client_id_issued_at: 456,
      redirect_uris: ["https://cursor.sh/cb"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: "Cursor",
    };
    const out = await clientStore.registerClient(input);
    expect(out).toBe(input);
    const data = prisma.oauth_clients.create.mock.calls[0][0].data;
    expect(data.id).toBe("c2");
    expect(data.redirect_uris).toEqual(["https://cursor.sh/cb"]);
    expect(data.client_name).toBe("Cursor");
  });
});
