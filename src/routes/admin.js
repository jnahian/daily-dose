// src/routes/admin.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

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

module.exports = { router, requireAuth, requireSuperAdmin };
