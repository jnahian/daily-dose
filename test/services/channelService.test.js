jest.mock("../../src/config/prisma", () => ({
  organization: { update: jest.fn(), findUnique: jest.fn() },
}));
jest.mock("../../src/utils/logger", () => ({ warn: jest.fn() }));

const prisma = require("../../src/config/prisma");
const {
  ensureOrgChannel,
  inviteUserToOrgChannel,
} = require("../../src/services/channelService");

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
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { botChannelId: "C2" },
    });
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

describe("inviteUserToOrgChannel", () => {
  it("no-ops and returns false when the org has no channel", async () => {
    prisma.organization.findUnique.mockResolvedValue({ botChannelId: null });
    const client = makeClient();
    const ok = await inviteUserToOrgChannel(client, "o1", "U1");
    expect(ok).toBe(false);
    expect(client.conversations.invite).not.toHaveBeenCalled();
  });

  it("invites the user when the org has a channel", async () => {
    prisma.organization.findUnique.mockResolvedValue({ botChannelId: "C1" });
    const client = makeClient();
    client.conversations.invite.mockResolvedValue({ ok: true });
    const ok = await inviteUserToOrgChannel(client, "o1", "U1");
    expect(client.conversations.invite).toHaveBeenCalledWith({
      channel: "C1",
      users: "U1",
    });
    expect(ok).toBe(true);
  });

  it("treats already_in_channel as success", async () => {
    prisma.organization.findUnique.mockResolvedValue({ botChannelId: "C1" });
    const client = makeClient();
    client.conversations.invite.mockRejectedValue({
      data: { error: "already_in_channel" },
    });
    expect(await inviteUserToOrgChannel(client, "o1", "U1")).toBe(true);
  });

  it("returns false on other invite errors", async () => {
    prisma.organization.findUnique.mockResolvedValue({ botChannelId: "C1" });
    const client = makeClient();
    client.conversations.invite.mockRejectedValue({
      data: { error: "missing_scope" },
    });
    expect(await inviteUserToOrgChannel(client, "o1", "U1")).toBe(false);
  });

  it("returns false when args are missing", async () => {
    const client = makeClient();
    expect(await inviteUserToOrgChannel(client, "o1", null)).toBe(false);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });
});
