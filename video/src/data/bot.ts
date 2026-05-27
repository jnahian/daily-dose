// Fixture data for mocked Slack UI — matches real bot name from slack-app-manifest.json
export const BOT = {
  name: "Daily Dose",
  avatarBg: "#2c3e50",
  avatarEmoji: "📊",   // fallback if image isn't available
  avatarLogo: true,    // use logo.png via staticFile in DmMessage / ChannelPost
};

export const TEAM = {
  name: "Engineering",
  date: "Tuesday, May 27",
};

export const MEMBERS = [
  {
    name: "Alex K.",
    initials: "AK",
    avatarColor: "#4f46e5",
    yesterday: "Reviewed PR #241, updated deployment docs",
    today: "Ship the auth refactor",
    blockers: "None",
  },
  {
    name: "Priya S.",
    initials: "PS",
    avatarColor: "#0891b2",
    yesterday: "Fixed the scheduler timezone bug",
    today: "Write tests for notification service",
    blockers: "Waiting on design review",
  },
  {
    name: "You",
    initials: "ME",
    avatarColor: "#059669",
    yesterday: "Finished onboarding docs",
    today: "First standup with Daily Dose 🎉",
    blockers: "None",
  },
];
