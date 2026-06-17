# MCP Standup Auto-Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `preview_standup` MCP tool and a `compose_standup` MCP prompt so an AI agent can draft a standup from its own work connections, show a faithful preview, and submit only after explicit user confirmation.

**Architecture:** Three additions in the existing MCP layer (`src/mcp/`) plus one small refactor in `standupService`. `preview_standup` renders a draft without writing; `compose_standup` is a server-side prompt that drives gather → draft → preview → confirm → submit; `submit_standup`'s description gains preview/confirm guidance. Daily Dose builds no third-party integrations — task-gathering is the agent's job.

**Tech Stack:** Node.js, `@modelcontextprotocol/sdk` v1.29.0, zod, dayjs, Jest.

**Spec:** `docs/superpowers/specs/2026-06-17-mcp-standup-autodraft-design.md`

---

## File Structure

- **Modify** `src/services/standupService.js` — extract `computeIsLate(team, standupDate)` from `submitStandup`; both `submitStandup` and the new preview tool call it (DRY).
- **Modify** `src/mcp/tools.js` — add a `formatStandupPreview` helper, a `composeStandupPromptText` helper, the `preview_standup` handler, its tool registration, the `compose_standup` prompt registration, and reword `submit_standup`'s description.
- **Create** `test/services/standupService.computeIsLate.test.js` — unit tests for the extracted helper (late-boundary logic).
- **Create** `test/mcp/tools.preview.test.js` — unit tests for the `preview_standup` handler.
- **Modify** `test/mcp/server.test.js` — assert `preview_standup` tool and `compose_standup` prompt register.
- **Modify** `web/src/data/mcpDocs.json`, `CHANGELOG.md` — docs + technical changelog. The user-facing `web/src/data/changelog.json` entry is **deferred to release time** (the `/release` flow folds user-visible changes under the cut version); its content is drafted in Task 4 but not inserted now.

---

## Task 1: Extract `computeIsLate` in standupService

**Files:**

- Modify: `src/services/standupService.js` (around lines 731-758)
- Test: `test/services/standupService.computeIsLate.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `test/services/standupService.computeIsLate.test.js`:

```js
// computeIsLate is pure (dayjs + team config). Mock the heavy deps so requiring
// the service stays offline.
jest.mock("../../src/config/prisma", () => ({}));
jest.mock("../../src/services/userService", () => ({}));
jest.mock("../../src/services/notificationService", () => ({}));

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

const standupService = require("../../src/services/standupService");

const team = { timezone: "UTC", postingTime: "10:00" };

describe("standupService.computeIsLate", () => {
  it("is false for a past date regardless of time", () => {
    const pastDate = dayjs().utc().subtract(3, "day").toDate();
    expect(standupService.computeIsLate(team, pastDate)).toBe(false);
  });

  it("is true for today after the posting time", () => {
    // Build a 'today' timestamp at 23:59 UTC, well past 10:00 posting time.
    const lateToday = dayjs().utc().startOf("day").hour(23).minute(59).toDate();
    expect(standupService.computeIsLate(team, lateToday)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/services/standupService.computeIsLate.test.js`
Expected: FAIL — `standupService.computeIsLate is not a function`.

- [ ] **Step 3: Add the `computeIsLate` method**

In `src/services/standupService.js`, add this method immediately **before** `async submitStandup(`:

```js
  // Whether a submission for `standupDate` counts as late: only today-or-future
  // dates can be late, and only once the team's posting time has passed.
  computeIsLate(team, standupDate) {
    const targetDate = dayjs(standupDate).tz(team.timezone);
    const todayStart = dayjs().tz(team.timezone).startOf("day");

    let isLate = false;
    if (
      targetDate.startOf("day").isSame(todayStart) ||
      targetDate.startOf("day").isAfter(todayStart)
    ) {
      const [postingHour, postingMinute] = team.postingTime
        .split(":")
        .map(Number);
      const postingTime = dayjs()
        .tz(team.timezone)
        .startOf("day")
        .hour(postingHour)
        .minute(postingMinute);
      isLate = dayjs().tz(team.timezone).isAfter(postingTime);
    }
    return isLate;
  }
```

- [ ] **Step 4: Refactor `submitStandup` to use it**

In `src/services/standupService.js`, replace the inline `isLate` block (the `let isLate = false;` through the closing `}` of the `if`, currently lines ~744-758) with a single line:

```js
const isLate = this.computeIsLate(team, standupDate);
```

The surrounding lines stay: `const { yesterdayTasks = "", ... } = fields;`, `const targetDate = dayjs(standupDate).tz(team.timezone);` (still used later for the late-thread branch), and the `await this.saveResponse(...)` call. Delete the now-unused `const todayStart = ...` line only if nothing else below references it (it does not).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest test/services/standupService.computeIsLate.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full suite to confirm no regression**

Run: `npm test`
Expected: PASS — existing standup/MCP tests still green (submitStandup behavior unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/services/standupService.js test/services/standupService.computeIsLate.test.js
git commit -m "refactor(standup): extract computeIsLate helper"
```

---

## Task 2: Add the `preview_standup` tool

**Files:**

- Modify: `src/mcp/tools.js`
- Test: `test/mcp/tools.preview.test.js` (create)

- [ ] **Step 1: Write the failing handler test**

Create `test/mcp/tools.preview.test.js`:

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
  computeIsLate: jest.fn(),
}));
jest.mock("../../src/services/teamService", () => ({ getTeamById: jest.fn() }));
jest.mock("../../src/services/schedulerService", () => ({
  sendStandupReminders: jest.fn(),
  sendFollowupReminders: jest.fn(),
}));

const { resolveTeam } = require("../../src/mcp/teamResolver");
const standupService = require("../../src/services/standupService");
const teamService = require("../../src/services/teamService");
const { buildToolHandlers } = require("../../src/mcp/tools");

const user = { id: "user-1", slackUserId: "U1", name: "Alice" };
const slackClient = { chat: { postMessage: jest.fn() } };
const team = { id: "t1", name: "Eng", timezone: "UTC", postingTime: "10:00" };

describe("preview_standup handler", () => {
  let tools;
  beforeEach(() => {
    jest.clearAllMocks();
    resolveTeam.mockResolvedValue({ team: { id: "t1", name: "Eng" } });
    teamService.getTeamById.mockResolvedValue(team);
    standupService.computeIsLate.mockReturnValue(false);
    tools = buildToolHandlers(user, slackClient);
  });

  it("rejects when all fields are empty", async () => {
    await expect(tools.preview_standup({ team: "Eng" })).rejects.toThrow(
      /at least one field/i
    );
  });

  it("renders a preview and reports willOverwrite=false when nothing exists", async () => {
    standupService.getUserResponse.mockResolvedValue(null);
    const result = await tools.preview_standup({
      team: "Eng",
      date: "2026-06-17",
      yesterdayTasks: "Shipped auth",
      todayTasks: "Code review",
    });
    expect(result.team).toBe("Eng");
    expect(result.date).toBe("2026-06-17");
    expect(result.willOverwrite).toBe(false);
    expect(result.existing).toBeNull();
    expect(result.fields).toEqual({
      yesterdayTasks: "Shipped auth",
      todayTasks: "Code review",
      blockers: "",
    });
    expect(result.preview).toContain("Eng — 2026-06-17");
    expect(result.preview).toContain("Shipped auth");
    expect(standupService.submitStandup).not.toHaveBeenCalled();
  });

  it("reports willOverwrite=true with the existing submission", async () => {
    standupService.getUserResponse.mockResolvedValue({
      yesterdayTasks: "Old y",
      todayTasks: "Old t",
      blockers: "",
    });
    const result = await tools.preview_standup({
      team: "Eng",
      date: "2026-06-17",
      todayTasks: "New plan",
    });
    expect(result.willOverwrite).toBe(true);
    expect(result.existing).toEqual({
      yesterdayTasks: "Old y",
      todayTasks: "Old t",
      blockers: "",
    });
  });

  it("rejects an invalid date", async () => {
    await expect(
      tools.preview_standup({
        team: "Eng",
        date: "06-17-2026",
        todayTasks: "x",
      })
    ).rejects.toThrow(/Invalid date/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/mcp/tools.preview.test.js`
Expected: FAIL — `tools.preview_standup is not a function`.

- [ ] **Step 3: Add the `formatStandupPreview` module helper**

In `src/mcp/tools.js`, add this function immediately after the `assertValidDate` function (module scope, before `buildToolHandlers`):

```js
function formatStandupPreview(teamName, date, fields) {
  const { yesterdayTasks, todayTasks, blockers } = fields;
  return [
    `*${teamName} — ${date}*`,
    `*Yesterday:* ${yesterdayTasks || "_(none)_"}`,
    `*Today:* ${todayTasks || "_(none)_"}`,
    `*Blockers:* ${blockers || "_(none)_"}`,
  ].join("\n");
}
```

- [ ] **Step 4: Add the `preview_standup` handler**

In `src/mcp/tools.js`, inside the object returned by `buildToolHandlers`, add this handler immediately after the `update_standup` handler (after its closing `},`):

```js
    async preview_standup({
      team,
      date,
      yesterdayTasks = "",
      todayTasks = "",
      blockers = "",
    }) {
      if (date) assertValidDate(date);
      if (!yesterdayTasks && !todayTasks && !blockers) {
        throw new Error(
          "Provide at least one field (yesterdayTasks, todayTasks, or blockers)."
        );
      }
      const resolved = await resolveOrThrow(team);
      const full = await teamService.getTeamById(resolved.id);
      const targetDate = date
        ? dayjs(date, "YYYY-MM-DD").toDate()
        : dayjs().tz(full.timezone).toDate();
      const dateStr = dayjs(targetDate).tz(full.timezone).format("YYYY-MM-DD");

      const existingRow = await standupService.getUserResponse(
        full.id,
        user.id,
        targetDate
      );
      const existing = existingRow
        ? {
            yesterdayTasks: existingRow.yesterdayTasks || "",
            todayTasks: existingRow.todayTasks || "",
            blockers: existingRow.blockers || "",
          }
        : null;

      const fields = { yesterdayTasks, todayTasks, blockers };
      return {
        team: resolved.name,
        date: dateStr,
        isLate: standupService.computeIsLate(full, targetDate),
        willOverwrite: existing !== null,
        existing,
        fields,
        preview: formatStandupPreview(resolved.name, dateStr, fields),
      };
    },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest test/mcp/tools.preview.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Register the `preview_standup` tool**

In `src/mcp/tools.js`, inside `registerTools`, add this registration immediately after the `update_standup` registration block (after its closing `);`):

```js
server.registerTool(
  "preview_standup",
  {
    title: "Preview standup",
    description:
      "Render a standup draft for a team WITHOUT saving it, so you can show the user exactly what will be submitted. Returns the formatted preview, whether it will overwrite an existing submission (willOverwrite/existing), and whether it will count as late (isLate). Always call this and get the user's explicit confirmation before calling submit_standup or update_standup.",
    inputSchema: z.object({
      team: TEAM_FIELD,
      date: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
      yesterdayTasks: z.string().optional(),
      todayTasks: z.string().optional(),
      blockers: z.string().optional(),
    }),
  },
  async (args) => {
    try {
      return json(await handlers.preview_standup(args));
    } catch (e) {
      return fail(e);
    }
  }
);
```

- [ ] **Step 7: Commit**

```bash
git add src/mcp/tools.js test/mcp/tools.preview.test.js
git commit -m "feat(mcp): add preview_standup tool"
```

---

## Task 3: Add the `compose_standup` prompt and reword `submit_standup`

**Files:**

- Modify: `src/mcp/tools.js`
- Test: `test/mcp/server.test.js`

- [ ] **Step 1: Write the failing registration test**

In `test/mcp/server.test.js`, inside the `describe("registerTools SDK wiring", ...)` block, add a new test after the existing one:

```js
it("registers preview_standup and the compose_standup prompt", () => {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  const toolSpy = jest.spyOn(server, "registerTool");
  const promptSpy = jest.spyOn(server, "registerPrompt");
  const user = { id: "u1", slackUserId: "U1", name: "Alice" };
  const slackClient = { chat: { postMessage: jest.fn() } };

  expect(() => registerTools(server, user, slackClient)).not.toThrow();

  expect(toolSpy.mock.calls.map((c) => c[0])).toEqual(
    expect.arrayContaining(["preview_standup"])
  );
  expect(promptSpy.mock.calls.map((c) => c[0])).toEqual(
    expect.arrayContaining(["compose_standup"])
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest test/mcp/server.test.js -t "compose_standup"`
Expected: FAIL — `preview_standup`/`compose_standup` not found in the spied calls.

(Note: `preview_standup` already exists from Task 2, so the tool assertion passes; the prompt assertion is what fails here.)

- [ ] **Step 3: Add the `composeStandupPromptText` module helper**

In `src/mcp/tools.js`, add this function at module scope (after `formatStandupPreview`):

```js
function composeStandupPromptText({ team, date } = {}) {
  return [
    "Help me submit my Daily Dose standup. Follow these steps:",
    "",
    `1. Determine the team.${
      team
        ? ` Use the team "${team}".`
        : " Call list_my_teams; if I belong to more than one team and I haven't named one, ask me which team."
    }`,
    `2. Gather my work${
      date ? ` for ${date}` : ""
    } using whatever work connections you have (git commits/PRs, ClickUp, Jira, Trello, etc.): what I completed since my last working day, what I plan to do today, and any blockers. Do NOT invent work — if you find nothing, tell me.`,
    "3. Map findings to three fields: yesterdayTasks (completed), todayTasks (planned), and blockers.",
    `4. Call preview_standup with the team${
      date ? `, date ${date},` : ""
    } and the drafted fields.`,
    "5. Show me the returned `preview` text verbatim. Warn me if willOverwrite is true (it replaces my existing submission) or isLate is true.",
    "6. Ask me to confirm. Do NOT submit until I explicitly say yes.",
    `7. When I confirm, call ${
      date ? "update_standup (with the date)" : "submit_standup"
    } using the same fields. If I ask for changes, revise and preview again.`,
  ].join("\n");
}
```

- [ ] **Step 4: Register the `compose_standup` prompt**

In `src/mcp/tools.js`, inside `registerTools`, add this at the **end** of the function, immediately before its closing `}` (after the last `server.registerTool(...)` block):

```js
server.registerPrompt(
  "compose_standup",
  {
    title: "Compose my standup",
    description:
      "Draft your standup from your connected work tools (git, Jira, ClickUp, Trello), preview it, and submit it after your confirmation.",
    argsSchema: {
      team: z
        .string()
        .optional()
        .describe(
          "Team name; you'll be asked if omitted and on multiple teams"
        ),
      date: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
    },
  },
  (args = {}) => ({
    messages: [
      {
        role: "user",
        content: { type: "text", text: composeStandupPromptText(args) },
      },
    ],
  })
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest test/mcp/server.test.js -t "compose_standup"`
Expected: PASS.

- [ ] **Step 6: Reword the `submit_standup` description**

In `src/mcp/tools.js`, in the `submit_standup` registration, replace its `description` value with:

```js
      description:
        "Submit today's standup for a team. At least one field is required. Before calling, draft the fields, call preview_standup, show the user the preview, and get explicit confirmation. Don't fabricate work the user didn't do.",
```

- [ ] **Step 7: Run the full MCP suite**

Run: `npx jest test/mcp`
Expected: PASS — all MCP tests green.

- [ ] **Step 8: Commit**

```bash
git add src/mcp/tools.js test/mcp/server.test.js
git commit -m "feat(mcp): add compose_standup prompt and preview guidance"
```

---

## Task 4: Docs and changelogs

**Files:**

- Modify: `web/src/data/mcpDocs.json`
- Modify: `CHANGELOG.md`
- (Deferred to release) `web/src/data/changelog.json` — content drafted below, not inserted now

- [ ] **Step 1: Add an MCP docs subsection**

In `web/src/data/mcpDocs.json`, insert this subsection object into the `subsections` array immediately **after** the `mcp-tools-everyone` subsection (and before `mcp-tools-admin`):

```json
        {
          "id": "mcp-autodraft",
          "title": "Let your agent draft your standup",
          "content": [
            {
              "type": "note",
              "title": "✍️ Draft from your other tools",
              "value": "If your AI agent is also connected to your work tools (GitHub, Jira, ClickUp, Trello), it can gather what you did and draft your standup for you — then show you a preview and submit only after you confirm. Daily Dose never connects to those tools itself; it relies on the connections your agent already has."
            },
            {
              "type": "text",
              "value": "**Just ask** — for example: *“Draft my Engineering standup from my GitHub activity and show me a preview.”* In clients that support prompts (like Claude Desktop), you can also run the **compose_standup** prompt as a shortcut."
            },
            {
              "type": "command",
              "command": "preview_standup",
              "description": "Render a standup draft for a team without saving it. Shows exactly what will be submitted, whether it will overwrite an existing entry, and whether it counts as late — so you can review before confirming.",
              "examples": [
                "# Your agent calls this, then shows you the preview and asks:\nReady to submit this standup to Engineering?"
              ]
            },
            {
              "type": "warning",
              "title": "You always confirm",
              "value": "Your agent is instructed to preview and get your explicit yes before submitting, and never to invent work you didn't do. Nothing is written to Daily Dose until you approve it."
            }
          ]
        },
```

- [ ] **Step 2: Validate the JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('web/src/data/mcpDocs.json','utf8')); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Add the CHANGELOG.md entry**

In `CHANGELOG.md`, under `## [Unreleased]`, add an `### Added` section (create it if absent) with:

```markdown
- MCP `preview_standup` tool (read-only): renders a standup draft for a team without saving it, reporting `willOverwrite`/`existing` and `isLate` so an agent can show a faithful preview before submitting. (`src/mcp/tools.js`)
- MCP `compose_standup` prompt: guides an agent to gather work from its own connections (git/Jira/ClickUp/Trello), draft the standup, preview it, and submit only after explicit user confirmation. (`src/mcp/tools.js`)
- `standupService.computeIsLate(team, standupDate)` extracted from `submitStandup` and reused by `preview_standup` (no behavior change). (`src/services/standupService.js`)
- Reworded `submit_standup` tool description to instruct agents to preview and confirm before submitting. (`src/mcp/tools.js`)
```

- [ ] **Step 4: Draft the user-facing changelog content (do NOT edit the file yet)**

Do **not** insert a synthetic version into `web/src/data/changelog.json` — the `/release` flow adds user-facing entries under the cut version (with correct `isLatest` handling). Record this `changes` block in the PR description / hand it to the maintainer to fold in at release:

```json
{
  "type": "added",
  "title": "Let your AI agent draft your standup",
  "items": [
    "If your AI agent is connected to your work tools, it can gather what you did, draft your standup, and show you a preview before anything is submitted",
    "You always confirm first — your agent never posts a standup without your explicit yes, and won't invent work you didn't do"
  ]
}
```

- [ ] **Step 5: Build the web app**

Run: `cd web && npm run build`
Expected: build succeeds (validates the `mcpDocs.json` change renders).

- [ ] **Step 6: Commit**

```bash
git add web/src/data/mcpDocs.json CHANGELOG.md
git commit -m "docs(mcp): document standup auto-draft (preview + compose prompt)"
```

---

## Final verification

- [ ] **Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Sanity-check tool/prompt registration against the real SDK**

Run: `npx jest test/mcp/server.test.js`
Expected: PASS — confirms `preview_standup` and `compose_standup` register without schema errors.
