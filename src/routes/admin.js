// src/routes/admin.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { WebClient } = require('@slack/web-api');
const crypto = require('crypto');

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

    res.redirect('/admin/dashboard');
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

module.exports = { router, requireAuth, requireSuperAdmin };
