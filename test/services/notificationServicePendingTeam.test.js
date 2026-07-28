jest.mock("../../src/services/userService", () => ({
  getOrganizationAdmins: jest.fn(),
}));

jest.mock("../../src/services/channelService", () => ({
  ensureOrgChannel: jest.fn(),
  inviteUserToOrgChannel: jest.fn(),
}));

// teamService is required by notificationService but unused on this path.
jest.mock("../../src/services/teamService", () => ({
  getTeamAdmins: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const userService = require("../../src/services/userService");
const channelService = require("../../src/services/channelService");
const notificationService = require("../../src/services/notificationService");

const team = {
  id: "t1",
  name: "Eng",
  slackChannelId: "C123",
  standupTime: "09:30",
  postingTime: "10:00",
  timezone: "America/New_York",
};
const organization = { id: "o1", botChannelId: "C_BOT" };

function makeClient() {
  return { chat: { postMessage: jest.fn().mockResolvedValue({}) } };
}

beforeEach(() => {
  jest.clearAllMocks();
  channelService.ensureOrgChannel.mockResolvedValue("C_BOT");
  channelService.inviteUserToOrgChannel.mockResolvedValue(true);
});

describe("notificationService.notifyOrgAdminsOfPendingTeam", () => {
  it("DMs every org admin except the proposer and skips the channel fallback", async () => {
    userService.getOrganizationAdmins.mockResolvedValue([
      { user: { slackUserId: "U_ADMIN1" } },
      { user: { slackUserId: "U_ADMIN2" } },
      { user: { slackUserId: "U_CREATOR" } },
    ]);
    const client = makeClient();

    await notificationService.notifyOrgAdminsOfPendingTeam({
      team,
      organization,
      creatorSlackUserId: "U_CREATOR",
      client,
    });

    const recipients = client.chat.postMessage.mock.calls.map(
      (c) => c[0].channel
    );
    expect(recipients).toEqual(["U_ADMIN1", "U_ADMIN2"]);
    // At least one DM landed, so the org channel is left alone.
    expect(channelService.ensureOrgChannel).not.toHaveBeenCalled();
  });

  it("falls back to the org channel when every admin DM fails", async () => {
    userService.getOrganizationAdmins.mockResolvedValue([
      { user: { slackUserId: "U_ADMIN1" } },
    ]);
    const client = makeClient();
    client.chat.postMessage
      .mockRejectedValueOnce(new Error("channel_not_found"))
      .mockResolvedValueOnce({});

    await notificationService.notifyOrgAdminsOfPendingTeam({
      team,
      organization,
      creatorSlackUserId: "U_CREATOR",
      client,
    });

    // Without this fallback the request would be invisible until someone
    // happened to open the admin panel.
    expect(channelService.ensureOrgChannel).toHaveBeenCalledWith(
      client,
      organization
    );
    const last = client.chat.postMessage.mock.calls.at(-1)[0];
    expect(last.channel).toBe("C_BOT");
    expect(last.text).toContain("Eng");
  });

  it("pulls the admins into the org channel before posting the fallback", async () => {
    userService.getOrganizationAdmins.mockResolvedValue([
      { user: { slackUserId: "U_ADMIN1" } },
      { user: { slackUserId: "U_ADMIN2" } },
    ]);
    const client = makeClient();
    client.chat.postMessage
      .mockRejectedValueOnce(new Error("channel_not_found"))
      .mockRejectedValueOnce(new Error("channel_not_found"))
      .mockResolvedValueOnce({});

    await notificationService.notifyOrgAdminsOfPendingTeam({
      team,
      organization,
      creatorSlackUserId: "U_CREATOR",
      client,
    });

    // ensureOrgChannel can return a channel that only the bot is in, so the
    // post would otherwise land where no admin is watching.
    expect(channelService.inviteUserToOrgChannel.mock.calls).toEqual([
      [client, "o1", "U_ADMIN1"],
      [client, "o1", "U_ADMIN2"],
    ]);
    expect(client.chat.postMessage.mock.calls.at(-1)[0].channel).toBe("C_BOT");
  });

  it("falls back to the org channel when the org has no admins to notify", async () => {
    userService.getOrganizationAdmins.mockResolvedValue([]);
    const client = makeClient();

    await notificationService.notifyOrgAdminsOfPendingTeam({
      team,
      organization,
      creatorSlackUserId: "U_CREATOR",
      client,
    });

    expect(client.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(client.chat.postMessage.mock.calls[0][0].channel).toBe("C_BOT");
  });

  it("does not throw when the fallback channel is unavailable", async () => {
    userService.getOrganizationAdmins.mockResolvedValue([]);
    channelService.ensureOrgChannel.mockResolvedValue(null);
    const client = makeClient();

    await expect(
      notificationService.notifyOrgAdminsOfPendingTeam({
        team,
        organization,
        creatorSlackUserId: "U_CREATOR",
        client,
      })
    ).resolves.toBeUndefined();

    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });
});
