# MCP Standup Auto-Draft — Design

**Date:** 2026-06-17
**Status:** Approved (pending implementation plan)

## Goal

Let a team member ask their AI agent to do their standup, and have the agent:

1. Gather "what I worked on" from **its own** connections (GitHub, Jira, ClickUp,
   Trello — via other MCP servers or built-in tools).
2. Draft the three standup fields (yesterday / today / blockers).
3. Show a **faithful preview** of what will be submitted.
4. Submit **only after explicit user confirmation**.

This automates the tedious part of standup (recalling and writing up work) while
keeping the human in the loop for accuracy.

## Scope

**In scope** (all under `src/mcp/`):

- A read-only `preview_standup` tool.
- An MCP prompt `compose_standup` that drives the gather → draft → preview →
  confirm → submit choreography.
- A reworded `submit_standup` description.
- Docs + changelog updates.

**Explicitly out of scope:**

- Daily Dose builds **no** third-party integrations and stores **no** external
  OAuth tokens. Task-gathering is the **agent's** job, using the agent's own
  connections. Daily Dose only provides preview/submit tooling and guidance.
- No server-enforced draft/confirm handshake (no draft tokens, no stateful draft
  storage). The flow is stateless; confirmation is the agent's responsibility,
  reinforced by the prompt, the `preview_standup` tool, and tool descriptions.

## Architecture

Three additions, all in the existing MCP layer. No new services, no schema
changes.

```
user → "do my Engineering standup"
  agent ─(its own MCP/tools)→ GitHub / Jira / ClickUp / Trello   # gather work
  agent → preview_standup(team, drafted fields)                  # DD renders, NO write
  agent → shows `preview`, surfaces willOverwrite/isLate, asks   # confirmation
  user → "yes"
  agent → submit_standup(team, fields)                           # DD writes (existing path)
```

The agent may loop preview ↔ edit before submitting. `submit_standup` is
unchanged behaviorally — it remains the only write path.

## Component: `preview_standup` tool

Read-only. Resolves and validates exactly like `submit_standup`, but never
writes. Identity-scoped via the existing `resolveTeam` (you can only preview for
teams you belong to).

**Input**

| field            | type                | notes                                |
| ---------------- | ------------------- | ------------------------------------ |
| `team`           | string (required)   | team name or id                      |
| `date`           | string `YYYY-MM-DD` | optional; default = today in team tz |
| `yesterdayTasks` | string              | optional                             |
| `todayTasks`     | string              | optional                             |
| `blockers`       | string              | optional                             |

At least one of the three task fields is required (same rule as
`submit_standup`).

**Output**

```jsonc
{
  "team": "Engineering", // resolved name
  "date": "2026-06-17",
  "isLate": true, // past the team's standup window
  "willOverwrite": true, // a submission already exists for this date
  "existing": {
    // null when nothing exists yet
    "yesterdayTasks": "…",
    "todayTasks": "…",
    "blockers": "…",
  },
  "fields": {
    // the draft, normalized
    "yesterdayTasks": "…",
    "todayTasks": "…",
    "blockers": "…",
  },
  "preview": "*Engineering — 2026-06-17*\n*Yesterday:* …\n*Today:* …\n*Blockers:* …",
}
```

`preview` is a ready-to-display string so the agent shows something faithful
rather than improvising. `isLate` and `willOverwrite` are computed from the same
helpers `submit_standup` already relies on — no new query logic is invented.

## Component: `compose_standup` MCP prompt

Surfaces as a slash-command in clients that support prompts (Claude Desktop,
Cursor); degrades to tool-description guidance elsewhere.

**Arguments:** `team` (optional), `date` (optional).

**Instructs the agent to:**

1. Resolve the team — call `list_my_teams`; if multiple teams and `team` not
   given, ask the user which one.
2. Gather **completed** work since the user's last working day and **planned**
   work for today from whatever work connections the agent has (git commits/PRs,
   issue trackers). Source-agnostic.
3. Map findings to `yesterdayTasks` / `todayTasks` / `blockers`.
4. Call `preview_standup` with the draft.
5. Display the returned `preview`, surface `willOverwrite` and `isLate`, and ask
   for **explicit confirmation**.
6. On confirmation, call `submit_standup`. On requested edits, re-draft and
   re-preview.

**Hard rules baked into the prompt:** never submit without confirmation; if no
work is found, say so rather than fabricating tasks.

## Component: `submit_standup` description rewording

Append guidance (no code/behavior change):

> Before calling, draft the fields, call `preview_standup`, show the user the
> preview, and get explicit confirmation. Don't fabricate work the user didn't
> do.

This covers clients that don't support MCP prompts.

## Edge cases

| Case                        | Handling                                                      |
| --------------------------- | ------------------------------------------------------------- |
| Multi-team, no team given   | Prompt has agent call `list_my_teams` and ask.                |
| Submission already exists   | `willOverwrite: true` + `existing` so the user sees the swap. |
| Past standup window         | `isLate: true` shown in preview; submit still allowed.        |
| No work found by the agent  | Agent reports it; does not fabricate (prompt rule).           |
| Not a member / invalid date | Same errors `submit_standup`/`resolveTeam` already throw.     |

## Testing

Jest, following `test/mcp/`:

- `preview_standup`:
  - renders `fields` and `preview` from inputs;
  - `willOverwrite: true` + `existing` populated when a response exists, `false` +
    `existing: null` when none;
  - `isLate` boundary (before vs after the team window);
  - date validation rejects malformed dates;
  - "at least one field" rule enforced;
  - **asserts no DB write** — team response count is unchanged after preview.
- Registration: `preview_standup` tool **and** `compose_standup` prompt register
  on the SDK server (extends the `server.test.js` pattern).
- No tests for git/Jira/etc. — out of scope by design.

## Docs & changelog

- `web/src/data/mcpDocs.json`: new subsection ("Let your agent draft your
  standup") explaining the prompt and the preview/confirm flow.
- `CHANGELOG.md`: technical entry under `[Unreleased]`.
- `web/src/data/changelog.json`: user-facing entry — this change **is**
  user-visible.
