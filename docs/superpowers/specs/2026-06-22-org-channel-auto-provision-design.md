# Auto-provision org Slack channel + auto-invite on team join

**Issue:** [#50](https://github.com/jnahian/daily-dose/issues/50)
**Date:** 2026-06-22
**Status:** Approved — ready for implementation plan

## Goal

1. When an organization is created (admin panel), automatically create a public Slack channel named `daily-dose-bot` for that org.
2. When a user joins a team, automatically invite them to their org's `daily-dose-bot` channel.

## Context (current behavior)

- **Org creation** happens in exactly one place: `POST /api/admin/organizations` (`src/routes/admin.js`), super-admin only. No auto-creation on workspace join.
- **TeamMember creation** happens in three places:
  - `teamService.joinTeam()` — `/dd-team-join` slash command (also auto-adds the user to the org).
  - `teamService` team-creation path — creator added as `ADMIN`.
  - `POST /api/admin/team-members` (`src/routes/admin.js`) — admin adds a member.
- **Slack client access**: Bolt handlers receive `client`; services use `this.app.client`; `src/routes/admin.js` has its own `WebClient` (`slackClient`) built from `BOT_TOKEN`.
- **Bot is single-workspace** (`BOT_TOKEN`); DB schema is multi-tenant. Channels are always created in the bot's installed workspace.
- **Current scopes** lack channel management — only `channels:read`. Need to add scopes and re-install.

## Design decisions

| Decision         | Choice                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channel naming   | Per-org channel named `daily-dose-bot`; on `name_taken` collision, fall back to a slugged suffix (`daily-dose-bot-2`, …). Store the resolved channel ID per org. |
| Backfill         | Forward-only. New orgs get a channel; new joins get invited. Existing orgs/members untouched — a separate one-off script backfills later.                        |
| Failure handling | Best-effort: log Slack failures, never roll back org creation or team join.                                                                                      |

## Architecture

### 1. Data model

Add a nullable column to `Organization`:

- `botChannelId String?` — Slack channel ID (e.g. `C0XXXX`) of the org's `daily-dose-bot` channel. Null until created.

Requires a **Prisma migration** (repo uses committed migrations). Confirm migration-vs-push with the user before running.

### 2. New module: `src/services/channelService.js`

Single-purpose, best-effort wrapper around the Slack channel API. Accepts a Slack `client` as a parameter so it works from both Bolt handlers and the admin route's `WebClient`.

- `ensureOrgChannel(client, org)` — idempotent.
  - If `org.botChannelId` is set, return it.
  - Else `conversations.create({ name: "daily-dose-bot" })`. On `name_taken`, retry with suffix (`daily-dose-bot-2`, `-3`, …) up to a small bound.
  - Persist resulting channel ID to `org.botChannelId`.
  - Bot is auto-added as channel creator.
  - Returns the channel ID (or `null` on failure).
- `inviteUserToOrgChannel(client, org, slackUserId)` — best-effort.
  - No-op if `org.botChannelId` is null.
  - `conversations.invite({ channel, users: slackUserId })`.
  - Swallow `already_in_channel`.

Both functions wrap every Slack call in try/catch, log failures as warnings via the existing logger, and never throw to the caller.

### 3. Hook points

- **Org creation** — after `prisma.organization.create` in `POST /api/admin/organizations`, call `ensureOrgChannel(slackClient, org)`.
- **Team join** — call `inviteUserToOrgChannel` from all three entry points:
  - `teamService.joinTeam()`
  - team-creation path (creator)
  - `POST /api/admin/team-members`

  Each needs the user's `slackUserId` and the team's organization (load `org` with `botChannelId`). All wrapped best-effort.

### 4. Slack scopes

Add **one** bot scope to `slack-app-manifest.json`:

- `channels:manage` — covers both `conversations.create` (create public channel) **and** `conversations.invite` (invite users to a public channel). Verified against Slack docs: `channels:manage` appears in the required-scope list for both methods, so no separate invite scope is needed.

`scripts/updateSlackManifest.js` reads scopes directly from `slack-app-manifest.json` (no hardcoded list), so the manifest edit is sufficient.

Operational: re-install / re-authorize the app to the workspace after the scope change (`npm run manifest:update`, then reinstall). Document in the implementation steps.

### 5. Backfill script

`scripts/backfillOrgChannels.js` (one-off, run manually):

- For each org without `botChannelId`: `ensureOrgChannel`.
- For each active TeamMember in the org: `inviteUserToOrgChannel`.
- Process orgs/teams **sequentially** (Slack rate-limits ~1 req/sec/channel). Add a small delay between invite batches.
- Support `--dry-run`.

Add an `npm run` alias consistent with existing script conventions.

## Error handling

- All Slack channel/invite calls are best-effort and logged; they never block the core DB operation.
- `ensureOrgChannel` collision fallback bounded to a few attempts; if all fail, log and leave `botChannelId` null (next attempt / backfill can retry).
- `inviteUserToOrgChannel` swallows `already_in_channel`; other errors logged.

## Testing

- Unit tests for `channelService` with a mocked Slack `client`:
  - creates channel and persists ID when `botChannelId` null.
  - returns existing ID when already set (idempotent, no API call).
  - retries with suffix on `name_taken`.
  - invite no-ops when no channel; swallows `already_in_channel`; logs other errors.
- Manual Slack verification: create an org in admin panel → channel appears; join a team → user invited.

## Out of scope

- Auto-creating orgs on workspace join (unchanged — admin-panel only).
- Archiving/renaming channels when orgs are deleted/renamed.
- Private channels.

## Documentation

- `CHANGELOG.md`: record the feature (technical).
- `web/src/data/changelog.json`: user-facing entry (auto-channel + auto-invite).
- Admin-panel behavior itself stays out of changelogs per repo rules, but the org-channel/team-join feature is a user-facing bot behavior, so it belongs in both changelogs.
- Update `README.md` for new scopes / behavior if applicable.
