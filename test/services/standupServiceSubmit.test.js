jest.mock("../../src/config/prisma", () => ({}));
jest.mock("../../src/services/userService", () => ({
  fetchSlackUserData: jest.fn(),
  findOrCreateUser: jest.fn(),
}));
jest.mock("../../src/services/notificationService", () => ({
  notifyAdminsOfStandupSubmission: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const dayjs = require("dayjs");
const standupService = require("../../src/services/standupService");
const notificationService = require("../../src/services/notificationService");

const team = {
  id: "team-1",
  name: "Eng",
  timezone: "Asia/Dhaka",
  postingTime: "11:00",
  slackChannelId: "C123",
};

function buildArgs(overrides = {}) {
  return {
    team,
    slackUserId: "U1",
    name: "Alice",
    fields: { yesterdayTasks: "y", todayTasks: "t", blockers: "" },
    standupDate: dayjs().tz(team.timezone).startOf("day").toDate(),
    isUpdate: false,
    slackClient: { chat: { postMessage: jest.fn() } },
    ...overrides,
  };
}

describe("standupService.submitStandup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(standupService, "saveResponse").mockResolvedValue({ id: "r1" });
    jest.spyOn(standupService, "getStandupPost").mockResolvedValue(null);
    jest.spyOn(standupService, "postStandupOnDemand").mockResolvedValue({});
  });

  it("saves the response and notifies admins", async () => {
    const args = buildArgs();
    await standupService.submitStandup(args);

    expect(standupService.saveResponse).toHaveBeenCalledWith(
      "team-1",
      "U1",
      expect.objectContaining({ yesterdayTasks: "y", todayTasks: "t" }),
      expect.any(Boolean),
      args.slackClient
    );
    expect(
      notificationService.notifyAdminsOfStandupSubmission
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        user: { id: "U1", name: "Alice" },
        team,
      })
    );
  });

  it("returns isLate=false before posting time", async () => {
    // Build a 'now' that is before 11:00 by submitting for a date and stubbing dayjs is hard;
    // instead assert the field flows through: postingTime far in the future of the day start.
    const result = await standupService.submitStandup(
      buildArgs({ team: { ...team, postingTime: "23:59" } })
    );
    expect(result.isLate).toBe(false);
    expect(standupService.postStandupOnDemand).not.toHaveBeenCalled();
  });

  it("when late and no parent post exists, creates the standup post", async () => {
    const result = await standupService.submitStandup(
      buildArgs({ team: { ...team, postingTime: "00:00" } })
    );
    expect(result.isLate).toBe(true);
    expect(standupService.postStandupOnDemand).toHaveBeenCalledWith(
      expect.objectContaining({ id: "team-1" }),
      expect.any(Date),
      { client: expect.anything() }
    );
  });

  it("when late and a parent post exists, threads the reply and skips postStandupOnDemand", async () => {
    jest
      .spyOn(standupService, "getStandupPost")
      .mockResolvedValue({ slackMessageTs: "ts123", channelId: "C123" });
    jest
      .spyOn(standupService, "formatLateResponseMessage")
      .mockResolvedValue({ blocks: [] });

    const args = buildArgs({ team: { ...team, postingTime: "00:00" } });
    await standupService.submitStandup(args);

    expect(args.slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C123",
        thread_ts: "ts123",
        reply_broadcast: true,
      })
    );
    expect(standupService.postStandupOnDemand).not.toHaveBeenCalled();
  });

  describe("isLate boundary around posting time", () => {
    beforeEach(() => {
      // 2026-06-17T11:30:00Z = 17:30 Asia/Dhaka (UTC+6)
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-06-17T11:30:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("is late when current time (17:30) is after postingTime 17:00", async () => {
      const result = await standupService.submitStandup(
        buildArgs({ team: { ...team, postingTime: "17:00" } })
      );
      expect(result.isLate).toBe(true);
    });

    it("is not late when current time (17:30) is before postingTime 18:00", async () => {
      const result = await standupService.submitStandup(
        buildArgs({ team: { ...team, postingTime: "18:00" } })
      );
      expect(result.isLate).toBe(false);
    });
  });
});
