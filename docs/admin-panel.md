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
| Members       | `/admin/members`       | Users           | Org                  |
| Standups      | `/admin/standups`      | MessageSquare   | Org                  |
| Holidays      | `/admin/holidays`      | CalendarDays    | Org                  |
| Scheduler     | `/admin/scheduler`     | Clock           | Org                  |
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
- **Org-scoped:** Teams, Members, and **Today's Completion** rate
  (`todayResponses / activeTeamMembers`, as a percentage).

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
- **Delete** → `DELETE /organizations/:id`. **Hard delete** — cascades to all
  teams, members, holidays, and standup data for the org.

### Teams (`/admin/teams`)

CRUD over the active org's teams. Deletes are **soft** (`deletedAt`); soft-
deleted teams are hidden everywhere in the panel.

| Column                      | Field                                 |
| --------------------------- | ------------------------------------- |
| Name / Channel ID           | `name`, `slackChannelId`              |
| Standup / Posting           | `standupTime`, `postingTime` (HH:MM)  |
| Timezone / Members / Status | `timezone`, `memberCount`, `isActive` |

Actions:

- **New Team** → `POST /teams`. Fields: Name, **Channel name** (resolved to a
  Slack channel ID via the Slack API — `#prefix` is stripped, matched case-
  insensitively across public+private channels), Standup time, Posting time,
  Timezone. Channel not found → 400; a soft-deleted team already on that channel
  → 409; live duplicate channel → 409.
- **Edit** → `PUT /teams/:id`. Editable: name, standup time, posting time,
  timezone, active. **Channel is not editable** after creation.
- **Delete** → `DELETE /teams/:id` (soft delete).

> Creating/updating a team's times here changes scheduling via the same
> `Team` records the scheduler reads. Confirm cron behavior with
> `npm run debug:scheduler` after edits.

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

| Method | Path                                   | Access          | Notes                                          |
| ------ | -------------------------------------- | --------------- | ---------------------------------------------- |
| GET    | `/me`                                  | auth            | Current user, `isSuperAdmin`, owned/admin orgs |
| GET    | `/auth/slack`                          | public          | Start Slack OAuth                              |
| GET    | `/auth/callback`                       | public          | OAuth redirect target; sets session cookie     |
| POST   | `/auth/logout`                         | auth            | Delete session, clear cookie                   |
| GET    | `/stats`                               | auth            | Global (super admin, no `orgId`) or org-scoped |
| GET    | `/organizations`                       | **super admin** | List orgs with team/member counts              |
| POST   | `/organizations`                       | **super admin** | Create org                                     |
| PUT    | `/organizations/:id`                   | **super admin** | Update org                                     |
| PATCH  | `/organizations/:id/toggle`            | **super admin** | Flip `isActive`                                |
| DELETE | `/organizations/:id`                   | **super admin** | **Hard delete** (cascades)                     |
| GET    | `/teams?orgId=`                        | org             | Active (non-deleted) teams                     |
| POST   | `/teams`                               | org             | Create team (resolves `channelName`)           |
| PUT    | `/teams/:id`                           | org             | Update name/times/timezone/active              |
| DELETE | `/teams/:id`                           | org             | Soft delete                                    |
| GET    | `/members?orgId=&role=`                | org             | Active org members + teams + last standup      |
| POST   | `/members`                             | org             | Add/reactivate org member                      |
| PUT    | `/members/:id`                         | org             | Change role                                    |
| DELETE | `/members/:id`                         | org             | Soft delete from org                           |
| POST   | `/team-members`                        | org             | Add/reactivate team membership                 |
| DELETE | `/team-members/:id`                    | org             | Soft delete team membership                    |
| GET    | `/holidays?orgId=`                     | org             | List holidays                                  |
| POST   | `/holidays`                            | org             | Create holiday                                 |
| PUT    | `/holidays/:id`                        | org             | Update holiday                                 |
| DELETE | `/holidays/:id`                        | org             | Hard delete holiday                            |
| GET    | `/standups?orgId=&startDate=&endDate=` | org             | Summaries (default last 7 days)                |
| GET    | `/standups/:teamId/:date`              | org             | Individual responses                           |
| GET    | `/scheduler?orgId=`                    | org             | Per-team cron job status                       |
| GET    | `/activity?orgId=&limit=`              | org             | Recent submissions (max 200)                   |
| GET    | `/tokens`                              | auth            | List caller's own MCP tokens (no secrets)      |
| POST   | `/tokens`                              | auth            | Mint caller's MCP token (raw value once)       |
| DELETE | `/tokens/:id`                          | auth            | Revoke one of the caller's tokens              |
| GET    | `/connections`                         | auth            | List caller's connected OAuth clients          |
| DELETE | `/connections/:clientId`               | auth            | Disconnect a client (revoke its grants)        |

Common error responses: `400` (missing/invalid input, e.g. no `orgId`),
`401` (no/expired session), `403` (not authorized for org / not super admin),
`404` (not found), `409` (duplicate — Prisma `P2002`), `500` (unhandled).

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
