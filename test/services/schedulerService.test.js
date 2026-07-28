jest.mock("../../src/services/standupService", () => ({
  getActiveMembers: jest.fn(),
  getTeamResponses: jest.fn(),
}));
jest.mock("../../src/services/teamService", () => ({}));
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const standupService = require("../../src/services/standupService");
const schedulerService = require("../../src/services/schedulerService");

const team = {
  id: "team-1",
  name: "Test Team",
  timezone: "Asia/Dhaka",
  postingTime: "11:00",
};

function member(
  slackUserId,
  { role = "MEMBER", receiveNotifications = true } = {}
) {
  return {
    userId: slackUserId,
    role,
    receiveNotifications,
    user: { slackUserId },
  };
}

describe("schedulerService reminder eligibility", () => {
  let postMessage;

  beforeEach(() => {
    postMessage = jest.fn().mockResolvedValue({});
    schedulerService.app = { client: { chat: { postMessage } } };
    jest.clearAllMocks();
  });

  it("sendStandupReminders skips admins and members who opted out of notifications", async () => {
    standupService.getActiveMembers.mockResolvedValue([
      member("U_MEMBER"),
      member("U_OPTED_OUT", { receiveNotifications: false }),
      member("U_ADMIN", { role: "ADMIN" }),
    ]);

    await schedulerService.sendStandupReminders(team);

    const recipients = postMessage.mock.calls.map(([args]) => args.channel);
    expect(recipients).toEqual(["U_MEMBER"]);
  });

  it("sendFollowupReminders skips opted-out members, admins, and prior responders", async () => {
    standupService.getActiveMembers.mockResolvedValue([
      member("U_MEMBER"),
      member("U_OPTED_OUT", { receiveNotifications: false }),
      member("U_RESPONDED"),
      member("U_ADMIN", { role: "ADMIN" }),
    ]);
    standupService.getTeamResponses.mockResolvedValue([
      { userId: "U_RESPONDED" },
    ]);

    await schedulerService.sendFollowupReminders(team);

    const recipients = postMessage.mock.calls.map(([args]) => args.channel);
    expect(recipients).toEqual(["U_MEMBER"]);
  });
});

describe("schedulerService.pruneStaleJobs", () => {
  beforeEach(() => schedulerService.scheduledJobs.clear());

  it("stops jobs for teams not in the active ID list, leaving active teams' jobs alone", () => {
    const stopStale = jest.fn();
    const stopActive = jest.fn();
    schedulerService.scheduledJobs.set("standup-stale-team", {
      stop: stopStale,
    });
    schedulerService.scheduledJobs.set("followup-stale-team", {
      stop: stopStale,
    });
    schedulerService.scheduledJobs.set("posting-stale-team", {
      stop: stopStale,
    });
    schedulerService.scheduledJobs.set("standup-active-team", {
      stop: stopActive,
    });

    schedulerService.pruneStaleJobs(["active-team"]);

    expect(stopStale).toHaveBeenCalledTimes(3);
    expect(stopActive).not.toHaveBeenCalled();
    expect(schedulerService.scheduledJobs.has("standup-stale-team")).toBe(
      false
    );
    expect(schedulerService.scheduledJobs.has("followup-stale-team")).toBe(
      false
    );
    expect(schedulerService.scheduledJobs.has("posting-stale-team")).toBe(
      false
    );
    expect(schedulerService.scheduledJobs.has("standup-active-team")).toBe(
      true
    );
  });

  it("ignores jobs that don't match the standup/followup/posting naming convention", () => {
    const stop = jest.fn();
    schedulerService.scheduledJobs.set("schedule-refresh", { stop });

    schedulerService.pruneStaleJobs([]);

    expect(stop).not.toHaveBeenCalled();
    expect(schedulerService.scheduledJobs.has("schedule-refresh")).toBe(true);
  });
});

describe("schedulerService.stopTeamSchedule", () => {
  it("stops and removes all three of a team's cron jobs", () => {
    const stop = jest.fn();
    schedulerService.scheduledJobs.set("standup-team-1", { stop });
    schedulerService.scheduledJobs.set("followup-team-1", { stop });
    schedulerService.scheduledJobs.set("posting-team-1", { stop });
    // A job for another team must be left untouched.
    schedulerService.scheduledJobs.set("standup-team-2", { stop });

    schedulerService.stopTeamSchedule("team-1");

    expect(stop).toHaveBeenCalledTimes(3);
    expect(schedulerService.scheduledJobs.has("standup-team-1")).toBe(false);
    expect(schedulerService.scheduledJobs.has("followup-team-1")).toBe(false);
    expect(schedulerService.scheduledJobs.has("posting-team-1")).toBe(false);
    expect(schedulerService.scheduledJobs.has("standup-team-2")).toBe(true);
  });
});
