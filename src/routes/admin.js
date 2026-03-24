// src/routes/admin.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { WebClient } = require('@slack/web-api');
const slackClient = new WebClient(process.env.BOT_TOKEN);
const crypto = require('crypto');

// In-memory OAuth state store (state → expiry timestamp)
const oauthStates = new Map();
const OAUTH_STATE_TTL = 10 * 60 * 1000; // 10 minutes

// Middleware: verify session cookie
async function requireAuth(req, res, next) {
  const token = req.cookies?.admin_session;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const session = await prisma.sessions.findUnique({
      where: { token },
      include: { users: true }
    });

    if (!session || !session.users || session.expires_at <= new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    req.adminUser = session.users;
    next();
  } catch (err) {
    console.error('requireAuth error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Middleware: check super admin
async function requireSuperAdmin(req, res, next) {
  try {
    const sa = await prisma.super_admins.findUnique({
      where: { user_id: req.adminUser.id }
    });
    if (!sa || sa.revoked_at) return res.status(403).json({ error: 'Forbidden' });
    req.isSuperAdmin = true;
    next();
  } catch (err) {
    console.error('requireSuperAdmin error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper: verify caller has access to the given orgId (super admin or org OWNER/ADMIN)
async function verifyOrgAccess(req, res, orgId) {
  if (!orgId) {
    res.status(400).json({ error: 'orgId is required' });
    return false;
  }
  // Super admins can access any org
  const sa = await prisma.super_admins.findUnique({ where: { user_id: req.adminUser.id } });
  if (sa && !sa.revoked_at) return true;
  // Check org membership
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: req.adminUser.id, organizationId: orgId, role: { in: ['OWNER', 'ADMIN'] }, isActive: true }
  });
  if (!membership) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

async function resolveChannelId(channelName) {
  const name = channelName.replace(/^#/, '').toLowerCase();
  let cursor;
  do {
    const result = await slackClient.conversations.list({
      limit: 200,
      types: 'public_channel,private_channel',
      ...(cursor ? { cursor } : {})
    });
    const match = result.channels.find(c => c.name === name);
    if (match) return match.id;
    cursor = result.response_metadata?.next_cursor;
  } while (cursor);
  return null;
}

// GET /api/admin/me
router.get('/me', requireAuth, async (req, res) => {
  try {
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
  } catch (err) {
    console.error('GET /me error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/auth/slack — initiate OAuth
router.get('/auth/slack', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, Date.now() + OAUTH_STATE_TTL);

  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    user_scope: 'identity.basic,identity.email',
    redirect_uri: process.env.ADMIN_OAUTH_REDIRECT_URI,
    state
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
});

// GET /api/admin/auth/callback — handle OAuth callback
router.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const expiry = oauthStates.get(state);

  if (!state || !expiry || Date.now() > expiry) {
    oauthStates.delete(state);
    return res.redirect('/admin/login?error=invalid_state');
  }

  oauthStates.delete(state);

  try {
    if (!code) return res.redirect('/admin/login?error=oauth_denied');

    const slack = new WebClient();
    const result = await slack.oauth.v2.access({
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: process.env.ADMIN_OAUTH_REDIRECT_URI
    });

    if (!result.ok) throw new Error(`Slack OAuth error: ${result.error}`);

    const userToken = result.authed_user?.access_token;
    if (!userToken) throw new Error('No user access token in OAuth response');

    const userClient = new WebClient(userToken);
    const identity = await userClient.users.identity();
    const slackUserId = identity.user?.id;
    if (!slackUserId) throw new Error('Could not get Slack user ID from identity');

    let user = await prisma.user.findUnique({ where: { slackUserId } });
    if (!user) {
      return res.redirect('/admin/login?error=not_registered');
    }

    const isSuperAdmin = !!(await prisma.super_admins.findFirst({
      where: { user_id: user.id, revoked_at: null }
    }));

    const isOrgAdmin = !!(await prisma.organizationMember.findFirst({
      where: { userId: user.id, role: { in: ['OWNER', 'ADMIN'] }, isActive: true }
    }));

    if (!isSuperAdmin && !isOrgAdmin) {
      return res.redirect('/admin/login?error=not_authorized');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

    const appUrl = process.env.APP_URL || '';
    res.redirect(`${appUrl}/admin/dashboard`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/admin/login?error=oauth_failed');
  }
});

// POST /api/admin/auth/logout
router.post('/auth/logout', requireAuth, async (req, res) => {
  try {
    const token = req.cookies?.admin_session;
    await prisma.sessions.deleteMany({ where: { token } });
    res.clearCookie('admin_session');
    res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/organizations — super admin only
router.get('/organizations', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const orgs = await prisma.organization.findMany({
      include: { _count: { select: { teams: true, members: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orgs.map(o => ({
      id: o.id,
      name: o.name,
      slackWorkspaceId: o.slackWorkspaceId,
      slackWorkspaceName: o.slackWorkspaceName,
      defaultTimezone: o.defaultTimezone,
      isActive: o.isActive,
      teamCount: o._count.teams,
      memberCount: o._count.members,
      createdAt: o.createdAt
    })));
  } catch (err) {
    console.error('GET /organizations error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/organizations/:id/toggle — super admin only
router.patch('/organizations/:id/toggle', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.organization.update({
      where: { id: req.params.id },
      data: { isActive: !org.isActive }
    });
    res.json({ id: updated.id, isActive: updated.isActive });
  } catch (err) {
    console.error('PATCH /organizations/:id/toggle error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/organizations — super admin only
router.post('/organizations', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, slackWorkspaceId, slackWorkspaceName, defaultTimezone } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const org = await prisma.organization.create({
      data: {
        name: name.trim(),
        slackWorkspaceId: slackWorkspaceId?.trim() || null,
        slackWorkspaceName: slackWorkspaceName?.trim() || null,
        defaultTimezone: defaultTimezone?.trim() || 'America/New_York',
      }
    });
    res.status(201).json({ id: org.id, name: org.name, slackWorkspaceId: org.slackWorkspaceId, slackWorkspaceName: org.slackWorkspaceName, defaultTimezone: org.defaultTimezone, isActive: org.isActive, teamCount: 0, memberCount: 0, createdAt: org.createdAt });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Name or workspace ID already exists' });
    console.error('POST /organizations error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/organizations/:id — super admin only
router.put('/organizations/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, slackWorkspaceId, slackWorkspaceName, defaultTimezone, isActive } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const updated = await prisma.organization.update({
      where: { id: req.params.id },
      data: {
        name: name.trim(),
        slackWorkspaceId: slackWorkspaceId?.trim() || null,
        slackWorkspaceName: slackWorkspaceName?.trim() || null,
        defaultTimezone: defaultTimezone?.trim() || 'America/New_York',
        isActive: typeof isActive === 'boolean' ? isActive : true,
      }
    });
    res.json({ id: updated.id, name: updated.name, slackWorkspaceId: updated.slackWorkspaceId, slackWorkspaceName: updated.slackWorkspaceName, defaultTimezone: updated.defaultTimezone, isActive: updated.isActive });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Name or workspace ID already exists' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    console.error('PUT /organizations/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/organizations/:id — super admin only
router.delete('/organizations/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    await prisma.organization.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    console.error('DELETE /organizations/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const sa = await prisma.super_admins.findUnique({ where: { user_id: req.adminUser.id } });
    const isSuperAdmin = !!(sa && !sa.revoked_at);
    if (isSuperAdmin && !orgId) {
      const [orgCount, teamCount, userCount, todayStandups] = await Promise.all([
        prisma.organization.count(),
        prisma.team.count(),
        prisma.user.count(),
        prisma.standupResponse.count({
          where: { standupDate: new Date(new Date().setHours(0, 0, 0, 0)) }
        })
      ]);
      return res.json({ orgCount, teamCount, userCount, todayStandups });
    }
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const targetOrgId = orgId;
    const [teamCount, memberCount, todayResponses, totalMembers] = await Promise.all([
      prisma.team.count({ where: { organizationId: targetOrgId } }),
      prisma.organizationMember.count({ where: { organizationId: targetOrgId, isActive: true } }),
      prisma.standupResponse.count({
        where: { standupDate: new Date(new Date().setHours(0, 0, 0, 0)), team: { organizationId: targetOrgId } }
      }),
      prisma.teamMember.count({ where: { team: { organizationId: targetOrgId }, isActive: true } })
    ]);
    res.json({
      teamCount,
      memberCount,
      todayCompletionRate: totalMembers > 0 ? Math.round((todayResponses / totalMembers) * 100) : 0
    });
  } catch (err) {
    console.error('GET /stats error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/teams?orgId=
router.get('/teams', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const teams = await prisma.team.findMany({
      where: { organizationId: orgId, deletedAt: null },
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
  } catch (err) {
    console.error('GET /teams error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/teams/:id
router.put('/teams/:id', requireAuth, async (req, res) => {
  try {
    // Verify team belongs to an org the caller has access to
    const team = await prisma.team.findUnique({ where: { id: req.params.id }, select: { organizationId: true, deletedAt: true } });
    if (!team || team.deletedAt) return res.status(404).json({ error: 'Not found' });
    const allowed = await verifyOrgAccess(req, res, team.organizationId);
    if (!allowed) return;
    const { standupTime, postingTime, timezone, isActive } = req.body;
    const updated = await prisma.team.update({
      where: { id: req.params.id },
      data: { standupTime, postingTime, timezone, isActive }
    });
    res.json(updated);
  } catch (err) {
    console.error('PUT /teams/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/teams
router.post('/teams', requireAuth, async (req, res) => {
  try {
    const { orgId, name, channelName, standupTime, postingTime, timezone } = req.body;
    if (!orgId || !name || !channelName || !standupTime || !postingTime || !timezone) {
      return res.status(400).json({ error: 'orgId, name, channelName, standupTime, postingTime, and timezone are required.' });
    }
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;

    const slackChannelId = await resolveChannelId(channelName);
    if (!slackChannelId) {
      return res.status(400).json({ error: `Channel "${channelName}" not found in Slack workspace.` });
    }

    const team = await prisma.team.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        slackChannelId,
        standupTime,
        postingTime,
        timezone,
      },
      include: { _count: { select: { members: true } } }
    });

    res.status(201).json({
      id: team.id,
      name: team.name,
      slackChannelId: team.slackChannelId,
      standupTime: team.standupTime,
      postingTime: team.postingTime,
      timezone: team.timezone,
      isActive: team.isActive,
      memberCount: team._count.members
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A team with this channel already exists.' });
    }
    console.error('POST /teams error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/teams/:id
router.delete('/teams/:id', requireAuth, async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      select: { organizationId: true, deletedAt: true }
    });
    if (!team || team.deletedAt) return res.status(404).json({ error: 'Not found' });
    const allowed = await verifyOrgAccess(req, res, team.organizationId);
    if (!allowed) return;

    await prisma.team.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /teams/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/members?orgId=
router.get('/members', requireAuth, async (req, res) => {
  try {
    const { orgId, role } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: orgId, ...(role ? { role } : {}), isActive: true },
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
  } catch (err) {
    console.error('GET /members error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/members — add user to org
router.post('/members', requireAuth, async (req, res) => {
  try {
    const { slackUserId, orgId, role } = req.body;
    if (!slackUserId?.trim() || !orgId) return res.status(400).json({ error: 'slackUserId and orgId are required' });
    const validRoles = ['OWNER', 'ADMIN', 'MEMBER'];
    if (role && !validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const user = await prisma.user.findUnique({ where: { slackUserId: slackUserId.trim() } });
    if (!user) return res.status(404).json({ error: 'User not found. They must sign in to the bot first.' });
    const existing = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: user.id } }
    });
    let member;
    if (existing) {
      member = await prisma.organizationMember.update({
        where: { id: existing.id },
        data: { role: role || 'MEMBER', isActive: true }
      });
    } else {
      member = await prisma.organizationMember.create({
        data: { organizationId: orgId, userId: user.id, role: role || 'MEMBER', isActive: true }
      });
    }
    res.status(201).json({
      id: member.id,
      userId: user.id,
      slackUserId: user.slackUserId,
      name: user.username || user.slackUserId,
      role: member.role,
      teams: [],
      receiveNotifications: true,
      lastStandupDate: null,
      joinedAt: member.joinedAt
    });
  } catch (err) {
    console.error('POST /members error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/members/:id — change role
router.put('/members/:id', requireAuth, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['OWNER', 'ADMIN', 'MEMBER'];
    if (!role || !validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const member = await prisma.organizationMember.findUnique({ where: { id: req.params.id } });
    if (!member) return res.status(404).json({ error: 'Not found' });
    const allowed = await verifyOrgAccess(req, res, member.organizationId);
    if (!allowed) return;
    const updated = await prisma.organizationMember.update({ where: { id: req.params.id }, data: { role } });
    res.json({ id: updated.id, role: updated.role });
  } catch (err) {
    console.error('PUT /members/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/members/:id — remove from org
router.delete('/members/:id', requireAuth, async (req, res) => {
  try {
    const member = await prisma.organizationMember.findUnique({ where: { id: req.params.id } });
    if (!member) return res.status(404).json({ error: 'Not found' });
    const allowed = await verifyOrgAccess(req, res, member.organizationId);
    if (!allowed) return;
    await prisma.organizationMember.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  } catch (err) {
    console.error('DELETE /members/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/holidays?orgId=
router.get('/holidays', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const holidays = await prisma.holiday.findMany({
      where: { organization_id: orgId },
      orderBy: { date: 'asc' }
    });
    res.json(holidays);
  } catch (err) {
    console.error('GET /holidays error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/holidays
router.post('/holidays', requireAuth, async (req, res) => {
  try {
    const { orgId, name, date, description } = req.body;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const holiday = await prisma.holiday.create({
      data: {
        id: crypto.randomUUID(),
        organization_id: orgId,
        name,
        date: new Date(date),
        description
      }
    });
    res.json(holiday);
  } catch (err) {
    console.error('POST /holidays error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/holidays/:id
router.put('/holidays/:id', requireAuth, async (req, res) => {
  try {
    const holiday = await prisma.holiday.findUnique({ where: { id: req.params.id }, select: { organization_id: true } });
    if (!holiday) return res.status(404).json({ error: 'Not found' });
    const allowed = await verifyOrgAccess(req, res, holiday.organization_id);
    if (!allowed) return;
    const { name, date, description } = req.body;
    const updated = await prisma.holiday.update({
      where: { id: req.params.id },
      data: { name, date: new Date(date), description }
    });
    res.json(updated);
  } catch (err) {
    console.error('PUT /holidays/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/holidays/:id
router.delete('/holidays/:id', requireAuth, async (req, res) => {
  try {
    const holiday = await prisma.holiday.findUnique({ where: { id: req.params.id }, select: { organization_id: true } });
    if (!holiday) return res.status(404).json({ error: 'Not found' });
    const allowed = await verifyOrgAccess(req, res, holiday.organization_id);
    if (!allowed) return;
    await prisma.holiday.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /holidays/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/standups?orgId=&startDate=&endDate=
router.get('/standups', requireAuth, async (req, res) => {
  try {
    const { orgId, startDate, endDate } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
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
  } catch (err) {
    console.error('GET /standups error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/standups/:teamId/:date
router.get('/standups/:teamId/:date', requireAuth, async (req, res) => {
  try {
    const { teamId, date } = req.params;
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { organizationId: true } });
    if (!team) return res.status(404).json({ error: 'Not found' });
    const allowed = await verifyOrgAccess(req, res, team.organizationId);
    if (!allowed) return;
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
  } catch (err) {
    console.error('GET /standups/:teamId/:date error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/scheduler?orgId=
router.get('/scheduler', requireAuth, async (req, res) => {
  try {
    const schedulerService = require('../services/schedulerService');
    const { orgId } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const teams = await prisma.team.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, standupTime: true, postingTime: true, timezone: true }
    });
    const jobs = schedulerService.scheduledJobs || new Map();
    const teamNameSlug = (name) => name.toLowerCase().replace(/\s+/g, '-');
    res.json(teams.map(t => ({
      teamId: t.id,
      teamName: t.name,
      standupTime: t.standupTime,
      postingTime: t.postingTime,
      timezone: t.timezone,
      reminderJobActive: jobs.has(`dd-${teamNameSlug(t.name)}`),
      postJobActive: jobs.has(`posting-${t.id}`)
    })));
  } catch (err) {
    console.error('GET /scheduler error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/activity?orgId=&limit=50
router.get('/activity', requireAuth, async (req, res) => {
  try {
    const { orgId, limit = '50' } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const responses = await prisma.standupResponse.findMany({
      where: { team: { organizationId: orgId } },
      include: {
        user: { select: { slackUserId: true, username: true } },
        team: { select: { name: true } }
      },
      orderBy: { submittedAt: 'desc' },
      take: Math.min(parseInt(limit, 10) || 50, 200)
    });
    res.json(responses.map(r => ({
      type: 'standup_submitted',
      user: r.user.username || r.user.slackUserId,
      team: r.team.name,
      date: r.standupDate,
      isLate: r.isLate,
      timestamp: r.submittedAt
    })));
  } catch (err) {
    console.error('GET /activity error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { router, requireAuth, requireSuperAdmin };
