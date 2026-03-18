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
