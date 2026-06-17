# Standup MCP Server — Phase 3 (Admin Actions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four admin/owner-gated MCP write tools — `send_standup_reminders`, `send_followup_reminders`, `post_team_standup`, `post_member_standup` — so a team admin can trigger reminders and post standups from any AI agent, wrapping the exact service methods the slash commands already use.

**Architecture:** Four new handlers in the existing `src/mcp/tools.js`, reusing the Phase 1/2 primitives (`resolveOrThrow`, `requireManageTeam`, `resolveMember`, `assertValidDate`). Posting tools call `standupService.postTeamStandup` / `postIndividualResponse` with the WebClient wrapped as `{ client: slackClient }` (the same shape the slash commands pass). Reminder tools call `schedulerService.sendStandupReminders` / `sendFollowupReminders`, which use the scheduler's already-initialized Bolt app. Every tool re-checks `canManageTeam` at call time. No new Slack-side data: tools return JSON confirmations.

**Tech Stack:** Node.js (CommonJS), Prisma/PostgreSQL, `@modelcontextprotocol/sdk` v1.29.0, `zod`, `dayjs`, Jest.

---

## Blast-radius note (read first)

These are the highest-risk tools in the MCP surface: they **DM whole teams** and **post to channels**. The spec's mitigations are all already in force and MUST be preserved:

- **Per-call `canManageTeam` re-check** before any Slack action (a token is identity, never a standing grant).
- **Sequential Slack calls** — the wrapped service methods (`sendStandupReminders`, `postTeamStandup`, etc.) already loop sequentially per the ~1 req/sec/channel rule. Do NOT parallelize.
- **`post_team_standup` guards on zero responses** (mirrors `/dd-standup-post`) so an empty summary is never posted to a channel.
- Token expiry/revoke (Phase 1) bounds a leaked token.

---

## Context the implementer needs (verified against the codebase)

1. **`schedulerService.sendStandupReminders(team)`** and **`sendFollowupReminders(team)`** (`src/services/schedulerService.js:174,221`) take ONLY `team` and post DMs via `this.app.client` — the Bolt app set at startup by `schedulerService.initialize(app)` in `src/app.js`. The MCP server runs in that same process, so calling these directly uses the initialized client. They return nothing. They internally filter out admins and members who opted out, and loop sequentially.

2. **`standupService.postTeamStandup(team, date, slackApp)`** (`:387`) calls `slackApp.client.chat.postMessage`. Pass `{ client: slackClient }`. Returns: `{ skipped: true, post }` if already posted; `undefined` if it's not an org working day; otherwise the Slack `result` (with `.ts`). The slash command wraps the WebClient as `{ client }` — see `src/commands/standup.js:757-761` and its comment.

3. **`standupService.postIndividualResponse(team, date, response, slackApp)`** (`:691`) auto-creates the team thread if missing, then posts the member's response as a threaded reply. `response` must be a `StandupResponse` row WITH its `user` relation (it calls `formatIndividualResponseMessage(response)` and `getDisplayName(response.user)`). Get it via `standupService.getUserResponse(teamId, internalUserId, date)` (includes `user`). Returns `{ ts, channel }`. Pass `{ client: slackClient }` as `slackApp`. Mirror `src/commands/standup.js:694-715`.

4. **`resolveTeam`** returns the full `Team` row (`organizationId`, `timezone`, `name`, `id`, `postingTime` all present), so the posting/reminder methods get everything they need — no `getTeamById` call required.

5. **`src/mcp/tools.js` already has** `resolveOrThrow(identifier)`, `requireManageTeam(teamId)` (calls `canManageTeam(user.id, teamId)`, throws `reason` on denial), `resolveMember` (Phase 2), `assertValidDate`, `TEAM_FIELD`, `json`/`fail`, and imports `prisma`, `dayjs` (+ plugins), `standupService`, `teamService`, `canManageTeam`, `resolveMember`, `z`. It does NOT yet import `schedulerService`.

6. **No schema/migration/env changes.** Phase 3 is behavior only.

---

## File structure

**Modify**

- `src/mcp/tools.js` — add `schedulerService` import; add `post_team_standup`, `post_member_standup`, `send_standup_reminders`, `send_followup_reminders` handlers to `buildToolHandlers`; register all four in `registerTools`.
- `test/mcp/tools.test.js` — extend mocks (add `schedulerService`, and `postTeamStandup`/`postIndividualResponse` on the `standupService` mock); add handler tests.
- `test/mcp/server.test.js` — mock `schedulerService` (now required transitively via `tools.js`); assert the four new tools register.
- `README.md`, `CHANGELOG.md`, `web/src/data/changelog.json` — document the new tools.

---

## Task 1: `post_team_standup` tool

Posts a team's standup summary for a date to the channel, wrapping `standupService.postTeamStandup`. Guards on zero responses so an empty summary is never posted.

**Files:**

- Modify: `src/mcp/tools.js`
- Test: `test/mcp/tools.test.js`

- [ ] **Step 1: Extend the test mocks**

In `test/mcp/tools.test.js`, the `standupService` mock currently is:

```js
jest.mock("../../src/services/standupService", () => ({
  submitStandup: jest.fn(),
  getUserStandupHistory: jest.fn(),
  getTeamResponses: jest.fn(),
  getLateResponses: jest.fn(),
  getActiveMembers: jest.fn(),
  getUserResponse: jest.fn(),
}));
```

Replace it with (adds the two posting methods):

```js
jest.mock("../../src/services/standupService", () => ({
  submitStandup: jest.fn(),
  getUserStandupHistory: jest.fn(),
  getTeamResponses: jest.fn(),
  getLateResponses: jest.fn(),
  getActiveMembers: jest.fn(),
  getUserResponse: jest.fn(),
  postTeamStandup: jest.fn(),
  postIndividualResponse: jest.fn(),
}));
```

Then add a `schedulerService` mock alongside the other `jest.mock` calls at the top of the file:

```js
jest.mock("../../src/services/schedulerService", () => ({
  sendStandupReminders: jest.fn(),
  sendFollowupReminders: jest.fn(),
}));
```

And add a require for it after the existing `standupService` require:

```js
const schedulerService = require("../../src/services/schedulerService");
```

- [ ] **Step 2: Write the failing tests**

Add this `describe` block to `test/mcp/tools.test.js` (after the `get_member_standup` block):

```js
describe("MCP Phase 3 — post_team_standup", () => {
  let tools;
  const team = {
    id: "t1",
    name: "Eng",
    timezone: "Asia/Dhaka",
    organizationId: "org1",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tools = buildToolHandlers(user, slackClient);
    resolveTeam.mockResolvedValue({ team });
    canManageTeam.mockResolvedValue({
      canManage: true,
      role: "ADMIN",
      reason: null,
    });
    standupService.getTeamResponses.mockResolvedValue([{ userId: "u1" }]);
    standupService.getLateResponses.mockResolvedValue([]);
    standupService.postTeamStandup.mockResolvedValue({ ts: "111.222" });
  });

  it("throws the permission reason when the caller can't manage the team", async () => {
    canManageTeam.mockResolvedValue({
      canManage: false,
      role: null,
      reason: "User is not an admin or owner",
    });
    await expect(tools.post_team_standup({ team: "Eng" })).rejects.toThrow(
      /not an admin or owner/i
    );
    expect(standupService.postTeamStandup).not.toHaveBeenCalled();
  });

  it("refuses to post when there are no responses", async () => {
    standupService.getTeamResponses.mockResolvedValue([]);
    standupService.getLateResponses.mockResolvedValue([]);
    await expect(tools.post_team_standup({ team: "Eng" })).rejects.toThrow(
      /nothing to post/i
    );
    expect(standupService.postTeamStandup).not.toHaveBeenCalled();
  });

  it("posts and returns the message timestamp", async () => {
    const result = await tools.post_team_standup({ team: "Eng" });

    expect(standupService.postTeamStandup).toHaveBeenCalledWith(
      team,
      expect.any(Date),
      { client: slackClient }
    );
    expect(result).toEqual(
      expect.objectContaining({
        team: "Eng",
        posted: true,
        messageTs: "111.222",
      })
    );
  });

  it("reports skipped when the standup was already posted", async () => {
    standupService.postTeamStandup.mockResolvedValue({
      skipped: true,
      post: { slackMessageTs: "999.888" },
    });
    const result = await tools.post_team_standup({ team: "Eng" });
    expect(result).toEqual(
      expect.objectContaining({
        posted: false,
        skipped: true,
        messageTs: "999.888",
      })
    );
  });

  it("throws when the date is not a working day (service returns undefined)", async () => {
    standupService.postTeamStandup.mockResolvedValue(undefined);
    await expect(tools.post_team_standup({ team: "Eng" })).rejects.toThrow(
      /not a working day/i
    );
  });

  it("rejects an invalid date before doing any work", async () => {
    await expect(
      tools.post_team_standup({ team: "Eng", date: "06/17/2026" })
    ).rejects.toThrow(/YYYY-MM-DD/);
    expect(resolveTeam).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx jest test/mcp/tools.test.js -t "post_team_standup"`
Expected: FAIL — `tools.post_team_standup is not a function`.

- [ ] **Step 4: Add the `schedulerService` import to `src/mcp/tools.js`**

After the existing `const teamService = require("../services/teamService");` line, add:

```js
const schedulerService = require("../services/schedulerService");
```

(Used by the reminder tools in Task 3, but import it now.)

- [ ] **Step 5: Add the `post_team_standup` handler**

Inside the object returned by `buildToolHandlers`, add this handler after `get_member_standup` (comma-separate):

```js
    async post_team_standup({ team, date }) {
      if (date) assertValidDate(date);
      const resolved = await resolveOrThrow(team);
      await requireManageTeam(resolved.id);

      const targetDate = date
        ? dayjs(date, "YYYY-MM-DD").toDate()
        : dayjs().tz(resolved.timezone).toDate();
      const dateLabel = dayjs(targetDate).format("YYYY-MM-DD");

      // Guard: never post an empty summary to a channel (mirrors /dd-standup-post).
      const onTime = await standupService.getTeamResponses(
        resolved.id,
        targetDate
      );
      const late = await standupService.getLateResponses(
        resolved.id,
        targetDate
      );
      if (onTime.length === 0 && late.length === 0) {
        throw new Error(
          `No standup responses for ${dateLabel} — nothing to post.`
        );
      }

      const result = await standupService.postTeamStandup(resolved, targetDate, {
        client: slackClient,
      });

      if (result?.skipped) {
        return {
          team: resolved.name,
          date: dateLabel,
          posted: false,
          skipped: true,
          messageTs: result.post?.slackMessageTs,
        };
      }
      if (!result) {
        throw new Error(
          `${dateLabel} is not a working day for this organization.`
        );
      }
      return {
        team: resolved.name,
        date: dateLabel,
        posted: true,
        messageTs: result.ts,
      };
    },
```

- [ ] **Step 6: Run to verify pass**

Run: `npx jest test/mcp/tools.test.js -t "post_team_standup"`
Expected: PASS (6 tests).

- [ ] **Step 7: Register the tool in `registerTools`**

Inside `registerTools`, after the `get_member_standup` registration, add:

```js
server.registerTool(
  "post_team_standup",
  {
    title: "Post team standup",
    description:
      "Post a team's standup summary for a date to its channel (includes late responses). Refuses if there are no responses. Requires team admin or owner.",
    inputSchema: z.object({
      team: TEAM_FIELD,
      date: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
    }),
  },
  async (args) => {
    try {
      return json(await handlers.post_team_standup(args));
    } catch (e) {
      return fail(e);
    }
  }
);
```

- [ ] **Step 8: Full tools test + lint**

Run: `npx jest test/mcp/tools.test.js`
Expected: PASS (all prior + 6 new).

Run: `npm run lint`
Expected: no errors. (`schedulerService` may be flagged unused until Task 3 — if so, hold that import for Task 3 instead.)

- [ ] **Step 9: Commit**

```bash
git add src/mcp/tools.js test/mcp/tools.test.js
git commit -m "feat(mcp): add post_team_standup write tool (admin-gated)"
```

---

## Task 2: `post_member_standup` tool

Posts one member's standup as a threaded reply, wrapping `standupService.postIndividualResponse`.

**Files:**

- Modify: `src/mcp/tools.js`
- Test: `test/mcp/tools.test.js`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `test/mcp/tools.test.js` (after the `post_team_standup` block):

```js
describe("MCP Phase 3 — post_member_standup", () => {
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
    standupService.getUserResponse.mockResolvedValue({
      user: member,
      todayTasks: "t",
    });
    standupService.postIndividualResponse.mockResolvedValue({
      ts: "333.444",
      channel: "C1",
    });
  });

  it("throws the permission reason when the caller can't manage the team", async () => {
    canManageTeam.mockResolvedValue({
      canManage: false,
      role: null,
      reason: "User is not an admin or owner",
    });
    await expect(
      tools.post_member_standup({ team: "Eng", member: "Bob" })
    ).rejects.toThrow(/not an admin or owner/i);
    expect(resolveMember).not.toHaveBeenCalled();
    expect(standupService.postIndividualResponse).not.toHaveBeenCalled();
  });

  it("throws the resolver error for an unknown member", async () => {
    resolveMember.mockResolvedValue({
      error: 'Member "Zoe" not found in this team.',
    });
    await expect(
      tools.post_member_standup({ team: "Eng", member: "Zoe" })
    ).rejects.toThrow(/not found/i);
    expect(standupService.postIndividualResponse).not.toHaveBeenCalled();
  });

  it("throws when the member has no submission for the date", async () => {
    standupService.getUserResponse.mockResolvedValue(null);
    await expect(
      tools.post_member_standup({ team: "Eng", member: "Bob" })
    ).rejects.toThrow(/no standup/i);
    expect(standupService.postIndividualResponse).not.toHaveBeenCalled();
  });

  it("posts the member's response and returns ts + channel", async () => {
    const result = await tools.post_member_standup({
      team: "Eng",
      member: "Bob",
    });

    expect(standupService.postIndividualResponse).toHaveBeenCalledWith(
      team,
      expect.any(Date),
      expect.objectContaining({ user: member }),
      { client: slackClient }
    );
    expect(result).toEqual(
      expect.objectContaining({
        team: "Eng",
        member: { slackUserId: "U2", name: "Bob" },
        posted: true,
        messageTs: "333.444",
        channel: "C1",
      })
    );
  });

  it("rejects an invalid date before doing any work", async () => {
    await expect(
      tools.post_member_standup({
        team: "Eng",
        member: "Bob",
        date: "2026/06/17",
      })
    ).rejects.toThrow(/YYYY-MM-DD/);
    expect(resolveTeam).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest test/mcp/tools.test.js -t "post_member_standup"`
Expected: FAIL — `tools.post_member_standup is not a function`.

- [ ] **Step 3: Add the `post_member_standup` handler**

Inside the object returned by `buildToolHandlers`, add after `post_team_standup` (comma-separate):

```js
    async post_member_standup({ team, member, date }) {
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
      const dateLabel = dayjs(targetDate).format("YYYY-MM-DD");

      const response = await standupService.getUserResponse(
        resolved.id,
        targetUser.id,
        targetDate
      );
      if (!response) {
        throw new Error(
          `${targetUser.name || targetUser.slackUserId} has no standup for ${dateLabel}.`
        );
      }

      const result = await standupService.postIndividualResponse(
        resolved,
        targetDate,
        response,
        { client: slackClient }
      );

      return {
        team: resolved.name,
        date: dateLabel,
        member: { slackUserId: targetUser.slackUserId, name: targetUser.name },
        posted: true,
        messageTs: result.ts,
        channel: result.channel,
      };
    },
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest test/mcp/tools.test.js -t "post_member_standup"`
Expected: PASS (5 tests).

- [ ] **Step 5: Register the tool in `registerTools`**

After the `post_team_standup` registration, add:

```js
server.registerTool(
  "post_member_standup",
  {
    title: "Post member standup",
    description:
      "Post one member's standup submission as a threaded reply (creates the team thread if needed). Identify the member by Slack id, name, or username. Requires team admin or owner.",
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
      return json(await handlers.post_member_standup(args));
    } catch (e) {
      return fail(e);
    }
  }
);
```

- [ ] **Step 6: Full tools test + lint**

Run: `npx jest test/mcp/tools.test.js`
Expected: PASS.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/mcp/tools.js test/mcp/tools.test.js
git commit -m "feat(mcp): add post_member_standup write tool (admin-gated)"
```

---

## Task 3: `send_standup_reminders` + `send_followup_reminders` tools

Two thin wrappers over the scheduler's reminder methods.

**Files:**

- Modify: `src/mcp/tools.js`
- Test: `test/mcp/tools.test.js`

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `test/mcp/tools.test.js` (after the `post_member_standup` block):

```js
describe("MCP Phase 3 — reminder tools", () => {
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
    schedulerService.sendStandupReminders.mockResolvedValue(undefined);
    schedulerService.sendFollowupReminders.mockResolvedValue(undefined);
  });

  it("send_standup_reminders requires manage permission", async () => {
    canManageTeam.mockResolvedValue({
      canManage: false,
      role: null,
      reason: "User is not an admin or owner",
    });
    await expect(tools.send_standup_reminders({ team: "Eng" })).rejects.toThrow(
      /not an admin or owner/i
    );
    expect(schedulerService.sendStandupReminders).not.toHaveBeenCalled();
  });

  it("send_standup_reminders delegates to the scheduler with the resolved team", async () => {
    const result = await tools.send_standup_reminders({ team: "Eng" });
    expect(schedulerService.sendStandupReminders).toHaveBeenCalledWith(team);
    expect(result).toEqual(expect.objectContaining({ team: "Eng" }));
  });

  it("send_followup_reminders requires manage permission", async () => {
    canManageTeam.mockResolvedValue({
      canManage: false,
      role: null,
      reason: "User is not an admin or owner",
    });
    await expect(
      tools.send_followup_reminders({ team: "Eng" })
    ).rejects.toThrow(/not an admin or owner/i);
    expect(schedulerService.sendFollowupReminders).not.toHaveBeenCalled();
  });

  it("send_followup_reminders delegates to the scheduler with the resolved team", async () => {
    const result = await tools.send_followup_reminders({ team: "Eng" });
    expect(schedulerService.sendFollowupReminders).toHaveBeenCalledWith(team);
    expect(result).toEqual(expect.objectContaining({ team: "Eng" }));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest test/mcp/tools.test.js -t "reminder tools"`
Expected: FAIL — `tools.send_standup_reminders is not a function`.

- [ ] **Step 3: Add the two handlers**

Inside the object returned by `buildToolHandlers`, add after `post_member_standup` (comma-separate):

```js
    async send_standup_reminders({ team }) {
      const resolved = await resolveOrThrow(team);
      await requireManageTeam(resolved.id);
      await schedulerService.sendStandupReminders(resolved);
      return { team: resolved.name, status: "Standup reminders sent." };
    },

    async send_followup_reminders({ team }) {
      const resolved = await resolveOrThrow(team);
      await requireManageTeam(resolved.id);
      await schedulerService.sendFollowupReminders(resolved);
      return { team: resolved.name, status: "Followup reminders sent." };
    },
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest test/mcp/tools.test.js -t "reminder tools"`
Expected: PASS (4 tests).

- [ ] **Step 5: Register both tools in `registerTools`**

After the `post_member_standup` registration, add:

```js
server.registerTool(
  "send_standup_reminders",
  {
    title: "Send standup reminders",
    description:
      "DM today's standup reminder to active team members who haven't opted out. Requires team admin or owner.",
    inputSchema: z.object({ team: TEAM_FIELD }),
  },
  async (args) => {
    try {
      return json(await handlers.send_standup_reminders(args));
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "send_followup_reminders",
  {
    title: "Send followup reminders",
    description:
      "DM a followup reminder to active team members who haven't submitted yet. Requires team admin or owner.",
    inputSchema: z.object({ team: TEAM_FIELD }),
  },
  async (args) => {
    try {
      return json(await handlers.send_followup_reminders(args));
    } catch (e) {
      return fail(e);
    }
  }
);
```

- [ ] **Step 6: Full suite + lint**

Run: `npx jest`
Expected: PASS — all suites green (`test/mcp/server.test.js` is updated in Task 4; if it fails on the `schedulerService` require, that's expected and fixed there — but run the tools file alone first: `npx jest test/mcp/tools.test.js` must pass).

Run: `npm run lint`
Expected: no errors (no unused `schedulerService` now).

- [ ] **Step 7: Commit**

```bash
git add src/mcp/tools.js test/mcp/tools.test.js
git commit -m "feat(mcp): add reminder + followup MCP tools (admin-gated)"
```

---

## Task 4: SDK registration test for the four new tools

`src/mcp/tools.js` now requires `../services/schedulerService`, so `test/mcp/server.test.js` must mock it (it already mocks the other transitive deps). Then assert all ten tools register.

**Files:**

- Modify: `test/mcp/server.test.js`

- [ ] **Step 1: Mock `schedulerService`**

At the top of `test/mcp/server.test.js`, alongside the existing `jest.mock` calls, add:

```js
jest.mock("../../src/services/schedulerService", () => ({
  sendStandupReminders: jest.fn(),
  sendFollowupReminders: jest.fn(),
}));
```

- [ ] **Step 2: Extend the registration assertion**

The existing assertion lists the six tool names. Add the four Phase 3 names:

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
    "post_team_standup",
    "post_member_standup",
    "send_standup_reminders",
    "send_followup_reminders",
  ])
);
```

- [ ] **Step 3: Run the test, then the full suite**

Run: `npx jest test/mcp/server.test.js`
Expected: PASS.

Run: `npx jest`
Expected: PASS — all suites green.

- [ ] **Step 4: Commit**

```bash
git add test/mcp/server.test.js
git commit -m "test(mcp): assert Phase 3 tools register on the SDK server"
```

---

## Task 5: Boot check + Documentation & changelog

**Files:**

- Modify: `README.md`, `CHANGELOG.md`, `web/src/data/changelog.json`

- [ ] **Step 1: Boot check (circular-import / require safety)**

`tools.js` now requires `schedulerService`. Confirm the server still loads its module graph without a circular-import crash:

Run: `node -e "process.env.SLACK_SIGNING_SECRET='x'; process.env.SLACK_BOT_TOKEN='xoxb-x'; require('./src/mcp/tools.js'); require('./src/mcp/server.js'); console.log('mcp modules load ok')"`
Expected: prints `mcp modules load ok` (no `Cannot read properties of undefined` / circular-require errors). If it errors on a circular require, STOP and report — `schedulerService` ↔ `standupService` ↔ `tools` would need a lazy `require` inside the handler instead of at module top.

- [ ] **Step 2: README — extend the MCP tools table**

In `README.md`, in the MCP Server tools table (which already lists the Phase 1 + Phase 2 tools), append four rows:

```
| `post_team_standup`       | Post a team's standup summary for a date to its channel (requires team admin/owner)        |
| `post_member_standup`     | Post one member's standup as a threaded reply (requires team admin/owner)                  |
| `send_standup_reminders`  | DM today's standup reminder to active team members (requires team admin/owner)             |
| `send_followup_reminders` | DM a followup reminder to members who haven't submitted (requires team admin/owner)        |
```

Match the existing table's column shape (read the table first to confirm header/alignment).

- [ ] **Step 3: CHANGELOG.md — add to [Unreleased] → ### Added**

Append this bullet under `## [Unreleased]` → `### Added`:

```markdown
- Phase 3 MCP write tools (admin/owner-gated via `canManageTeam`, sequential Slack calls): `post_team_standup` (guards on zero responses), `post_member_standup`, `send_standup_reminders`, and `send_followup_reminders` — wrapping the same `standupService.postTeamStandup`/`postIndividualResponse` and `schedulerService.sendStandupReminders`/`sendFollowupReminders` the slash commands use. (`src/mcp/tools.js`)
```

- [ ] **Step 4: web/src/data/changelog.json — append to the 1.14.0 entry**

The first version entry is `1.14.0` with `"isLatest": true`. Append a THIRD change object to that entry's `changes` array (use the `items` array shape the other changes use; do not create a new version, do not change `isLatest`):

```json
{
  "type": "added",
  "title": "Run standups from your AI agent",
  "items": [
    "Team admins and owners can now post a team's standup summary or a single member's update, and send standup or follow-up reminders — all from any connected AI agent",
    "Every action re-checks your team permissions, so a token only ever does what you're already allowed to do"
  ]
}
```

Make sure the JSON stays valid (comma after the previous change object). Verify:

Run: `node -e "JSON.parse(require('fs').readFileSync('web/src/data/changelog.json','utf8')); console.log('valid json')"`
Expected: `valid json`.

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md web/src/data/changelog.json
git commit -m "docs(mcp): document Phase 3 admin action tools"
```

---

## Self-review notes

- **Spec coverage:** the spec's Phase 3 table is implemented in Tasks 1–3 — `send_standup_reminders` → `schedulerService.sendStandupReminders`, `send_followup_reminders` → `schedulerService.sendFollowupReminders`, `post_team_standup` → `standupService.postTeamStandup` (the spec's "extracted postStandupForTeam" — already exists, no extraction needed, per the Phase 1 deviation note), `post_member_standup` → `standupService.postIndividualResponse`. All gated by `canManageTeam`; Slack calls inherited sequential. Docs/changelog in Task 5.
- **Blast-radius mitigations preserved:** per-call permission re-check (every handler calls `requireManageTeam` before any Slack action), sequential Slack ops (inherited from the wrapped service methods — nothing is parallelized), and `post_team_standup`'s zero-response guard (no empty summaries posted). Verified by the permission-denied tests asserting the Slack-side method was never called.
- **Type/name consistency:** all four handlers pass the full `resolved` team (from `resolveTeam`) to the service methods; posting tools wrap the WebClient as `{ client: slackClient }` (matching `src/commands/standup.js:714,760`); `post_member_standup` builds the `response` via `getUserResponse(resolved.id, targetUser.id, targetDate)` (with `user` included) exactly as the slash command does. `requireManageTeam`, `resolveOrThrow`, `resolveMember`, `assertValidDate`, `TEAM_FIELD`, `json`/`fail` are all pre-existing from Phases 1–2.
- **Reminder client source:** `send_*_reminders` rely on `schedulerService.this.app` (set by `initialize(app)` at startup in `src/app.js`) — the MCP endpoint runs in the same process, so the client is available. They take only `team`.
- **No placeholders:** every code/test step shows complete code; commands have expected output. Task 5 Step 1 adds a boot check because `tools.js` gains a `schedulerService` dependency (circular-import risk surfaced and gated).
- **No schema/migration/env changes.** This completes the three-phase MCP rollout (Phases 1–2 already on PR #39).
