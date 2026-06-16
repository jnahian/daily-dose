# Admin Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a sidebar-based admin dashboard to the existing React SPA at `/admin/*` routes, with Slack OAuth authentication and permission-gated features for super admins and org admins.

**Architecture:** Extend `web/src/App.tsx` with `/admin/*` routes sharing a persistent `AdminLayout` (sidebar + topbar). Backend API routes added at `/api/admin/*` in a new `src/routes/admin.js` Express router mounted in `src/app.js`. All add/edit/show actions use modal dialogs.

**Tech Stack:** React 19, TypeScript, React Router 7, Tailwind CSS v4, Lucide React, Express.js, Prisma, Slack OAuth (`@slack/web-api`)

---

## Task 1: Backend — Admin API Router Setup

**Files:**
- Create: `src/routes/admin.js`
- Modify: `src/app.js`

**Step 1: Create the admin router file**

```js
// src/routes/admin.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Middleware: verify session cookie
async function requireAuth(req, res, next) {
  const token = req.cookies?.admin_session;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const session = await prisma.sessions.findUnique({
    where: { token },
    include: { users: true }
  });

  if (!session || session.expires_at < new Date()) {
    return res.status(401).json({ error: 'Session expired' });
  }

  req.adminUser = session.users;
  next();
}

// Middleware: check super admin
async function requireSuperAdmin(req, res, next) {
  const sa = await prisma.super_admins.findUnique({
    where: { user_id: req.adminUser.id }
  });
  if (!sa || sa.revoked_at) return res.status(403).json({ error: 'Forbidden' });
  req.isSuperAdmin = true;
  next();
}

// GET /api/admin/me
router.get('/me', requireAuth, async (req, res) => {
  const sa = await prisma.super_admins.findUnique({ where: { user_id: req.adminUser.id } });
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: req.adminUser.id, role: { in: ['OWNER', 'ADMIN'] }, isActive: true },
    include: { organization: true }
  });

  res.json({
    user: {
      id: req.adminUser.id,
      slackUserId: req.adminUser.slackUserId,
      name: req.adminUser.username || req.adminUser.slackUserId,
      avatar: null
    },
    isSuperAdmin: !!(sa && !sa.revoked_at),
    organizations: memberships.map(m => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role
    }))
  });
});

module.exports = { router, requireAuth, requireSuperAdmin };
```

**Step 2: Mount router in app.js**

In `src/app.js`, add before the static files middleware:

```js
const cookieParser = require('cookie-parser');
const { router: adminRouter } = require('./routes/admin');

receiver.app.use(cookieParser());
receiver.app.use(express.json());
receiver.app.use('/api/admin', adminRouter);
```

**Step 3: Install cookie-parser**

```bash
cd /Users/nahian/Projects/daily-dose-bot
npm install cookie-parser
```

**Step 4: Verify server starts without errors**

```bash
npm run dev
```
Expected: Server starts on port 3000, no errors.

**Step 5: Commit**

```bash
git add src/routes/admin.js src/app.js package.json package-lock.json
git commit -m "feat(admin): add admin API router with session auth middleware"
```

---

## Task 2: Backend — Slack OAuth Endpoints

**Files:**
- Modify: `src/routes/admin.js`

**Step 1: Add OAuth endpoints**

Add to `src/routes/admin.js` before `module.exports`:

```js
const { WebClient } = require('@slack/web-api');
const crypto = require('crypto');

// GET /api/admin/auth/slack — initiate OAuth
router.get('/auth/slack', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  // Store state in a short-lived cookie for CSRF protection
  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 10 * 60 * 1000 });

  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    scope: 'identity.basic,identity.avatar',
    redirect_uri: process.env.ADMIN_OAUTH_REDIRECT_URI,
    state
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
});

// GET /api/admin/auth/callback — handle OAuth callback
router.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const savedState = req.cookies?.oauth_state;

  if (!state || state !== savedState) {
    return res.redirect('/admin/login?error=invalid_state');
  }

  res.clearCookie('oauth_state');

  try {
    const slack = new WebClient();
    const result = await slack.oauth.v2.access({
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: process.env.ADMIN_OAUTH_REDIRECT_URI
    });

    const userToken = result.authed_user?.access_token;
    const userClient = new WebClient(userToken);
    const identity = await userClient.users.identity();
    const slackUserId = identity.user?.id;

    // Find user in DB
    let user = await prisma.user.findUnique({ where: { slackUserId } });
    if (!user) {
      return res.redirect('/admin/login?error=not_registered');
    }

    // Check authorization: super admin OR org admin/owner
    const isSuperAdmin = !!(await prisma.super_admins.findFirst({
      where: { user_id: user.id, revoked_at: null }
    }));

    const isOrgAdmin = !!(await prisma.organizationMember.findFirst({
      where: { userId: user.id, role: { in: ['OWNER', 'ADMIN'] }, isActive: true }
    }));

    if (!isSuperAdmin && !isOrgAdmin) {
      return res.redirect('/admin/login?error=not_authorized');
    }

    // Create session
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.sessions.create({
      data: {
        id: crypto.randomUUID(),
        user_id: user.id,
        token,
        expires_at: expiresAt,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      }
    });

    res.cookie('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/admin/login?error=oauth_failed');
  }
});

// POST /api/admin/auth/logout
router.post('/auth/logout', requireAuth, async (req, res) => {
  const token = req.cookies?.admin_session;
  await prisma.sessions.deleteMany({ where: { token } });
  res.clearCookie('admin_session');
  res.json({ ok: true });
});
```

**Step 2: Add env vars to `.env`**

Add to `.env` and `.env.example`:
```
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
ADMIN_OAUTH_REDIRECT_URI=http://localhost:3000/api/admin/auth/callback
```

**Step 3: Test OAuth initiation**

Start server and visit `http://localhost:3000/api/admin/auth/slack` in browser.
Expected: Redirects to Slack OAuth page.

**Step 4: Commit**

```bash
git add src/routes/admin.js .env.example
git commit -m "feat(admin): add Slack OAuth login and logout endpoints"
```

---

## Task 3: Backend — Organizations & Dashboard Stats API

**Files:**
- Modify: `src/routes/admin.js`

**Step 1: Add organizations endpoints**

```js
// GET /api/admin/organizations — super admin only
router.get('/organizations', requireAuth, requireSuperAdmin, async (req, res) => {
  const orgs = await prisma.organization.findMany({
    include: {
      _count: { select: { teams: true, members: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(orgs.map(o => ({
    id: o.id,
    name: o.name,
    slackWorkspaceId: o.slackWorkspaceId,
    isActive: o.isActive,
    teamCount: o._count.teams,
    memberCount: o._count.members,
    createdAt: o.createdAt
  })));
});

// PATCH /api/admin/organizations/:id/toggle — super admin only
router.patch('/organizations/:id/toggle', requireAuth, requireSuperAdmin, async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
  if (!org) return res.status(404).json({ error: 'Not found' });

  const updated = await prisma.organization.update({
    where: { id: req.params.id },
    data: { isActive: !org.isActive }
  });

  res.json({ id: updated.id, isActive: updated.isActive });
});

// GET /api/admin/stats — dashboard stats
router.get('/stats', requireAuth, async (req, res) => {
  const { orgId } = req.query;

  if (req.isSuperAdmin && !orgId) {
    // Platform-wide stats
    const [orgCount, teamCount, userCount, todayStandups] = await Promise.all([
      prisma.organization.count(),
      prisma.team.count(),
      prisma.user.count(),
      prisma.standupResponse.count({
        where: { standupDate: new Date(new Date().setHours(0,0,0,0)) }
      })
    ]);
    return res.json({ orgCount, teamCount, userCount, todayStandups });
  }

  // Org-level stats
  const targetOrgId = orgId;
  const [teamCount, memberCount, todayResponses, totalMembers] = await Promise.all([
    prisma.team.count({ where: { organizationId: targetOrgId } }),
    prisma.organizationMember.count({ where: { organizationId: targetOrgId, isActive: true } }),
    prisma.standupResponse.count({
      where: {
        standupDate: new Date(new Date().setHours(0,0,0,0)),
        team: { organizationId: targetOrgId }
      }
    }),
    prisma.teamMember.count({
      where: { team: { organizationId: targetOrgId }, isActive: true }
    })
  ]);

  res.json({
    teamCount,
    memberCount,
    todayCompletionRate: totalMembers > 0 ? Math.round((todayResponses / totalMembers) * 100) : 0
  });
});
```

**Step 2: Commit**

```bash
git add src/routes/admin.js
git commit -m "feat(admin): add organizations and stats API endpoints"
```

---

## Task 4: Backend — Teams, Members, Holidays API

**Files:**
- Modify: `src/routes/admin.js`

**Step 1: Add teams endpoints**

```js
// GET /api/admin/teams?orgId=
router.get('/teams', requireAuth, async (req, res) => {
  const { orgId } = req.query;
  const teams = await prisma.team.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { members: true } } },
    orderBy: { name: 'asc' }
  });

  res.json(teams.map(t => ({
    id: t.id,
    name: t.name,
    slackChannelId: t.slackChannelId,
    standupTime: t.standupTime,
    postingTime: t.postingTime,
    timezone: t.timezone,
    isActive: t.isActive,
    memberCount: t._count.members
  })));
});

// PUT /api/admin/teams/:id
router.put('/teams/:id', requireAuth, async (req, res) => {
  const { standupTime, postingTime, timezone, isActive } = req.body;
  const updated = await prisma.team.update({
    where: { id: req.params.id },
    data: { standupTime, postingTime, timezone, isActive }
  });
  res.json(updated);
});
```

**Step 2: Add members endpoints**

```js
// GET /api/admin/members?orgId=&teamId=&role=
router.get('/members', requireAuth, async (req, res) => {
  const { orgId, teamId, role } = req.query;

  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId: orgId,
      ...(role ? { role } : {}),
      isActive: true
    },
    include: {
      user: {
        include: {
          teamMemberships: {
            where: { team: { organizationId: orgId }, isActive: true },
            include: { team: { select: { id: true, name: true } } }
          },
          standupResponses: {
            orderBy: { standupDate: 'desc' },
            take: 1,
            select: { standupDate: true }
          }
        }
      }
    },
    orderBy: { joinedAt: 'desc' }
  });

  res.json(members.map(m => ({
    id: m.id,
    userId: m.userId,
    slackUserId: m.user.slackUserId,
    name: m.user.username || m.user.slackUserId,
    role: m.role,
    teams: m.user.teamMemberships.map(tm => ({ id: tm.team.id, name: tm.team.name })),
    receiveNotifications: m.user.teamMemberships[0]?.receiveNotifications ?? true,
    lastStandupDate: m.user.standupResponses[0]?.standupDate ?? null,
    joinedAt: m.joinedAt
  })));
});
```

**Step 3: Add holidays endpoints**

```js
// GET /api/admin/holidays?orgId=
router.get('/holidays', requireAuth, async (req, res) => {
  const { orgId } = req.query;
  const holidays = await prisma.holiday.findMany({
    where: { organization_id: orgId },
    orderBy: { date: 'asc' }
  });
  res.json(holidays);
});

// POST /api/admin/holidays
router.post('/holidays', requireAuth, async (req, res) => {
  const { orgId, name, date, description } = req.body;
  const holiday = await prisma.holiday.create({
    data: {
      id: require('crypto').randomUUID(),
      organization_id: orgId,
      name,
      date: new Date(date),
      description
    }
  });
  res.json(holiday);
});

// PUT /api/admin/holidays/:id
router.put('/holidays/:id', requireAuth, async (req, res) => {
  const { name, date, description } = req.body;
  const updated = await prisma.holiday.update({
    where: { id: req.params.id },
    data: { name, date: new Date(date), description }
  });
  res.json(updated);
});

// DELETE /api/admin/holidays/:id
router.delete('/holidays/:id', requireAuth, async (req, res) => {
  await prisma.holiday.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
```

**Step 4: Commit**

```bash
git add src/routes/admin.js
git commit -m "feat(admin): add teams, members, and holidays API endpoints"
```

---

## Task 5: Backend — Standups, Scheduler & Activity API

**Files:**
- Modify: `src/routes/admin.js`

**Step 1: Add standups endpoints**

```js
// GET /api/admin/standups?orgId=&startDate=&endDate=
router.get('/standups', requireAuth, async (req, res) => {
  const { orgId, startDate, endDate } = req.query;

  const posts = await prisma.standupPost.findMany({
    where: {
      team: { organizationId: orgId },
      standupDate: {
        gte: new Date(startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        lte: new Date(endDate || new Date())
      }
    },
    include: {
      team: { select: { id: true, name: true } },
      _count: { select: { responses: true } }
    },
    orderBy: { standupDate: 'desc' }
  });

  const teamMemberCounts = await prisma.teamMember.groupBy({
    by: ['teamId'],
    where: { team: { organizationId: orgId }, isActive: true },
    _count: { id: true }
  });

  const countMap = Object.fromEntries(teamMemberCounts.map(t => [t.teamId, t._count.id]));

  res.json(posts.map(p => ({
    id: p.id,
    teamId: p.team.id,
    teamName: p.team.name,
    standupDate: p.standupDate,
    submittedCount: p._count.responses,
    totalMembers: countMap[p.team.id] || 0,
    postedAt: p.postedAt
  })));
});

// GET /api/admin/standups/:teamId/:date — individual responses
router.get('/standups/:teamId/:date', requireAuth, async (req, res) => {
  const { teamId, date } = req.params;
  const responses = await prisma.standupResponse.findMany({
    where: { teamId, standupDate: new Date(date) },
    include: { user: { select: { slackUserId: true, username: true } } },
    orderBy: { submittedAt: 'asc' }
  });

  res.json(responses.map(r => ({
    id: r.id,
    user: { slackUserId: r.user.slackUserId, name: r.user.username || r.user.slackUserId },
    yesterdayTasks: r.yesterdayTasks,
    todayTasks: r.todayTasks,
    blockers: r.blockers,
    hasBlockers: r.hasBlockers,
    isLate: r.isLate,
    submittedAt: r.submittedAt
  })));
});
```

**Step 2: Add scheduler status endpoint**

```js
// GET /api/admin/scheduler?orgId=
router.get('/scheduler', requireAuth, async (req, res) => {
  const schedulerService = require('../services/schedulerService');
  const { orgId } = req.query;

  // Get teams for this org
  const teams = await prisma.team.findMany({
    where: { organizationId: orgId, isActive: true },
    select: { id: true, name: true, standupTime: true, postingTime: true, timezone: true }
  });

  // Get active jobs from scheduler
  const jobs = schedulerService.getActiveJobs ? schedulerService.getActiveJobs() : {};

  res.json(teams.map(t => ({
    teamId: t.id,
    teamName: t.name,
    standupTime: t.standupTime,
    postingTime: t.postingTime,
    timezone: t.timezone,
    reminderJobActive: !!(jobs[`reminder_${t.id}`]),
    postJobActive: !!(jobs[`post_${t.id}`])
  })));
});
```

**Step 3: Add activity log endpoint**

```js
// GET /api/admin/activity?orgId=&limit=50
router.get('/activity', requireAuth, async (req, res) => {
  const { orgId, limit = 50 } = req.query;

  const responses = await prisma.standupResponse.findMany({
    where: { team: { organizationId: orgId } },
    include: {
      user: { select: { slackUserId: true, username: true } },
      team: { select: { name: true } }
    },
    orderBy: { submittedAt: 'desc' },
    take: parseInt(limit)
  });

  res.json(responses.map(r => ({
    type: 'standup_submitted',
    user: r.user.username || r.user.slackUserId,
    team: r.team.name,
    date: r.standupDate,
    isLate: r.isLate,
    timestamp: r.submittedAt
  })));
});
```

**Step 4: Commit**

```bash
git add src/routes/admin.js
git commit -m "feat(admin): add standups, scheduler, and activity API endpoints"
```

---

## Task 6: Frontend — AdminAuthContext & useAdminAuth Hook

**Files:**
- Create: `web/src/context/AdminAuthContext.tsx`
- Create: `web/src/hooks/useAdminAuth.ts`

**Step 1: Create AdminAuthContext**

```tsx
// web/src/context/AdminAuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AdminUser {
  id: string;
  slackUserId: string;
  name: string;
  avatar: string | null;
}

interface AdminOrg {
  id: string;
  name: string;
  role: 'OWNER' | 'ADMIN';
}

interface AdminAuthState {
  user: AdminUser | null;
  isSuperAdmin: boolean;
  organizations: AdminOrg[];
  activeOrgId: string | null;
  isLoading: boolean;
  setActiveOrgId: (id: string) => void;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [organizations, setOrganizations] = useState<AdminOrg[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setUser(data.user);
          setIsSuperAdmin(data.isSuperAdmin);
          setOrganizations(data.organizations);
          if (data.organizations.length > 0) {
            setActiveOrgId(data.organizations[0].id);
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AdminAuthContext.Provider value={{ user, isSuperAdmin, organizations, activeOrgId, isLoading, setActiveOrgId }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuthContext() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuthContext must be used within AdminAuthProvider');
  return ctx;
}
```

**Step 2: Create useAdminAuth hook**

```ts
// web/src/hooks/useAdminAuth.ts
import { useAdminAuthContext } from '../context/AdminAuthContext';

export function useAdminAuth() {
  return useAdminAuthContext();
}

export async function adminLogout() {
  await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/admin/login';
}
```

**Step 3: Commit**

```bash
git add web/src/context/AdminAuthContext.tsx web/src/hooks/useAdminAuth.ts
git commit -m "feat(admin): add AdminAuthContext and useAdminAuth hook"
```

---

## Task 7: Frontend — AdminLayout & AdminSidebar Components

**Files:**
- Create: `web/src/components/admin/AdminLayout.tsx`
- Create: `web/src/components/admin/AdminSidebar.tsx`
- Create: `web/src/components/admin/AdminTopBar.tsx`

**Step 1: Create AdminSidebar**

```tsx
// web/src/components/admin/AdminSidebar.tsx
import { NavLink } from 'react-router';
import { LayoutDashboard, Building2, Users, MessageSquare, CalendarDays, Clock, Activity } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/organizations', icon: Building2, label: 'Organizations', superAdminOnly: true },
  { to: '/admin/teams', icon: Users, label: 'Teams' },
  { to: '/admin/members', icon: Users, label: 'Members' },
  { to: '/admin/standups', icon: MessageSquare, label: 'Standups' },
  { to: '/admin/holidays', icon: CalendarDays, label: 'Holidays' },
  { to: '/admin/scheduler', icon: Clock, label: 'Scheduler' },
  { to: '/admin/activity', icon: Activity, label: 'Activity' },
];

export function AdminSidebar() {
  const { isSuperAdmin } = useAdminAuth();

  return (
    <aside className="w-56 bg-[#0d1117] border-r border-white/10 flex flex-col h-full">
      <div className="px-4 py-5 border-b border-white/10">
        <span className="text-[#00CFFF] font-bold text-lg tracking-tight">Daily Dose</span>
        <span className="text-white/40 text-xs ml-2">Admin</span>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems
          .filter(item => !item.superAdminOnly || isSuperAdmin)
          .map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[#00CFFF]/10 text-[#00CFFF]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
      </nav>
    </aside>
  );
}
```

**Step 2: Create AdminTopBar**

```tsx
// web/src/components/admin/AdminTopBar.tsx
import { ChevronDown, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAdminAuth, adminLogout } from '../../hooks/useAdminAuth';

export function AdminTopBar() {
  const { user, organizations, activeOrgId, setActiveOrgId, isSuperAdmin } = useAdminAuth();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const activeOrg = organizations.find(o => o.id === activeOrgId);

  return (
    <header className="h-14 border-b border-white/10 px-6 flex items-center justify-between bg-[#0d1117]">
      {/* Org switcher */}
      <div className="relative">
        {organizations.length > 0 && (
          <button
            onClick={() => setOrgMenuOpen(o => !o)}
            className="flex items-center gap-2 text-sm text-white/80 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            {activeOrg?.name || 'Select org'}
            <ChevronDown size={14} />
          </button>
        )}
        {orgMenuOpen && (
          <div className="absolute top-full left-0 mt-1 bg-[#161b22] border border-white/10 rounded-lg shadow-xl z-50 min-w-48">
            {organizations.map(org => (
              <button
                key={org.id}
                onClick={() => { setActiveOrgId(org.id); setOrgMenuOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                  org.id === activeOrgId ? 'text-[#00CFFF]' : 'text-white/80'
                }`}
              >
                {org.name}
                <span className="text-white/30 text-xs ml-2">{org.role}</span>
              </button>
            ))}
            {isSuperAdmin && <div className="border-t border-white/10 px-4 py-2 text-xs text-white/30">Super Admin</div>}
          </div>
        )}
      </div>

      {/* User + logout */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/60">{user?.name}</span>
        <button
          onClick={adminLogout}
          className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/80 transition-colors"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  );
}
```

**Step 3: Create AdminLayout**

```tsx
// web/src/components/admin/AdminLayout.tsx
import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router';
import { AdminAuthProvider, useAdminAuthContext } from '../../context/AdminAuthContext';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopBar } from './AdminTopBar';

function AdminLayoutInner() {
  const { user, isLoading } = useAdminAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin/login');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f16] flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0a0f16] flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <AdminTopBar />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminLayout() {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner />
    </AdminAuthProvider>
  );
}
```

**Step 4: Commit**

```bash
git add web/src/components/admin/
git commit -m "feat(admin): add AdminLayout, AdminSidebar, and AdminTopBar components"
```

---

## Task 8: Frontend — Shared Admin UI Components

**Files:**
- Create: `web/src/components/admin/StatCard.tsx`
- Create: `web/src/components/admin/DataTable.tsx`
- Create: `web/src/components/admin/StatusBadge.tsx`
- Create: `web/src/components/admin/AdminModal.tsx`

**Step 1: Create StatCard**

```tsx
// web/src/components/admin/StatCard.tsx
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-white/50">{label}</span>
        {icon && <span className="text-[#00CFFF]/60">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
```

**Step 2: Create StatusBadge**

```tsx
// web/src/components/admin/StatusBadge.tsx
const variants = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  inactive: 'bg-white/5 text-white/40 border-white/10',
  admin: 'bg-[#00CFFF]/10 text-[#00CFFF] border-[#00CFFF]/20',
  owner: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  member: 'bg-white/5 text-white/50 border-white/10',
  late: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

type Variant = keyof typeof variants;

export function StatusBadge({ variant, label }: { variant: Variant; label: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${variants[variant]}`}>
      {label}
    </span>
  );
}
```

**Step 3: Create AdminModal**

```tsx
// web/src/components/admin/AdminModal.tsx
import { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function AdminModal({ isOpen, onClose, title, children }: AdminModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#161b22] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
```

**Step 4: Create DataTable**

```tsx
// web/src/components/admin/DataTable.tsx
interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

import { ReactNode } from 'react';

export function DataTable<T extends { id: string }>({ columns, rows, onRowClick, emptyMessage = 'No data' }: DataTableProps<T>) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map(col => (
              <th key={col.key} className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wide">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-white/30 text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : rows.map(row => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-white/5 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-white/3' : ''}`}
            >
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3 text-white/80">
                  {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add web/src/components/admin/
git commit -m "feat(admin): add shared admin UI components (StatCard, DataTable, StatusBadge, AdminModal)"
```

---

## Task 9: Frontend — Login Page & Route Wiring

**Files:**
- Create: `web/src/pages/admin/Login.tsx`
- Modify: `web/src/App.tsx`

**Step 1: Create Login page**

```tsx
// web/src/pages/admin/Login.tsx
export default function AdminLogin() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');

  const errorMessages: Record<string, string> = {
    not_authorized: 'Your Slack account does not have admin access.',
    not_registered: 'Your Slack account is not registered in this workspace.',
    oauth_failed: 'Slack authentication failed. Please try again.',
    invalid_state: 'Invalid OAuth state. Please try again.',
  };

  return (
    <div className="min-h-screen bg-[#0a0f16] flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-white/10 rounded-2xl p-8 w-full max-w-sm text-center">
        <div className="mb-6">
          <span className="text-[#00CFFF] font-bold text-2xl">Daily Dose</span>
          <p className="text-white/40 text-sm mt-1">Admin Dashboard</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {errorMessages[error] || 'An error occurred.'}
          </div>
        )}

        <a
          href="/api/admin/auth/slack"
          className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-black font-semibold rounded-xl transition-colors text-sm"
        >
          Sign in with Slack
        </a>

        <p className="mt-4 text-xs text-white/20">
          Only organization admins and super admins can access this dashboard.
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Wire admin routes in App.tsx**

```tsx
// Add to existing imports
import { AdminLayout } from './components/admin/AdminLayout';

// Add lazy imports
const AdminLogin = lazy(() => import('./pages/admin/Login'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminOrganizations = lazy(() => import('./pages/admin/Organizations'));
const AdminTeams = lazy(() => import('./pages/admin/Teams'));
const AdminMembers = lazy(() => import('./pages/admin/Members'));
const AdminStandups = lazy(() => import('./pages/admin/Standups'));
const AdminHolidays = lazy(() => import('./pages/admin/Holidays'));
const AdminScheduler = lazy(() => import('./pages/admin/Scheduler'));
const AdminActivity = lazy(() => import('./pages/admin/Activity'));
```

Add inside `<Routes>` in App.tsx, after existing routes:

```tsx
{/* Admin routes - outside Navbar/PageTransition */}
<Route path="/admin/login" element={<AdminLogin />} />
<Route path="/admin" element={<AdminLayout />}>
  <Route index element={<Navigate to="/admin/dashboard" replace />} />
  <Route path="dashboard" element={<AdminDashboard />} />
  <Route path="organizations" element={<AdminOrganizations />} />
  <Route path="teams" element={<AdminTeams />} />
  <Route path="members" element={<AdminMembers />} />
  <Route path="standups" element={<AdminStandups />} />
  <Route path="holidays" element={<AdminHolidays />} />
  <Route path="scheduler" element={<AdminScheduler />} />
  <Route path="activity" element={<AdminActivity />} />
</Route>
```

Also add `Navigate` to imports: `import { Routes, Route, useLocation, Navigate } from 'react-router';`

**Note:** The `<Navbar />` and `<AnimatePresence>` wrappers only apply to non-admin routes. Admin routes render `AdminLayout` which has its own layout — make sure admin routes are placed outside the existing layout wrapper.

**Step 3: Verify routing works**

```bash
cd web && npm run dev
```
Visit `http://localhost:5173/admin` — should redirect to `/admin/login`.
Visit `http://localhost:5173/admin/login` — should show login page.

**Step 4: Commit**

```bash
git add web/src/pages/admin/Login.tsx web/src/App.tsx
git commit -m "feat(admin): add login page and admin route tree"
```

---

## Task 10: Frontend — Dashboard Page

**Files:**
- Create: `web/src/pages/admin/Dashboard.tsx`

**Step 1: Create Dashboard page**

```tsx
// web/src/pages/admin/Dashboard.tsx
import { useEffect, useState } from 'react';
import { Building2, Users, MessageSquare, TrendingUp } from 'lucide-react';
import { StatCard } from '../../components/admin/StatCard';
import { useAdminAuth } from '../../hooks/useAdminAuth';

export default function AdminDashboard() {
  const { isSuperAdmin, activeOrgId } = useAdminAuth();
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    const url = isSuperAdmin && !activeOrgId
      ? '/api/admin/stats'
      : `/api/admin/stats?orgId=${activeOrgId}`;

    fetch(url, { credentials: 'include' })
      .then(r => r.json())
      .then(setStats);
  }, [isSuperAdmin, activeOrgId]);

  if (!stats) return <div className="text-white/40 text-sm">Loading stats...</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Dashboard</h1>

      {isSuperAdmin ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Organizations" value={stats.orgCount} icon={<Building2 size={18} />} />
          <StatCard label="Teams" value={stats.teamCount} icon={<Users size={18} />} />
          <StatCard label="Users" value={stats.userCount} icon={<Users size={18} />} />
          <StatCard label="Standups Today" value={stats.todayStandups} icon={<MessageSquare size={18} />} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Teams" value={stats.teamCount} icon={<Users size={18} />} />
          <StatCard label="Members" value={stats.memberCount} icon={<Users size={18} />} />
          <StatCard label="Today's Completion" value={`${stats.todayCompletionRate}%`} icon={<TrendingUp size={18} />} />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/pages/admin/Dashboard.tsx
git commit -m "feat(admin): add dashboard page with stats"
```

---

## Task 11: Frontend — Organizations Page (Super Admin)

**Files:**
- Create: `web/src/pages/admin/Organizations.tsx`

**Step 1: Create Organizations page**

```tsx
// web/src/pages/admin/Organizations.tsx
import { useEffect, useState } from 'react';
import { DataTable } from '../../components/admin/DataTable';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useNavigate } from 'react-router';

interface Org {
  id: string;
  name: string;
  slackWorkspaceId: string;
  isActive: boolean;
  teamCount: number;
  memberCount: number;
  createdAt: string;
}

export default function AdminOrganizations() {
  const { isSuperAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Org[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) { navigate('/admin/dashboard'); return; }
    fetch('/api/admin/organizations', { credentials: 'include' })
      .then(r => r.json()).then(setOrgs);
  }, [isSuperAdmin]);

  const toggleOrg = async (org: Org) => {
    await fetch(`/api/admin/organizations/${org.id}/toggle`, {
      method: 'PATCH', credentials: 'include'
    });
    setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, isActive: !o.isActive } : o));
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Organizations</h1>
      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'slackWorkspaceId', label: 'Workspace ID' },
          { key: 'teamCount', label: 'Teams' },
          { key: 'memberCount', label: 'Members' },
          {
            key: 'isActive', label: 'Status',
            render: (o) => <StatusBadge variant={o.isActive ? 'active' : 'inactive'} label={o.isActive ? 'Active' : 'Inactive'} />
          },
          {
            key: 'actions', label: '',
            render: (o) => (
              <button
                onClick={(e) => { e.stopPropagation(); toggleOrg(o); }}
                className="text-xs text-white/40 hover:text-white transition-colors"
              >
                {o.isActive ? 'Disable' : 'Enable'}
              </button>
            )
          }
        ]}
        rows={orgs}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/pages/admin/Organizations.tsx
git commit -m "feat(admin): add organizations page for super admin"
```

---

## Task 12: Frontend — Teams Page with Edit Modal

**Files:**
- Create: `web/src/pages/admin/Teams.tsx`

**Step 1: Create Teams page**

```tsx
// web/src/pages/admin/Teams.tsx
import { useEffect, useState } from 'react';
import { DataTable } from '../../components/admin/DataTable';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface Team {
  id: string;
  name: string;
  slackChannelId: string;
  standupTime: string;
  postingTime: string;
  timezone: string;
  isActive: boolean;
  memberCount: number;
}

export default function AdminTeams() {
  const { activeOrgId } = useAdminAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [form, setForm] = useState({ standupTime: '', postingTime: '', timezone: '' });

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/teams?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => r.json()).then(setTeams);
  }, [activeOrgId]);

  const openEdit = (team: Team) => {
    setEditTeam(team);
    setForm({ standupTime: team.standupTime, postingTime: team.postingTime, timezone: team.timezone });
  };

  const saveEdit = async () => {
    if (!editTeam) return;
    await fetch(`/api/admin/teams/${editTeam.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setTeams(prev => prev.map(t => t.id === editTeam.id ? { ...t, ...form } : t));
    setEditTeam(null);
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Teams</h1>
      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'slackChannelId', label: 'Channel' },
          { key: 'standupTime', label: 'Standup Time' },
          { key: 'postingTime', label: 'Posting Time' },
          { key: 'timezone', label: 'Timezone' },
          { key: 'memberCount', label: 'Members' },
          {
            key: 'isActive', label: 'Status',
            render: (t) => <StatusBadge variant={t.isActive ? 'active' : 'inactive'} label={t.isActive ? 'Active' : 'Inactive'} />
          },
          {
            key: 'actions', label: '',
            render: (t) => (
              <button onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                className="text-xs text-[#00CFFF] hover:text-[#00CFFF]/80 transition-colors">
                Edit
              </button>
            )
          }
        ]}
        rows={teams}
      />

      <AdminModal isOpen={!!editTeam} onClose={() => setEditTeam(null)} title={`Edit — ${editTeam?.name}`}>
        <div className="space-y-4">
          {(['standupTime', 'postingTime', 'timezone'] as const).map(field => (
            <div key={field}>
              <label className="block text-xs text-white/50 mb-1 capitalize">
                {field.replace(/([A-Z])/g, ' $1')}
              </label>
              <input
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
              />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditTeam(null)}
              className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={saveEdit}
              className="px-4 py-2 text-sm bg-[#00CFFF] text-black font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors">
              Save
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/pages/admin/Teams.tsx
git commit -m "feat(admin): add teams page with edit modal"
```

---

## Task 13: Frontend — Members Page

**Files:**
- Create: `web/src/pages/admin/Members.tsx`

**Step 1: Create Members page**

```tsx
// web/src/pages/admin/Members.tsx
import { useEffect, useState } from 'react';
import { DataTable } from '../../components/admin/DataTable';
import { StatusBadge } from '../../components/admin/StatusBadge';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface Member {
  id: string;
  slackUserId: string;
  name: string;
  role: string;
  teams: { id: string; name: string }[];
  receiveNotifications: boolean;
  lastStandupDate: string | null;
  joinedAt: string;
}

export default function AdminMembers() {
  const { activeOrgId } = useAdminAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [viewMember, setViewMember] = useState<Member | null>(null);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/members?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => r.json()).then(setMembers);
  }, [activeOrgId]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Members</h1>
      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'slackUserId', label: 'Slack ID' },
          {
            key: 'role', label: 'Role',
            render: (m) => <StatusBadge variant={m.role === 'OWNER' ? 'owner' : m.role === 'ADMIN' ? 'admin' : 'member'} label={m.role} />
          },
          {
            key: 'teams', label: 'Teams',
            render: (m) => <span className="text-white/50">{m.teams.map(t => t.name).join(', ') || '—'}</span>
          },
          {
            key: 'lastStandupDate', label: 'Last Standup',
            render: (m) => <span className="text-white/50">{m.lastStandupDate ? new Date(m.lastStandupDate).toLocaleDateString() : '—'}</span>
          },
          {
            key: 'actions', label: '',
            render: (m) => (
              <button onClick={(e) => { e.stopPropagation(); setViewMember(m); }}
                className="text-xs text-[#00CFFF] hover:text-[#00CFFF]/80 transition-colors">
                View
              </button>
            )
          }
        ]}
        rows={members}
      />

      <AdminModal isOpen={!!viewMember} onClose={() => setViewMember(null)} title={viewMember?.name || ''}>
        {viewMember && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-white/40">Slack ID</span><span className="text-white">{viewMember.slackUserId}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Role</span><StatusBadge variant={viewMember.role === 'OWNER' ? 'owner' : viewMember.role === 'ADMIN' ? 'admin' : 'member'} label={viewMember.role} /></div>
            <div className="flex justify-between"><span className="text-white/40">Notifications</span><span className="text-white">{viewMember.receiveNotifications ? 'On' : 'Off'}</span></div>
            <div className="flex justify-between"><span className="text-white/40">Last Standup</span><span className="text-white">{viewMember.lastStandupDate ? new Date(viewMember.lastStandupDate).toLocaleDateString() : '—'}</span></div>
            <div>
              <span className="text-white/40">Teams</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {viewMember.teams.map(t => (
                  <span key={t.id} className="px-2 py-1 bg-white/5 rounded text-xs text-white/70">{t.name}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/pages/admin/Members.tsx
git commit -m "feat(admin): add members page with view modal"
```

---

## Task 14: Frontend — Standups Page with Responses Modal

**Files:**
- Create: `web/src/pages/admin/Standups.tsx`

**Step 1: Create Standups page**

```tsx
// web/src/pages/admin/Standups.tsx
import { useEffect, useState } from 'react';
import { DataTable } from '../../components/admin/DataTable';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface StandupRow {
  id: string;
  teamId: string;
  teamName: string;
  standupDate: string;
  submittedCount: number;
  totalMembers: number;
  postedAt: string;
}

interface Response {
  id: string;
  user: { slackUserId: string; name: string };
  yesterdayTasks: string;
  todayTasks: string;
  blockers: string;
  hasBlockers: boolean;
  isLate: boolean;
  submittedAt: string;
}

export default function AdminStandups() {
  const { activeOrgId } = useAdminAuth();
  const [rows, setRows] = useState<StandupRow[]>([]);
  const [selected, setSelected] = useState<StandupRow | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/standups?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => r.json()).then(setRows);
  }, [activeOrgId]);

  const openResponses = async (row: StandupRow) => {
    setSelected(row);
    const date = new Date(row.standupDate).toISOString().split('T')[0];
    const data = await fetch(`/api/admin/standups/${row.teamId}/${date}`, { credentials: 'include' }).then(r => r.json());
    setResponses(data);
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Standups</h1>
      <DataTable
        columns={[
          { key: 'teamName', label: 'Team' },
          { key: 'standupDate', label: 'Date', render: (r) => new Date(r.standupDate).toLocaleDateString() },
          { key: 'submittedCount', label: 'Submitted' },
          { key: 'totalMembers', label: 'Total Members' },
          {
            key: 'rate', label: 'Rate',
            render: (r) => `${r.totalMembers > 0 ? Math.round((r.submittedCount / r.totalMembers) * 100) : 0}%`
          }
        ]}
        rows={rows}
        onRowClick={openResponses}
      />

      <AdminModal isOpen={!!selected} onClose={() => setSelected(null)} title={`${selected?.teamName} — ${selected ? new Date(selected.standupDate).toLocaleDateString() : ''}`}>
        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
          {responses.length === 0 && <p className="text-white/40 text-sm">No responses.</p>}
          {responses.map(r => (
            <div key={r.id} className="border border-white/10 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{r.user.name}</span>
                <div className="flex gap-2">
                  {r.isLate && <span className="text-xs text-amber-400">Late</span>}
                  {r.hasBlockers && <span className="text-xs text-red-400">Blocked</span>}
                </div>
              </div>
              <div className="text-xs text-white/50 space-y-1">
                <p><span className="text-white/30">Yesterday: </span>{r.yesterdayTasks}</p>
                <p><span className="text-white/30">Today: </span>{r.todayTasks}</p>
                {r.hasBlockers && <p><span className="text-white/30">Blockers: </span>{r.blockers}</p>}
              </div>
            </div>
          ))}
        </div>
      </AdminModal>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/pages/admin/Standups.tsx
git commit -m "feat(admin): add standups page with responses modal"
```

---

## Task 15: Frontend — Holidays Page with Add/Edit/Delete Modals

**Files:**
- Create: `web/src/pages/admin/Holidays.tsx`

**Step 1: Create Holidays page**

```tsx
// web/src/pages/admin/Holidays.tsx
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/admin/DataTable';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface Holiday {
  id: string;
  name: string;
  date: string;
  description: string | null;
}

const emptyForm = { name: '', date: '', description: '' };

export default function AdminHolidays() {
  const { activeOrgId } = useAdminAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [modal, setModal] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<Holiday | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/holidays?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => r.json()).then(setHolidays);
  }, [activeOrgId]);

  const openAdd = () => { setForm(emptyForm); setSelected(null); setModal('add'); };
  const openEdit = (h: Holiday) => { setSelected(h); setForm({ name: h.name, date: h.date.split('T')[0], description: h.description || '' }); setModal('edit'); };
  const openDelete = (h: Holiday) => { setSelected(h); setModal('delete'); };

  const save = async () => {
    if (modal === 'add') {
      const created = await fetch('/api/admin/holidays', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, orgId: activeOrgId })
      }).then(r => r.json());
      setHolidays(prev => [...prev, created].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } else if (modal === 'edit' && selected) {
      const updated = await fetch(`/api/admin/holidays/${selected.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      }).then(r => r.json());
      setHolidays(prev => prev.map(h => h.id === selected.id ? updated : h));
    }
    setModal(null);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    await fetch(`/api/admin/holidays/${selected.id}`, { method: 'DELETE', credentials: 'include' });
    setHolidays(prev => prev.filter(h => h.id !== selected.id));
    setModal(null);
  };

  const FormFields = () => (
    <div className="space-y-4">
      {(['name', 'date', 'description'] as const).map(field => (
        <div key={field}>
          <label className="block text-xs text-white/50 mb-1 capitalize">{field}</label>
          <input
            type={field === 'date' ? 'date' : 'text'}
            value={form[field]}
            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00CFFF]/50"
          />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
        <button onClick={save} className="px-4 py-2 text-sm bg-[#00CFFF] text-black font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors">Save</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Holidays</h1>
        <button onClick={openAdd} className="flex items-center gap-2 px-3 py-2 bg-[#00CFFF] text-black text-sm font-medium rounded-lg hover:bg-[#00CFFF]/90 transition-colors">
          <Plus size={15} /> Add Holiday
        </button>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'date', label: 'Date', render: (h) => new Date(h.date).toLocaleDateString() },
          { key: 'description', label: 'Description', render: (h) => h.description || '—' },
          {
            key: 'actions', label: '',
            render: (h) => (
              <div className="flex items-center gap-3">
                <button onClick={(e) => { e.stopPropagation(); openEdit(h); }} className="text-white/40 hover:text-[#00CFFF] transition-colors"><Pencil size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); openDelete(h); }} className="text-white/40 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
              </div>
            )
          }
        ]}
        rows={holidays}
      />

      <AdminModal isOpen={modal === 'add'} onClose={() => setModal(null)} title="Add Holiday"><FormFields /></AdminModal>
      <AdminModal isOpen={modal === 'edit'} onClose={() => setModal(null)} title="Edit Holiday"><FormFields /></AdminModal>
      <AdminModal isOpen={modal === 'delete'} onClose={() => setModal(null)} title="Delete Holiday">
        <p className="text-sm text-white/70 mb-6">Delete <span className="text-white font-medium">{selected?.name}</span>? This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel</button>
          <button onClick={confirmDelete} className="px-4 py-2 text-sm bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </AdminModal>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/src/pages/admin/Holidays.tsx
git commit -m "feat(admin): add holidays page with add/edit/delete modals"
```

---

## Task 16: Frontend — Scheduler & Activity Pages

**Files:**
- Create: `web/src/pages/admin/Scheduler.tsx`
- Create: `web/src/pages/admin/Activity.tsx`

**Step 1: Create Scheduler page**

```tsx
// web/src/pages/admin/Scheduler.tsx
import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { StatusBadge } from '../../components/admin/StatusBadge';

interface SchedulerJob {
  teamId: string;
  teamName: string;
  standupTime: string;
  postingTime: string;
  timezone: string;
  reminderJobActive: boolean;
  postJobActive: boolean;
}

export default function AdminScheduler() {
  const { activeOrgId } = useAdminAuth();
  const [jobs, setJobs] = useState<SchedulerJob[]>([]);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/scheduler?orgId=${activeOrgId}`, { credentials: 'include' })
      .then(r => r.json()).then(setJobs);
  }, [activeOrgId]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Scheduler</h1>
      <div className="space-y-3">
        {jobs.length === 0 && <p className="text-white/40 text-sm">No active teams.</p>}
        {jobs.map(job => (
          <div key={job.teamId} className="bg-[#161b22] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">{job.teamName}</span>
              <span className="text-xs text-white/30">{job.timezone}</span>
            </div>
            <div className="mt-3 flex gap-6 text-sm">
              <div>
                <span className="text-white/40 text-xs">Reminder at</span>
                <p className="text-white mt-0.5">{job.standupTime}</p>
                <div className="mt-1">
                  <StatusBadge variant={job.reminderJobActive ? 'active' : 'inactive'} label={job.reminderJobActive ? 'Running' : 'Inactive'} />
                </div>
              </div>
              <div>
                <span className="text-white/40 text-xs">Post at</span>
                <p className="text-white mt-0.5">{job.postingTime}</p>
                <div className="mt-1">
                  <StatusBadge variant={job.postJobActive ? 'active' : 'inactive'} label={job.postJobActive ? 'Running' : 'Inactive'} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Create Activity page**

```tsx
// web/src/pages/admin/Activity.tsx
import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface ActivityEvent {
  type: string;
  user: string;
  team: string;
  date: string;
  isLate: boolean;
  timestamp: string;
}

export default function AdminActivity() {
  const { activeOrgId } = useAdminAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/admin/activity?orgId=${activeOrgId}&limit=50`, { credentials: 'include' })
      .then(r => r.json()).then(setEvents);
  }, [activeOrgId]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Activity</h1>
      <div className="bg-[#161b22] border border-white/10 rounded-xl divide-y divide-white/5">
        {events.length === 0 && <p className="text-white/40 text-sm px-4 py-6">No recent activity.</p>}
        {events.map((e, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between">
            <div>
              <span className="text-sm text-white">{e.user}</span>
              <span className="text-sm text-white/40"> submitted standup for </span>
              <span className="text-sm text-white">{e.team}</span>
              {e.isLate && <span className="ml-2 text-xs text-amber-400">late</span>}
            </div>
            <span className="text-xs text-white/30">{new Date(e.timestamp).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add web/src/pages/admin/Scheduler.tsx web/src/pages/admin/Activity.tsx
git commit -m "feat(admin): add scheduler and activity pages"
```

---

## Task 17: Build & End-to-End Verification

**Step 1: Build the web app**

```bash
cd /Users/nahian/Projects/daily-dose-bot/web
npm run build
```
Expected: Build completes with no TypeScript errors.

**Step 2: Start the bot server**

```bash
cd /Users/nahian/Projects/daily-dose-bot
npm run dev
```

**Step 3: Verify all routes**

Visit each URL and confirm correct rendering:
- `http://localhost:3000/admin` → redirects to `/admin/login`
- `http://localhost:3000/admin/login` → shows login page with "Sign in with Slack" button
- Click "Sign in with Slack" → redirects to Slack OAuth
- After OAuth: `http://localhost:3000/admin/dashboard` → shows stats
- `/admin/organizations` → accessible only as super admin, shows org table
- `/admin/teams` → shows teams table, Edit button opens modal
- `/admin/members` → shows members, View button opens detail modal
- `/admin/standups` → shows standup list, clicking row opens responses modal
- `/admin/holidays` → shows list, Add/Edit/Delete modals work
- `/admin/scheduler` → shows job status cards
- `/admin/activity` → shows activity feed
- Logout button → clears session, redirects to login

**Step 4: Fix any TypeScript errors**

```bash
cd web && npm run lint
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(admin): complete admin dashboard implementation"
```
