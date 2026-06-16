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
