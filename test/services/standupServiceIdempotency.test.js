jest.mock("../../src/config/prisma", () => {
  const findUnique = jest.fn();
  return {
    standupPost: { findUnique, upsert: jest.fn() },
    standupResponse: { findMany: jest.fn().mockResolvedValue([]) },
    team: { findUnique: jest.fn() },
    teamMember: { findMany: jest.fn().mockResolvedValue([]) },
    holiday: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn() },
    __mocks: { findUnique },
  };
});

const prisma = require("../../src/config/prisma");
const standupService = require("../../src/services/standupService");

describe("postTeamStandup idempotency guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns early when an existing post has slackMessageTs set", async () => {
    prisma.__mocks.findUnique.mockResolvedValueOnce({
      id: "p1",
      teamId: "t1",
      standupDate: new Date("2024-01-01"),
      slackMessageTs: "1700000000.000100",
      channelId: "C123",
    });

    const fakeApp = { client: { chat: { postMessage: jest.fn() } } };
    const result = await standupService.postTeamStandup(
      { id: "t1", name: "Eng", slackChannelId: "C123", organizationId: "o1" },
      new Date("2024-01-01"),
      fakeApp
    );

    expect(fakeApp.client.chat.postMessage).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: true });
  });

  it("does not skip when there is no existing post", async () => {
    prisma.__mocks.findUnique.mockResolvedValueOnce(null);

    const fakeApp = { client: { chat: { postMessage: jest.fn() } } };
    const result = await standupService.postTeamStandup(
      {
        id: "t1",
        name: "Eng",
        slackChannelId: "C123",
        organizationId: "o1",
        timezone: "UTC",
      },
      new Date("2024-01-01"),
      fakeApp
    );

    // Guard did not fire — execution fell through to the no-data skip path,
    // which bare-returns undefined (no { skipped: true }).
    expect(result).toBeUndefined();
  });

  it("does not skip when the existing post has a null slackMessageTs", async () => {
    prisma.__mocks.findUnique.mockResolvedValueOnce({
      id: "p1",
      teamId: "t1",
      standupDate: new Date("2024-01-01"),
      slackMessageTs: null,
      channelId: "C123",
    });

    const fakeApp = { client: { chat: { postMessage: jest.fn() } } };
    const result = await standupService.postTeamStandup(
      {
        id: "t1",
        name: "Eng",
        slackChannelId: "C123",
        organizationId: "o1",
        timezone: "UTC",
      },
      new Date("2024-01-01"),
      fakeApp
    );

    // A row with no slackMessageTs must not block a (re)post.
    expect(result).toBeUndefined();
  });
});
