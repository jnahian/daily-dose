# Standup MCP Server — Design

**Date:** 2026-06-16
**Status:** Approved for planning

## Goal

Expose Daily Dose's standup features over the Model Context Protocol (MCP) so a
team member can operate them from any AI agent (Claude Desktop, Cursor, etc.) —
submit and update standups, view history, and (for admins/owners) read team
summaries and run reminder/posting actions.

Full feature parity is the destination, delivered in **three phases** ordered by
blast radius: member self-service → read-only team views → admin actions.

## Non-goals

- No new standup _behavior_ — the MCP is an alternate entry point to existing logic.
- No Slack slash command or manifest changes (MCP is not a slash command).
- No OAuth 2.1 MCP-native authorization server (declined in favor of reusing the
  existing Slack OAuth to mint a bearer token — see Auth).
- Not a separate deployable — the server is embedded in the existing Express app.

## Architecture

```
AI agent (Claude Desktop / Cursor / headless client)
  │  HTTP + Authorization: Bearer <mcp-token>
  ▼
POST /mcp   ← new endpoint mounted in src/app.js (same Express app, same process)
  │  validateMcpToken middleware → mcp_tokens (hashed) → users → req.mcpUser
  ▼
MCP server (@modelcontextprotocol/sdk, Streamable HTTP transport)
  │  tool dispatch ↓
  ▼
Shared service layer (standupService — refactored to own the real logic)
  │
  ├─ read tools   → data methods (getTeamResponses, getUserStandupHistory, …) → JSON
  └─ action tools → submitStandup / postStandupForTeam (require the Bolt app `client`)
```

Key commitments:

1. **Embedded in Express.** The `/mcp` endpoint is mounted in `src/app.js`
   alongside `/api/admin` and the SPA. One process, one domain. Reuses Prisma,
   the services, and the existing Slack OAuth routes directly.

2. **The business logic must be extracted into services first.** Today the
   parity-critical logic for submitting a standup lives in the _Slack handler_
   (`src/commands/standup.js` `handleStandupSubmission`, ~lines 224–310), not in
   `standupService.saveResponse` (which is only persistence). Specifically the
   handler owns: the `isLate` computation, the late-submission → thread-reply /
   parent-post-creation flow, and `notifyAdminsOfStandupSubmission`. The same
   resolve→permission→post sequence lives in `postStandup`. Before the MCP can
   call this logic, it must move into shared service methods that **both** the
   Slack handler and the MCP call. This is an in-scope refactor, not optional.

3. **Action tools need the Bolt app `client`.** Methods like `submitStandup` and
   `postStandupForTeam` post to Slack, so they need the initialized Bolt app's
   `client` (the same object `schedulerService` already holds from startup). The
   embedded MCP handler must reach that app instance to pass `client`/`slackApp`
   through. **Integration risk to validate during implementation:** confirm the
   MCP route can access the initialized Bolt app from `app.js`.

4. **Read tools return structured JSON**, calling data methods directly. They
   never invoke the Block Kit formatters (`formatStandupMessage`,
   `formatIndividualResponseMessage`) — those emit Slack blocks, not agent-facing
   data.

## Authentication

Reuse the admin panel's Slack OAuth flow to establish identity, then issue a
bearer token the MCP transport validates on every request.

- **Identity source:** the existing `GET /api/admin/auth/slack` → `/auth/callback`
  flow. It authenticates _any_ Slack user (super-admin is a separate gate that
  the MCP issuance page does **not** require).
- **Token issuance:** a new authenticated web page ("Generate MCP token"), gated
  by the existing `requireAuth` session cookie. Minting creates a row in a new
  `mcp_tokens` table. The raw token is shown once; only its hash is stored.
- **Token validation:** `validateMcpToken` middleware on `/mcp` reads
  `Authorization: Bearer <token>`, looks up the hash, rejects missing/expired/
  revoked tokens, sets `req.mcpUser`, and updates `lastUsedAt`.

### `mcp_tokens` table

| column     | type      | notes                               |
| ---------- | --------- | ----------------------------------- |
| id         | uuid      | PK                                  |
| userId     | uuid      | FK → users, cascade delete          |
| tokenHash  | string    | sha256 of the raw token, unique     |
| name       | string?   | user-supplied label (e.g. "Cursor") |
| expiresAt  | datetime  | default now + 90 days               |
| revokedAt  | datetime? | set on revoke                       |
| lastUsedAt | datetime? | updated on each validated request   |
| createdAt  | datetime  | default now                         |

Migration is a committed Prisma migration (repo policy: real migrations, not
pure `db push`).

### UX (correcting an earlier mischaracterization)

There is **no per-request browser dance**. The browser is used once, to mint a
token. After that, token-paste into the MCP client's HTTP header works with every
HTTP-capable MCP client, **including headless ones**.

## Tools & phasing

Because an AI agent has no Slack channel context, every team-scoped tool takes an
explicit `team` argument (name, case-insensitive, or id). `list_my_teams` is the
discovery primitive that replaces channel resolution. Team-scoped tools re-run
the existing `canManageTeam` check at call time — a token is the user's
_identity_, never a standing grant.

Field inputs are plain-text strings (no rich_text handling needed —
`saveResponse` already stores strings).

### Phase 1 — member self-service (ships first, lowest risk)

| tool                     | input                                                               | output                              |
| ------------------------ | ------------------------------------------------------------------- | ----------------------------------- |
| `list_my_teams`          | —                                                                   | `[{id, name, role}]`                |
| `submit_standup`         | `{team, yesterdayTasks?, todayTasks?, blockers?}`                   | confirmation `{team, date, isLate}` |
| `update_standup`         | `{team, date(YYYY-MM-DD), yesterdayTasks?, todayTasks?, blockers?}` | confirmation                        |
| `get_my_standup_history` | `{startDate?, endDate?}`                                            | JSON entries                        |

- `submit_standup` requires at least one field filled (matches the modal). Calls
  the extracted `submitStandup` so isLate / admin-notify / late→thread-or-parent
  behavior is identical to `/dd-standup`.
- `update_standup` handles today or a past date, mirroring `/dd-standup-update`.

### Phase 2 — read-only team views (gated by `canManageTeam`)

| tool                 | input                   | output                                    |
| -------------------- | ----------------------- | ----------------------------------------- |
| `get_team_standup`   | `{team, date?}`         | JSON `{responses, notSubmitted, onLeave}` |
| `get_member_standup` | `{team, member, date?}` | JSON response                             |

`get_team_standup` covers both the "summary" and "preview" use cases — preview
was only ever an ephemeral render of the same underlying data.

### Phase 3 — admin actions (gated by `canManageTeam`; sequential Slack calls)

| tool                      | input                   | wraps                                    |
| ------------------------- | ----------------------- | ---------------------------------------- |
| `send_standup_reminders`  | `{team}`                | `schedulerService.sendStandupReminders`  |
| `send_followup_reminders` | `{team}`                | `schedulerService.sendFollowupReminders` |
| `post_team_standup`       | `{team, date?}`         | extracted `postStandupForTeam`           |
| `post_member_standup`     | `{team, member, date?}` | `standupService.postIndividualResponse`  |

Bulk Slack operations stay **sequential** per the repo's ~1 req/sec/channel rule
(CLAUDE.md). These tools wrap the same methods the slash commands already call,
so rate-limit discipline is inherited.

## Safety & error handling

- **Blast radius:** by Phase 3 a leaked or prompt-injected token can DM whole
  teams and post to channels. Mitigations: token expiry (90d default), one-click
  revoke, per-call `canManageTeam` re-checks, sequential bulk ops, and the
  phasing itself — Phase 1 self-service carries none of this exposure, so the
  permission/rate rigor lands with Phase 3.
- **Errors:** tools return clear structured MCP tool errors — unknown team,
  permission denied, no data for the requested date — never silent failures.

## Testing

- Jest unit tests for the extracted `submitStandup` / `postStandupForTeam`,
  asserting parity with the current handler behavior (isLate, admin notify,
  late→thread/parent).
- Jest tests for `validateMcpToken` (missing / expired / revoked / valid).
- Jest tests for tool handlers with a mocked Bolt `client`.
- Manual end-to-end test against a real MCP client (token mint → paste → call).

## Documentation

- Setup guide (mint token → paste into MCP client config) in the `web` docs and
  README.
- No Slack manifest change.
- Changelog: `CHANGELOG.md` always; `web/src/data/changelog.json` for the
  user-visible "operate standups from your AI agent" feature.

## Implementation scope

This spec covers, for a single implementation plan:

- Shared infra: the service extraction, `mcp_tokens` table + migration, token
  issuance page, `validateMcpToken` middleware, the `/mcp` Streamable HTTP
  endpoint and MCP server scaffold, team-resolution helper.
- **Phase 1 tools in full.**

Phases 2 and 3 are outlined here and will get their own plan increments once
Phase 1 is in place.
