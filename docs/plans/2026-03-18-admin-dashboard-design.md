# Admin Dashboard Design

**Date:** 2026-03-18
**Status:** Approved
**Approach:** Extend existing `/web` React SPA with `/admin` route tree

---

## Overview

Add a sidebar-based admin dashboard to the existing React SPA in `/web`. The dashboard provides platform management (super admins) and organization management (org admins) under a single `/admin` URL, with features gated by user permission. Authentication uses Slack OAuth with database-backed sessions.

---

## Architecture

### Approach
Extend `/web/src/App.tsx` with `/admin/*` routes. Admin pages live in `web/src/pages/admin/`. Shares existing Tailwind config, theme system, and Framer Motion. No new build config required.

### Route Structure
```
/admin                    → redirect to /admin/dashboard (or /admin/login if unauthenticated)
/admin/login              → Slack OAuth entry point
/admin/auth/callback      → OAuth callback handler
/admin/dashboard          → Overview stats (permission-gated content)
/admin/organizations      → [Super Admin only] All orgs
/admin/teams              → [Org Admin+] Teams management
/admin/members            → [Org Admin+] Members list
/admin/standups           → [Org Admin+] Standup history
/admin/holidays           → [Org Admin+] Holiday management
/admin/scheduler          → [Org Admin+] Scheduler status
/admin/activity           → [Org Admin+] Recent activity log
```

### New Frontend Files
```
web/src/pages/admin/           ← page components per route
web/src/components/admin/      ← AdminLayout, AdminSidebar, StatCard, DataTable, StatusBadge
web/src/context/AdminAuthContext.tsx
web/src/hooks/useAdminAuth.ts
```

### New Backend API Routes
Added to `/src/routes/admin.js` (mounted in `src/app.js`):
```
GET  /api/admin/auth/slack      → initiate Slack OAuth
GET  /api/admin/auth/callback   → handle OAuth, create session
POST /api/admin/auth/logout     → destroy session
GET  /api/admin/me              → current user + permissions
GET  /api/admin/organizations   → [super admin] list all orgs
GET  /api/admin/organizations/:id/toggle → [super admin] enable/disable org
GET  /api/admin/teams           → [org admin] list teams
PUT  /api/admin/teams/:id       → [org admin] update team settings
GET  /api/admin/members         → [org admin] list members
GET  /api/admin/standups        → [org admin] standup history
GET  /api/admin/standups/:teamId/:date → [org admin] individual responses
GET  /api/admin/holidays        → [org admin] list holidays
POST /api/admin/holidays        → [org admin] create holiday
PUT  /api/admin/holidays/:id    → [org admin] update holiday
DELETE /api/admin/holidays/:id  → [org admin] delete holiday
GET  /api/admin/scheduler       → [org admin] active cron jobs + next run times
GET  /api/admin/activity        → [org admin] recent activity log
```

---

## Authentication

### Slack OAuth Flow
1. User visits `/admin` → redirected to `/admin/login` if unauthenticated
2. Clicks "Sign in with Slack" → `GET /api/admin/auth/slack` → redirect to Slack OAuth URL
3. Slack redirects to `GET /api/admin/auth/callback` with auth code
4. Server exchanges code for token, fetches user identity via `users.identity`
5. Checks authorization: `super_admins` table OR `OrganizationMember` with role `OWNER`/`ADMIN`
6. If authorized: creates `sessions` record, sets `httpOnly` cookie
7. Frontend hydrates `AdminAuthContext` via `GET /api/admin/me`

### `/api/admin/me` Response Shape
```json
{
  "user": { "slackUserId": "...", "name": "...", "avatar": "..." },
  "isSuperAdmin": true,
  "organizations": [{ "id": "...", "name": "...", "role": "OWNER" }]
}
```

### Session Management
- Stored in existing `sessions` DB table (already in Prisma schema)
- 7-day expiry, renewed on activity
- Logout destroys session record and clears cookie

### Access Control
- **Super Admin:** user present in `super_admins` table
- **Org Admin:** `OrganizationMember` with `role = OWNER` or `role = ADMIN`
- **Everyone else:** denied with "not authorized" screen

---

## UI Layout

### Sidebar Layout
```
┌─────────────┬────────────────────────────────┐
│  Logo       │  Top bar: org switcher + user  │
│─────────────│                                │
│  Dashboard  │                                │
│  Orgs ✦     │     Page content               │
│  Teams      │                                │
│  Members    │                                │
│  Standups   │                                │
│  Holidays   │                                │
│  Scheduler  │                                │
│  Activity   │                                │
│─────────────│                                │
│  User       │                                │
│  Logout     │                                │
└─────────────┴────────────────────────────────┘
✦ Super Admin only
```

### Org Switcher
Super admins: dropdown to switch between all orgs — sets active org context for all pages.
Org admins: see only their own org(s).

### Key Shared Components
- `AdminLayout` — sidebar + topbar wrapper with auth guard
- `AdminSidebar` — nav with permission-filtered items, cyan `#00CFFF` active state
- `StatCard` — metric display (e.g. "12 teams", "48 members")
- `DataTable` — sortable/filterable table for list pages
- `StatusBadge` — colored pill (active/inactive, admin/member, etc.)

### Styling
Matches existing brand: dark background, cyan `#00CFFF` accents, same Tailwind config. Sidebar uses a slightly lighter dark panel to distinguish from content area. Supports existing dark/light theme toggle.

---

## Pages & Features

### Dashboard
- **Super Admin view:** total orgs, teams, users, standups submitted today (platform-wide)
- **Org Admin view:** their org's team count, member count, today's standup completion rate

### Organizations *(Super Admin only)*
- Table: org name, Slack workspace, team count, member count, created date, active status
- Actions: enable/disable org

### Teams
- Table: team name, channel, standup time, posting time, timezone, member count, active status
- Actions: edit team settings (time, timezone), view members

### Members
- Table: name, Slack handle, role, teams, notification status, last standup date
- Filters: by team, role, active status
- Actions: view leave schedule

### Standups
- Date-picker for date range selection
- Table: team, date, submitted count, total members, response rate
- Drill-down: click row to see individual responses for that team/date

### Holidays
- Table: name, date, description
- Actions: add, edit, delete

### Scheduler
- Read-only list: team name, job type (reminder/post), next run time, timezone
- Status indicator per job: running / paused

### Activity Log
- Chronological feed: standup submitted, reminder sent, member joined, holiday added, etc.
- Filters: by org, team, date range
- Read-only

---

## Out of Scope (for now)
- Real-time updates (WebSocket/SSE) — polling or manual refresh is sufficient
- Email notifications
- Audit log for admin actions
- Mobile-optimized sidebar (responsive is fine, mobile-first is not required)
