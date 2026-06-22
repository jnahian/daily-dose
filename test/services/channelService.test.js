jest.mock("../../src/config/prisma", () => ({
  organization: { update: jest.fn(), findUnique: jest.fn() },
}));
jest.mock("../../src/utils/logger", () => ({ warn: jest.fn() }));

const prisma = require("../../src/config/prisma");
const { ensureOrgChannel } = require("../../src/services/channelService");

function makeClient() {
  return { conversations: { create: jest.fn(), invite: jest.fn() } };
}

beforeEach(() => jest.clearAllMocks());

describe("ensureOrgChannel", () => {
  it("returns the existing channel id without calling Slack", async () => {
    const client = makeClient();
    const id = await ensureOrgChannel(client, {
      id: "o1",
      botChannelId: "C_OLD",
    });
    expect(id).toBe("C_OLD");
    expect(client.conversations.create).not.toHaveBeenCalled();
  });

  it("creates the channel and persists the id when none exists", async () => {
    const client = makeClient();
    client.conversations.create.mockResolvedValue({
      ok: true,
      channel: { id: "C_NEW" },
    });
    const id = await ensureOrgChannel(client, { id: "o1", botChannelId: null });
    expect(client.conversations.create).toHaveBeenCalledWith({
      name: "daily-dose-bot",
      is_private: false,
    });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { botChannelId: "C_NEW" },
    });
    expect(id).toBe("C_NEW");
  });

  it("retries with a suffixed name on name_taken", async () => {
    const client = makeClient();
    client.conversations.create
      .mockRejectedValueOnce({ data: { error: "name_taken" } })
      .mockResolvedValueOnce({ channel: { id: "C2" } });
    const id = await ensureOrgChannel(client, { id: "o1", botChannelId: null });
    expect(client.conversations.create).toHaveBeenNthCalledWith(2, {
      name: "daily-dose-bot-2",
      is_private: false,
    });
    expect(id).toBe("C2");
  });

  it("returns null and does not persist on a non-name error", async () => {
    const client = makeClient();
    client.conversations.create.mockRejectedValue({
      data: { error: "missing_scope" },
    });
    const id = await ensureOrgChannel(client, { id: "o1", botChannelId: null });
    expect(id).toBeNull();
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("returns null when client is missing", async () => {
    expect(
      await ensureOrgChannel(null, { id: "o1", botChannelId: null })
    ).toBeNull();
  });
});
