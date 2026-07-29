# Admin Panel

The admin panel is an **operator/super-admin web UI** for managing Daily Dose
without going through Slack slash commands. It is an internal tool — **not** a
user-facing bot feature — so its changes are intentionally kept out of
`CHANGELOG.md` and `web/src/data/changelog.json`.

- **URL:** `/admin/*` (e.g. `https://dd.jnahian.me/admin/dashboard`)
- **Backend:** `src/routes/admin.js` — Express router mounted at `/api/admin`
  (see `src/app.js`)
- **Frontend:** `web/src/pages/admin/*`, `web/src/components/admin/*`,
  `web/src/context/AdminAuthContext.tsx`, `web/src/hooks/useAdminAuth.ts`
- **Routing:** `web/src/App.tsx` renders admin routes in a separate `<Routes>`
  tree under `AdminLayout` when `location.pathname.startsWith('/admin')` — no
  public navbar, theme wrapper, or page transitions.

---

## Architecture

The admin panel reuses the same React SPA and the same Express server as the
rest of the app. There is no separate process or deployment.

```
Browser  ──/admin/*──▶  React SPA (AdminLayout + admin pages)
                              │
                              ▼  fetch('/api/admin/*', { credentials: 'include' })
Express (src/app.js)  ──/api/admin──▶  src/routes/admin.js (router)
                                              │
                                              ▼
                                        Prisma / PostgreSQL
                                        Slack Web API (channel lookup, OAuth)
```

The router is mounted **before** the contact form and the SPA fallback in
`src/app.js`, after `cookieParser()` and `express.json()`:

```js
receiver.app.use(cookieParser());
receiver.app.use(express.json());
receiver.app.use("/api/admin", adminRouter);
```

---

## Access model

Two tiers of access, both requiring the user to **already exist as a `User`**
in the database (i.e. they have interacted with the bot at least once):

| Tier                | Backed by                                                               | Can see                                                                   | Granted via                                                                  |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Super admin**     | `super_admins` table (row with `revoked_at = null`)                     | Every organization; the **Organizations** page; cross-org aggregate stats | `npm run super-admin:add` (`scripts/addSuperAdmin.js`)                       |
| **Org admin/owner** | `OrganizationMember` with role `OWNER` or `ADMIN` and `isActive = true` | Only the orgs they own/administer                                         | Existing Slack role (`/dd-org-promote`) or the panel's **Add Member** action |

A user with **neither** is rejected at login (`?error=not_authorized`).

Middleware in `src/routes/admin.js`:

- **`requireAuth`** — validates the `admin_session` cookie against the
  `sessions` table (must exist, have a related user, and not be expired). Sets
  `req.adminUser`.
- **`requireSuperAdmin`** — runs after `requireAuth`; 403s unless the caller has
  an active `super_admins` row. Gates the `/organizations` routes only.
- **`verifyOrgAccess(req, res, orgId)`** — helper used by every org-scoped
  route. Allows super admins through unconditionally; otherwise requires an
  active `OWNER`/`ADMIN` `OrganizationMember` for that `orgId`. Returns 400 if
  `orgId` is missing, 403 if not authorized.

### Authentication flow (Slack OAuth)

1. User clicks **Sign in with Slack** → `GET /api/admin/auth/slack`. The server
   generates a CSRF `state` (kept in an in-memory map with a 10-minute TTL) and
   redirects to Slack's OAuth consent screen requesting
   `identity.basic,identity.email` user scopes.
2. Slack redirects back to `GET /api/admin/auth/callback` (the URL configured in
   `ADMIN_OAUTH_REDIRECT_URI`). The server validates `state`, exchanges `code`
   for a user token, and reads the Slack user identity.
3. The Slack user is matched to a `User` row. If not found →
   `?error=not_registered`. If found but neither super admin nor org admin →
   `?error=not_authorized`.
4. On success, a random 32-byte session token is stored in `sessions`
   (`expires_at` = 7 days out, with `ip_address`/`user_agent`) and set as an
   **httpOnly** cookie `admin_session` (`secure` in production, `sameSite=lax`,
   7-day `maxAge`). The user is redirected to `/admin/dashboard`.
5. **Logout** (`POST /api/admin/auth/logout`) deletes the session row and clears
   the cookie.

> **Setup prerequisites:** the Slack app needs the `identity.basic` /
> `identity.email` user scopes and the redirect URL registered. Set
> `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `ADMIN_OAUTH_REDIRECT_URI`
> (e.g. `https://dd.jnahian.me/api/admin/auth/callback`). See `.env.example`.

### The org switcher

`AdminAuthContext` loads the current user from `GET /api/admin/me` on mount,
which returns the user, `isSuperAdmin`, and the list of orgs they
own/administer. `activeOrgId` is **in-memory React state** that defaults to the
first organization in that list — it is **not** persisted, so it resets to the
default on a full page reload. The **org switcher** dropdown in the top bar
(`AdminTopBar`) calls `setActiveOrgId(...)`; every org-scoped page re-fetches
when `activeOrgId` changes.

> A super admin with no `OWNER`/`ADMIN` memberships of their own has
> `activeOrgId = null`; org-scoped pages then have no org to query. To manage a
> specific org's data, a super admin should hold (or be added to) an admin role
> in it, or use the Organizations page for org-level operations.

---

## Granting super-admin access

```bash
npm run super-admin:add
# → scripts/addSuperAdmin.js
```

This inserts a row into `super_admins` for a given user. Revoking is done by
setting `revoked_at` on the row.

---

## Navigation

`AdminSidebar` shows these items (icons in parentheses). **Organizations** is
visible to super admins only; the rest are always shown but operate on the
active org.

| Nav item      | Route                  | Icon            | Scope                |
| ------------- | ---------------------- | --------------- | -------------------- |
| Dashboard     | `/admin/dashboard`     | LayoutDashboard | Org or global        |
| Organizations | `/admin/organizations` | Building2       | **Super admin only** |
| Teams         | `/admin/teams`         | Users           | Org                  |
| Approvals     | `/admin/approvals`     | ClipboardCheck  | Org                  |
| Members       | `/admin/members`       | Users           | Org                  |
| Standups      | `/admin/standups`      | MessageSquare   | Org                  |
| Holidays      | `/admin/holidays`      | CalendarDays    | Org                  |
| Scheduler     | `/admin/scheduler`     | Clock           | Org                  |
| Zoho Sync     | `/admin/zoho`          | RefreshCw       | Org                  |
| Activity      | `/admin/activity`      | Activity        | Org                  |
| MCP Usage     | `/admin/mcp-usage`     | BarChart3       | Org                  |
| My Tokens     | `/admin/tokens`        | Key             | Self (current user)  |

`AdminLayout` guards every admin route: it shows a loading state while the auth
context initializes and redirects to `/admin/login` if there is no authenticated
user.

---

## Features

### Login (`/admin/login`)

Single **Sign in with Slack** button → `/api/admin/auth/slack`. Renders a
human-readable message for each `?error=` returned by the OAuth callback:
`invalid_state`, `oauth_denied`, `oauth_failed`, `not_registered`,
`not_authorized`.

### Dashboard (`/admin/dashboard`)

Read-only stat cards from `GET /api/admin/stats`.

- **Super admin, no org selected:** Organizations, Teams, Users, Standups Today
  (global counts).
- **Org-scoped:** Teams, Members, **Pending Approvals**
  (`pendingTeamCount` — teams awaiting a decision, see Approvals below), and
  **Today's Completion** rate (`todayResponses / activeTeamMembers`, as a
  percentage).

### Organizations (`/admin/organizations`) — super admin only

Full CRUD over organizations. Org admins are redirected to the dashboard.

| Column                         | Field                                         |
| ------------------------------ | --------------------------------------------- |
| Name / Workspace ID / Timezone | `name`, `slackWorkspaceId`, `defaultTimezone` |
| Teams / Members                | `teamCount`, `memberCount`                    |
| Status                         | `isActive` (active/inactive badge)            |

Actions:

- **New Organization** → `POST /organizations`. Fields: Name (required),
  Slack Workspace ID, Slack Workspace Name, Default Timezone (defaults to
  `America/New_York`). Duplicate name/workspace ID → 409.
- **Edit** → `PUT /organizations/:id`. Same fields plus an **Active** checkbox.
- **Add Member** → `POST /members` (`{ slackUserId, orgId, role }`). The user
  must have signed in to the bot at least once.
- **Toggle active** → `PATCH /organizations/:id/toggle` (flips `isActive`).
- **Delete** → `DELETE /organizations/:id`. **Soft delete** — deactivates the
  org (`isActive: false`, `deletedAt`) and cascades deactivation to its teams
  and team/org memberships (same soft-delete fields), stopping their live
  cron jobs. Holidays and standup data are left untouched.

### Teams (`/admin/teams`)

CRUD over the active org's teams. Deletes are **soft** (`deletedAt`); soft-
deleted teams are hidden everywhere in the panel.

| Column                      | Field                                          |
| --------------------------- | ---------------------------------------------- |
| Name / Channel ID           | `name`, `slackChannelId`                       |
| Standup / Posting           | `standupTime`, `postingTime` (HH:MM)           |
| Timezone / Members / Status | `timezone`, `memberCount`, `status`/`isActive` |

The Status column reads `status` first: a `PENDING` team shows a **Pending**
badge regardless of `isActive` (pending teams are created with `isActive: true`
but are deliberately left unscheduled until approved — see Approvals below).
Everything else falls back to the Active/Inactive `isActive` badge.

A `PENDING` team's **Migrate Members** and **Delete** actions are disabled, and
both routes reject it server-side with a `409` — the UI guard alone isn't the
enforcement. Migrating out of a pending team would move the first `ADMIN`
`TeamMember` that Approvals reads as the proposer, and soft-deleting one would
hide it from Approvals without notifying the proposer while permanently holding
its `slackChannelId` (the unique constraint is not scoped to `deletedAt`).
Rejecting from Approvals is the correct exit — it hard-deletes and frees the
channel. Pending teams are likewise excluded as a **Migrate Members** target,
in the dropdown and in the route.

Actions:

- **New Team** → `POST /teams`. Fields: Name, **Channel name** (resolved to a
  Slack channel ID via the Slack API — `#prefix` is stripped, matched case-
  insensitively across public+private channels), Standup time, Posting time,
  Timezone. Channel not found → 400; a soft-deleted team already on that channel
  → 409; live duplicate channel → 409.
- **Edit** → `PUT /teams/:id`. Editable: name, standup time, posting time,
  timezone, active. **Channel is not editable** after creation. Resyncs the
  team's live cron jobs immediately (reschedules with the new times/timezone,
  or stops them if `isActive` is turned off) — see the note below.
- **Migrate Members** → `POST /teams/:id/migrate-members`
  (`{ targetTeamId, keepSource?, resetRole? }`). Moves every active
  `TeamMember` from this team to another team **in the same organization**
  (disabled when the org has fewer than 2 teams). By default this is a move:
  each member is created/reactivated on the target team (preserving role,
  `receiveNotifications`, `hideFromNotResponded`) and the source membership is
  soft-deleted. `keepSource` copies instead of moving (source membership stays
  active); `resetRole` adds everyone to the target as `MEMBER` regardless of
  their source role. Members already active on the target team are skipped,
  not duplicated. Standup history (`StandupResponse`/`StandupPost`) stays
  attached to the original team — only membership moves. Cross-organization
  migration isn't available from the admin panel; use
  `npm run team:migrate-members -- "<source-team>" "<target-team>" --allow-cross-org`
  for that.
- **Delete** → `DELETE /teams/:id` (soft delete). Also stops the team's live
  cron jobs immediately.

> Creating/updating a team's times here changes scheduling via the same
> `Team` records the scheduler reads. Edits, deletes, and the org soft-delete
> above call `schedulerService.refreshTeamSchedule` / `stopTeamSchedule`
> directly, so the change takes effect on the running process without a
> restart — no need to wait for the hourly safety-net refresh. Confirm cron
> behavior with `npm run debug:scheduler` after edits.

### Approvals (`/admin/approvals`)

Lists the active org's teams awaiting approval and lets an org admin approve or
reject them from the panel.

When a workspace member who is **not** an org `OWNER`/`ADMIN` runs
`/dd-team-create`, `teamService.createTeam` stores the team with
`status: PENDING` and leaves it unscheduled. Until it is approved, no standup
reminder or posting job runs for it. The Slack flow DMs every org admin an
approve/reject Block Kit message, but that DM is a single delivery attempt — if
it fails, is deleted, or the org has no reachable admin, the request used to
become invisible. This page is the durable path to those requests.

| Column                 | Field                                                |
| ---------------------- | ---------------------------------------------------- |
| Team / Channel ID      | `name`, `slackChannelId`                             |
| Proposed By            | first `ADMIN` `TeamMember` (whoever ran the command) |
| Standup / Posting / TZ | `standupTime`, `postingTime`, `timezone`             |
| Requested              | `createdAt`                                          |

Actions (both open a confirmation modal):

- **Approve** → `POST /teams/:id/approve`. Flips `PENDING → ACTIVE` via
  `teamService.approvePendingTeam`, calls
  `schedulerService.refreshTeamSchedule` so standups start immediately, and DMs
  the proposer.
- **Reject** → `POST /teams/:id/reject`. Deletes the proposed team via
  `teamService.rejectPendingTeam` (freeing the channel for a fresh request;
  cascade deletes remove the creator's `TeamMember` row) and DMs the proposer.

Both transitions are scoped to `status: PENDING` in the write itself, so two
admins deciding at once — or an admin clicking here after someone already used
the Slack button — get a `409` instead of double-processing. The page reloads
the list on a `409` so the stale row disappears. The proposer DM is
best-effort: the decision is already committed, so a Slack failure is logged
and the request still succeeds.

When no admin DM lands (every send failed, or the org has no active
`OWNER`/`ADMIN`), the Slack flow falls back to posting the same approve/reject
message in the org's `daily-dose-bot` channel. `ensureOrgChannel` may have just
created that channel with only the bot in it, so the fallback first invites the
org admins into it — otherwise the post lands where nobody is watching. Both
steps are best-effort. The buttons in that channel post are safe for a public
channel: `teamService.getPendingTeamForDecision` re-authorizes whoever clicks.

The sidebar shows a live count badge next to **Approvals**. It is fetched from
`GET /teams/pending` on mount and refreshed when the page dispatches the
`dailydose:pending-teams-changed` window event
(`web/src/utils/adminEvents.ts`) after a decision.

### Members (`/admin/members`)

Manage org membership and per-team membership for the active org.

| Column          | Field                             |
| --------------- | --------------------------------- |
| Name / Slack ID | `name`, `slackUserId`             |
| Role            | `OWNER`/`ADMIN`/`MEMBER` badge    |
| Teams           | comma-separated team names (or —) |
| Last Standup    | most recent `standupDate` (or —)  |

Actions:

- **Add Member** → `POST /members` (`{ slackUserId, orgId, role }`). Re-adding a
  previously-removed user reactivates their membership. User must exist (have
  signed in to the bot) → otherwise 404.
- **Manage Teams** (per member) → loads the org's teams, then:
  - Add to a team → `POST /team-members` (`{ userId, teamId, role }`, role
    `MEMBER`/`ADMIN`). Reactivates a prior soft-deleted membership if present.
  - Remove from a team → `DELETE /team-members/:id` (soft delete).
- **Change Role** → `PUT /members/:id` (`{ role }`, one of
  `OWNER`/`ADMIN`/`MEMBER`).
- **Remove** → `DELETE /members/:id` (soft delete from the org).

> The Members page can be opened with router state `{ addMember: true }` to
> auto-open the Add Member modal.

### Standups (`/admin/standups`)

Read-only browser of posted standup summaries for the active org. Defaults to
the **last 7 days** (`startDate`/`endDate` query params override the window).

| Column              | Field                                                  |
| ------------------- | ------------------------------------------------------ |
| Team / Date         | `teamName`, `standupDate`                              |
| Submitted / Members | `submittedCount`, `totalMembers` (active team members) |
| Rate                | `submittedCount / totalMembers` percentage             |

Clicking a row fetches `GET /standups/:teamId/:date` and opens a modal listing
each response as a card: user, **Late**/**Blocked** badges, Yesterday, Today,
Blockers (when present), and the submitted timestamp.

### Holidays (`/admin/holidays`)

CRUD over the active org's holidays (org-scoped `Holiday` table).

| Column                    | Field                                |
| ------------------------- | ------------------------------------ |
| Name / Date / Description | `name`, `date`, `description` (or —) |

- **Add Holiday** → `POST /holidays` (`{ name, date, description, orgId }`).
- **Edit** → `PUT /holidays/:id` (`{ name, date, description }`).
- **Delete** → `DELETE /holidays/:id` (**hard delete**).
- **Import** (**super admin only**) → upload a Zoho People holiday export
  (`.xls`/`.xlsx`/`.csv`). The button is hidden for org `OWNER`/`ADMIN`. Two-step
  flow backed by `src/services/holidayImportService.js`:
  1. `POST /holidays/import/preview` (multipart: `file`, `orgId`) parses the file,
     expands multi-day rows (`From`/`To` columns) into one entry per calendar day,
     and diffs each date against existing holidays. Returns `{ items, warnings }`
     where each item is tagged `new` / `update` / `unchanged`, and `warnings` lists
     any skipped rows (missing name, unparsable date, reversed range, range over 60
     days) plus how many days the 1000-record cap dropped.
  2. The admin reviews/deselects rows in the modal, then
     `POST /holidays/import` (`{ orgId, items }`) upserts the confirmed rows by
     `(organization_id, date)` in a single `$transaction`, returning
     `{ created, updated, skipped, total }`. Items are normalized first (bad date,
     blank name, duplicate day, over-long name), so a malformed row is counted in
     `skipped` rather than failing the write partway through.
  - `.xls`/`.xlsx` are parsed with the `xlsx` (SheetJS) package. `.csv` is parsed by
    hand — SheetJS's own CSV reader auto-detects and silently mangles Zoho's
    `DD-MMM-YYYY` date strings, so plain-text files bypass it entirely.
  - **Dates are keyed in UTC**, not local time. `Holiday.date` is `@db.Date` and
    Prisma persists the UTC calendar day of whatever `Date` it's given, so
    `holidayImportService.toUtcDate()` / `toDateKey()` are used on both the read
    and write side. A local-midnight `Date` would shift the stored day on any host
    where `TZ !== UTC` and — because the upsert key is `(organization_id, date)` —
    silently overwrite the neighbouring day's holiday. No `TZ` is pinned in
    deployment config, so don't assume the host clock is UTC.
  - Imported rows are tagged `source: MANUAL` and have any `externalId` cleared,
    even though the file came out of Zoho: the upload is a manual action. The
    nightly Zoho sync (`zohoSyncService`) remains authoritative and will re-tag a
    date `ZOHO` if its API still returns it. Use the import when an org has no
    Zoho API credentials configured, or to backfill ahead of the first sync.
  - Known tradeoff: the npm-published `xlsx@0.18.5` has open high-severity
    advisories (prototype pollution / ReDoS) with no newer npm release available,
    and it is effectively the only Node option for legacy binary `.xls`. Because
    it parses caller-chosen bytes **inside this shared multi-tenant process**, the
    blast radius is every org on the box — wider than the org-scoped holiday CRUD
    routes. Both import routes are therefore gated on `requireAuth` +
    `requireSuperAdmin` (in addition to `verifyOrgAccess`) and capped at a 5 MB
    upload. Dropping `.xls` support would remove the dependency entirely.

These are the same holidays the scheduler checks before sending reminders.

### Scheduler (`/admin/scheduler`)

Read-only monitor of cron job state for the active org's **active** teams. One
card per team showing timezone, **Reminder at** `standupTime` and **Post at**
`postingTime`, each with an active/inactive badge.

The badges reflect whether the in-memory job is currently registered in
`schedulerService.scheduledJobs`: the reminder job key is
`dd-<team-name-slug>` (name lowercased, spaces → hyphens) and the posting job
key is `posting-<teamId>`. An "inactive" badge means no live job is registered
for that team (e.g. after a restart before re-scheduling, or invalid stored
times).

### Zoho Sync (`/admin/zoho`)

Operator view of the org's Zoho People integration — the same surface the
`/dd-zoho-*` slash commands expose, and gated at the same tier
(`verifyOrgAccess`: org `OWNER`/`ADMIN`, or super admin). All data is loaded in
one `GET /zoho?orgId=` call and the page refetches after every mutation.

> Connecting an org in the first place — Zoho-side permissions, the Self Client
> app, the grant-token exchange — is covered in
> [`zoho-setup.md`](./zoho-setup.md), including a troubleshooting table for the
> errors this page surfaces.

Three sections:

1. **Integration** — `enabled` state and data center from `ZohoCredential`.
   The route selects only `{ enabled, dataCenter }`; the refresh and
   access tokens are never sent to the browser. When no credential row exists
   the page says so and points at `npm run zoho:auth-setup` — **credential
   setup is deliberately not exposed in the panel**, since the Zoho grant token
   is a one-time secret and the CLI flow already handles it.
2. **Last run** — the most recent `ZohoSyncRun` per type. Queried as one
   `findFirst` per type rather than one capped list, so a burst of runs of one
   type can't push the other out of the window and make it read as "never
   synced" (same reasoning as `/dd-zoho-sync-status`).
   - `run.error` is a raw thrown message and is **never** returned to the
     client, per `errorHelper`'s policy — a failed run renders as "check the
     server logs" and the API sends only `failed: true`.
   - `serializeSyncRun` computes a `warning` for the two misconfiguration
     shapes that otherwise look like an idle night: synced 0 with
     `skippedUnmapped > 0` (employee IDs aren't mapped) and synced 0 with
     `skippedInvalid > 0` (the org's Zoho response uses different field names).
3. **Employee mappings** — `ZohoUserMapping` rows with add/remove via modal.
   The picker is a **dropdown of the org's members** (`GET /members?orgId=`),
   not a free-text Slack ID field, and `POST /zoho/mappings` enforces the same
   thing server-side: the user must already exist (404, same wording as
   `POST /members`) and be an active `OrganizationMember` (400).
   - That guard is load-bearing, not defensive padding. `mapMember()` goes
     through `userService.findOrCreateUser()`, which **creates** a `User` for an
     unknown Slack ID, and `fetchSlackUserData()` swallows a failed
     `users.info` lookup — so without it a typo would silently mint an empty
     orphan `User` and return 200. The Slack command can't hit this because its
     ID comes from a resolved mention.
   - Creation still goes through `zohoMappingService`, so the panel inherits
     its validation (an employee ID already mapped to someone else is rejected,
     including the `P2002` race path). `zohoEmployeeId` is a string end to end —
     Zoho IDs overflow JS's safe integer range. `UserFacingError` maps to `400`
     with its message; anything else is a `500` with a generic body.
   - Deletion is a `delete` by primary key after the org check, **not**
     `unmapMember()` — the row is already fetched and authorized, so the
     service's `slackUserId` re-lookup and `(org, user)` `deleteMany` would add
     two queries to re-prove it.

**Sync now** posts to `POST /zoho/sync` with `type: 'ALL'` and runs the same
functions the nightly cron calls. It is **synchronous** — it calls Zoho and
upserts before responding, so the operator sees real counts instead of a
fire-and-forget "started". Expect seconds, not milliseconds.

Each type is caught **separately**, the way `syncAllOrganizations` does it, so a
holiday failure can't erase a leave sync that already landed:

- At least one type succeeded → `200` with `{ HOLIDAY?, LEAVE?, errors }`,
  where `errors` maps the failed type to its message (`{}` when all succeeded).
  The page reports the counts and the failure together.
- Every requested type failed → `400` if all failures were `ZohoAuthError` /
  `ZohoApiError` (actionable setup detail: missing credential, revoked refresh
  token, insufficient Zoho permissions), `500` otherwise. Either way the sync
  has already recorded a `FAILED` `ZohoSyncRun` before rethrowing.

Note the cron's `noOverlap` guard does not cover manual runs.

> **Known ceiling:** the request is long-lived by design — two sequential Zoho
> calls at a 15s timeout each, plus one upsert per record — and neither the
> route nor the fetch sets an overall deadline. A large org behind a proxy can
> exceed an Nginx/Cloudflare read timeout, in which case the browser sees a
> failed request while the sync **keeps running server-side** and still writes
> its `ZohoSyncRun`. Reload the page to see the real outcome rather than
> re-running. If this becomes routine, the fix is to make the route
> fire-and-forget and have the page poll `GET /zoho`.

### Activity (`/admin/activity`)

Read-only feed of the most recent standup submissions for the active org
(`GET /activity?limit=50`, capped at 200). Each row reads
"`{user}` submitted standup for `{team}`" with a **late** badge when applicable,
plus a localized timestamp. Currently the only activity type is
`standup_submitted`.

### MCP Usage (`/admin/mcp-usage`)

Per-user MCP tool-call counts over time for the active org, as a multi-series
line chart (`GET /mcp-usage?orgId=&days=`, window clamped to 1–365 days).

Every `tools/call` on the `POST /mcp` endpoint writes one `mcp_tool_calls` row
(`user_id`, `tool_name`, `created_at`) from the handler in `src/mcp/server.js`.
The insert is fire-and-forget so a tracking failure can never fail a tool call.
Two consequences worth knowing:

- The row is written **before** the tool runs, so these are call _attempts_, not
  successes.
- No org is recorded at write time (a user may belong to several), so membership
  is joined at read time — a multi-org user's calls appear under each of their orgs.

The chart plots the six busiest users, folding the remainder into an "Other"
series; hues are keyed to user identity, so changing the day range never
repaints a surviving series.

### My Tokens (`/admin/tokens`)

Self-service management of the **logged-in user's own** personal access tokens
and connected AI clients — the same surface as the public `/mcp-tokens` page, but
inside the admin panel and keyed off the `admin_session` cookie. These routes are
**not** org-scoped: they always operate on `req.adminUser`, so any signed-in
member (super admin, org owner/admin) manages only their own tokens.

- **MCP access tokens**: list (`GET /tokens`), generate (`POST /tokens`, raw value
  shown once in a modal), and revoke (`DELETE /tokens/:id`). Backed by
  `mcpTokenService`.
- **Connected AI clients (OAuth)**: list (`GET /connections`) and disconnect
  (`DELETE /connections/:clientId`). Backed by `oauthTokenService`.

---

## API reference

All routes are under `/api/admin` and require the `admin_session` cookie
(`requireAuth`) unless noted. Org-scoped routes call `verifyOrgAccess` —
super admin, or `OWNER`/`ADMIN` of the target org.

| Method | Path                                   | Access          | Notes                                                 |
| ------ | -------------------------------------- | --------------- | ----------------------------------------------------- |
| GET    | `/me`                                  | auth            | Current user, `isSuperAdmin`, owned/admin orgs        |
| GET    | `/auth/slack`                          | public          | Start Slack OAuth                                     |
| GET    | `/auth/callback`                       | public          | OAuth redirect target; sets session cookie            |
| POST   | `/auth/logout`                         | auth            | Delete session, clear cookie                          |
| GET    | `/stats`                               | auth            | Global (super admin, no `orgId`) or org-scoped        |
| GET    | `/organizations`                       | **super admin** | List orgs with team/member counts                     |
| POST   | `/organizations`                       | **super admin** | Create org                                            |
| PUT    | `/organizations/:id`                   | **super admin** | Update org                                            |
| PATCH  | `/organizations/:id/toggle`            | **super admin** | Flip `isActive`                                       |
| DELETE | `/organizations/:id`                   | **super admin** | **Hard delete** (cascades)                            |
| GET    | `/teams?orgId=`                        | org             | Non-deleted teams (includes `status`)                 |
| GET    | `/teams/pending?orgId=`                | org             | `PENDING` teams + proposer, oldest first              |
| POST   | `/teams`                               | org             | Create team (resolves `channelName`)                  |
| PUT    | `/teams/:id`                           | org             | Update name/times/timezone/active                     |
| POST   | `/teams/:id/approve`                   | org             | `PENDING` → `ACTIVE`, schedules, DMs proposer         |
| POST   | `/teams/:id/reject`                    | org             | Delete the pending team, DMs proposer                 |
| POST   | `/teams/:id/migrate-members`           | org             | Move/copy active members (not to/from PENDING)        |
| DELETE | `/teams/:id`                           | org             | Soft delete (409 on a PENDING team)                   |
| GET    | `/members?orgId=&role=`                | org             | Active org members + teams + last standup             |
| POST   | `/members`                             | org             | Add/reactivate org member                             |
| PUT    | `/members/:id`                         | org             | Change role                                           |
| DELETE | `/members/:id`                         | org             | Soft delete from org                                  |
| POST   | `/team-members`                        | org             | Add/reactivate team membership                        |
| DELETE | `/team-members/:id`                    | org             | Soft delete team membership                           |
| GET    | `/holidays?orgId=`                     | org             | List holidays                                         |
| POST   | `/holidays`                            | org             | Create holiday                                        |
| PUT    | `/holidays/:id`                        | org             | Update holiday                                        |
| DELETE | `/holidays/:id`                        | org             | Hard delete holiday                                   |
| POST   | `/holidays/import/preview`             | super admin     | Parse an uploaded holiday file, return preview        |
| POST   | `/holidays/import`                     | super admin     | Bulk create/update from a confirmed preview           |
| GET    | `/standups?orgId=&startDate=&endDate=` | org             | Summaries (default last 7 days)                       |
| GET    | `/standups/:teamId/:date`              | org             | Individual responses                                  |
| GET    | `/scheduler?orgId=`                    | org             | Per-team cron job status                              |
| GET    | `/zoho?orgId=`                         | org             | Credential state, latest run per type, mappings       |
| POST   | `/zoho/mappings`                       | org             | Map a Slack user to a Zoho employee ID                |
| DELETE | `/zoho/mappings/:id`                   | org             | Remove a mapping                                      |
| POST   | `/zoho/sync`                           | org             | Run the Zoho sync on demand (`HOLIDAY`/`LEAVE`/`ALL`) |
| GET    | `/activity?orgId=&limit=`              | org             | Recent submissions (max 200)                          |
| GET    | `/tokens`                              | auth            | List caller's own MCP tokens (no secrets)             |
| POST   | `/tokens`                              | auth            | Mint caller's MCP token (raw value once)              |
| DELETE | `/tokens/:id`                          | auth            | Revoke one of the caller's tokens                     |
| GET    | `/connections`                         | auth            | List caller's connected OAuth clients                 |
| DELETE | `/connections/:clientId`               | auth            | Disconnect a client (revoke its grants)               |

Common error responses: `400` (missing/invalid input, e.g. no `orgId`),
`401` (no/expired session), `403` (not authorized for org / not super admin),
`404` (not found), `409` (duplicate — Prisma `P2002`; also a team already
decided on the approve/reject routes), `500` (unhandled).

---

## Data model

The panel relies on these Prisma models (`prisma/schema.prisma`), created by
migration `20260318061742_`:

- **`sessions`** — `{ id, user_id, token (unique), expires_at, ip_address,
user_agent, created_at }`, relation `users → User`. Backs the `admin_session`
  cookie.
- **`super_admins`** — `{ id, user_id (unique), granted_by, granted_at,
revoked_at, notes }`, relation `users → User`. A row with `revoked_at = null`
  grants platform-wide access.

Org/team/member/holiday/standup data is the existing application schema
(`Organization`, `Team`, `OrganizationMember`, `TeamMember`, `Holiday`,
`StandupPost`, `StandupResponse`). Soft deletes use `deletedAt`/`isActive`;
the panel filters these out of its lists.

---

## Shared frontend components (`web/src/components/admin/`)

- **`AdminLayout`** — auth guard + sidebar/top-bar shell.
- **`AdminSidebar`** — role-filtered nav (Organizations only for super admins).
- **`AdminTopBar`** — org switcher dropdown (with role badges) + username +
  logout.
- **`DataTable`** — generic table; `columns` (`{ key, label, render? }`),
  `rows` (each needs `id`), optional `onRowClick`, `emptyMessage`.
- **`AdminModal`** — overlay modal; `isOpen`, `onClose`, `title`, `children`;
  closes on Escape / backdrop / X.
- **`StatCard`** — `label`, `value`, optional `icon` (Dashboard tiles).
- **`StatusBadge`** — pill with variants: `active`, `inactive`, `owner`,
  `admin`, `member`, `late`.

---

## Local development

1. Run the bot (serves `/api/admin`): `npm run dev` (port 3000).
2. Run the web dev server: `cd web && npm run dev` (Vite, ~5173). `vite.config.ts`
   proxies `/api` (with `changeOrigin`) to `http://localhost:3000`, so the admin
   API and OAuth work through the dev server.
3. Visit `http://localhost:5173/admin/login`.

For OAuth to work locally, `ADMIN_OAUTH_REDIRECT_URI` must point at a callback
URL Slack can reach and that is registered on the Slack app. The session cookie
is `secure` only when `NODE_ENV=production`, so it works over plain HTTP in dev.

Tests for the auth middleware live in `test/routes/admin.test.js`.
