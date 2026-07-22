# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Team disable/enable/delete slash commands (team admin or org owner/admin):
  - `/dd-team-disable [team-name]` pauses a team by setting `isActive: false` and tearing down its cron jobs via the new `schedulerService.stopTeamSchedule(teamId)`; the team's members and standup history are preserved. (`src/commands/team.js`, `src/services/teamService.js` `setTeamActive`, `src/services/schedulerService.js`)
  - `/dd-team-enable [team-name]` restores a disabled team (`isActive: true`) and reschedules it via `refreshTeamSchedule` when its status is `ACTIVE` (a still-`PENDING` team is left unscheduled).
  - `/dd-team-delete [team-name]` shows a Block Kit confirmation prompt (`createTeamDeleteConfirmBlocks`) and, on confirm, soft-deletes the team via `teamService.deleteTeam` (`deletedAt` + `isActive: false`, mirroring the admin panel) then stops its schedule. The row and its members/standup history are retained for operator restore, but `deletedAt` hides the team from every Slack lookup so it can't be re-enabled from Slack (unlike a disabled team). Confirm/cancel handled by the `confirm_delete_team_*` / `cancel_delete_team_*` actions with `createTeamDeleteResultBlocks`. (`src/commands/index.js`, `src/utils/blockHelper.js`)
  - All three resolve the target team by explicit name (scoped to the caller's org) or the current channel via new `teamService.findManageableTeamByName` / `findManageableTeamByChannel`, which include disabled but exclude soft-deleted (`deletedAt`) teams, so a disabled team can still be re-enabled or deleted while a deleted one cannot.
  - `permissionHelper.canManageTeam` gained a `{ requireActive = true }` option so disabled teams stay manageable by their admins.
  - Registered the three slash commands in `slack-app-manifest.json` and documented them in `web/src/data/docs.json`.

### Changed

- `teamService.createTeam` now revives a soft-deleted team in a channel instead of throwing "This channel already has a team". The `slackChannelId` column is unique, so a soft-deleted team keeps occupying the channel; `createTeam` detects the `deletedAt` row and reuses it — clearing `deletedAt`, reactivating, applying the caller's new name/times/timezone, and re-asserting the creator as an active team ADMIN via `teamMember.upsert` — so `/dd-team-create` in the channel restores the team (retained members and standup history come back) rather than dead-ending. Returns a `revived` flag so `/dd-team-create` reports "restored" and notes the kept data. An active/disabled team in the channel still blocks creation as before. (`src/services/teamService.js`, `src/commands/team.js`)
- Standup reminder and follow-up DMs now open with a time-of-day greeting ("Good morning", "Good afternoon", "Good evening", or a neutral "Hello" late at night / overnight) instead of a random salutation. The greeting is chosen from the current hour in the **recipient's own** timezone (`User.timezone`), so members on distributed teams each get a correct greeting. Implemented via a new `getTimeGreeting(tz)` helper and a `{greeting}` token in the reminder templates; `getRandomStandupMessage`/`getRandomFollowupMessage` now take an optional `timezone` argument (server-local fallback when omitted or invalid), and `schedulerService` passes `member.user.timezone` at both call sites. (`src/utils/messageHelper.js`, `src/services/schedulerService.js`, `test/utils/messageHelper.test.js`)

## [1.16.2] - 2026-07-09

### Added

- MCP tool-call tracking: every `tools/call` on the `POST /mcp` endpoint now writes an `mcp_tool_calls` row (`user_id`, `tool_name`, `created_at`) from the `handleMcp` choke point. The insert is fire-and-forget with a `.catch()` into `logger.error`, so a tracking failure can never fail a tool call. Rows are written before the tool executes, so counts are call attempts, not successes. (`prisma/schema.prisma`, `prisma/migrations/20260709063754_add_mcp_tool_calls/`, `src/mcp/server.js`)
- `GET /api/admin/mcp-usage?orgId=&days=` returns per-user, per-day MCP tool-call counts for an org, gated by `verifyOrgAccess` with the day window clamped to 1–365. No org is recorded at write time (a user may belong to several), so `organization_members` is joined at read time — a multi-org user's calls appear under each of their orgs. (`src/routes/admin.js`)
- MCP Usage admin page (`/admin/mcp-usage`): a recharts multi-series line chart of per-user tool-call counts over a 7/30/90-day window. Plots the six busiest users and folds the remainder into an "Other" series; hues are keyed to user identity via a persistent slot map, so changing the day range never repaints a surviving series. Adds `recharts` to `web/` (lazy-loaded chunk, ~372 kB). (`web/src/pages/admin/McpUsage.tsx`, `web/src/App.tsx`, `web/src/components/admin/AdminSidebar.tsx`)

### Changed

- Documented the MCP Usage page and `GET /api/admin/mcp-usage` endpoint, including the attempts-not-successes and multi-org read-time-join caveats. (`docs/admin-panel.md`)

## [1.16.1] - 2026-06-23

### Added

- Demo video section on the landing page (`web/src/components/landing/DemoVideo.tsx`): a lazy-loaded, privacy-friendly (`youtube-nocookie`) 16:9 embed rendered between How It Works and FAQ on the homepage, with a "Demo" link (`/#demo`) added to the Home submenu in the navbar. (`web/src/components/Navbar.tsx`, `web/src/pages/Home.tsx`, `web/src/components/landing/index.ts`)

### Changed

- Simplified the README from a 1256-line end-user guide into a concise developer/repo overview, since the full user guide now lives at dd.jnahian.me/docs. Added a links bar (Documentation, Changelog, Deployment, Contributing) and kept the short feature list, tech stack, dev setup, scripts table, project structure, and versioning sections; removed duplicated user content (full command reference, scenarios, error walkthroughs, env-var catalog, MCP setup). (`README.md`)

### Fixed

- MCP standup submissions (`submit_standup` / `update_standup`) now escape Slack mrkdwn control characters (`&`, `<`, `>`) in `yesterdayTasks`, `todayTasks`, and `blockers` before storing them, via a shared `escapeStandupFields` helper (built on `escapeSlackText`). Previously the LLM-supplied text was stored verbatim, so a submission containing angle brackets — e.g. a PR title like "password with < or > characters" — was parsed by Slack as broken link/mention syntax and corrupted the entire posted standup message. This brings the MCP path in line with the modal path, which already escapes raw text during rich-text extraction (`extractRichTextValue`). `preview_standup` escapes the same way so its `fields`/`preview` match what gets stored (and the already-escaped `existing` value). (`src/mcp/tools.js`)

## [1.16.0] - 2026-06-23

### Added

- Auto-provision a per-org `daily-dose-bot` Slack channel on organization creation (`channelService.ensureOrgChannel`, stored on `Organization.botChannelId`). Falls back to `daily-dose-bot-2`, etc. on name conflicts.
- Auto-invite members to their org's `daily-dose-bot` channel on team join (`/dd-team-join`, team creation, and admin add-member). Best-effort; Slack failures are logged, never blocking.
- `npm run channels:backfill` (supports `--dry-run`) to create channels and invite current members for existing orgs.
- Added `channels:manage` bot scope to the Slack manifest (required for channel creation and member invites). Re-install the app to the workspace after updating the manifest.
- Auto-broadcast the latest user-facing changelog entry to each org's `daily-dose-bot` channel on deploy (`src/services/changelogBroadcastService.js`, fired from `src/app.js` after `app.start`). Per-org `Organization.lastBroadcastVersion` marker prevents re-posting on restarts; a `null` marker is seeded silently so existing orgs aren't mass-blasted on first deploy, and new orgs are stamped with the current version at creation. Set `CHANGELOG_BROADCAST=off` to disable or `=dry` to preview without posting.
- Member status in `/dd-team-list` (compact, nested per team) and `/dd-team-members` (detailed cards): today's standup, on-leave, notifications on/off, role, and active/inactive (team & org). Standup status is suppressed for admins and on non-work-days/holidays. New `deriveMemberStatus` resolver, `teamService.getTeamMembersWithStatus`, and `blockHelper` renderers.

## [1.15.2] - 2026-06-21

### Fixed

- Updating an already-submitted standup (via `/dd-standup-update` or MCP `update_standup`) after the team summary has posted now labels the channel thread reply **"🔄 Standup Updated"** instead of **"🕐 Late Submission"**. The thread reply's visible header is driven by the Block Kit blocks, so `createLateResponseBlocks` and `formatLateResponseMessage` now take an `isUpdate` flag that the `submitStandup` late→thread path threads through; the fallback notification text was also corrected (it was previously overridden by the message spread). (`src/utils/blockHelper.js`, `src/services/standupService.js`, #48)

## [1.15.1] - 2026-06-17

### Changed

- MCP `compose_standup` prompt now tells the agent where to source each field: completed work from finished items (merged PRs, closed/done tickets), today's plan from in-progress/assigned work (open PRs, WIP branches, in-progress/to-do tickets), and blockers — previously it only described gathering completed work. (`src/mcp/tools.js`)
- MCP `compose_standup` prompt now starts by checking my last submission via `get_my_standup_history`, using its planned `todayTasks` as a checklist and asking which items I completed / for status updates before drafting `yesterdayTasks`. (`src/mcp/tools.js`)

## [1.15.0] - 2026-06-17

### Added

- MCP server now advertises a display `title`, `websiteUrl`, and `icons` (32/192/512 PNGs derived from `APP_URL`) on initialize, so MCP clients that support the icons spec show the Daily Dose logo next to the connected server. (`src/mcp/server.js`)
- MCP `preview_standup` tool (read-only): renders a standup draft for a team without saving it, reporting `willOverwrite`/`existing` and `isLate` so an agent can show a faithful preview before submitting. (`src/mcp/tools.js`)
- MCP `compose_standup` prompt: guides an agent to gather work from its own connections (git/Jira/ClickUp/Trello), draft the standup, preview it, and submit only after explicit user confirmation. (`src/mcp/tools.js`)
- `standupService.computeIsLate(team, standupDate)` extracted from `submitStandup` and reused by `preview_standup` (no behavior change). (`src/services/standupService.js`)
- Reworded `submit_standup` tool description to instruct agents to preview and confirm before submitting. (`src/mcp/tools.js`)

## [1.14.0] - 2026-06-17

### Added

- MCP server at `POST /mcp` (Streamable HTTP, `@modelcontextprotocol/sdk` v1.29.0): team members can submit and view standups from any AI agent using a bearer token. (`src/mcp/server.js`, `src/mcp/tools.js`)
- Phase 1 MCP tools: `list_my_teams`, `submit_standup`, `update_standup`, `get_my_standup_history`. (`src/mcp/tools.js`)
- `submitStandup` shared service method extracted from Slack command handler — handles isLate computation, admin notification, and late→thread/parent-post logic. Both Slack and MCP now call the same code path. (`src/services/standupService.js`)
- `mcp_tokens` table and migration (`20260616180944_add_mcp_tokens`) for bearer token storage (SHA-256 hashed, 90-day TTL, revocable). (`prisma/schema.prisma`, `prisma/migrations/`)
- `mcpTokenService`: mint, validate, list, and revoke MCP tokens. (`src/services/mcpTokenService.js`)
- Member-gated Slack OAuth flow at `/api/mcp/auth/*` for MCP identity (any registered user, no admin requirement). (`src/routes/mcpAuth.js`)
- Token management web page at `/mcp-tokens`: sign in, generate, list, and revoke tokens. (`web/src/pages/McpTokens.tsx`)
- Phase 2 MCP read tools (admin/owner-gated via `canManageTeam`): `get_team_standup` (combined on-time + late responses, not-submitted, and on-leave as JSON) and `get_member_standup` (one member's submission). New `src/mcp/memberResolver.js` resolves a member by Slack id, name, or username. (`src/mcp/tools.js`, `src/mcp/memberResolver.js`)
- Phase 3 MCP write tools (admin/owner-gated via `canManageTeam`, sequential Slack calls): `post_team_standup` (guards on zero responses), `post_member_standup`, `send_standup_reminders`, and `send_followup_reminders` — wrapping the same `standupService.postTeamStandup`/`postIndividualResponse` and `schedulerService.sendStandupReminders`/`sendFollowupReminders` the slash commands use. (`src/mcp/tools.js`)
- Phase 4 MCP OAuth 2.1 authorization server (DCR + PKCE + Slack-delegated login): MCP clients connect by URL and obtain/refresh tokens automatically. Mounts the SDK `mcpAuthRouter` (`/authorize`, `/token`, `/register`, `/revoke`, `.well-known` metadata) backed by a custom `OAuthServerProvider`. (`src/mcp/auth/*`)
- `oauth_clients`, `oauth_auth_codes`, `oauth_tokens` tables + migration (`20260617050748_add_oauth_tables`): DCR client records, in-flight PKCE-bound authorization state, and opaque access (`mcat_`) + rotating refresh (`mcrt_`) tokens (SHA-256 hashed). (`prisma/schema.prisma`, `prisma/migrations/`)
- Combined bearer middleware accepting either an OAuth access token or a legacy `ddm_` token. (`src/mcp/auth/index.js`)
- Connection management API + UI: list and revoke connected AI clients (`GET`/`DELETE /api/mcp/connections`). (`src/routes/mcpAuth.js`, `web/src/pages/McpTokens.tsx`)
- Both MCP Slack OAuth callback URLs (`/api/mcp/auth/callback` for the manual flow and `/api/mcp/oauth/slack/callback` for the authorization server) are derived from `APP_URL` — no dedicated env var; both must be registered in the Slack app's OAuth redirect URLs. (`src/utils/slackIdentity.js`)

### Changed

- `handleStandupSubmission` and `handleStandupUpdateSubmission` in `src/commands/standup.js` now delegate to `standupService.submitStandup` (refactor, no behavior change).
- `/api/mcp/auth/callback` now uses a shared `resolveSlackUserFromCode` helper (`src/utils/slackIdentity.js`) shared with the OAuth authorization flow.

## [1.13.0] - 2026-06-16

### Added

- Soft-delete support across core tables: nullable `deleted_at` columns on `organizations`, `teams`, `users`, `organization_members`, `team_members`, `leaves`, `standup_responses`, `standup_posts`, and `holidays`. Migration `20260616140000_add_soft_delete_columns`. (`prisma/schema.prisma`, `prisma/migrations/`)

### Changed

- Docker Compose PostgreSQL port mapping changed from `5433` to `5442`. (`docker-compose.yml`)

## [1.12.0] - 2026-06-16

### Added

- Self-service team creation with org-admin approval: anyone in the workspace can now run `/dd-team-create`, even if they aren't yet an organization member. Non-members are auto-onboarded into the workspace's organization as a `MEMBER` (mirroring `joinTeam`'s behavior) by resolving the org from the slash command's `team_id` (`Organization.slackWorkspaceId`). Teams created by org owners/admins go live immediately; teams created by regular members are created with `status = PENDING` and are not scheduled until approved. Org owners/admins receive a DM with Approve/Reject buttons; approval flips the team to `ACTIVE` and schedules it, rejection deletes the team (freeing the channel). The creator is DM'd the decision. (`src/services/teamService.js` — `createTeam` now takes `slackWorkspaceId` and returns `{ team, status, organization, creatorSlackUserId }`, plus new `getPendingTeamForDecision`/`approveTeam`/`rejectTeam`; `src/services/userService.js` — new `getOrganizationByWorkspaceId`/`getOrganizationAdmins`; `src/services/notificationService.js` — new `notifyOrgAdminsOfPendingTeam`; `src/commands/team.js` — `createTeam` handler + `approveTeam`/`rejectTeam` action handlers; `src/commands/index.js` — `approve_team_*`/`reject_team_*` action routes; `src/utils/blockHelper.js` — `createTeamApprovalRequestBlocks`/`createTeamApprovalResultBlocks`)

### Changed

- New `TeamStatus` enum (`PENDING`/`ACTIVE`/`REJECTED`) and `Team.status` column (default `ACTIVE`, so existing teams stay active). Migration `20260616131600_team_status`. (`prisma/schema.prisma`, `prisma/migrations/`)
- `getActiveTeamsForScheduling` now filters `status = ACTIVE`, so pending teams never trigger reminders or posting until approved. (`src/services/teamService.js`)

### Tests

- `test/services/teamServiceApproval.test.js` covers auto-onboarding, pending vs. active creation, the no-org-for-workspace error, duplicate-channel guard, and approve/reject permission + state transitions.

## [1.11.0] - 2026-06-12

### Added

- Complete landing page redesign ("Refined Dark"): new `web/src/components/landing/` component set — hero with Slack summary mockup, "A day with Daily Dose" walkthrough timeline (`#walkthrough`), features bento (`#features`), curated stats strip (`web/src/data/landingStats.json`), how-it-works steps (`#how-it-works`), FAQ accordion, final CTA band, and dark footer — assembled by `web/src/pages/Home.tsx`. Reusable Slack mock primitives live in `web/src/components/landing/slack/`. The previous landing page is preserved unchanged at `/v1` (`web/src/pages/HomeV1.tsx`, robots noindex). Navbar forces dark styling and hides the theme toggle on `/` only; all other routes keep the light/dark toggle. Landing animations are scroll-triggered Framer Motion reveals respecting `prefers-reduced-motion`.

## [1.10.0] - 2026-06-10

### Added

- Website contact form now actually sends messages (#23): new `POST /api/contact` endpoint forwards submissions to the Slack channel/user configured via `CONTACT_SLACK_CHANNEL` (503 with a friendly error when unset). Inputs are length-capped, rendered as `plain_text` blocks (no mrkdwn injection from an unauthenticated endpoint), and rate-limited to 5 submissions per 10 minutes per IP. The form previously simulated submission with a `setTimeout` and discarded the message; it now reports real success/failure. New `blockHelper.createContactNotificationBlocks`; Vite dev proxy for `/api`. (`src/app.js`, `src/utils/blockHelper.js`, `web/src/components/home/ContactForm.tsx`, `web/vite.config.ts`, `.env.example`, `README.md`, `DEPLOYMENT.md`)
- Team timezones are validated as IANA identifiers on create/update (#25): new `timeHelper.validateTimezone` (via `Intl.DateTimeFormat`) throws a user-facing error for typos like `America/NewYork`, which previously stored fine and silently broke the team's cron scheduling. (`src/utils/timeHelper.js`, `src/services/teamService.js`, `test/utils/timeHelper.test.js`)

### Changed

- Scheduler safety-net refresh runs hourly instead of daily at UTC midnight (#22). Team create/update already calls `refreshTeamSchedule()` directly (the issue's staleness concern was largely moot); the periodic job only recovers from drift, and hourly keeps that recovery from lagging up to a day for non-UTC teams. (`src/services/schedulerService.js`)
- `seedOrg.js` now prints the target database host and seed data, then requires interactive `yes` confirmation (or `--confirm`) before upserting — it previously wrote hardcoded org/user/team data with no prompt (#24). (`scripts/seedOrg.js`)
- `logCommand` truncates slash-command text to 100 chars at the `info` level (full text moved to `debug`) so pasted sensitive content isn't retained in default logs (#30). (`src/utils/logger.js`)

### Fixed

- Removed unreachable dead code in `postTeamStandup` (#21): the "all members disabled reminders" skip checked `eligibleMembers.every((m) => m.hideFromNotResponded)`, which is equivalent to the `visibleMembers.length === 0` condition already returned on a few lines earlier — and its comment referenced the wrong flag (reminders vs. hide-from-not-responded). The surviving check's comment now describes the actual semantics. (`src/services/standupService.js`)
- `validateDateFormat` uses strict dayjs parsing instead of the native `Date` constructor (#32): `2025-02-30` is now rejected instead of rolling over to March 2, and parsing semantics match the rest of the codebase. Documented `toIsoDate()`'s UTC contract. (`src/utils/teamHelper.js`, `src/utils/dateHelper.js`, `test/utils/teamHelper.test.js`)
- Open Graph/Twitter URL meta tags are now absolute `https://dd.jnahian.me/...` URLs on all pages; Home's were empty and Scripts' pointed at the nonexistent `/scripts-docs` route (#26). Fixed `ContactPage` using the undefined `bg-bg-secondary` Tailwind class (theme defines `bg-bg-surface`) (#31). (`web/src/pages/*.tsx`)
- Block Kit convention cleanup (#27): admin submission notification blocks and the reminder-DM deadline context block moved from inline literals in `notificationService.js`/`schedulerService.js` into `blockHelper.js` (`createContextBlock`, `createAdminSubmissionNotificationBlocks`).
- All `console.log`/`console.error` calls in `standupService.js`, `notificationService.js`, and `permissionHelper.js` now go through the project logger (LOG_LEVEL filtering + Sentry forwarding); permission-check errors include user/org/team context instead of being silently swallowed as denials (#28, #29). (`src/services/standupService.js`, `src/services/notificationService.js`, `src/utils/permissionHelper.js`)
- Standup reminder and follow-up DMs ignored the `TeamMember.receiveNotifications` opt-out (`/dd-standup-reminder notify=off`): `schedulerService.sendStandupReminders` / `sendFollowupReminders` filtered only by `role !== "ADMIN"`, so opted-out members were still DM'd every day. Both filters now also require `receiveNotifications`. Added `test/services/schedulerService.test.js`. (#18) (`src/services/schedulerService.js`)
- User-typed `&`, `<`, `>` in standup fields was interpolated raw into mrkdwn — pasted snippets like `<script>` or `a < b && b > c` parsed as broken link/mention syntax and could corrupt the posted message. `messageHelper.formatElement` now escapes them in raw text elements (structured link/user/channel elements are untouched). To keep edit/resubmit cycles stable (no `&amp;amp;` growth), modal prefill goes through `convertTextToRichText`, which now unescapes entities first; the second modal builder's raw-text prefill was switched to `convertTextToRichText` accordingly. New `escapeSlackText` / `unescapeSlackText` exports. (#19) (`src/utils/messageHelper.js`, `src/utils/blockHelper.js`)
- Blocker text in standup posts was wrapped in `_…_` italics with no length cap: user underscores/multi-line content broke the formatting pairing, and an over-limit blocker (e.g. a pasted error log) made Slack reject the whole post with `invalid_blocks`. New `blockHelper.createBlockerSectionBlock` / `createBlockerContextBlock` truncate via `truncateForSlack` and drop the italics wrapper; the three inline blocker block call sites in `standupService.js` and `commands/standup.js` now use them. (#19) (`src/utils/blockHelper.js`, `src/services/standupService.js`, `src/commands/standup.js`)
- The Basic-Auth gate on `/scripts` only protected direct page loads — the full scripts documentation was bundled into the public SPA (`web/src/data/scripts.json` imported by `Scripts.tsx`), so client-side navigation rendered it without authentication. The content is no longer bundled: Express now serves it at `GET /scripts/data.json` (under the auth-gated `/scripts` path) and the page fetches it, showing a sign-in screen on 401 that triggers a full-page load (and the browser's auth prompt). Added a Vite dev proxy for the endpoint and fixed the page's `og:url`/`twitter:url` meta (`/scripts-docs` → `/scripts`). (#20) (`src/app.js`, `web/src/pages/Scripts.tsx`, `web/vite.config.ts`)

## [1.9.1] - 2026-06-09

### Fixed

- The v1.9.0 individual-standup `@mention` feature never matched the mention: `/dd-standup-post` and `/dd-standup-preview` were registered with the `stripFormatting()` middleware, whose `removeFormatting()` rewrites `<@U123|alice>` to `alice` (its `<…|…>` link rule) before the handler runs, so `parseCommandArguments` saw plain text and fell through to the team path. Removed `stripFormatting()` from both commands so the raw `<@U…|name>` wrapper survives — matching the existing suspension/promote commands, which already skip it for the same reason. (`src/commands/index.js`)
- Slack manifest: updated `/dd-standup-post` and `/dd-standup-preview` `usage_hint` (`[YYYY-MM-DD] [team-name] [@user]`) and `description` to advertise the optional member `@mention`. (`slack-app-manifest.json`)

## [1.9.0] - 2026-06-08

### Added

- `/dd-standup-preview` and `/dd-standup-post` now accept an optional `@mention` to preview or post a single team member's standup. Preview is ephemeral; post appends the member's response as a threaded reply under the day's team standup post (`reply_broadcast: true`), auto-posting the team summary first if no thread exists yet. New `standupService.getUserResponse`, `formatIndividualResponseMessage`, and `postIndividualResponse`; `teamHelper.parseCommandArguments` now returns `mentionedUserId`; reuses `blockHelper.createUserResponseBlocks` (no admin label). Always appends — no dedup. (`src/commands/standup.js`, `src/services/standupService.js`, `src/utils/teamHelper.js`)

### Changed

- `permissionHelper.canManageTeam` now grants management to organization **admins** (`OrgRole.ADMIN`), not just owners and team admins — applies to all admin commands. New `isOrganizationAdmin` helper. (`src/utils/permissionHelper.js`)

## [1.8.7] - 2026-06-08

### Fixed

- Posting a **late** standup submission failed with Slack `invalid_blocks` (`must be less than 2001 characters [json-pointer:/blocks/2/fields/0/text]`) when the user's tasks contained long pasted content (e.g. URLs). The 1.8.5 fix routed the regular post path through the limit-aware `blockHelper.createTaskFieldBlocks`, but `createLateResponseBlocks` still hand-built the section `fields[]` with no length check, so a late entry over the 2000-char field cap was rejected. `createLateResponseBlocks` now reuses `createTaskFieldBlocks` (compact two-column fields when each entry fits 2000 chars, otherwise full-width sections truncated on a line boundary). Added `test/utils/blockHelper.test.js` covering both the regular and late paths against Slack's field/text limits. (`src/utils/blockHelper.js`, `test/utils/blockHelper.test.js`)

## [1.8.6] - 2026-06-04

### Fixed

- Opening the standup modal failed with Slack `invalid_arguments` (`invalid additional property: style [json-pointer:/view/blocks/2/element/initial_value/elements/0/elements/1]`) whenever the user's previous standup contained an indented (nested) bullet or numbered list. `extractRichTextValue` stores nested list items as space-indented lines, and `convertTextToRichText` rebuilt them via `parseListStructure`, which modeled nesting by placing a child `rich_text_list` inside the parent list's `elements` array — a shape Slack's rich_text schema rejects (a list's `elements` may contain only `rich_text_section`). Replaced `parseListStructure` with `parseListBlocks`, which expresses nesting the way Slack requires: flat sibling `rich_text_list` blocks distinguished by an integer `indent` level, grouping consecutive same-`(indent, style)` items into one block so ordered numbering stays contiguous. Added `test/utils/messageHelper.test.js` covering the crash repro, the Slack schema invariant, indent-based nesting, and round-trip stability. (`src/utils/messageHelper.js`, `test/utils/messageHelper.test.js`)

## [1.8.5] - 2026-06-03

### Changed

- Logging under PM2 now shows a single timestamp: the app logger no longer adds its own ISO timestamp (PM2 already prepends one to every line via `ecosystem.config.js` `time: true`), and slash-command logs show the command at the top level (`COMMAND /dd-standup-post {…}`) via `logger.logCommand` instead of the raw `console.log("Command:", command)` object dump. PM2 `log_date_format` bumped to millisecond precision. Removed the now-unused `dayjs`/`formatTimestamp` from `logger.js`. (`src/utils/logger.js`, `src/middleware/command.js`, `ecosystem.config.js`, `test/utils/logger.test.js`)

### Fixed

- Standup posting and manual reminders crashed with `TypeError: Cannot read properties of undefined (reading 'chat')`. `/dd-standup-post` passed the raw Slack WebClient to `standupService.postTeamStandup`, which expects an app-shaped object (`slackApp.client.chat`); `/dd-standup-remind` and `/dd-standup-followup` re-ran `schedulerService.initialize(client)`, overwriting the singleton's `this.app` (set with the real Bolt app at startup) with the WebClient and re-registering duplicate cron jobs — breaking automated reminders until the next restart. `postStandup` now passes `{ client }` (matching the `postStandupOnDemand` call sites); the erroneous re-init calls are removed. (`src/commands/standup.js`)
- `/dd-standup-preview` (and posting) failed with Slack `500 invalid_blocks` for long standups, on two independent counts. Rich-text links were rendered as `<url |text>` — a space before the pipe with no trim on the URL — so a link whose URL had trailing whitespace became invalid; now renders `<url|text>` (trimmed). And each user's yesterday/today went into a section `fields[]` entry, which Slack caps at 2000 chars; long pasted task URLs overflowed it. New shared `blockHelper.createTaskFieldBlocks` keeps the two-column fields layout when each entry fits 2000, otherwise renders full-width section blocks (3000 cap, truncated on a line boundary so links aren't cut mid-URL), replacing the duplicated field-building in `standupService` and `blockHelper`. (`src/utils/messageHelper.js`, `src/utils/blockHelper.js`, `src/services/standupService.js`)

## [1.8.4] - 2026-06-03

### Fixed

- `isOrganizationOwner()` in `src/utils/permissionHelper.js` selected `createdBy` off `prisma.organization.findUnique()`, but the `Organization` model has no `createdBy` field — ownership is modelled via `OrganizationMember.role = OWNER`. The query threw `PrismaClientValidationError`, the `catch` returned `false`, so **no user was ever recognized as an org owner**: `canManageTeam()` always fell through to the team-admin check, silently blocking owners from every owner-gated command (standup post/remind/preview/followup, leave admin paths, team update). Now checks `prisma.organizationMember.findUnique({ where: { organizationId_userId }, select: { role, isActive } })` for an active `OWNER` membership.
- `teamService.updateTeam()` (`/dd-team-update`) gated on the caller's `TeamMember.role === "ADMIN"` directly, so an organization owner who was not a team admin of that specific team got "You need admin permissions to update this team". Now gates via `permissionHelper.canManageTeam()` (org owner **or** team admin), consistent with the standup admin commands.
- Ran a schema-wide audit validating every Prisma query's field references against `schema.prisma`; these two were the only remaining stale-field references (companions to the 1.8.2 `getUserBySlackId` and 1.8.3 `resolveTeamFromContext` fixes).

## [1.8.3] - 2026-06-03

### Fixed

- `resolveTeamFromContext()` in `src/utils/teamHelper.js` selected `organizationId` off `prisma.user.findUnique()` to scope a team-name lookup to the requester's org, but the `User` model has no `organizationId` scalar (orgs are reached through the `OrganizationMember` junction). Prisma threw `PrismaClientValidationError`, the `catch` returned a generic "An error occurred while finding the team" message, and `/dd-standup-post`/`-remind`/`-preview`/`-followup` failed whenever a team name was passed. Now resolves the org via `prisma.organizationMember.findFirst({ where: { userId, isActive: true } })`, matching the `getUserOrganization` / `listTeamsForUser` convention. Companion to the 1.8.2 `getUserBySlackId` fix; an app-wide audit confirmed these were the only two stale singular-`User`-organization assumptions.

## [1.8.2] - 2026-06-03

### Changed

- CI workflows bumped to current action and runtime versions: `actions/checkout` and `actions/setup-node` to v5, and the setup-node `node-version` to 24 (`.github/workflows/`).

### Fixed

- `getUserBySlackId()` in `src/utils/permissionHelper.js` queried `prisma.user.findUnique()` with `include: { organization: true }`, but the `User` model has no singular `organization` relation (orgs are reached through the `organizations` / `OrganizationMember[]` junction). Prisma threw `PrismaClientValidationError`, which the helper's `catch` swallowed into `null`, causing `/dd-standup-post`, `/dd-standup-remind`, `/dd-standup-preview`, and `/dd-standup-followup` to report "User not found" for every user. Removed the broken (and unused — all callers read only `user.id`) `include`.

## [1.8.1] - 2026-05-27

### Added

- Slack **Home tab** for the bot — surfaces a welcome message, quick-link buttons (intro video, website, docs, changelog), a getting-started checklist, and a handy commands cheat sheet. Implemented as `createHomeTabView()` in `src/utils/blockHelper.js` and published on `app_home_opened` in `src/events/index.js`. Manifest updated: `features.app_home.home_tab_enabled = true` and `app_home_opened` added to bot events.

## [1.8.0] - 2026-05-27

### Added

- Remotion video workspace (`video/`) — programmatic get-started video built with React and Remotion. Includes six scenes (Hook, Reminder, Modal, Commands, Summary, CTA), per-scene OpenAI TTS voiceover clips, Suno background music, and two output compositions: `MainVideo` (1920×1080) and `Reel` (1080×1920 social media variant). Brand tokens mirror the web theme (`video/src/data/brand.ts`). Scripts: `npm run video:studio`, `video:render`, `video:render:reel`, `video:vo`.
- Per-command subtitles in the Commands scene — each of the six command slides now shows a caption via the global `CAPTION_SCHEDULE` in `video/src/data/script.ts`.

### Changed

- Homepage hero (`web/src/components/home/Hero.tsx`) now embeds the YouTube video (`youtu.be/bQrJqBpSlBU`) via the IFrame Player API. Autoplays muted and looped; YouTube title/control overlays are clipped by extending the iframe 60px beyond the container. A custom fullscreen button unmutes audio on enter and remutes on exit.
- README now includes a YouTube thumbnail link to the demo video below the project description.
- Slack app manifest `description` and `long_description` updated to reflect current feature set and link to `dd.jnahian.me`.

### Removed

- `web/public/daily-dose-intro.mp4` — local video file replaced by the YouTube embed.

## [1.7.1] - 2026-05-20

### Removed

- Client-side `BasicAuth` React gate on the `/scripts` page (`web/src/components/auth/`, `web/.env.example`, `VITE_ADMIN_USERNAME` / `VITE_ADMIN_PASSWORD`). It was a redundant second login layered on top of the server-side BasicAuth added in 1.7.0, and — as a build-time-baked credential check shipped in the client bundle — provided no real security. `/scripts` remains protected at the Express layer via `SCRIPTS_AUTH_USERNAME` / `SCRIPTS_AUTH_PASSWORD`.

## [1.7.0] - 2026-05-20

### Added

- Server-side BasicAuth gate on `/scripts` route (`src/middleware/basicAuth.js`, `src/app.js`). Replaces the React-only client-side gate that was bypassable by direct URL access. Application refuses to start if `SCRIPTS_AUTH_USERNAME` or `SCRIPTS_AUTH_PASSWORD` is unset.
- `UserFacingError` class and `sanitizeError(err, fallback?)` helper in `src/utils/errorHelper.js`. Command handlers now emit a generic `Something went wrong (ref: ...)` message for unknown errors; service-provided messages are only rendered verbatim when the service throws `UserFacingError`.
- `parseTimeString(input)` validator and `TimeFormatError` in `src/utils/timeHelper.js`. Rejects malformed `HH:MM` input at command boundaries before scheduler registration.
- Jest test harness at the repo root (`jest.config.js`, `npm test`, `npm run test:watch`, `npm run test:coverage`). 32 tests across `timeHelper`, `errorHelper`, and `basicAuth` middleware.
- Composite database index `@@index([teamId, standupDate])` on `StandupResponse` (migration `20260520044120_standup_response_team_date_index`). The existing `@@unique([teamId, userId, standupDate])` constraint cannot serve team + date-range queries without a `userId`, the shape used by `getTeamResponses`, `getLateResponses`, and the response counting in `postTeamStandup`.
- `isWorkingDayPure({ date, workDays, holidayDateSet })`, `getHolidayDateSet()`, and `getOrgDefaultWorkDays()` in `src/utils/dateHelper.js` — a pure work-day check plus batch holiday lookup for hot-path callers. `test/utils/dateHelper.test.js` adds 7 tests.
- Sentry error reporting (`@sentry/node`). New `src/config/sentry.js` initializes Sentry once at process start when `SENTRY_DSN` is set and is a silent no-op otherwise. Wired into `src/app.js`. `SENTRY_DSN` was documented for months but never installed or initialized.
- Level-aware logging in `src/utils/logger.js`: `logger.debug/info/warn/error` honor the `LOG_LEVEL` env var (`debug` < `info` < `warn` < `error`, default `info`). `logger.error` forwards `Error` instances to Sentry when initialized. The existing typed loggers are preserved and now participate in level filtering.
- `runScheduledJob(name, fn)` wrapper in `schedulerService` — every cron callback (standup, followup, posting, midnight schedule-refresh) logs start/end with duration and routes failures through `logger.error` → Sentry.
- Root ESLint flat config (`eslint.config.js`) covering backend `.js` files (`web/` and `public/` have their own tooling and are ignored), plus `npm run lint` / `lint:fix` scripts. ESLint 9 was an unused devDependency.
- Root `.env.example` — a template mirroring every env var the app reads, so onboarding no longer requires cross-referencing `DEPLOYMENT.md`.
- husky + lint-staged pre-commit hook — staged backend files are auto-linted (`eslint --fix`) and formatted (`prettier --write`) on commit.
- CI lint + test gate: `deploy.yml` gains a `lint-and-test` job and `deploy-version.yml`'s `validate` job gains lint + test steps. A failing `npm run lint` or `npm test` now blocks deploy in both workflows.

### Changed

- `/dd-team-create` and `/dd-team-update` now validate time inputs and reject invalid formats (e.g. `99:99`) before scheduler registration.
- `schedulerService.scheduleTeam` defensively re-parses stored team times and skips registration with a logged warning for teams with invalid stored data.
- Command-handler catch blocks in `src/commands/team.js`, `src/commands/standup.js`, `src/commands/leave.js` route errors through `sanitizeError` rather than rendering raw `error.message`.
- `userService.promoteOrganizationMember` and `userService.setOrganizationMemberActive` convert all user-facing throws to `UserFacingError` so messages such as "You cannot promote yourself" and "Target user not found" are preserved through `sanitizeError` instead of being redacted.
- `teamService.promoteTeamMember` converts all user-facing throws to `UserFacingError` for the same reason; adds `UserFacingError` import to `teamService.js`.
- `parseTimeString` catch blocks in `/dd-team-create` and `/dd-team-update` route through `sanitizeError` for pattern consistency (behavior unchanged since `TimeFormatError.userFacing === true`).
- `standupService.getActiveMembers` batches its holiday and work-day lookups instead of calling the per-member async `isWorkingDay`, which re-fetched the same organization settings and per-user `workDays` every iteration. Query count is now O(1) in team size (~3 queries) instead of 2N+1 (~21 for a 10-person team, ~101 for 50). `isWorkingDay` is retained as a thin async wrapper for low-volume one-off callers and short-circuits on non-work days before its holiday query.
- `schedulerService` cron callbacks no longer use inline `try/catch` + `console.error` (which left failures invisible in production); `console.*` calls in that file migrated to `logger.*`.
- Prettier is now unified on the root `.prettierrc.json` (double quotes, `printWidth` 80). The duplicate `web/.prettierrc` (single quotes) is deleted and `web/` reformatted to match, so running Prettier from any directory produces consistent output.

### Fixed

- `postTeamStandup` is now idempotent: a duplicate posting-cron firing for the same `(teamId, standupDate)` used to post a second Slack message and overwrite the first message's `slackMessageTs`, orphaning late-reply threads. It now checks for an existing `StandupPost` with a non-null `slackMessageTs` and returns early. Operator-facing call sites (`/dd-standup-post`, `sendManualStandup`) report "already posted" instead of a blank timestamp.
- `handleStandupUpdateSubmission` destructured `isUpdate` inside its `try` block but referenced it in the `catch` handler; block scope meant the catch threw a `ReferenceError` instead of reporting the real error. `isUpdate` is now declared before the `try`. (Caught by the newly-added ESLint config.)

### Security

- `/scripts` is no longer reachable without valid `SCRIPTS_AUTH_USERNAME` / `SCRIPTS_AUTH_PASSWORD` credentials.
- Removed hardcoded `admin`/`daily-dose-admin` default credentials from `basicAuth` middleware.

## [1.6.2] - 2026-05-19

### Added

- `/dd-org-promote @user [TeamName]` — promotes a user to admin role (org owner/admin only)
  - With no `TeamName`: promotes the target's `OrganizationMember.role` from `MEMBER` to `ADMIN` in the actor's organization
  - With a `TeamName`: promotes the target's `TeamMember.role` from `MEMBER` to `ADMIN` in that team
  - Permission gate: actor must have an active `OrganizationMember` with role `OWNER` or `ADMIN`; team-scope path checks the team's org, not the channel
  - Guards: target must be an active member of the relevant scope (org or team); rejects self-promotion, already-admin targets, and org owners (already at the highest role)
  - Service layer: added `userService.promoteOrganizationMember()` and `teamService.promoteTeamMember()`
  - Accepts the same three target formats as the suspend commands (mention, raw Slack user ID, bare `@username`/`username`) via the existing `resolveTargetSlackUserId` helper
  - Command registered without `stripFormatting` so `<@U…|name>` mention tokens survive for `parseUserMention`
  - Team-scope lookup is scoped to the actor's organization to prevent cross-tenant collisions when a team of the same name exists in another org
  - Slash command added to `slack-app-manifest.json`

### Changed

- `teamService.findTeamByName(teamName, organizationId = null)` now accepts an optional `organizationId` filter; existing call sites that omit it retain the previous global behavior

## [1.6.1] - 2026-05-17

### Changed

- `/dd-team-list` is now scoped by role. Members and team admins see only the teams they are an active member of; org owners, org admins, and active super admins continue to see every team in the organization.
  - Added `teamService.listTeamsForUser(slackUserId)` returning `{ teams, scope, organization }` — single `findUnique` on `User` with `super_admins` and active `organizations` includes, then a filtered `team.findMany` (privileged: all org teams; unprivileged: filtered via `members: { some: { userId, isActive: true } }`)
  - "Privileged" = `OrganizationMember.role` in `OWNER`/`ADMIN`, or an active row in `super_admins` (no `revoked_at`)
  - `/dd-team-list` heading now reads `Teams in <Org Name>:` for privileged users and `Your teams:` for regular members; empty-state message differs accordingly
  - Existing `teamService.listTeams` left untouched; its callers in `src/commands/standup.js` use it for separate semantics
- Replaced the npm-script release flow with a Claude Code `/release` skill (`.claude/commands/release.md`). Removed `version:patch`, `version:minor`, `version:major`, `version:check`, `preversion`, `postversion`, and `release` scripts from `package.json` and deleted `scripts/checkVersion.js`. Removed the now-redundant `create-release` job from `.github/workflows/deploy-version.yml` — the skill creates the GitHub release before pushing the tag, so the in-workflow create would fail with "release exists"

### Fixed

- `/dd-team-suspend`, `/dd-team-unsuspend`, `/dd-org-suspend`, and `/dd-org-unsuspend` now accept additional input formats so admins can target Slack users who have already been deactivated and can no longer be @-mentioned in chat:
  - Raw Slack user ID (e.g., `U0123ABCD` / `W0123ABCD`) — globally unique, accepted without an org lookup
  - Bare `@username` or `username` — resolved via the user's stored Slack `username` field, scoped to the admin's organization (since `User.username` is `String?` and not `@unique` in `schema.prisma`)
  - The standard `<@U…|name>` mention token remains the primary path for active users
- Added `userService.findUserByUsernameInOrg(username, organizationId)` and a `resolveTargetSlackUserId(token, organizationId)` helper in `src/commands/team.js` covering all three formats in priority order
- `handleTeamSuspension` now resolves the team first so `team.organizationId` is available for the username lookup; `handleOrgSuspension` pre-fetches the admin's org via `userService.getUserOrganization`
- Error message in `parseUserMention`'s "invalid mention" branch updated to list all three supported input formats

## [1.6.0] - 2026-05-17

### Added

- Member suspension feature
  - `/dd-team-suspend @user [TeamName]` — team admin (or org owner/admin) can suspend a member from a single team; falls back to channel's team when no name given
  - `/dd-team-unsuspend @user [TeamName]` — reactivate a suspended team member
  - `/dd-org-suspend @user` — org owner/admin suspends a member across the entire organization (cascades to currently-active `TeamMember` rows in that org)
  - `/dd-org-unsuspend @user` — reactivates the user's `OrganizationMember` only; does **not** resurrect team memberships (admin must use `/dd-team-unsuspend` per team) to avoid silently re-adding users who had left or been team-suspended independently
  - Suspension is implemented by toggling `TeamMember.isActive` / `OrganizationMember.isActive` — no new schema or migration required
  - Service layer: `teamService.setTeamMemberActive()` and `userService.setOrganizationMemberActive()` enforce permission checks and prevent self-suspension, suspending the only active team admin (per-team and org-wide), non-owners changing an owner's status, and team-reactivating a user who is currently org-suspended
  - Cascade and org-membership update wrapped in a Prisma transaction
- Auto-suspension when a Slack workspace user is deactivated
  - New `user_change` bot event subscription (`slack-app-manifest.json`)
  - `src/events/index.js` handles the event; when `event.user.deleted === true` calls `userService.suspendUserSystemWide(slackUserId)` which deactivates every active `OrganizationMember` and `TeamMember` row for that user across all orgs
  - System-triggered path bypasses admin-permission and sole-active-admin guards — the deactivated Slack user can no longer act, so suspension must apply regardless
  - Idempotent (only touches `isActive: true` rows); no-op when the Slack user isn't in our DB
  - Commands registered in `src/commands/index.js`; slash commands added to `slack-app-manifest.json`

## [1.5.1] - 2026-04-30

### Fixed

- Fixed `/dd-standup` returning a 500 error when run without a team name in a DM with the bot or in a non-team channel
  - Previously the no-team fallback rendered `createTeamSelectionBlocks`, which builds a Slack `actions` block with one button per team and exceeds Slack's 5-element-per-actions-block limit when the user belongs to 6+ teams
  - Replaced the team-selection fallback in `submitManual` (`src/commands/standup.js`) with a `createCommandErrorBlocks` usage hint listing the user's available teams
- Removed unused `createTeamSelectionBlocks` import from `src/commands/standup.js`

### Changed

- Normalized all slash-command error responses across `standup.js`, `team.js`, `leave.js`, `holiday.js`, and `preferences.js` to use `createCommandErrorBlocks` instead of plain `text:` responses
  - Replaces inline `❌ ...` strings with structured blocks (primary message + bulleted suggestions)
  - Affects usage hints, "team not found" / "no team in channel" branches, validation errors, and generic catch-block fallbacks
  - Interactive transports left untouched: `ack({text})` for action handlers, modal block content inside `client.views.update`, and `client.chat.postMessage` direct DMs

### Documentation

- Added `/dd-standup-history` entry to `web/src/data/docs.json` Standup Commands section so it surfaces on the `/docs` page (matching its existing presence in `README.md` and `slack-app-manifest.json`)
- Added v1.5.0 user-facing entry to `web/src/data/changelog.json` and demoted v1.4.6 from `isLatest`
- Trimmed `CLAUDE.md` from 556 to ~300 lines: removed the generic "Software Development Best Practices" section (KISS/DRY/YAGNI, naming, error-handling, git, React advice) and replaced with a focused "Project-Specific Conventions" section
  - Added "Deployment & Infrastructure" pointers (`DEPLOYMENT.md`, `docker-compose.yml`, `ecosystem.config.js`, `slack-app-manifest.json`)
  - Documented the recurring Cloudflare DNS-only requirement for Slack endpoints under Slack Integration
  - Listed `/dd-standup-history` in the Manual Standup Trigger Commands section
  - Noted empty `admin/` and `test/` placeholder directories
- Removed `GEMINI.md` (was a symlink to `CLAUDE.md`); project standardizes on `CLAUDE.md`

## [1.5.0] - 2026-04-30

### Added

- New `/dd-standup-history [start-date] [end-date]` slash command for members to view their own submitted standups across all their teams
  - No arguments: returns submissions from the user's last submitted day
  - Single date (`YYYY-MM-DD`): returns that day's submissions
  - Two dates: inclusive date range (order-independent)
  - Response is ephemeral; entries grouped by date with team name, yesterday/today/blockers, and late marker
- `standupService.getUserStandupHistory(slackUserId, startDate, endDate)` — fetches the user's responses across teams within a date range, ordered by date desc
- `standupService.getUserLastSubmissionDate(slackUserId)` — returns the most recent `standupDate` the user has submitted
- Registered `/dd-standup-history` in `src/commands/index.js` and `slack-app-manifest.json`

## [1.4.6] - 2026-03-30

### Changed

- Replaced "Add to Slack" buttons in Navbar and Hero with GitHub repository links
- Added repository field to package.json

## [1.4.5] - 2026-03-30

### Fixed

- Fixed all slash commands failing with "app did not respond" error in production
  - `ackWithProcessing` now properly awaits `ack()` as required by Bolt v4
  - Without `await`, the HTTP acknowledgment to Slack was not guaranteed to send within the 3-second window
  - Affected all `/dd-*` commands across team, leave, standup, holiday, and preferences modules
- Added missing `text` fallback argument to `chat.postMessage` calls in standup and followup reminders
  - Required by Slack for push notifications and screen reader accessibility

## [1.4.4] - 2026-03-18

### Added

- Web application favicon and PWA manifest assets
  - Android Chrome icons (192x192 and 512x512 PNG)
  - Apple touch icon for iOS home screen support
  - Favicon in multiple formats (16x16, 32x32, and ICO)
  - Site.webmanifest for Progressive Web App configuration
  - Enables proper branding across browsers and devices
- Git Town configuration file for branch and hosting setup
- Admin configuration files for database and environment setup
  - Docker Compose configuration for local development
  - Environment variable examples for admin setup

### Changed

- Database schema migration (20260318061742)

## [1.4.3] - 2026-02-05

### Added

- Bulk operations support for standup automation scripts
  - `triggerStandup.js` now supports `--all` flag for reminder and followup commands
  - `sendManualStandup.js` now supports `--all` flag for post and remind commands
  - Interactive confirmation prompts before bulk operations
  - Table preview showing all teams to be processed
  - Only processes teams with active members
  - Summary statistics with success/skipped/failed counts
  - Sequential processing to avoid rate limits
  - Comprehensive error handling for individual team failures

### Changed

- Enhanced standup automation scripts with bulk operation capabilities
  - `npm run standup:trigger -- reminder --all` - Send reminders to all active teams
  - `npm run standup:trigger -- followup --all` - Send followups to all active teams
  - `npm run standup:post -- post --all` - Post standups for all active teams
  - `npm run standup:post -- post --all --date YYYY-MM-DD` - Bulk post for specific date
  - `npm run standup:post -- post --all --dry-run` - Preview bulk posts
  - `npm run standup:post -- remind --all` - Send reminders to all active teams

## [1.4.2] - 2026-02-05

### Fixed

- Fixed holiday system database schema mismatch causing runtime errors
  - Updated Holiday model to use `organization_id` instead of `country` field
  - Changed unique constraint from `date_country` to `organization_id_date`
  - Updated `dateHelper.js` to query holidays by organization
  - Updated `holiday.js` commands (set, update, delete, list) to use organization-scoped holidays
  - Regenerated Prisma client to sync with database schema
  - Resolved "The column `holidays.country` does not exist" error in scheduler service

### Changed

- Holiday system is now fully organization-scoped instead of country-based
  - Each organization manages its own holidays independently
  - Holiday queries now require organization context
  - Added `description` and `updated_at` fields to Holiday model

## [1.4.1] - 2025-02-03

### Changed

- Updated project dependencies to latest versions
- Enhanced CLAUDE.md with comprehensive project documentation
  - Added utility scripts section with admin, team, and debug commands
  - Documented Web Frontend (React SPA) development workflow and build commands
  - Expanded Architecture Overview with detailed service descriptions
  - Enhanced Database Schema section with multi-tenant design patterns
  - Documented Slack Integration including Block Kit UI and markdown guidelines
  - Added Web Frontend Architecture section covering React, routing, styling, and theme system
  - Expanded Environment Configuration with categorized variable descriptions
  - Added Development Notes section with frontend workflow and conventions
- Improved command documentation with better clarity and examples
  - Refined `/dd-standup-reminder` command syntax and parameter requirements
  - Updated standup submission examples with correct field names
  - Added "Smart Prefilling" note explaining automatic pre-population
  - Enhanced "Channel-Based Commands" note with context-aware operation details
  - Clarified `/dd-team-update` notifications parameter with examples
  - Expanded leave management documentation with admin-only commands
  - Enhanced holiday management section with organization-wide clarification
- Clarified notification system behavior in documentation
  - Added comprehensive Notification System section explaining `receiveNotifications` behavior
  - Documented that `notify=off` disables ALL notifications (reminders + admin submission alerts)
  - Clarified `notify` parameter controls both standup reminders and admin submission notifications
  - Added use cases for team admins wanting to reduce notification noise
  - Updated web documentation (docs.json) with corrected command examples

### Removed

- Removed non-existent "view preferences" command examples from documentation

### Fixed

- Corrected preferences command implementation to match documented behavior

## [1.4.0] - 2025-11-26

### Added

- React-based web application with modern UI
  - Home page with hero section, features, and how it works
  - Comprehensive documentation with search functionality
  - Changelog page with version history
  - Contact form with functional form submission
  - Theme toggle for dark/light mode support
  - Lazy loading for pages with loading fallbacks
  - Global page transitions and scroll-to-top functionality
- GitHub issue and pull request templates for better issue tracking
- Organization administrator management script (`addOrgAdmin.js`)
- Documentation search functionality to filter navigation and content
- Lucide icons integration for UI components
- Enhanced responsiveness across all pages with sticky sidebar

### Changed

- Removed legacy static HTML routes and `basicAuth` middleware
- Replaced multiple static routes with single-page application (SPA)
- Refactored documentation sidebar navigation to use external `docs.json`
- Updated Node.js version requirement to 20.19+ or 22.12+
- Improved Slack manifest update script with better error handling
- Enhanced Tailwind CSS configuration and styling
- Restructured UI components for theme-aware styling

### Removed

- Web frontend application static files (migrated to React)
- Legacy HTML routes and basic auth middleware
- Unnecessary console log statements

## [1.3.0] - 2025-11-20

### Added

- Manual standup trigger commands for admins and organization owners
  - `/dd-standup-remind [team-name]` - Send standup reminders to team members
  - `/dd-standup-post [YYYY-MM-DD] [team-name]` - Post standup summary for specific date
  - `/dd-standup-preview [YYYY-MM-DD] [team-name]` - Preview standup summary (ephemeral)
  - `/dd-standup-followup [team-name]` - Send followup reminders to non-responders
- Permission system with role-based access control
  - `permissionHelper.js` utility for checking Organization Owner and Team Admin roles
  - `isOrganizationOwner()`, `isTeamAdmin()`, and `canManageTeam()` functions
- Context-aware team resolution in `teamHelper.js`
  - Admins can run commands from team channel without specifying team name
  - Owners must specify team name when running from any location
  - `resolveTeamFromContext()` function for automatic team detection
  - `parseCommandArguments()` for flexible date and team name parsing
- Block helper functions for formatted command responses
  - `createCommandSuccessBlocks()` - Success messages with details
  - `createCommandErrorBlocks()` - Error messages with suggestions
  - `createPermissionDeniedBlocks()` - Permission error messages
  - `createStandupPreviewHeaderBlocks()` - Preview header formatting
  - `createNoDataBlocks()` - No data available messages
- Comprehensive audit logging for all admin actions
- User stories and implementation plan documentation

## [1.2.0] - 2025-01-09

### Changed

- Late standup submissions now create full standup posts when no parent message exists
  - First late submission for the day creates a complete standup post with all sections
  - Subsequent late submissions are added as threaded replies to the parent
  - Applies to both `/dd-standup` submissions and `/dd-standup-update` updates
  - New `postStandupOnDemand()` method in StandupService for on-demand standup post creation

## [1.1.0] - 2025-01-02

### Added

- Admin leave management commands for team admins
  - `/dd-leave-set-member` - Set leave for any team member (admin only)
  - `/dd-leave-cancel-member` - Cancel team member's leave (admin only)
  - `/dd-leave-list-member` - List team member's upcoming leaves (admin only)
- `isTeamAdmin()` method in TeamService to check admin permissions
- `getUserTeams()` method in TeamService to get user's teams
- `setMemberLeave()`, `cancelMemberLeave()`, and `listMemberLeaves()` methods in UserService
- Support for @mentions in admin leave commands
- Smart team detection for single-team admins
- Comprehensive permission checks for admin leave operations
- Admin leave management documentation in README
- Slack app manifest auto-update during deployment
- Release workflow separating version bump from tag creation

### Changed

- Leave management section in README reorganized to separate personal vs admin commands
- Slack manifest updated with new admin leave commands
- Version commands now only bump version without creating tags
- Release command creates tags and triggers deployment
- Manifest update script always uses `SLACK_APP_ID` from environment

## [1.0.2] - 2025-11-02

### Added

- Git-based package versioning with SemVer policy
- Automated deployment on version tag push
- Version management scripts (patch, minor, major)
- Pre-version checks for clean git state
- GitHub Actions workflow for version releases
- CHANGELOG.md for tracking version history

### Changed

- Standup posting logic to skip when no eligible members exist
- Standup messages exclude mention=off members from display

## [1.0.0] - 2025-11-02

### Added

- Initial release of Daily Dose Slack bot
- Automated daily standup reminders
- Team management commands
- Leave tracking system
- Timezone-aware scheduling
- Work day configuration
- Standup response collection via modals
- Team standup summaries
- Late submission threading
- User preference management
- Admin role management
- Multi-tenant organization support
- PostgreSQL database with Prisma ORM
- PM2 process management
- Health check endpoint
- Comprehensive documentation

### Features

- `/dd-team-create` - Create new standup teams
- `/dd-team-list` - List all teams
- `/dd-team-info` - View team details
- `/dd-team-update` - Update team configuration
- `/dd-team-delete` - Delete teams
- `/dd-team-leave` - Leave a team
- `/dd-team-join` - Join existing teams
- `/dd-standup-submit` - Submit standup updates
- `/dd-standup-reminder` - Configure reminder preferences
- `/dd-leave-add` - Add leave periods
- `/dd-leave-list` - View leave history
- `/dd-leave-remove` - Remove leave entries
- Automated standup reminders via DM
- Follow-up reminders for pending submissions
- Channel-based standup summaries
- Mention control for "Not Responded" lists

---

## Version History Guidelines

### Version Format: MAJOR.MINOR.PATCH

- **MAJOR** (X.0.0): Incompatible API changes, major feature overhauls
- **MINOR** (1.X.0): New features, backwards-compatible functionality
- **PATCH** (1.0.X): Bug fixes, minor improvements, backwards-compatible

### Change Categories

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes

### How to Update

1. Make your changes on a feature branch
2. Update this CHANGELOG.md under `[Unreleased]`
3. Merge to main branch
4. Run version bump command:
   - `npm run version:patch` for bug fixes (1.0.X)
   - `npm run version:minor` for new features (1.X.0)
   - `npm run version:major` for breaking changes (X.0.0)
5. The version bump will:
   - Update package.json version
   - Create a git tag
   - Push to remote
   - Trigger automated deployment

[Unreleased]: https://github.com/jnahian/daily-dose/compare/v1.16.2...HEAD
[1.16.2]: https://github.com/jnahian/daily-dose/compare/v1.16.1...v1.16.2
[1.16.1]: https://github.com/jnahian/daily-dose/compare/v1.15.2...v1.16.1
[1.16.0]: https://github.com/jnahian/daily-dose/compare/v1.15.2...v1.16.0
[1.15.2]: https://github.com/jnahian/daily-dose/compare/v1.15.1...v1.15.2
[1.15.1]: https://github.com/jnahian/daily-dose/compare/v1.15.0...v1.15.1
[1.15.0]: https://github.com/jnahian/daily-dose/compare/v1.14.0...v1.15.0
[1.14.0]: https://github.com/jnahian/daily-dose/compare/v1.13.0...v1.14.0
[1.13.0]: https://github.com/jnahian/daily-dose/compare/v1.12.0...v1.13.0
[1.12.0]: https://github.com/jnahian/daily-dose/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/jnahian/daily-dose/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/jnahian/daily-dose/compare/v1.9.1...v1.10.0
[1.9.1]: https://github.com/jnahian/daily-dose/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/jnahian/daily-dose/compare/v1.8.7...v1.9.0
[1.8.7]: https://github.com/jnahian/daily-dose/compare/v1.8.6...v1.8.7
[1.8.6]: https://github.com/jnahian/daily-dose/compare/v1.8.5...v1.8.6
[1.8.5]: https://github.com/jnahian/daily-dose/compare/v1.8.4...v1.8.5
[1.8.4]: https://github.com/jnahian/daily-dose/compare/v1.8.3...v1.8.4
[1.8.3]: https://github.com/jnahian/daily-dose/compare/v1.8.2...v1.8.3
[1.8.2]: https://github.com/jnahian/daily-dose/compare/v1.8.1...v1.8.2
[1.8.1]: https://github.com/jnahian/daily-dose/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/jnahian/daily-dose/compare/v1.7.1...v1.8.0
[1.7.1]: https://github.com/jnahian/daily-dose/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/jnahian/daily-dose/compare/v1.6.2...v1.7.0
[1.6.2]: https://github.com/jnahian/daily-dose/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/jnahian/daily-dose/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/jnahian/daily-dose/compare/v1.5.1...v1.6.0
[1.5.1]: https://github.com/jnahian/daily-dose/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/jnahian/daily-dose/compare/v1.4.6...v1.5.0
[1.4.6]: https://github.com/jnahian/daily-dose/compare/v1.4.5...v1.4.6
[1.4.5]: https://github.com/jnahian/daily-dose/compare/v1.4.4...v1.4.5
[1.4.4]: https://github.com/jnahian/daily-dose/compare/v1.4.3...v1.4.4
[1.4.3]: https://github.com/jnahian/daily-dose/compare/v1.4.2...v1.4.3
[1.4.2]: https://github.com/jnahian/daily-dose/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/jnahian/daily-dose/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/jnahian/daily-dose/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/jnahian/daily-dose/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/jnahian/daily-dose/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/jnahian/daily-dose/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/jnahian/daily-dose/compare/v1.0.0...v1.0.2
[1.0.0]: https://github.com/jnahian/daily-dose/releases/tag/v1.0.0
