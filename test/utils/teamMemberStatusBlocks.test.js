// test/utils/teamMemberStatusBlocks.test.js
const {
  createTeamMembersStatusBlocks,
  createTeamListWithMembersBlocks,
} = require("../../src/utils/blockHelper");

const team = {
  name: "Engineering",
  standupTime: "09:30",
  postingTime: "10:00",
  timezone: "America/New_York",
};

const members = [
  {
    user: { slackUserId: "U1", name: "Alice" },
    role: "ADMIN",
    teamActive: true,
    orgActive: true,
    receiveNotifications: true,
    onLeave: false,
    workingToday: true,
    responded: false,
  },
  {
    user: { slackUserId: "U2", name: "Bob" },
    role: "MEMBER",
    teamActive: true,
    orgActive: true,
    receiveNotifications: false,
    onLeave: false,
    workingToday: true,
    responded: false,
  },
  {
    user: { slackUserId: "U3", name: "Carol" },
    role: "MEMBER",
    teamActive: true,
    orgActive: true,
    receiveNotifications: true,
    onLeave: true,
    workingToday: true,
    responded: false,
  },
  {
    user: { slackUserId: "U4", name: "Dave" },
    role: "MEMBER",
    teamActive: true,
    orgActive: true,
    receiveNotifications: true,
    onLeave: false,
    workingToday: true,
    responded: true,
  },
  {
    user: { slackUserId: "U5", name: "Eve" },
    role: "MEMBER",
    teamActive: false,
    orgActive: true,
    receiveNotifications: true,
    onLeave: false,
    workingToday: true,
    responded: false,
  },
];

function allText(blocks) {
  return blocks
    .map((b) => b.text?.text || (b.elements || []).map((e) => e.text).join(" "))
    .join("\n");
}

describe("createTeamMembersStatusBlocks (Option C)", () => {
  const blocks = createTeamMembersStatusBlocks(team, members);
  const text = allText(blocks);

  it("shows an active/inactive count header", () => {
    expect(text).toContain("4 active");
    expect(text).toContain("1 inactive");
  });

  it("suppresses standup for the admin but shows notifications + active", () => {
    expect(text).toContain("👑 *Alice* (<@U1>) — Admin");
    // Scoped to Alice's own block: the plan's `/Alice[\s\S]*Not submitted/`
    // greedily spans into Bob's card (joined text), so it false-positives on
    // correct output. Intent is "Alice's card has no 'Not submitted'".
    const aliceBlock = blocks.find((b) => b.text?.text?.includes("Alice"));
    expect(aliceBlock.text.text).not.toContain("Not submitted");
    expect(text).toContain("🔔 Notifications on");
  });

  it("renders pending, on-leave, submitted, and inactive", () => {
    expect(text).toContain("⏳ Not submitted");
    expect(text).toContain("🔕 Notifications off");
    expect(text).toContain("🌴 On leave today");
    expect(text).toContain("✅ Submitted today");
    expect(text).toContain("💤 *Eve* (<@U5>) — Member");
    expect(text).toContain("⚪ Inactive in team");
  });
});

describe("createTeamListWithMembersBlocks (Option A)", () => {
  const blocks = createTeamListWithMembersBlocks({
    heading: "*📋 Your teams:*",
    teams: [{ team, members }],
  });
  const text = allText(blocks);

  it("keeps the per-team meta line", () => {
    expect(text).toContain("*👥 Engineering");
    expect(text).toContain("🔔 Reminder: 9:30 AM");
    expect(text).toContain("📊 Posting: 10:00 AM");
    expect(text).toContain("🌍 America/New_York");
  });

  it("renders compact member lines with status emoji", () => {
    expect(text).toContain("👑 <@U1> · 🔔");
    expect(text).toContain("👤 <@U2> · ⏳ · 🔕");
    expect(text).toContain("👤 <@U3> · 🌴 · 🔔");
    expect(text).toContain("👤 <@U4> · ✅ · 🔔");
    expect(text).toContain("💤 <@U5> · inactive");
  });

  it("ends with a legend context block", () => {
    const last = blocks[blocks.length - 1];
    expect(last.type).toBe("context");
    expect(last.elements[0].text).toContain("✅ submitted");
  });
});

function makeMember(i) {
  return {
    user: { slackUserId: `U${i}`, name: `Member ${i}` },
    role: "MEMBER",
    teamActive: true,
    orgActive: true,
    receiveNotifications: true,
    onLeave: false,
    workingToday: true,
    responded: false,
  };
}

describe("large-team guards", () => {
  it("Option C caps member cards under the 50-block limit", () => {
    const many = Array.from({ length: 60 }, (_, i) => makeMember(i));
    const blocks = createTeamMembersStatusBlocks(team, many);

    expect(blocks.length).toBeLessThanOrEqual(50);
    const last = blocks[blocks.length - 1];
    expect(last.type).toBe("context");
    expect(last.elements[0].text).toContain("13 more members not shown");
  });

  it("Option A keeps each team's section text within the 3000-char limit", () => {
    const many = Array.from({ length: 300 }, (_, i) => makeMember(i));
    const blocks = createTeamListWithMembersBlocks({
      heading: "*📋 Your teams:*",
      teams: [{ team, members: many }],
    });

    const teamBlock = blocks[1];
    expect(teamBlock.text.text.length).toBeLessThanOrEqual(3000);
    expect(teamBlock.text.text).toContain("…and");
  });

  it("Option A clamps a team section to 3000 chars even when the team name is huge", () => {
    const hugeTeam = { ...team, name: "X".repeat(5000) };
    const blocks = createTeamListWithMembersBlocks({
      heading: "*📋 Your teams:*",
      teams: [{ team: hugeTeam, members: [makeMember(1)] }],
    });
    expect(blocks[1].text.text.length).toBeLessThanOrEqual(3000);
  });

  it("Option A caps the number of team blocks under the 50-block limit", () => {
    const teams = Array.from({ length: 60 }, (_, i) => ({
      team: { ...team, name: `Team ${i}` },
      members: [makeMember(i)],
    }));
    const blocks = createTeamListWithMembersBlocks({
      heading: "*📋 Teams:*",
      teams,
    });

    expect(blocks.length).toBeLessThanOrEqual(50);
    const text = blocks
      .map(
        (b) => b.text?.text || (b.elements || []).map((e) => e.text).join(" ")
      )
      .join("\n");
    expect(text).toContain("more teams not shown");
  });
});
