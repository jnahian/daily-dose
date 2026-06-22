# Member Status in Team Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each team member's current status (today's standup, on-leave, notifications, role, active/inactive) in `/dd-team-members` (detailed cards) and `/dd-team-list` (compact, nested under each team).

**Architecture:** A pure resolver (`deriveMemberStatus`) encodes the status precedence and is unit-tested in isolation. A new `teamService.getTeamMembersWithStatus` assembles the raw per-member facts from the DB (reusing `getHolidayDateSet` / `isWorkingDayPure` for work-day gating). Two new `blockHelper` functions render the two layouts. The two command handlers in `team.js` wire them together.

**Tech Stack:** Node.js, Slack Bolt, Prisma (PostgreSQL), dayjs, Jest.

## Global Constraints

- **All Block Kit lives in `src/utils/blockHelper.js`** — never inline blocks at call sites.
- **No parallel Slack/DB fan-out across teams** — process teams sequentially.
- **Prisma client** is imported from `src/config/prisma`.
- **Dates:** use dayjs with the team's timezone; "today" = `dayjs().tz(team.timezone).startOf("day")`.
- **Match existing query patterns** — do not add `deletedAt` filtering (existing leave/response queries omit it).
- **Two changelogs:** `CHANGELOG.md` always; `web/src/data/changelog.json` only for the user-facing summary. No Slack manifest change (no new command).
- **Status precedence (first match wins):** inactive (team OR org) → on-leave → admin (suppress standup) → non-work-day (suppress standup) → submitted → not-submitted.

---

### Task 1: Pure status resolver `deriveMemberStatus`

**Files:**
- Create: `src/utils/memberStatusHelper.js`
- Test: `test/utils/memberStatusHelper.test.js`

**Interfaces:**
- Produces: `deriveMemberStatus(member) → { active: boolean, inactiveScope: 'team'|'org'|null, standup: 'leave'|'submitted'|'pending'|null }`
  - Input `member`: `{ role, teamActive, orgActive, onLeave, workingToday, responded }`
  - `active` = `teamActive && orgActive`.
  - `inactiveScope` = `null` when active; else `'team'` if `!teamActive`, otherwise `'org'`.
  - `standup` = `null` when inactive, admin, or non-work-day; `'leave'` when on leave; else `'submitted'`/`'pending'` by `responded`. On-leave outranks admin/work-day.

- [ ] **Step 1: Write the failing test**

```js
// test/utils/memberStatusHelper.test.js
const { deriveMemberStatus } = require("../../src/utils/memberStatusHelper");

const base = {
  role: "MEMBER",
  teamActive: true,
  orgActive: true,
  onLeave: false,
  workingToday: true,
  responded: false,
};

describe("deriveMemberStatus", () => {
  it("flags team-inactive members and suppresses standup", () => {
    expect(deriveMemberStatus({ ...base, teamActive: false })).toEqual({
      active: false,
      inactiveScope: "team",
      standup: null,
    });
  });

  it("flags org-inactive members (team active) as org scope", () => {
    expect(deriveMemberStatus({ ...base, orgActive: false })).toEqual({
      active: false,
      inactiveScope: "org",
      standup: null,
    });
  });

  it("prefers team scope when inactive in both", () => {
    expect(
      deriveMemberStatus({ ...base, teamActive: false, orgActive: false })
        .inactiveScope
    ).toBe("team");
  });

  it("shows on-leave even for admins", () => {
    expect(
      deriveMemberStatus({ ...base, role: "ADMIN", onLeave: true }).standup
    ).toBe("leave");
  });

  it("suppresses standup for active admins", () => {
    expect(deriveMemberStatus({ ...base, role: "ADMIN" }).standup).toBeNull();
  });

  it("suppresses standup on a non-work-day", () => {
    expect(deriveMemberStatus({ ...base, workingToday: false }).standup).toBeNull();
  });

  it("reports submitted when responded on a work day", () => {
    expect(deriveMemberStatus({ ...base, responded: true }).standup).toBe(
      "submitted"
    );
  });

  it("reports pending when not responded on a work day", () => {
    expect(deriveMemberStatus(base).standup).toBe("pending");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/utils/memberStatusHelper.test.js`
Expected: FAIL — `Cannot find module '../../src/utils/memberStatusHelper'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/memberStatusHelper.js
/**
 * Pure resolver for a team member's display status.
 * @param {Object} member
 * @param {('ADMIN'|'MEMBER')} member.role
 * @param {boolean} member.teamActive  TeamMember.isActive
 * @param {boolean} member.orgActive   OrganizationMember.isActive
 * @param {boolean} member.onLeave     leave overlaps today
 * @param {boolean} member.workingToday today is a work day (and not a holiday)
 * @param {boolean} member.responded   submitted a standup today
 * @returns {{active: boolean, inactiveScope: ('team'|'org'|null), standup: ('leave'|'submitted'|'pending'|null)}}
 */
function deriveMemberStatus({
  role,
  teamActive,
  orgActive,
  onLeave,
  workingToday,
  responded,
}) {
  const active = teamActive && orgActive;
  if (!active) {
    return {
      active: false,
      inactiveScope: !teamActive ? "team" : "org",
      standup: null,
    };
  }

  let standup;
  if (onLeave) {
    standup = "leave";
  } else if (role === "ADMIN" || !workingToday) {
    standup = null;
  } else {
    standup = responded ? "submitted" : "pending";
  }

  return { active: true, inactiveScope: null, standup };
}

module.exports = { deriveMemberStatus };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/utils/memberStatusHelper.test.js`
Expected: PASS (8 passing).

- [ ] **Step 5: Commit**

```bash
git add src/utils/memberStatusHelper.js test/utils/memberStatusHelper.test.js
git commit -m "feat: add deriveMemberStatus precedence resolver"
```

---

### Task 2: Data layer `teamService.getTeamMembersWithStatus`

**Files:**
- Modify: `src/services/teamService.js` (add method; add imports)
- Test: `test/services/teamServiceMemberStatus.test.js`

**Interfaces:**
- Consumes: `getHolidayDateSet`, `isWorkingDayPure`, `getOrgDefaultWorkDays` from `src/utils/dateHelper`.
- Produces: `async getTeamMembersWithStatus(teamId, date = null) → Array<{ user, role, teamActive, orgActive, receiveNotifications, onLeave, workingToday, responded }>`
  - `date` defaults to today in the team's timezone.
  - `user` is the full Prisma `User` (has `slackUserId`, `name`, `username`, `timezone`, `workDays`).
  - Returns `[]` if the team has no members.

Add these imports near the top of `teamService.js` (file already imports `prisma` from `../config/prisma`):

```js
const {
  getHolidayDateSet,
  isWorkingDayPure,
  getOrgDefaultWorkDays,
} = require("../utils/dateHelper");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);
```

> Note: if any of these (`dayjs`, the plugins, or a dateHelper import) are already imported in `teamService.js`, do not duplicate them — add only what's missing.

- [ ] **Step 1: Write the failing test**

```js
// test/services/teamServiceMemberStatus.test.js
jest.mock("../../src/config/prisma", () => ({
  team: { findUnique: jest.fn() },
  teamMember: { findMany: jest.fn() },
  organizationMember: { findMany: jest.fn() },
  standupResponse: { findMany: jest.fn() },
  leave: { findMany: jest.fn() },
  holiday: { findMany: jest.fn() },
}));

const prisma = require("../../src/config/prisma");
const teamService = require("../../src/services/teamService");

const team = {
  id: "t1",
  organizationId: "o1",
  timezone: "America/New_York",
  organization: { id: "o1", settings: { defaultWorkDays: [1, 2, 3, 4, 5] } },
};

// A fixed work-day Wednesday (ISO day 3) for deterministic workingToday.
const WED = new Date("2026-06-24T12:00:00Z");

beforeEach(() => {
  jest.clearAllMocks();
  prisma.team.findUnique.mockResolvedValue(team);
  prisma.holiday.findMany.mockResolvedValue([]);
  prisma.organizationMember.findMany.mockResolvedValue([
    { userId: "u1", isActive: true },
    { userId: "u2", isActive: false },
  ]);
  prisma.standupResponse.findMany.mockResolvedValue([{ userId: "u1" }]);
  prisma.leave.findMany.mockResolvedValue([{ userId: "u3" }]);
  prisma.teamMember.findMany.mockResolvedValue([
    {
      role: "MEMBER",
      isActive: true,
      receiveNotifications: true,
      userId: "u1",
      user: { id: "u1", slackUserId: "U1", name: "Alice", workDays: [1, 2, 3, 4, 5] },
    },
    {
      role: "MEMBER",
      isActive: true,
      receiveNotifications: false,
      userId: "u2",
      user: { id: "u2", slackUserId: "U2", name: "Bob", workDays: null },
    },
    {
      role: "ADMIN",
      isActive: true,
      receiveNotifications: true,
      userId: "u3",
      user: { id: "u3", slackUserId: "U3", name: "Carol", workDays: null },
    },
  ]);
});

describe("getTeamMembersWithStatus", () => {
  it("enriches each member with responded/onLeave/orgActive/workingToday", async () => {
    const out = await teamService.getTeamMembersWithStatus("t1", WED);
    const byId = Object.fromEntries(out.map((m) => [m.user.slackUserId, m]));

    expect(byId.U1).toMatchObject({
      role: "MEMBER",
      teamActive: true,
      orgActive: true,
      receiveNotifications: true,
      onLeave: false,
      responded: true,
      workingToday: true,
    });
    expect(byId.U2).toMatchObject({ orgActive: false, responded: false });
    expect(byId.U3).toMatchObject({ role: "ADMIN", onLeave: true });
  });

  it("returns [] when the team has no members", async () => {
    prisma.teamMember.findMany.mockResolvedValue([]);
    expect(await teamService.getTeamMembersWithStatus("t1", WED)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/services/teamServiceMemberStatus.test.js`
Expected: FAIL — `teamService.getTeamMembersWithStatus is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add this method to the `TeamService` class in `src/services/teamService.js` (e.g. just after `getTeamMembers`):

```js
async getTeamMembersWithStatus(teamId, date = null) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { organization: true },
  });
  if (!team) return [];

  const targetDate = date
    ? dayjs(date)
    : dayjs().tz(team.timezone).startOf("day");
  const startOfDay = targetDate.startOf("day").toDate();
  const endOfDay = targetDate.endOf("day").toDate();

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: true },
  });
  if (members.length === 0) return [];

  const userIds = members.map((m) => m.userId);

  const [orgMembers, responses, leaves, holidayDateSet] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: team.organizationId, userId: { in: userIds } },
      select: { userId: true, isActive: true },
    }),
    prisma.standupResponse.findMany({
      where: { teamId, standupDate: { gte: startOfDay, lte: endOfDay } },
      select: { userId: true },
    }),
    prisma.leave.findMany({
      where: {
        userId: { in: userIds },
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
      },
      select: { userId: true },
    }),
    getHolidayDateSet(team.organizationId, startOfDay, endOfDay),
  ]);

  const orgActiveById = new Map(orgMembers.map((o) => [o.userId, o.isActive]));
  const respondedIds = new Set(responses.map((r) => r.userId));
  const onLeaveIds = new Set(leaves.map((l) => l.userId));
  const orgDefaultWorkDays = getOrgDefaultWorkDays(team.organization?.settings);
  const dateValue = targetDate.toDate();

  return members.map((m) => {
    const workDays = m.user.workDays?.length
      ? m.user.workDays
      : orgDefaultWorkDays;
    return {
      user: m.user,
      role: m.role,
      teamActive: m.isActive,
      orgActive: orgActiveById.get(m.userId) ?? true,
      receiveNotifications: m.receiveNotifications,
      onLeave: onLeaveIds.has(m.userId),
      workingToday: isWorkingDayPure({ date: dateValue, workDays, holidayDateSet }),
      responded: respondedIds.has(m.userId),
    };
  });
}
```

> The `Promise.all` here batches independent **reads of one team** — it is not the cross-team fan-out the repo prohibits. Callers still iterate teams sequentially.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/services/teamServiceMemberStatus.test.js`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add src/services/teamService.js test/services/teamServiceMemberStatus.test.js
git commit -m "feat: add teamService.getTeamMembersWithStatus"
```

---

### Task 3: Block helpers for both layouts

**Files:**
- Modify: `src/utils/blockHelper.js` (add two functions + exports)
- Test: `test/utils/teamMemberStatusBlocks.test.js`

**Interfaces:**
- Consumes: `deriveMemberStatus` from `src/utils/memberStatusHelper`; `getDisplayName` from `src/utils/userHelper`; `formatTime12Hour` from `src/utils/dateHelper`; existing `createSectionBlock`, `createContextBlock` (same file).
- Produces:
  - `createTeamMembersStatusBlocks(team, members) → Block[]` — Option C, one section block per member.
  - `createTeamListWithMembersBlocks({ heading, teams }) → Block[]` — Option A. `teams` is `Array<{ team, members }>`; one section block per team, a leading heading section, and a trailing legend context block.
- `members` items are the enriched objects from Task 2.

Note `blockHelper.js` already imports `createSectionBlock`/`createContextBlock` locally (defined in-file). Add at the top of `blockHelper.js`:

```js
const { deriveMemberStatus } = require("./memberStatusHelper");
const { getDisplayName } = require("./userHelper");
const { formatTime12Hour } = require("./dateHelper");
```

> If `getDisplayName` / `formatTime12Hour` are already imported in `blockHelper.js`, don't duplicate.

- [ ] **Step 1: Write the failing test**

```js
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
  { user: { slackUserId: "U1", name: "Alice" }, role: "ADMIN", teamActive: true, orgActive: true, receiveNotifications: true, onLeave: false, workingToday: true, responded: false },
  { user: { slackUserId: "U2", name: "Bob" }, role: "MEMBER", teamActive: true, orgActive: true, receiveNotifications: false, onLeave: false, workingToday: true, responded: false },
  { user: { slackUserId: "U3", name: "Carol" }, role: "MEMBER", teamActive: true, orgActive: true, receiveNotifications: true, onLeave: true, workingToday: true, responded: false },
  { user: { slackUserId: "U4", name: "Dave" }, role: "MEMBER", teamActive: true, orgActive: true, receiveNotifications: true, onLeave: false, workingToday: true, responded: true },
  { user: { slackUserId: "U5", name: "Eve" }, role: "MEMBER", teamActive: false, orgActive: true, receiveNotifications: true, onLeave: false, workingToday: true, responded: false },
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
    expect(text).not.toMatch(/Alice[\s\S]*Not submitted/);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/utils/teamMemberStatusBlocks.test.js`
Expected: FAIL — `createTeamMembersStatusBlocks is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `src/utils/blockHelper.js` (before `module.exports`):

```js
const STATUS_LABELS = {
  leave: "🌴 On leave today",
  submitted: "✅ Submitted today",
  pending: "⏳ Not submitted",
};
const STATUS_EMOJI = { leave: "🌴", submitted: "✅", pending: "⏳" };

// Option C — detailed two-line card per member.
function createTeamMembersStatusBlocks(team, members) {
  const activeCount = members.filter(
    (m) => m.teamActive && m.orgActive
  ).length;
  const inactiveCount = members.length - activeCount;
  const countLine =
    inactiveCount > 0
      ? `${activeCount} active · ${inactiveCount} inactive`
      : `${activeCount} active`;

  const blocks = [
    createSectionBlock(`*👥 Members of "${team.name}"*\n${countLine}`),
  ];

  for (const m of members) {
    const status = deriveMemberStatus(m);
    const name = getDisplayName(m.user);
    const roleLabel = m.role === "ADMIN" ? "Admin" : "Member";

    if (!status.active) {
      blocks.push(
        createSectionBlock(
          `💤 *${name}* (<@${m.user.slackUserId}>) — ${roleLabel}\n    ⚪ Inactive in ${status.inactiveScope}`
        )
      );
      continue;
    }

    const roleIcon = m.role === "ADMIN" ? "👑" : "👤";
    const parts = [];
    if (status.standup) parts.push(STATUS_LABELS[status.standup]);
    parts.push(
      m.receiveNotifications ? "🔔 Notifications on" : "🔕 Notifications off"
    );
    parts.push("🟢 Active");

    blocks.push(
      createSectionBlock(
        `${roleIcon} *${name}* (<@${m.user.slackUserId}>) — ${roleLabel}\n    ${parts.join(
          "  ·  "
        )}`
      )
    );
  }

  return blocks;
}

// Option A — compact one-line-per-member, nested under each team.
function createTeamListWithMembersBlocks({ heading, teams }) {
  const blocks = [createSectionBlock(heading)];

  for (const { team, members } of teams) {
    const meta =
      `*👥 ${team.name} — ${members.length} members*\n` +
      `🔔 Reminder: ${formatTime12Hour(team.standupTime)} | ` +
      `📊 Posting: ${formatTime12Hour(team.postingTime)} | 🌍 ${team.timezone}`;

    const lines = members.map((m) => {
      const status = deriveMemberStatus(m);
      if (!status.active) return `💤 <@${m.user.slackUserId}> · inactive`;
      const roleIcon = m.role === "ADMIN" ? "👑" : "👤";
      const parts = [`${roleIcon} <@${m.user.slackUserId}>`];
      if (status.standup) parts.push(STATUS_EMOJI[status.standup]);
      parts.push(m.receiveNotifications ? "🔔" : "🔕");
      return parts.join(" · ");
    });

    blocks.push(createSectionBlock(`${meta}\n${lines.join("\n")}`));
  }

  blocks.push(
    createContextBlock(
      "✅ submitted · ⏳ not submitted · 🌴 on leave · 💤 inactive · 🔔/🔕 notifications on/off"
    )
  );

  return blocks;
}
```

Add both names to the `module.exports` object in `blockHelper.js`:

```js
  createTeamMembersStatusBlocks,
  createTeamListWithMembersBlocks,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/utils/teamMemberStatusBlocks.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/utils/blockHelper.js test/utils/teamMemberStatusBlocks.test.js
git commit -m "feat: add team member status block helpers (Options A & C)"
```

---

### Task 4: Wire `listMembers` (`/dd-team-members`)

**Files:**
- Modify: `src/commands/team.js` — `listMembers` (lines ~321-390) and the `blockHelper` import block (lines ~8-12).

**Interfaces:**
- Consumes: `teamService.getTeamMembersWithStatus` (Task 2), `createTeamMembersStatusBlocks` (Task 3).

This task is verified manually (the handler depends on Slack `ack`/`respond`); there is no unit test step. The deliverable is the wiring + a green full test run.

- [ ] **Step 1: Add the import**

In the `require("../utils/blockHelper")` destructure at the top of `team.js`, add `createTeamMembersStatusBlocks`:

```js
const {
  createSectionBlock,
  createCommandErrorBlocks,
  createTeamApprovalResultBlocks,
  createTeamMembersStatusBlocks,
} = require("../utils/blockHelper");
```

- [ ] **Step 2: Replace the member-rendering body**

In `listMembers`, replace the block that starts at `const members = await teamService.getTeamMembers(team.id);` through the `await updateResponse({ blocks: [ createSectionBlock(...) ] });` call with:

```js
    const members = await teamService.getTeamMembersWithStatus(team.id);

    if (members.length === 0) {
      await updateResponse({
        text: `📋 No members found in team "${team.name}"`,
      });
      return;
    }

    await updateResponse({
      blocks: createTeamMembersStatusBlocks(team, members),
    });
```

(Leave the surrounding team-resolution and `try/catch` exactly as they are.)

- [ ] **Step 3: Run the full suite**

Run: `npx jest`
Expected: PASS — no regressions.

- [ ] **Step 4: Manual check in Slack (note for executor)**

Run `/dd-team-members` in a team channel and with an explicit team name. Confirm: admin shows no ✅/⏳; a submitted member shows ✅; an on-leave member shows 🌴; an inactive member shows 💤 + "Inactive in team/org"; the count line reads "N active · M inactive".

- [ ] **Step 5: Commit**

```bash
git add src/commands/team.js
git commit -m "feat: show member status in /dd-team-members"
```

---

### Task 5: Wire `listTeams` (`/dd-team-list`)

**Files:**
- Modify: `src/commands/team.js` — `listTeams` (lines ~271-319) and the `blockHelper` import block.

**Interfaces:**
- Consumes: `teamService.getTeamMembersWithStatus` (Task 2), `createTeamListWithMembersBlocks` (Task 3).

Manual-verified (Slack handler). Deliverable is wiring + green suite.

- [ ] **Step 1: Add the import**

Add `createTeamListWithMembersBlocks` to the same `blockHelper` destructure:

```js
  createTeamListWithMembersBlocks,
```

- [ ] **Step 2: Replace the team-rendering body**

In `listTeams`, replace the block from `const teamList = teams.map(...)` through the final `await updateResponse({ blocks: [createSectionBlock(...)] });` with sequential per-team status fetching + the new helper:

```js
    const heading =
      scope === "all"
        ? `*📋 Teams in ${organization.name}:*`
        : `*📋 Your teams:*`;

    // Sequential, not parallel — avoid cross-team DB/Slack fan-out.
    const teamsWithMembers = [];
    for (const t of teams) {
      const members = await teamService.getTeamMembersWithStatus(t.id);
      teamsWithMembers.push({ team: t, members });
    }

    await updateResponse({
      blocks: createTeamListWithMembersBlocks({
        heading,
        teams: teamsWithMembers,
      }),
    });
```

(Keep the empty-teams early return and the `try/catch` as they are. The `formatTime12Hour` import in `team.js` may become unused after this change — if so, remove it from the import line; if `formatTime12Hour` is still referenced elsewhere in the file, leave it.)

- [ ] **Step 3: Run the full suite**

Run: `npx jest`
Expected: PASS.

- [ ] **Step 4: Lint (catch any now-unused import)**

Run: `npm run lint`
Expected: PASS — no `no-unused-vars` errors. Fix any flagged unused import created by this change only.

- [ ] **Step 5: Manual check in Slack (note for executor)**

Run `/dd-team-list` as a regular member (own teams) and as an org owner/admin (all teams). Confirm each team keeps its meta line, members appear compactly with status emoji, and the legend renders once at the bottom.

- [ ] **Step 6: Commit**

```bash
git add src/commands/team.js
git commit -m "feat: nest member status under teams in /dd-team-list"
```

---

### Task 6: Documentation

**Files:**
- Modify: `README.md` (command descriptions for `/dd-team-list` and `/dd-team-members`)
- Modify: `CHANGELOG.md` (technical entry under a new Unreleased/next-version section)
- Modify: `web/src/data/changelog.json` (user-facing entry)

Docs-only; verified by reading. No code test.

- [ ] **Step 1: Update README**

Find the `/dd-team-list` and `/dd-team-members` entries in `README.md` and note that both now show per-member status (today's standup, on-leave, notifications, role, active/inactive). Match the existing list formatting in that section.

- [ ] **Step 2: Update CHANGELOG.md**

Add under the top `Added` list (create an Unreleased section if the file's format uses one):

```markdown
- Member status in `/dd-team-list` (compact, nested per team) and `/dd-team-members` (detailed cards): today's standup, on-leave, notifications on/off, role, and active/inactive (team & org). Standup status is suppressed for admins and on non-work-days/holidays. New `deriveMemberStatus` resolver, `teamService.getTeamMembersWithStatus`, and `blockHelper` renderers.
```

- [ ] **Step 3: Update changelog.json**

Add a user-facing entry (match the existing object shape in `web/src/data/changelog.json` — inspect the first entry for the exact keys/format before writing):

```json
{ "type": "added", "title": "See who's done their standup at a glance", "items": ["/dd-team-members now shows each member's status — submitted, not yet, on leave, notifications, and role.", "/dd-team-list lists members under each team with the same at-a-glance status."] }
```

- [ ] **Step 4: Verify formatting**

Run: `npm run format:check` (or `npm run format` then re-stage) and confirm `web/src/data/changelog.json` is valid JSON: `node -e "require('./web/src/data/changelog.json')"`.
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md web/src/data/changelog.json
git commit -m "docs: document member status in team-list & team-members"
```

---

## Self-Review

**Spec coverage:**
- Status model / precedence → Task 1 (resolver) + Task 2 (facts). ✅
- Suppress on non-work-days, holidays → Task 2 `workingToday` via `isWorkingDayPure`; Task 1 suppresses. ✅
- Admins suppressed → Task 1. ✅
- Show inactive (team & org) → Task 2 `teamActive`/`orgActive`; Task 1 `inactiveScope`; Tasks 3 render. ✅
- `hideFromNotResponded` ignored → not queried anywhere (everyone listed). ✅
- Option C for `/dd-team-members` → Tasks 3 + 4. ✅
- Option A nested + meta line retained for `/dd-team-list` → Tasks 3 + 5. ✅
- Per-team section blocks (3000-char limit) → Task 3 (`createTeamListWithMembersBlocks` emits one section per team). ✅
- Sequential team processing → Task 5. ✅
- Tests for resolver + block shape → Tasks 1, 3; service test Task 2. ✅
- Docs (README, CHANGELOG.md, changelog.json) → Task 6. ✅

**Placeholder scan:** No TBD/TODO; all steps contain concrete code/commands.

**Type consistency:** `deriveMemberStatus` returns `{active, inactiveScope, standup}` — consumed identically in Tasks 1 and 3. Enriched member shape `{user, role, teamActive, orgActive, receiveNotifications, onLeave, workingToday, responded}` produced in Task 2, consumed in Tasks 1 & 3. `createTeamListWithMembersBlocks({heading, teams})` signature matches Task 5's call. ✅
