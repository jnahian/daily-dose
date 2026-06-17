# Standup MCP Server — Phase 2 (Read-Only Team Views) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two admin-gated read-only MCP tools — `get_team_standup` and `get_member_standup` — so a team admin/owner can view a team's standup summary or a single member's submission from any AI agent, returned as structured JSON.

**Architecture:** Both tools live in the existing `src/mcp/tools.js`, reusing the Phase 1 `resolveTeam` discovery primitive and the `standupService` data methods (`getTeamResponses`, `getLateResponses`, `getActiveMembers`, `getUserResponse`). Each tool re-checks `permissionHelper.canManageTeam(user.id, team.id)` at call time and throws the permission reason on denial. A new `src/mcp/memberResolver.js` resolves a free-text member identifier (Slack id, name, or username) to an internal user within the team — the MCP analogue of the slash command's mention-based `resolveTargetMember`. Read tools return JSON, never Block Kit.

**Tech Stack:** Node.js (CommonJS), Prisma/PostgreSQL, `@modelcontextprotocol/sdk` v1.29.0, `zod`, `dayjs` (utc/timezone/customParseFormat), Jest.

---

## Context the implementer needs (read first)

These facts were verified against the codebase and are load-bearing:

1. **`permissionHelper.canManageTeam(userId, teamId)`** (`src/utils/permissionHelper.js:83`) takes the **internal DB user id** (not the Slack id) and returns `{ canManage: boolean, role: string|null, reason: string|null }` — it does **not** return a boolean. The MCP user object (`req.mcpUser`, the full `User` row) exposes `user.id` (internal) and `user.slackUserId`. Call it with `user.id`; on `!canManage`, throw `perm.reason`.

2. **`StandupResponse.userId` is the internal user id.** `standupService.getUserResponse(teamId, userId, date)` (`:168`) and `getTeamResponses`/`getLateResponses` all key on the internal id and `include: { user: true }`. So response objects carry `r.userId` (internal) and `r.user.slackUserId` / `r.user.name`.

3. **`getTeamResponses` returns ON-TIME responses only** (`isLate: false`); `getLateResponses` returns the late ones. A complete read view combines both. (The Slack post threads late ones separately, but for an agent-facing JSON view we return them together, each tagged with `isLate`.)

4. **`getActiveMembers(teamId, date)`** (`:33`) already excludes members on leave and non-working-day members, and returns `TeamMember` rows with `include: { user: true }` (so `m.userId` internal, `m.user.slackUserId`/`m.user.name`).

5. **On-leave members** are fetched with a separate query (mirrors `previewStandup`, `src/commands/standup.js:971-987`):

   ```js
   prisma.teamMember.findMany({
     where: {
       teamId,
       isActive: true,
       user: {
         leaves: { some: { startDate: { lte: date }, endDate: { gte: date } } },
       },
     },
     include: { user: true },
   });
   ```

6. **`resolveTeam(slackUserId, identifier)`** (`src/mcp/teamResolver.js`) returns `{ team }` where `team` is a full `Team` row (from `include: { team: true }`), so **`team.timezone` is available** — no extra `getTeamById` call is needed for the default-date timezone.

7. **`src/mcp/tools.js` already imports** `prisma`, `dayjs` (+ utc/timezone/customParseFormat extended), `resolveTeam`, `standupService`, `teamService`, and `z`. It exports `buildToolHandlers(user, slackClient)` and `registerTools(server, user, slackClient)`. It already has `assertValidDate(date)` (throws on non-`YYYY-MM-DD`). Reuse all of these.

8. **No schema/migration/env changes.** Phase 2 is read-only.

---

## File structure

**Create**

- `src/mcp/memberResolver.js` — resolve a member identifier (Slack id / name / username, mention-wrapper tolerant) to a team's active member.
- `test/mcp/memberResolver.test.js`

**Modify**

- `src/mcp/tools.js` — add `get_team_standup` + `get_member_standup` handlers to `buildToolHandlers`, a shared `requireManageTeam` permission guard, and register both tools in `registerTools`. Add imports for `canManageTeam` and `resolveMember`.
- `test/mcp/tools.test.js` — extend mocks (add `permissionHelper`, `memberResolver`, and the new `standupService` read methods) and add handler tests for both tools.
- `README.md`, `CHANGELOG.md`, `web/src/data/changelog.json` — document the new tools.

---

## Task 1: Member resolver

Resolves a free-text member identifier to an active member of a team. Mirrors the slash command's `resolveTargetMember` (`src/commands/standup.js:807`) but accepts free text (Slack id, name, or username) instead of a parsed Slack mention, and tolerates a `<@U…>` / `@U…` wrapper an agent might pass.

**Files:**

- Create: `src/mcp/memberResolver.js`
- Test: `test/mcp/memberResolver.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/mcp/memberResolver.test.js`:

```js
jest.mock("../../src/config/prisma", () => ({
  teamMember: { findMany: jest.fn() },
}));

const prisma = require("../../src/config/prisma");
const { resolveMember } = require("../../src/mcp/memberResolver");

const members = [
  {
    user: {
      id: "u1",
      slackUserId: "U111",
      name: "Alice Smith",
      username: "alice",
    },
  },
  {
    user: { id: "u2", slackUserId: "U222", name: "Bob Jones", username: "bob" },
  },
];

describe("resolveMember", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.teamMember.findMany.mockResolvedValue(members);
  });

  it("matches by Slack user id (case-sensitive)", async () => {
    const { member } = await resolveMember("t1", "U222");
    expect(member.id).toBe("u2");
  });

  it("matches by case-insensitive name", async () => {
    const { member } = await resolveMember("t1", "alice smith");
    expect(member.id).toBe("u1");
  });

  it("matches by case-insensitive username", async () => {
    const { member } = await resolveMember("t1", "BOB");
    expect(member.id).toBe("u2");
  });

  it("strips a Slack mention wrapper", async () => {
    const { member } = await resolveMember("t1", "<@U111>");
    expect(member.id).toBe("u1");
  });

  it("returns an error for an unknown member", async () => {
    const { member, error } = await resolveMember("t1", "Charlie");
    expect(member).toBeUndefined();
    expect(error).toMatch(/not found/i);
  });

  it("returns an error when the team has no active members", async () => {
    prisma.teamMember.findMany.mockResolvedValue([]);
    const { error } = await resolveMember("t1", "U111");
    expect(error).toMatch(/no active members/i);
  });

  it("scopes the query to active members of the team", async () => {
    await resolveMember("t1", "alice");
    expect(prisma.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId: "t1", isActive: true },
        include: { user: true },
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/mcp/memberResolver.test.js`
Expected: FAIL — cannot find module `memberResolver`.

- [ ] **Step 3: Implement**

Create `src/mcp/memberResolver.js`:

```js
const prisma = require("../config/prisma");

// Matches a Slack mention wrapper an agent might paste, e.g. "<@U123>" or
// "<@U123|alice>". Capture group 1 is the Slack user id.
const MENTION_RE = /^<@([A-Z0-9]+)(?:\|[^>]*)?>$/i;

/**
 * Resolve a free-text member identifier to an active member of a team.
 * Accepts a Slack user id (case-sensitive), a display name, or a username
 * (both case-insensitive), and tolerates a "<@U…>" / "@U…" wrapper.
 * @returns {Promise<{member?: object, error?: string}>} the matched User row.
 */
async function resolveMember(teamId, identifier) {
  const members = await prisma.teamMember.findMany({
    where: { teamId, isActive: true },
    include: { user: true },
  });

  if (members.length === 0) {
    return { error: "This team has no active members." };
  }

  const raw = String(identifier || "").trim();
  const mention = raw.match(MENTION_RE);
  // Slack ids are case-sensitive; preserve case for the id comparison.
  const idNeedle = mention ? mention[1] : raw.replace(/^@/, "");
  const nameNeedle = idNeedle.toLowerCase();

  const match = members.find((m) => {
    const u = m.user;
    return (
      u.slackUserId === idNeedle ||
      (u.name && u.name.toLowerCase() === nameNeedle) ||
      (u.username && u.username.toLowerCase() === nameNeedle)
    );
  });

  if (!match) {
    return { error: `Member "${identifier}" not found in this team.` };
  }
  return { member: match.user };
}

module.exports = { resolveMember };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest test/mcp/memberResolver.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/mcp/memberResolver.js test/mcp/memberResolver.test.js
git commit -m "feat(mcp): add member resolver for Phase 2 tools"
```

---

## Task 2: `get_team_standup` tool (with the shared permission guard)

Adds the first admin-gated read tool plus the `requireManageTeam` helper both Phase 2 tools share. Returns the team's standup for a date as JSON: all responses (on-time + late, each tagged `isLate`), who hasn't submitted, and who's on leave.

**Files:**

- Modify: `src/mcp/tools.js`
- Test: `test/mcp/tools.test.js`

- [ ] **Step 1: Extend the test mocks**

In `test/mcp/tools.test.js`, the existing mock block looks like this:

```js
jest.mock("../../src/config/prisma", () => ({
  teamMember: { findMany: jest.fn() },
}));
jest.mock("../../src/mcp/teamResolver", () => ({ resolveTeam: jest.fn() }));
jest.mock("../../src/services/standupService", () => ({
  submitStandup: jest.fn(),
  getUserStandupHistory: jest.fn(),
}));
jest.mock("../../src/services/teamService", () => ({
  getTeamById: jest.fn(),
}));
```

Replace it with this expanded version (adds the permission helper, the member resolver, and the four read methods):

```js
jest.mock("../../src/config/prisma", () => ({
  teamMember: { findMany: jest.fn() },
}));
jest.mock("../../src/mcp/teamResolver", () => ({ resolveTeam: jest.fn() }));
jest.mock("../../src/mcp/memberResolver", () => ({ resolveMember: jest.fn() }));
jest.mock("../../src/utils/permissionHelper", () => ({
  canManageTeam: jest.fn(),
}));
jest.mock("../../src/services/standupService", () => ({
  submitStandup: jest.fn(),
  getUserStandupHistory: jest.fn(),
  getTeamResponses: jest.fn(),
  getLateResponses: jest.fn(),
  getActiveMembers: jest.fn(),
  getUserResponse: jest.fn(),
}));
jest.mock("../../src/services/teamService", () => ({
  getTeamById: jest.fn(),
}));
```

Then, just below the existing requires near the top of the file, add requires for the two new mocked modules. The existing requires look like:

```js
const prisma = require("../../src/config/prisma");
const { resolveTeam } = require("../../src/mcp/teamResolver");
const standupService = require("../../src/services/standupService");
const teamService = require("../../src/services/teamService");
const { buildToolHandlers } = require("../../src/mcp/tools");
```

Add these two lines after the `resolveTeam` require:

```js
const { resolveMember } = require("../../src/mcp/memberResolver");
const { canManageTeam } = require("../../src/utils/permissionHelper");
```

- [ ] **Step 2: Write the failing tests for `get_team_standup`**

Add this `describe` block to `test/mcp/tools.test.js` (e.g. after the existing `describe("MCP Phase 1 tool handlers", …)` block):

```js
describe("MCP Phase 2 — get_team_standup", () => {
  let tools;
  const team = { id: "t1", name: "Eng", timezone: "Asia/Dhaka" };

  beforeEach(() => {
    jest.clearAllMocks();
    tools = buildToolHandlers(user, slackClient);
    resolveTeam.mockResolvedValue({ team });
    canManageTeam.mockResolvedValue({
      canManage: true,
      role: "ADMIN",
      reason: null,
    });
    standupService.getTeamResponses.mockResolvedValue([]);
    standupService.getLateResponses.mockResolvedValue([]);
    standupService.getActiveMembers.mockResolvedValue([]);
    prisma.teamMember.findMany.mockResolvedValue([]); // on-leave query
  });

  it("throws the permission reason when the caller can't manage the team", async () => {
    canManageTeam.mockResolvedValue({
      canManage: false,
      role: null,
      reason: "User is not an admin or owner",
    });
    await expect(tools.get_team_standup({ team: "Eng" })).rejects.toThrow(
      /not an admin or owner/i
    );
    expect(canManageTeam).toHaveBeenCalledWith("user-1", "t1");
    expect(standupService.getTeamResponses).not.toHaveBeenCalled();
  });

  it("combines on-time and late responses, each tagged isLate", async () => {
    standupService.getTeamResponses.mockResolvedValue([
      {
        userId: "u1",
        user: { slackUserId: "U1", name: "Alice" },
        yesterdayTasks: "y",
        todayTasks: "t",
        blockers: "",
        isLate: false,
        submittedAt: new Date("2026-06-17T03:00:00Z"),
      },
    ]);
    standupService.getLateResponses.mockResolvedValue([
      {
        userId: "u2",
        user: { slackUserId: "U2", name: "Bob" },
        yesterdayTasks: "",
        todayTasks: "late",
        blockers: "",
        isLate: true,
        submittedAt: new Date("2026-06-17T05:00:00Z"),
      },
    ]);
    standupService.getActiveMembers.mockResolvedValue([
      { userId: "u1", user: { slackUserId: "U1", name: "Alice" } },
      { userId: "u2", user: { slackUserId: "U2", name: "Bob" } },
    ]);

    const result = await tools.get_team_standup({ team: "Eng" });

    expect(result.team).toBe("Eng");
    expect(result.responses).toHaveLength(2);
    expect(result.responses.map((r) => r.isLate).sort()).toEqual([false, true]);
    expect(result.notSubmitted).toEqual([]);
    expect(result.onLeave).toEqual([]);
  });

  it("lists active members who did not submit and excludes late submitters from notSubmitted", async () => {
    standupService.getTeamResponses.mockResolvedValue([
      {
        userId: "u1",
        user: { slackUserId: "U1", name: "Alice" },
        yesterdayTasks: "",
        todayTasks: "t",
        blockers: "",
        isLate: false,
        submittedAt: new Date("2026-06-17T03:00:00Z"),
      },
    ]);
    standupService.getLateResponses.mockResolvedValue([
      {
        userId: "u2",
        user: { slackUserId: "U2", name: "Bob" },
        yesterdayTasks: "",
        todayTasks: "late",
        blockers: "",
        isLate: true,
        submittedAt: new Date("2026-06-17T05:00:00Z"),
      },
    ]);
    standupService.getActiveMembers.mockResolvedValue([
      { userId: "u1", user: { slackUserId: "U1", name: "Alice" } },
      { userId: "u2", user: { slackUserId: "U2", name: "Bob" } },
      { userId: "u3", user: { slackUserId: "U3", name: "Carol" } },
    ]);

    const result = await tools.get_team_standup({ team: "Eng" });

    expect(result.notSubmitted).toEqual([{ slackUserId: "U3", name: "Carol" }]);
  });

  it("reports members on leave and excludes them from notSubmitted", async () => {
    standupService.getActiveMembers.mockResolvedValue([
      { userId: "u1", user: { slackUserId: "U1", name: "Alice" } },
    ]);
    prisma.teamMember.findMany.mockResolvedValue([
      { userId: "u9", user: { slackUserId: "U9", name: "Dave" } },
    ]);

    const result = await tools.get_team_standup({ team: "Eng" });

    expect(result.onLeave).toEqual([{ slackUserId: "U9", name: "Dave" }]);
    expect(result.notSubmitted).toEqual([{ slackUserId: "U1", name: "Alice" }]);
  });

  it("rejects an invalid date before doing any work", async () => {
    await expect(
      tools.get_team_standup({ team: "Eng", date: "06/17/2026" })
    ).rejects.toThrow(/YYYY-MM-DD/);
    expect(resolveTeam).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest test/mcp/tools.test.js -t "get_team_standup"`
Expected: FAIL — `tools.get_team_standup is not a function`.

- [ ] **Step 4: Add imports to `src/mcp/tools.js`**

At the top of `src/mcp/tools.js`, the existing requires are:

```js
const { z } = require("zod");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const customParseFormat = require("dayjs/plugin/customParseFormat");
const prisma = require("../config/prisma");
const { resolveTeam } = require("./teamResolver");
const standupService = require("../services/standupService");
const teamService = require("../services/teamService");
```

Add these two lines after the `resolveTeam` require:

```js
const { resolveMember } = require("./memberResolver");
const { canManageTeam } = require("../utils/permissionHelper");
```

- [ ] **Step 5: Add the permission guard + `get_team_standup` handler**

In `src/mcp/tools.js`, inside `buildToolHandlers(user, slackClient)`, there is an existing inner helper `resolveOrThrow`:

```js
async function resolveOrThrow(identifier) {
  const { team, error } = await resolveTeam(user.slackUserId, identifier);
  if (error) throw new Error(error);
  return team;
}
```

Immediately after it, add a second inner helper:

```js
async function requireManageTeam(teamId) {
  const perm = await canManageTeam(user.id, teamId);
  if (!perm.canManage) {
    throw new Error(
      perm.reason || "You don't have permission to manage this team."
    );
  }
}
```

Then add the `get_team_standup` handler inside the object returned by `buildToolHandlers` (e.g. after the existing `get_my_standup_history` handler — add a comma after its closing brace, then):

```js
    async get_team_standup({ team, date }) {
      if (date) assertValidDate(date);
      const resolved = await resolveOrThrow(team);
      await requireManageTeam(resolved.id);

      const targetDate = date
        ? dayjs(date, "YYYY-MM-DD").toDate()
        : dayjs().tz(resolved.timezone).toDate();

      const onTime = await standupService.getTeamResponses(
        resolved.id,
        targetDate
      );
      const late = await standupService.getLateResponses(
        resolved.id,
        targetDate
      );
      const activeMembers = await standupService.getActiveMembers(
        resolved.id,
        targetDate
      );
      const onLeaveMembers = await prisma.teamMember.findMany({
        where: {
          teamId: resolved.id,
          isActive: true,
          user: {
            leaves: {
              some: {
                startDate: { lte: targetDate },
                endDate: { gte: targetDate },
              },
            },
          },
        },
        include: { user: true },
      });

      const responses = [...onTime, ...late]
        .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
        .map((r) => ({
          slackUserId: r.user.slackUserId,
          name: r.user.name,
          yesterdayTasks: r.yesterdayTasks || "",
          todayTasks: r.todayTasks || "",
          blockers: r.blockers || "",
          isLate: r.isLate,
          submittedAt: dayjs(r.submittedAt).toISOString(),
        }));

      const respondedUserIds = new Set([...onTime, ...late].map((r) => r.userId));
      const leaveUserIds = new Set(onLeaveMembers.map((m) => m.userId));

      const notSubmitted = activeMembers
        .filter(
          (m) => !respondedUserIds.has(m.userId) && !leaveUserIds.has(m.userId)
        )
        .map((m) => ({ slackUserId: m.user.slackUserId, name: m.user.name }));

      const onLeave = onLeaveMembers.map((m) => ({
        slackUserId: m.user.slackUserId,
        name: m.user.name,
      }));

      return {
        team: resolved.name,
        date: dayjs(targetDate).format("YYYY-MM-DD"),
        responses,
        notSubmitted,
        onLeave,
      };
    },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest test/mcp/tools.test.js -t "get_team_standup"`
Expected: PASS (5 tests).

- [ ] **Step 7: Register the tool in `registerTools`**

In `src/mcp/tools.js`, inside `registerTools(server, user, slackClient)`, after the existing `server.registerTool("get_my_standup_history", …)` call, add:

```js
server.registerTool(
  "get_team_standup",
  {
    title: "Get team standup",
    description:
      "View a team's standup for a date: all responses (on-time and late), who hasn't submitted, and who's on leave. Requires team admin or owner.",
    inputSchema: z.object({
      team: TEAM_FIELD,
      date: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
    }),
  },
  async (args) => {
    try {
      return json(await handlers.get_team_standup(args));
    } catch (e) {
      return fail(e);
    }
  }
);
```

- [ ] **Step 8: Run the full tools test file**

Run: `npx jest test/mcp/tools.test.js`
Expected: PASS (all Phase 1 tests still green + the 5 new ones).

- [ ] **Step 9: Lint + commit**

```bash
npm run lint
git add src/mcp/tools.js test/mcp/tools.test.js
git commit -m "feat(mcp): add get_team_standup read tool (admin-gated)"
```

---

## Task 3: `get_member_standup` tool

Adds the second admin-gated read tool: one member's submission for a date, resolved via the Task 1 member resolver.

**Files:**

- Modify: `src/mcp/tools.js`
- Test: `test/mcp/tools.test.js`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `test/mcp/tools.test.js` (after the `get_team_standup` block):

```js
describe("MCP Phase 2 — get_member_standup", () => {
  let tools;
  const team = { id: "t1", name: "Eng", timezone: "Asia/Dhaka" };
  const member = { id: "u2", slackUserId: "U2", name: "Bob" };

  beforeEach(() => {
    jest.clearAllMocks();
    tools = buildToolHandlers(user, slackClient);
    resolveTeam.mockResolvedValue({ team });
    canManageTeam.mockResolvedValue({
      canManage: true,
      role: "ADMIN",
      reason: null,
    });
    resolveMember.mockResolvedValue({ member });
  });

  it("throws the permission reason when the caller can't manage the team", async () => {
    canManageTeam.mockResolvedValue({
      canManage: false,
      role: null,
      reason: "User is not an admin or owner",
    });
    await expect(
      tools.get_member_standup({ team: "Eng", member: "Bob" })
    ).rejects.toThrow(/not an admin or owner/i);
    expect(resolveMember).not.toHaveBeenCalled();
  });

  it("returns the member's response for the date", async () => {
    standupService.getUserResponse.mockResolvedValue({
      yesterdayTasks: "y",
      todayTasks: "t",
      blockers: "none",
      isLate: false,
      submittedAt: new Date("2026-06-17T03:00:00Z"),
    });

    const result = await tools.get_member_standup({
      team: "Eng",
      member: "Bob",
    });

    expect(resolveMember).toHaveBeenCalledWith("t1", "Bob");
    expect(standupService.getUserResponse).toHaveBeenCalledWith(
      "t1",
      "u2",
      expect.any(Date)
    );
    expect(result.member).toEqual({ slackUserId: "U2", name: "Bob" });
    expect(result.response).toEqual(
      expect.objectContaining({
        todayTasks: "t",
        blockers: "none",
        isLate: false,
      })
    );
  });

  it("returns response: null when the member has no submission", async () => {
    standupService.getUserResponse.mockResolvedValue(null);
    const result = await tools.get_member_standup({
      team: "Eng",
      member: "Bob",
    });
    expect(result.response).toBeNull();
    expect(result.member).toEqual({ slackUserId: "U2", name: "Bob" });
  });

  it("throws the resolver error for an unknown member", async () => {
    resolveMember.mockResolvedValue({
      error: 'Member "Zoe" not found in this team.',
    });
    await expect(
      tools.get_member_standup({ team: "Eng", member: "Zoe" })
    ).rejects.toThrow(/not found/i);
    expect(standupService.getUserResponse).not.toHaveBeenCalled();
  });

  it("rejects an invalid date before doing any work", async () => {
    await expect(
      tools.get_member_standup({
        team: "Eng",
        member: "Bob",
        date: "2026/06/17",
      })
    ).rejects.toThrow(/YYYY-MM-DD/);
    expect(resolveTeam).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest test/mcp/tools.test.js -t "get_member_standup"`
Expected: FAIL — `tools.get_member_standup is not a function`.

- [ ] **Step 3: Add the `get_member_standup` handler**

In `src/mcp/tools.js`, inside the object returned by `buildToolHandlers`, add this handler after `get_team_standup` (comma-separate):

```js
    async get_member_standup({ team, member, date }) {
      if (date) assertValidDate(date);
      const resolved = await resolveOrThrow(team);
      await requireManageTeam(resolved.id);

      const { member: targetUser, error } = await resolveMember(
        resolved.id,
        member
      );
      if (error) throw new Error(error);

      const targetDate = date
        ? dayjs(date, "YYYY-MM-DD").toDate()
        : dayjs().tz(resolved.timezone).toDate();

      const response = await standupService.getUserResponse(
        resolved.id,
        targetUser.id,
        targetDate
      );

      return {
        team: resolved.name,
        date: dayjs(targetDate).format("YYYY-MM-DD"),
        member: { slackUserId: targetUser.slackUserId, name: targetUser.name },
        response: response
          ? {
              yesterdayTasks: response.yesterdayTasks || "",
              todayTasks: response.todayTasks || "",
              blockers: response.blockers || "",
              isLate: response.isLate,
              submittedAt: dayjs(response.submittedAt).toISOString(),
            }
          : null,
      };
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest test/mcp/tools.test.js -t "get_member_standup"`
Expected: PASS (5 tests).

- [ ] **Step 5: Register the tool in `registerTools`**

In `src/mcp/tools.js`, inside `registerTools`, after the `get_team_standup` registration, add:

```js
server.registerTool(
  "get_member_standup",
  {
    title: "Get member standup",
    description:
      "View one member's standup submission for a date. Identify the member by Slack id, name, or username. Requires team admin or owner.",
    inputSchema: z.object({
      team: TEAM_FIELD,
      member: z
        .string()
        .describe("Member's Slack user id, display name, or username"),
      date: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
    }),
  },
  async (args) => {
    try {
      return json(await handlers.get_member_standup(args));
    } catch (e) {
      return fail(e);
    }
  }
);
```

- [ ] **Step 6: Run the full suite + lint**

Run: `npx jest`
Expected: PASS — all suites green.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/mcp/tools.js test/mcp/tools.test.js
git commit -m "feat(mcp): add get_member_standup read tool (admin-gated)"
```

---

## Task 4: Verify SDK registration of the new tools

A unit-level guard that the two new tools register cleanly against the real `McpServer` (catches a zod/SDK schema incompatibility that handler unit tests can't, mirroring `test/mcp/server.test.js`).

**Files:**

- Modify: `test/mcp/server.test.js`

- [ ] **Step 1: Update the registration assertion**

In `test/mcp/server.test.js`, the existing test asserts the four Phase 1 tool names are registered:

```js
const names = spy.mock.calls.map((c) => c[0]);
expect(names).toEqual(
  expect.arrayContaining([
    "list_my_teams",
    "submit_standup",
    "update_standup",
    "get_my_standup_history",
  ])
);
```

Add the two Phase 2 names to the `arrayContaining` list:

```js
const names = spy.mock.calls.map((c) => c[0]);
expect(names).toEqual(
  expect.arrayContaining([
    "list_my_teams",
    "submit_standup",
    "update_standup",
    "get_my_standup_history",
    "get_team_standup",
    "get_member_standup",
  ])
);
```

The test file's `jest.mock("../../src/config/prisma", …)` already mocks `teamMember.findMany`, and `tools.js` now also requires `../utils/permissionHelper` and `./memberResolver`. Those load fine without mocking (they only hold references to `prisma` at module load; nothing runs at registration). If requiring the suite surfaces an error from those modules loading, add `jest.mock("../../src/utils/permissionHelper", () => ({ canManageTeam: jest.fn() }))` and `jest.mock("../../src/mcp/memberResolver", () => ({ resolveMember: jest.fn() }))` at the top of `test/mcp/server.test.js` — only if needed.

- [ ] **Step 2: Run the test**

Run: `npx jest test/mcp/server.test.js`
Expected: PASS (6 tests; the registration test now sees all six tools).

- [ ] **Step 3: Commit**

```bash
git add test/mcp/server.test.js
git commit -m "test(mcp): assert Phase 2 tools register on the SDK server"
```

---

## Task 5: Documentation & changelog

**Files:**

- Modify: `README.md`, `CHANGELOG.md`, `web/src/data/changelog.json`

- [ ] **Step 1: README — extend the MCP tools list**

In `README.md`, find the "MCP Server" section's Phase 1 tools table/list (added in the Phase 1 docs). Add the two new tools, noting they require team admin or owner:

- `get_team_standup` — view a team's standup for a date (all responses, who hasn't submitted, who's on leave). Requires team admin/owner.
- `get_member_standup` — view one member's standup submission for a date (identify by Slack id, name, or username). Requires team admin/owner.

Match the existing formatting of the Phase 1 tool entries in that section.

- [ ] **Step 2: CHANGELOG.md (technical, always)**

Add to the `## [Unreleased]` section under `### Added`:

```markdown
- Phase 2 MCP read tools (admin/owner-gated via `canManageTeam`): `get_team_standup` (combined on-time + late responses, not-submitted, on-leave as JSON) and `get_member_standup` (one member's submission). New `src/mcp/memberResolver.js` resolves a member by Slack id, name, or username. (`src/mcp/tools.js`, `src/mcp/memberResolver.js`)
```

- [ ] **Step 3: web/src/data/changelog.json (user-facing)**

Read the file to confirm the current latest entry. If the `1.14.0` entry (the Phase 1 MCP entry) is still `"isLatest": true` and unreleased, append a Phase-2 `change` object to that version's `changes` array (don't create a new version) so both ship together:

```json
{
  "type": "added",
  "title": "Team leads can review standups from their AI agent",
  "description": "Team admins and owners can now pull a team's standup summary — who responded, who hasn't, and who's on leave — or a single member's update, directly from any connected AI agent."
}
```

If `1.14.0` has already been released (no longer `isLatest`), instead add a new `1.15.0` entry dated `2026-06-17` with `"isLatest": true` containing the change above, and set the previous latest entry to `"isLatest": false`. Use plain language only — no file or function names.

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md web/src/data/changelog.json
git commit -m "docs(mcp): document Phase 2 read tools"
```

---

## Self-review notes

- **Spec coverage:** the spec's Phase 2 table (`get_team_standup {team, date?}` → `{responses, notSubmitted, onLeave}`; `get_member_standup {team, member, date?}` → JSON response) is implemented in Tasks 2–3, gated by `canManageTeam` per spec, returning JSON (never `formatStandupMessage`) per the spec's explicit constraint. Member resolution (the spec's `resolveTargetMember`-style lookup) is Task 1. Docs/changelog is Task 5.
- **Deliberate deviation (documented):** `get_team_standup` includes late responses (tagged `isLate`) in `responses` and excludes late submitters from `notSubmitted`. The spec's `previewStandup` reference threads late responses separately and counts only on-time responders; for an agent-facing read view, surfacing a complete, unambiguous picture (a late submitter has submitted) is the correct semantics. Noted here so it isn't mistaken for a parity bug.
- **Type/name consistency:** `resolveMember(teamId, identifier)` returns `{ member }` / `{ error }` (Task 1) and is consumed identically in Task 3. `canManageTeam(user.id, teamId)` returns `{ canManage, role, reason }` and is consumed via `requireManageTeam` in Tasks 2–3. `resolved.timezone`, `resolved.id`, `resolved.name` come from `resolveTeam`'s full `Team` row. The four `standupService` read methods match their real signatures (`getTeamResponses(teamId, date)`, `getLateResponses(teamId, date)`, `getActiveMembers(teamId, date)`, `getUserResponse(teamId, userId, date)`).
- **No placeholders:** every code step shows complete code; every test step shows full test code; commands have expected output.
- **Out of scope:** Phase 3 (admin actions — reminders, posting). No schema/migration/env changes in Phase 2.
