jest.mock("../../src/config/prisma", () => ({
  standupResponse: { findFirst: jest.fn(), findMany: jest.fn() },
  standupPost: { findUnique: jest.fn(), upsert: jest.fn() },
  team: { findUnique: jest.fn() },
  teamMember: { findMany: jest.fn() },
  holiday: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
}));

const prisma = require("../../src/config/prisma");
const standupService = require("../../src/services/standupService");

describe("getUserResponse", () => {
  beforeEach(() => jest.clearAllMocks());

  it("queries the member's response for the date window", async () => {
    const row = { id: "r1", user: { slackUserId: "U1" } };
    prisma.standupResponse.findFirst.mockResolvedValue(row);

    const result = await standupService.getUserResponse(
      "t1",
      "u1",
      new Date("2025-01-15T10:00:00Z")
    );

    expect(result).toBe(row);
    const arg = prisma.standupResponse.findFirst.mock.calls[0][0];
    expect(arg.where.teamId).toBe("t1");
    expect(arg.where.userId).toBe("u1");
    expect(arg.where.standupDate.gte).toBeInstanceOf(Date);
    expect(arg.where.standupDate.lte).toBeInstanceOf(Date);
    expect(arg.include).toEqual({ user: true });
  });

  it("returns null when there is no response", async () => {
    prisma.standupResponse.findFirst.mockResolvedValue(null);
    const result = await standupService.getUserResponse("t1", "u1", new Date());
    expect(result).toBeNull();
  });
});

describe("formatIndividualResponseMessage", () => {
  it("returns text and blocks with the member section, no admin label", async () => {
    const response = {
      user: { slackUserId: "U1", name: "Alice" },
      yesterdayTasks: "shipped X",
      todayTasks: "review Y",
      blockers: null,
    };

    const msg = await standupService.formatIndividualResponseMessage(response);

    expect(typeof msg.text).toBe("string");
    expect(msg.text).toContain("Alice");
    expect(Array.isArray(msg.blocks)).toBe(true);
    // First block is the member header section "*👤 <@U1>*"
    expect(msg.blocks[0].text.text).toContain("<@U1>");
    // No "Late Submission" / "posted by admin" labelling anywhere
    const serialized = JSON.stringify(msg.blocks);
    expect(serialized).not.toContain("Late Submission");
    expect(serialized.toLowerCase()).not.toContain("posted by admin");
  });
});

describe("postIndividualResponse", () => {
  const team = { id: "t1", name: "Eng", slackChannelId: "C1" };
  const response = {
    user: { slackUserId: "U1", name: "Alice" },
    yesterdayTasks: "a",
    todayTasks: "b",
    blockers: null,
  };

  afterEach(() => jest.restoreAllMocks());

  it("appends a threaded reply when a thread already exists", async () => {
    jest
      .spyOn(standupService, "getStandupPost")
      .mockResolvedValue({ slackMessageTs: "111.1", channelId: "C1" });
    const postTeam = jest
      .spyOn(standupService, "postTeamStandup")
      .mockResolvedValue({});
    const postMessage = jest.fn().mockResolvedValue({ ts: "222.2" });
    const slackApp = { client: { chat: { postMessage } } };

    const result = await standupService.postIndividualResponse(
      team,
      new Date("2025-01-15"),
      response,
      slackApp
    );

    expect(postTeam).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C1",
        thread_ts: "111.1",
        reply_broadcast: true,
      })
    );
    expect(result).toMatchObject({ ts: "222.2", channel: "C1" });
  });

  it("auto-posts the team summary first when no thread exists", async () => {
    jest
      .spyOn(standupService, "getStandupPost")
      .mockResolvedValueOnce(null) // before
      .mockResolvedValueOnce({ slackMessageTs: "333.3", channelId: "C1" }); // after
    const postTeam = jest
      .spyOn(standupService, "postTeamStandup")
      .mockResolvedValue({});
    const postMessage = jest.fn().mockResolvedValue({ ts: "444.4" });
    const slackApp = { client: { chat: { postMessage } } };

    await standupService.postIndividualResponse(
      team,
      new Date("2025-01-15"),
      response,
      slackApp
    );

    expect(postTeam).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ thread_ts: "333.3", reply_broadcast: true })
    );
  });

  it("throws when no thread can be found or created", async () => {
    jest.spyOn(standupService, "getStandupPost").mockResolvedValue(null);
    jest.spyOn(standupService, "postTeamStandup").mockResolvedValue({});
    const postMessage = jest.fn();
    const slackApp = { client: { chat: { postMessage } } };

    await expect(
      standupService.postIndividualResponse(
        team,
        new Date("2025-01-15"),
        response,
        slackApp
      )
    ).rejects.toThrow();
    expect(postMessage).not.toHaveBeenCalled();
  });
});
