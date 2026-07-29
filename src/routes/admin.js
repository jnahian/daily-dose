// src/routes/admin.js
const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");
const { WebClient } = require("@slack/web-api");
const slackClient = new WebClient(process.env.BOT_TOKEN);
const crypto = require("crypto");
const schedulerService = require("../services/schedulerService");
const teamService = require("../services/teamService");
const mcpTokenService = require("../services/mcpTokenService");
const channelService = require("../services/channelService");
const changelogBroadcastService = require("../services/changelogBroadcastService");
const oauthTokenService = require("../mcp/auth/oauthTokenService");
const { escapeSlackText } = require("../utils/messageHelper");
const multer = require("multer");
const holidayImportService = require("../services/holidayImportService");
const zohoMappingService = require("../services/zoho/zohoMappingService");
const zohoSyncService = require("../services/zoho/zohoSyncService");

const holidayImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.(xls|xlsx|csv)$/i;
    if (!allowedExt.test(file.originalname)) {
      cb(new Error("Only .xls, .xlsx, or .csv files are supported"));
      return;
    }
    cb(null, true);
  },
});

// In-memory OAuth state store (state → expiry timestamp)
const oauthStates = new Map();
const OAUTH_STATE_TTL = 10 * 60 * 1000; // 10 minutes

// Middleware: verify session cookie
async function requireAuth(req, res, next) {
  const token = req.cookies?.admin_session;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const session = await prisma.sessions.findUnique({
      where: { token },
      include: { users: true },
    });

    if (!session || !session.users || session.expires_at <= new Date()) {
      return res.status(401).json({ error: "Session expired" });
    }

    req.adminUser = session.users;
    next();
  } catch (err) {
    console.error("requireAuth error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Middleware: check super admin
async function requireSuperAdmin(req, res, next) {
  try {
    const sa = await prisma.super_admins.findUnique({
      where: { user_id: req.adminUser.id },
    });
    if (!sa || sa.revoked_at)
      return res.status(403).json({ error: "Forbidden" });
    req.isSuperAdmin = true;
    next();
  } catch (err) {
    console.error("requireSuperAdmin error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Helper: shape a ZohoSyncRun for the admin UI. `run.error` is a raw thrown
// message (possibly from Prisma) — per errorHelper's policy it is never sent
// to the client, only the fact that the run failed. The `warning` field
// mirrors /dd-zoho-sync-status: a run that synced nothing *and* skipped
// records is a misconfiguration, not an idle night, and saying so is the
// difference between a useful page and a row of zeroes.
function serializeSyncRun(run) {
  if (!run) return null;

  let warning = null;
  if (run.status === "SUCCESS" && run.recordsSynced === 0) {
    if (run.skippedUnmapped > 0) {
      warning =
        "Nothing synced — every record belonged to an unmapped employee. " +
        "Check the mappings below against the employee IDs Zoho returns.";
    } else if (run.skippedInvalid > 0) {
      warning =
        "Nothing synced — no record could be read. The Zoho response field " +
        "names likely differ for this organization.";
    }
  }

  return {
    status: run.status,
    recordsSynced: run.recordsSynced,
    skippedUnmapped: run.skippedUnmapped,
    skippedNotApproved: run.skippedNotApproved,
    skippedInvalid: run.skippedInvalid,
    failed: run.status === "FAILED",
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    warning,
  };
}

// Helper: verify caller has access to the given orgId (super admin or org OWNER/ADMIN)
async function verifyOrgAccess(req, res, orgId) {
  if (!orgId) {
    res.status(400).json({ error: "orgId is required" });
    return false;
  }
  // Super admins can access any org
  const sa = await prisma.super_admins.findUnique({
    where: { user_id: req.adminUser.id },
  });
  if (sa && !sa.revoked_at) return true;
  // Check org membership
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: req.adminUser.id,
      organizationId: orgId,
      role: { in: ["OWNER", "ADMIN"] },
      isActive: true,
    },
  });
  if (!membership) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

async function resolveChannelId(channelName) {
  const name = channelName.replace(/^#/, "").toLowerCase();
  let cursor;
  do {
    const result = await slackClient.conversations.list({
      limit: 200,
      types: "public_channel,private_channel",
      ...(cursor ? { cursor } : {}),
    });
    const match = result.channels.find((c) => c.name === name);
    if (match) return match.id;
    cursor = result.response_metadata?.next_cursor;
  } while (cursor);
  return null;
}

// GET /api/admin/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const sa = await prisma.super_admins.findUnique({
      where: { user_id: req.adminUser.id },
    });
    const isSuperAdmin = !!(sa && !sa.revoked_at);

    let organizations;
    if (isSuperAdmin) {
      const orgs = await prisma.organization.findMany({
        where: { deletedAt: null },
      });
      organizations = orgs.map((o) => ({
        id: o.id,
        name: o.name,
        role: null,
      }));
    } else {
      const memberships = await prisma.organizationMember.findMany({
        where: {
          userId: req.adminUser.id,
          role: { in: ["OWNER", "ADMIN"] },
          isActive: true,
        },
        include: { organization: true },
      });
      organizations = memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      }));
    }

    res.json({
      user: {
        id: req.adminUser.id,
        slackUserId: req.adminUser.slackUserId,
        name: req.adminUser.username || req.adminUser.slackUserId,
        avatar: null,
      },
      isSuperAdmin,
      organizations,
    });
  } catch (err) {
    console.error("GET /me error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/auth/slack — initiate OAuth
router.get("/auth/slack", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, Date.now() + OAUTH_STATE_TTL);

  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    user_scope: "identity.basic,identity.email",
    redirect_uri: process.env.ADMIN_OAUTH_REDIRECT_URI,
    state,
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
});

// GET /api/admin/auth/callback — handle OAuth callback
router.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;
  const expiry = oauthStates.get(state);

  if (!state || !expiry || Date.now() > expiry) {
    oauthStates.delete(state);
    return res.redirect(
      `${process.env.APP_URL || ""}/admin/login?error=invalid_state`
    );
  }

  oauthStates.delete(state);

  try {
    if (!code)
      return res.redirect(
        `${process.env.APP_URL || ""}/admin/login?error=oauth_denied`
      );

    const slack = new WebClient();
    const result = await slack.oauth.v2.access({
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: process.env.ADMIN_OAUTH_REDIRECT_URI,
    });

    if (!result.ok) throw new Error(`Slack OAuth error: ${result.error}`);

    const userToken = result.authed_user?.access_token;
    if (!userToken) throw new Error("No user access token in OAuth response");

    const userClient = new WebClient(userToken);
    const identity = await userClient.users.identity();
    const slackUserId = identity.user?.id;
    if (!slackUserId)
      throw new Error("Could not get Slack user ID from identity");

    const user = await prisma.user.findUnique({ where: { slackUserId } });
    if (!user) {
      return res.redirect(
        `${process.env.APP_URL || ""}/admin/login?error=not_registered`
      );
    }

    const isSuperAdmin = !!(await prisma.super_admins.findFirst({
      where: { user_id: user.id, revoked_at: null },
    }));

    const isOrgAdmin = !!(await prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        role: { in: ["OWNER", "ADMIN"] },
        isActive: true,
      },
    }));

    if (!isSuperAdmin && !isOrgAdmin) {
      return res.redirect(
        `${process.env.APP_URL || ""}/admin/login?error=not_authorized`
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.sessions.create({
      data: {
        id: crypto.randomUUID(),
        user_id: user.id,
        token,
        expires_at: expiresAt,
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      },
    });

    res.cookie("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    const appUrl = process.env.APP_URL || "";
    res.redirect(`${appUrl}/admin/dashboard`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.redirect(`${process.env.APP_URL || ""}/admin/login?error=oauth_failed`);
  }
});

// POST /api/admin/auth/logout
router.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    const token = req.cookies?.admin_session;
    await prisma.sessions.deleteMany({ where: { token } });
    res.clearCookie("admin_session");
    res.json({ ok: true });
  } catch (err) {
    console.error("Logout error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/organizations — super admin only
router.get(
  "/organizations",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const orgs = await prisma.organization.findMany({
        where: { deletedAt: null },
        include: { _count: { select: { teams: true, members: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.json(
        orgs.map((o) => ({
          id: o.id,
          name: o.name,
          slackWorkspaceId: o.slackWorkspaceId,
          slackWorkspaceName: o.slackWorkspaceName,
          defaultTimezone: o.defaultTimezone,
          isActive: o.isActive,
          teamCount: o._count.teams,
          memberCount: o._count.members,
          createdAt: o.createdAt,
        }))
      );
    } catch (err) {
      console.error("GET /organizations error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// PATCH /api/admin/organizations/:id/toggle — super admin only
router.patch(
  "/organizations/:id/toggle",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.params.id },
      });
      if (!org || org.deletedAt)
        return res.status(404).json({ error: "Not found" });
      const updated = await prisma.organization.update({
        where: { id: req.params.id },
        data: { isActive: !org.isActive },
      });
      res.json({ id: updated.id, isActive: updated.isActive });
    } catch (err) {
      console.error("PATCH /organizations/:id/toggle error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/admin/organizations — super admin only
router.post(
  "/organizations",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { name, slackWorkspaceId, slackWorkspaceName, defaultTimezone } =
        req.body;
      if (!name?.trim())
        return res.status(400).json({ error: "Name is required" });
      const org = await prisma.organization.create({
        data: {
          name: name.trim(),
          slackWorkspaceId: slackWorkspaceId?.trim() || null,
          slackWorkspaceName: slackWorkspaceName?.trim() || null,
          defaultTimezone: defaultTimezone?.trim() || "America/New_York",
          lastBroadcastVersion: changelogBroadcastService.getLatestVersion(),
        },
      });
      // Best-effort: create the org's daily-dose-bot Slack channel.
      await channelService.ensureOrgChannel(slackClient, org);
      res.status(201).json({
        id: org.id,
        name: org.name,
        slackWorkspaceId: org.slackWorkspaceId,
        slackWorkspaceName: org.slackWorkspaceName,
        defaultTimezone: org.defaultTimezone,
        isActive: org.isActive,
        teamCount: 0,
        memberCount: 0,
        createdAt: org.createdAt,
      });
    } catch (err) {
      if (err.code === "P2002")
        return res
          .status(409)
          .json({ error: "Name or workspace ID already exists" });
      console.error("POST /organizations error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// PUT /api/admin/organizations/:id — super admin only
router.put(
  "/organizations/:id",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const {
        name,
        slackWorkspaceId,
        slackWorkspaceName,
        defaultTimezone,
        isActive,
      } = req.body;
      if (!name?.trim())
        return res.status(400).json({ error: "Name is required" });
      const existing = await prisma.organization.findUnique({
        where: { id: req.params.id },
        select: { deletedAt: true },
      });
      if (!existing || existing.deletedAt)
        return res.status(404).json({ error: "Not found" });
      const updated = await prisma.organization.update({
        where: { id: req.params.id },
        data: {
          name: name.trim(),
          slackWorkspaceId: slackWorkspaceId?.trim() || null,
          slackWorkspaceName: slackWorkspaceName?.trim() || null,
          defaultTimezone: defaultTimezone?.trim() || "America/New_York",
          isActive: typeof isActive === "boolean" ? isActive : true,
        },
      });
      res.json({
        id: updated.id,
        name: updated.name,
        slackWorkspaceId: updated.slackWorkspaceId,
        slackWorkspaceName: updated.slackWorkspaceName,
        defaultTimezone: updated.defaultTimezone,
        isActive: updated.isActive,
      });
    } catch (err) {
      if (err.code === "P2002")
        return res
          .status(409)
          .json({ error: "Name or workspace ID already exists" });
      if (err.code === "P2025")
        return res.status(404).json({ error: "Not found" });
      console.error("PUT /organizations/:id error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// DELETE /api/admin/organizations/:id — super admin only
router.delete(
  "/organizations/:id",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.params.id },
        select: { deletedAt: true },
      });
      if (!org || org.deletedAt)
        return res.status(404).json({ error: "Not found" });

      const orgTeams = await prisma.team.findMany({
        where: { organizationId: req.params.id, deletedAt: null },
        select: { id: true },
      });

      // Soft-delete the org and cascade deactivation to its teams, team
      // memberships, and org memberships. The bot filters on isActive (not
      // org.deletedAt), so deactivating the children is what actually stops
      // reminders/posts.
      const now = new Date();
      await prisma.$transaction([
        prisma.teamMember.updateMany({
          where: { team: { organizationId: req.params.id }, isActive: true },
          data: { isActive: false, deletedAt: now },
        }),
        prisma.team.updateMany({
          where: { organizationId: req.params.id, deletedAt: null },
          data: { isActive: false, deletedAt: now },
        }),
        prisma.organizationMember.updateMany({
          where: { organizationId: req.params.id, isActive: true },
          data: { isActive: false, deletedAt: now },
        }),
        prisma.organization.update({
          where: { id: req.params.id },
          data: { isActive: false, deletedAt: now },
        }),
      ]);

      // Stop the live cron jobs for every team that was just deactivated —
      // the hourly refresh is add-only and won't prune them on its own.
      for (const orgTeam of orgTeams) {
        schedulerService.stopTeamSchedule(orgTeam.id);
      }

      res.status(204).end();
    } catch (err) {
      console.error("DELETE /organizations/:id error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/admin/stats
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const sa = await prisma.super_admins.findUnique({
      where: { user_id: req.adminUser.id },
    });
    const isSuperAdmin = !!(sa && !sa.revoked_at);
    if (isSuperAdmin && !orgId) {
      const [orgCount, teamCount, userCount, todayStandups] = await Promise.all(
        [
          prisma.organization.count({ where: { deletedAt: null } }),
          prisma.team.count({ where: { deletedAt: null } }),
          prisma.user.count(),
          prisma.standupResponse.count({
            where: { standupDate: new Date(new Date().setHours(0, 0, 0, 0)) },
          }),
        ]
      );
      return res.json({ orgCount, teamCount, userCount, todayStandups });
    }
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const targetOrgId = orgId;
    const [
      teamCount,
      memberCount,
      todayResponses,
      totalMembers,
      pendingTeamCount,
    ] = await Promise.all([
      prisma.team.count({
        where: { organizationId: targetOrgId, deletedAt: null },
      }),
      prisma.organizationMember.count({
        where: { organizationId: targetOrgId, isActive: true },
      }),
      prisma.standupResponse.count({
        where: {
          standupDate: new Date(new Date().setHours(0, 0, 0, 0)),
          team: { organizationId: targetOrgId },
        },
      }),
      prisma.teamMember.count({
        where: { team: { organizationId: targetOrgId }, isActive: true },
      }),
      prisma.team.count({
        where: {
          organizationId: targetOrgId,
          status: "PENDING",
          deletedAt: null,
        },
      }),
    ]);
    res.json({
      teamCount,
      memberCount,
      pendingTeamCount,
      todayCompletionRate:
        totalMembers > 0
          ? Math.round((todayResponses / totalMembers) * 100)
          : 0,
    });
  } catch (err) {
    console.error("GET /stats error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/teams?orgId=
router.get("/teams", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const teams = await prisma.team.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: { _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    });
    res.json(
      teams.map((t) => ({
        id: t.id,
        name: t.name,
        slackChannelId: t.slackChannelId,
        standupTime: t.standupTime,
        postingTime: t.postingTime,
        timezone: t.timezone,
        isActive: t.isActive,
        // A PENDING team has isActive=true but is deliberately unscheduled, so
        // the UI needs status to avoid badging it as a healthy active team.
        status: t.status,
        memberCount: t._count.members,
      }))
    );
  } catch (err) {
    console.error("GET /teams error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/teams/pending?orgId= — teams proposed by non-admins awaiting approval
router.get("/teams/pending", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;

    const teams = await teamService.getPendingTeamsForOrg(orgId);
    res.json(
      teams.map((t) => ({
        id: t.id,
        name: t.name,
        slackChannelId: t.slackChannelId,
        standupTime: t.standupTime,
        postingTime: t.postingTime,
        timezone: t.timezone,
        createdAt: t.createdAt,
        proposedBy: t.members[0]?.user
          ? {
              name: t.members[0].user.name,
              username: t.members[0].user.username,
              slackUserId: t.members[0].user.slackUserId,
            }
          : null,
      }))
    );
  } catch (err) {
    console.error("GET /teams/pending error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Shared guard for the approve/reject routes: load the team, confirm it is
// still PENDING, and confirm the caller administers its organization.
async function loadPendingTeamForDecision(req, res) {
  const team = await prisma.team.findUnique({
    where: { id: req.params.id },
    include: {
      // First ADMIN member is the proposer — needed to DM them the decision.
      members: {
        where: { role: "ADMIN" },
        include: { user: true },
        orderBy: { joinedAt: "asc" },
        take: 1,
      },
    },
  });
  if (!team || team.deletedAt) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  const allowed = await verifyOrgAccess(req, res, team.organizationId);
  if (!allowed) return null;
  if (team.status !== "PENDING") {
    res.status(409).json({
      error: `This team has already been ${team.status.toLowerCase()}.`,
    });
    return null;
  }
  return team;
}

// Best-effort DM to the member who proposed the team. The decision is already
// committed, so a Slack failure must not fail the request.
async function notifyProposerOfDecision(team, text) {
  const proposerSlackUserId = team.members[0]?.user?.slackUserId;
  if (!proposerSlackUserId) return;
  try {
    await slackClient.chat.postMessage({
      channel: proposerSlackUserId,
      text,
    });
  } catch (err) {
    console.error("Failed to notify team proposer:", err.message);
  }
}

// POST /api/admin/teams/:id/approve
router.post("/teams/:id/approve", requireAuth, async (req, res) => {
  try {
    const team = await loadPendingTeamForDecision(req, res);
    if (!team) return;

    const approved = await teamService.approvePendingTeam(team.id);

    // Start the team's cron jobs now rather than waiting for the hourly refresh.
    await schedulerService.refreshTeamSchedule(approved.id);

    await notifyProposerOfDecision(
      team,
      `✅ Your team "${escapeSlackText(approved.name)}" was approved and standups are now scheduled.`
    );

    res.json({
      id: approved.id,
      name: approved.name,
      slackChannelId: approved.slackChannelId,
      standupTime: approved.standupTime,
      postingTime: approved.postingTime,
      timezone: approved.timezone,
      isActive: approved.isActive,
      status: approved.status,
    });
  } catch (err) {
    // approvePendingTeam throws when a concurrent decision already moved it.
    if (err.message === "This team has already been processed") {
      return res.status(409).json({ error: err.message });
    }
    console.error("POST /teams/:id/approve error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/teams/:id/reject
router.post("/teams/:id/reject", requireAuth, async (req, res) => {
  try {
    const team = await loadPendingTeamForDecision(req, res);
    if (!team) return;

    // Rejection deletes the team, so capture what we need for the DM first.
    await teamService.rejectPendingTeam(team.id);

    await notifyProposerOfDecision(
      team,
      `❌ Your team "${escapeSlackText(team.name)}" request was declined. Reach out to an organization admin if you have questions.`
    );

    res.json({ success: true });
  } catch (err) {
    if (err.message === "This team has already been processed") {
      return res.status(409).json({ error: err.message });
    }
    console.error("POST /teams/:id/reject error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/teams/:id
router.put("/teams/:id", requireAuth, async (req, res) => {
  try {
    // Verify team belongs to an org the caller has access to
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      select: { organizationId: true, deletedAt: true },
    });
    if (!team || team.deletedAt)
      return res.status(404).json({ error: "Not found" });
    const allowed = await verifyOrgAccess(req, res, team.organizationId);
    if (!allowed) return;
    const { name, standupTime, postingTime, timezone, isActive } = req.body;
    const updated = await prisma.team.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && name.trim() && { name: name.trim() }),
        ...(standupTime !== undefined && { standupTime }),
        ...(postingTime !== undefined && { postingTime }),
        ...(timezone !== undefined && { timezone }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { _count: { select: { members: true } } },
    });

    // Resync the live cron jobs so edits (times/timezone/active) take effect
    // immediately instead of waiting for the hourly refresh or a restart.
    if (updated.isActive && updated.status === "ACTIVE") {
      await schedulerService.refreshTeamSchedule(updated.id);
    } else {
      schedulerService.stopTeamSchedule(updated.id);
    }

    res.json({
      id: updated.id,
      name: updated.name,
      slackChannelId: updated.slackChannelId,
      standupTime: updated.standupTime,
      postingTime: updated.postingTime,
      timezone: updated.timezone,
      isActive: updated.isActive,
      status: updated.status,
      memberCount: updated._count.members,
    });
  } catch (err) {
    console.error("PUT /teams/:id error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/teams
router.post("/teams", requireAuth, async (req, res) => {
  try {
    const { orgId, name, channelName, standupTime, postingTime, timezone } =
      req.body;
    if (
      !orgId ||
      !name ||
      !channelName ||
      !standupTime ||
      !postingTime ||
      !timezone
    ) {
      return res.status(400).json({
        error:
          "orgId, name, channelName, standupTime, postingTime, and timezone are required.",
      });
    }
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;

    const slackChannelId = await resolveChannelId(channelName);
    if (!slackChannelId) {
      return res.status(400).json({
        error: `Channel "${channelName}" not found in Slack workspace.`,
      });
    }

    // Check if a soft-deleted team already occupies this channel
    const existingDeleted = await prisma.team.findFirst({
      where: { slackChannelId, deletedAt: { not: null } },
    });
    if (existingDeleted) {
      return res.status(409).json({
        error: `A deleted team already exists for this channel. Please contact support to restore it.`,
      });
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
      include: { _count: { select: { members: true } } },
    });

    res.status(201).json({
      id: team.id,
      name: team.name,
      slackChannelId: team.slackChannelId,
      standupTime: team.standupTime,
      postingTime: team.postingTime,
      timezone: team.timezone,
      isActive: team.isActive,
      status: team.status,
      memberCount: team._count.members,
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ error: "A team with this channel already exists." });
    }
    console.error("POST /teams error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/teams/:id
router.delete("/teams/:id", requireAuth, async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.params.id },
      select: { organizationId: true, deletedAt: true, status: true },
    });
    if (!team || team.deletedAt)
      return res.status(404).json({ error: "Not found" });
    const allowed = await verifyOrgAccess(req, res, team.organizationId);
    if (!allowed) return;

    // Soft-deleting a PENDING team would hide it from Approvals without ever
    // telling the proposer, and slackChannelId is globally unique (not scoped
    // to deletedAt), so the channel would be blocked against a fresh proposal.
    // Rejecting is the correct exit for a pending team — it hard-deletes.
    if (team.status === "PENDING") {
      return res.status(409).json({
        error:
          "This team is awaiting approval. Reject it from Approvals instead of deleting it.",
      });
    }

    await prisma.team.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    // Stop the team's live cron jobs — the hourly refresh is add-only and
    // won't prune a deleted team's jobs on its own.
    schedulerService.stopTeamSchedule(req.params.id);

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /teams/:id error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/teams/:id/migrate-members — move (or copy) active members to another team in the same org
router.post("/teams/:id/migrate-members", requireAuth, async (req, res) => {
  try {
    const { targetTeamId, keepSource, resetRole } = req.body;
    if (!targetTeamId)
      return res.status(400).json({ error: "targetTeamId is required." });
    if (targetTeamId === req.params.id)
      return res
        .status(400)
        .json({ error: "Source and target team must be different." });

    const sourceTeam = await prisma.team.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        organizationId: true,
        deletedAt: true,
        status: true,
      },
    });
    if (!sourceTeam || sourceTeam.deletedAt)
      return res.status(404).json({ error: "Source team not found." });
    const allowed = await verifyOrgAccess(req, res, sourceTeam.organizationId);
    if (!allowed) return;
    // Migrating out of a pending team would move the first ADMIN TeamMember
    // that Approvals reads as the proposer, leaving the request unattributable
    // and the decision DM undeliverable.
    if (sourceTeam.status === "PENDING")
      return res.status(409).json({
        error: "A team awaiting approval can't be used as a migration source.",
      });

    const targetTeam = await prisma.team.findUnique({
      where: { id: targetTeamId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        deletedAt: true,
        isActive: true,
        status: true,
      },
    });
    // A PENDING team is unscheduled, so members moved into it would silently
    // stop getting standups. The UI hides it; enforce it here too.
    if (
      !targetTeam ||
      targetTeam.deletedAt ||
      !targetTeam.isActive ||
      targetTeam.status === "PENDING"
    )
      return res.status(404).json({ error: "Target team not found." });
    if (targetTeam.organizationId !== sourceTeam.organizationId)
      return res.status(400).json({
        error: "Source and target team must belong to the same organization.",
      });

    const runMigration = () =>
      prisma.$transaction(
        async (tx) => {
          const members = await tx.teamMember.findMany({
            where: { teamId: sourceTeam.id, isActive: true },
          });
          if (members.length === 0)
            return { migratedCount: 0, skippedCount: 0 };

          const existingTargetMembers = await tx.teamMember.findMany({
            where: {
              teamId: targetTeam.id,
              isActive: true,
              userId: { in: members.map((m) => m.userId) },
            },
            select: { userId: true },
          });
          const alreadyOnTargetIds = new Set(
            existingTargetMembers.map((m) => m.userId)
          );

          for (const member of members) {
            if (!alreadyOnTargetIds.has(member.userId)) {
              const existing = await tx.teamMember.findUnique({
                where: {
                  teamId_userId: {
                    teamId: targetTeam.id,
                    userId: member.userId,
                  },
                },
              });
              const data = {
                role: resetRole ? "MEMBER" : member.role,
                receiveNotifications: member.receiveNotifications,
                hideFromNotResponded: member.hideFromNotResponded,
              };
              if (existing) {
                await tx.teamMember.update({
                  where: { id: existing.id },
                  data: { ...data, isActive: true, deletedAt: null },
                });
              } else {
                await tx.teamMember.create({
                  data: {
                    ...data,
                    teamId: targetTeam.id,
                    userId: member.userId,
                  },
                });
              }
            }

            if (!keepSource) {
              await tx.teamMember.update({
                where: { id: member.id },
                data: { isActive: false, deletedAt: new Date() },
              });
            }
          }

          return {
            migratedCount: members.length - alreadyOnTargetIds.size,
            skippedCount: alreadyOnTargetIds.size,
          };
        },
        { isolationLevel: "Serializable" }
      );

    let result;
    for (let attempt = 0; ; attempt++) {
      try {
        result = await runMigration();
        break;
      } catch (err) {
        // P2034: transaction write conflict / deadlock — retry a couple times
        if (err.code === "P2034" && attempt < 2) continue;
        throw err;
      }
    }

    res.json(result);
  } catch (err) {
    console.error("POST /teams/:id/migrate-members error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/members?orgId=
router.get("/members", requireAuth, async (req, res) => {
  try {
    const { orgId, role } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const members = await prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
        ...(role ? { role } : {}),
        isActive: true,
        deletedAt: null,
      },
      include: {
        user: {
          include: {
            teams: {
              where: {
                team: { organizationId: orgId },
                isActive: true,
                deletedAt: null,
              },
              include: { team: { select: { id: true, name: true } } },
            },
            standupResponses: {
              where: { team: { organizationId: orgId } },
              orderBy: { standupDate: "desc" },
              take: 1,
              select: { standupDate: true },
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });
    res.json(
      members.map((m) => ({
        id: m.id,
        userId: m.userId,
        slackUserId: m.user.slackUserId,
        name: m.user.username || m.user.slackUserId,
        role: m.role,
        teams: m.user.teams.map((tm) => ({
          teamMemberId: tm.id,
          id: tm.team.id,
          name: tm.team.name,
        })),
        receiveNotifications: m.user.teams[0]?.receiveNotifications ?? true,
        lastStandupDate: m.user.standupResponses[0]?.standupDate ?? null,
        joinedAt: m.joinedAt,
      }))
    );
  } catch (err) {
    console.error("GET /members error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/members — add user to org
router.post("/members", requireAuth, async (req, res) => {
  try {
    const { slackUserId, orgId, role } = req.body;
    if (!slackUserId?.trim() || !orgId)
      return res
        .status(400)
        .json({ error: "slackUserId and orgId are required" });
    const validRoles = ["OWNER", "ADMIN", "MEMBER"];
    if (role && !validRoles.includes(role))
      return res.status(400).json({ error: "Invalid role" });
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const user = await prisma.user.findUnique({
      where: { slackUserId: slackUserId.trim() },
    });
    if (!user)
      return res
        .status(404)
        .json({ error: "User not found. They must sign in to the bot first." });
    const existing = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: user.id },
      },
    });
    let member;
    if (existing) {
      member = await prisma.organizationMember.update({
        where: { id: existing.id },
        data: { role: role || "MEMBER", isActive: true, deletedAt: null },
      });
    } else {
      member = await prisma.organizationMember.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          role: role || "MEMBER",
          isActive: true,
        },
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
      joinedAt: member.joinedAt,
    });
  } catch (err) {
    console.error("POST /members error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/members/:id — change role
router.put("/members/:id", requireAuth, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ["OWNER", "ADMIN", "MEMBER"];
    if (!role || !validRoles.includes(role))
      return res.status(400).json({ error: "Invalid role" });
    const member = await prisma.organizationMember.findUnique({
      where: { id: req.params.id },
    });
    if (!member) return res.status(404).json({ error: "Not found" });
    const allowed = await verifyOrgAccess(req, res, member.organizationId);
    if (!allowed) return;
    const updated = await prisma.organizationMember.update({
      where: { id: req.params.id },
      data: { role },
    });
    res.json({ id: updated.id, role: updated.role });
  } catch (err) {
    console.error("PUT /members/:id error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/members/:id — remove from org
router.delete("/members/:id", requireAuth, async (req, res) => {
  try {
    const member = await prisma.organizationMember.findUnique({
      where: { id: req.params.id },
    });
    if (!member) return res.status(404).json({ error: "Not found" });
    const allowed = await verifyOrgAccess(req, res, member.organizationId);
    if (!allowed) return;
    await prisma.organizationMember.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await prisma.teamMember.updateMany({
      where: {
        userId: member.userId,
        team: { organizationId: member.organizationId },
        isActive: true,
      },
      data: { isActive: false, deletedAt: new Date() },
    });
    res.status(204).end();
  } catch (err) {
    console.error("DELETE /members/:id error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/team-members — add user to a team
router.post("/team-members", requireAuth, async (req, res) => {
  try {
    const { userId, teamId, role } = req.body;
    if (!userId || !teamId)
      return res.status(400).json({ error: "userId and teamId are required." });
    const validRoles = ["ADMIN", "MEMBER"];
    if (role && !validRoles.includes(role))
      return res
        .status(400)
        .json({ error: "Invalid role. Must be ADMIN or MEMBER." });

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { organizationId: true, deletedAt: true, name: true },
    });
    if (!team || team.deletedAt)
      return res.status(404).json({ error: "Team not found." });
    const allowed = await verifyOrgAccess(req, res, team.organizationId);
    if (!allowed) return;

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    let teamMember;
    if (existing) {
      teamMember = await prisma.teamMember.update({
        where: { id: existing.id },
        data: { role: role || "MEMBER", isActive: true, deletedAt: null },
      });
    } else {
      teamMember = await prisma.teamMember.create({
        data: { teamId, userId, role: role || "MEMBER", isActive: true },
      });
    }

    // Best-effort: add the member to the org's daily-dose-bot channel.
    try {
      const memberUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { slackUserId: true },
      });
      if (memberUser?.slackUserId) {
        await channelService.inviteUserToOrgChannel(
          slackClient,
          team.organizationId,
          memberUser.slackUserId
        );
      }
    } catch (channelErr) {
      console.error(
        "POST /team-members channel invite (best-effort) failed:",
        channelErr.message
      );
    }

    res.status(201).json({
      teamMemberId: teamMember.id,
      id: teamId,
      name: team.name,
      role: teamMember.role,
    });
  } catch (err) {
    console.error("POST /team-members error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/team-members/:id — remove user from a team (soft delete)
router.delete("/team-members/:id", requireAuth, async (req, res) => {
  try {
    const teamMember = await prisma.teamMember.findUnique({
      where: { id: req.params.id },
      include: { team: { select: { organizationId: true } } },
    });
    if (!teamMember || teamMember.deletedAt)
      return res.status(404).json({ error: "Not found" });
    const allowed = await verifyOrgAccess(
      req,
      res,
      teamMember.team.organizationId
    );
    if (!allowed) return;

    await prisma.teamMember.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /team-members/:id error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/holidays?orgId=
router.get("/holidays", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const holidays = await prisma.holiday.findMany({
      where: { organization_id: orgId },
      orderBy: { date: "asc" },
    });
    res.json(holidays);
  } catch (err) {
    console.error("GET /holidays error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/holidays
router.post("/holidays", requireAuth, async (req, res) => {
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
        description,
      },
    });
    res.json(holiday);
  } catch (err) {
    console.error("POST /holidays error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/holidays/:id
router.put("/holidays/:id", requireAuth, async (req, res) => {
  try {
    const holiday = await prisma.holiday.findUnique({
      where: { id: req.params.id },
      select: { organization_id: true },
    });
    if (!holiday) return res.status(404).json({ error: "Not found" });
    const allowed = await verifyOrgAccess(req, res, holiday.organization_id);
    if (!allowed) return;
    const { name, date, description } = req.body;
    const updated = await prisma.holiday.update({
      where: { id: req.params.id },
      data: { name, date: new Date(date), description },
    });
    res.json(updated);
  } catch (err) {
    console.error("PUT /holidays/:id error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/holidays/:id
router.delete("/holidays/:id", requireAuth, async (req, res) => {
  try {
    const holiday = await prisma.holiday.findUnique({
      where: { id: req.params.id },
      select: { organization_id: true },
    });
    if (!holiday) return res.status(404).json({ error: "Not found" });
    const allowed = await verifyOrgAccess(req, res, holiday.organization_id);
    if (!allowed) return;
    await prisma.holiday.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /holidays/:id error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/holidays/import/preview (multipart: file, orgId)
// Org-scoped (OWNER/ADMIN), matching the rest of the holiday CRUD routes.
// Accepted risk: `xlsx` (SheetJS) has open prototype-pollution/ReDoS
// advisories with no fixed npm release, and it parses caller-chosen bytes
// inside this shared multi-tenant process — so an org admin can reach a
// parser whose blast radius is every org on the box. Bounded by the 5 MB cap
// and an authenticated org admin/owner session. See docs/admin-panel.md.
router.post(
  "/holidays/import/preview",
  requireAuth,
  (req, res, next) => {
    holidayImportUpload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      const { orgId } = req.body;
      const allowed = await verifyOrgAccess(req, res, orgId);
      if (!allowed) return;

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      let parsed;
      try {
        parsed = holidayImportService.parseHolidayFile(
          req.file.buffer,
          req.file.originalname
        );
      } catch (parseErr) {
        return res.status(400).json({ error: parseErr.message });
      }

      const { records, truncated } = holidayImportService.expandToDailyRecords(
        parsed.rows
      );
      const warnings = [...parsed.warnings];
      if (truncated > 0) {
        warnings.push(
          `Only the first ${holidayImportService.MAX_TOTAL_RECORDS} holiday days were kept; ${truncated} more were dropped`
        );
      }

      if (records.length === 0) {
        return res.json({ items: [], warnings });
      }

      // records are sorted by date, so the ends are the range bounds.
      const existing = await prisma.holiday.findMany({
        where: {
          organization_id: orgId,
          date: {
            gte: holidayImportService.toUtcDate(records[0].date),
            lte: holidayImportService.toUtcDate(
              records[records.length - 1].date
            ),
          },
        },
      });
      const items = holidayImportService.diffAgainstExisting(records, existing);

      res.json({ items, warnings });
    } catch (err) {
      console.error("POST /holidays/import/preview error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/admin/holidays/import ({ orgId, items: [{ date, name, description }] })
// Org-scoped, same tier as the preview route above. This one takes JSON, not a
// file, so it never reaches the xlsx parser.
router.post("/holidays/import", requireAuth, async (req, res) => {
  try {
    const { orgId, items } = req.body;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No holidays to import" });
    }
    if (items.length > holidayImportService.MAX_TOTAL_RECORDS) {
      return res.status(400).json({ error: "Too many holidays in one import" });
    }

    const { valid, skipped } = holidayImportService.normalizeImportItems(items);

    if (valid.length === 0) {
      return res.status(400).json({ error: "No valid holidays to import" });
    }

    const existing = await prisma.holiday.findMany({
      where: {
        organization_id: orgId,
        date: { in: valid.map((v) => v.date) },
      },
      select: { date: true },
    });
    const existingDates = new Set(
      existing.map((h) => holidayImportService.toDateKey(h.date))
    );

    // An imported row is a manual upload even when the file came out of
    // Zoho, so it's tagged MANUAL and any Zoho externalId is cleared — the
    // nightly sync stays authoritative and will re-tag ZOHO if it still
    // returns that date.
    await prisma.$transaction(
      valid.map((v) =>
        prisma.holiday.upsert({
          where: {
            organization_id_date: {
              organization_id: orgId,
              date: v.date,
            },
          },
          update: {
            name: v.name,
            description: v.description,
            source: "MANUAL",
            externalId: null,
          },
          create: {
            id: crypto.randomUUID(),
            organization_id: orgId,
            date: v.date,
            name: v.name,
            description: v.description,
            source: "MANUAL",
          },
        })
      )
    );

    const updated = valid.filter((v) =>
      existingDates.has(holidayImportService.toDateKey(v.date))
    ).length;

    res.json({
      created: valid.length - updated,
      updated,
      skipped,
      total: valid.length,
    });
  } catch (err) {
    console.error("POST /holidays/import error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/standups?orgId=&startDate=&endDate=
router.get("/standups", requireAuth, async (req, res) => {
  try {
    const { orgId, startDate, endDate } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const gte = new Date(
      startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    const lte = new Date(endDate || new Date());
    const posts = await prisma.standupPost.findMany({
      where: {
        team: { organizationId: orgId },
        standupDate: { gte, lte },
      },
      include: {
        team: { select: { id: true, name: true } },
      },
      orderBy: { standupDate: "desc" },
    });
    const teamMemberCounts = await prisma.teamMember.groupBy({
      by: ["teamId"],
      where: { team: { organizationId: orgId }, isActive: true },
      _count: { id: true },
    });
    const countMap = Object.fromEntries(
      teamMemberCounts.map((t) => [t.teamId, t._count.id])
    );
    const responseCounts = await prisma.standupResponse.groupBy({
      by: ["teamId", "standupDate"],
      where: {
        team: { organizationId: orgId },
        standupDate: { gte, lte },
      },
      _count: { id: true },
    });
    const submittedMap = Object.fromEntries(
      responseCounts.map((r) => [
        `${r.teamId}_${r.standupDate.toISOString()}`,
        r._count.id,
      ])
    );
    res.json(
      posts.map((p) => ({
        id: p.id,
        teamId: p.team.id,
        teamName: p.team.name,
        standupDate: p.standupDate,
        submittedCount:
          submittedMap[`${p.teamId}_${p.standupDate.toISOString()}`] ?? 0,
        totalMembers: countMap[p.team.id] || 0,
        postedAt: p.postedAt,
      }))
    );
  } catch (err) {
    console.error("GET /standups error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/standups/:teamId/:date
router.get("/standups/:teamId/:date", requireAuth, async (req, res) => {
  try {
    const { teamId, date } = req.params;
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { organizationId: true },
    });
    if (!team) return res.status(404).json({ error: "Not found" });
    const allowed = await verifyOrgAccess(req, res, team.organizationId);
    if (!allowed) return;
    const responses = await prisma.standupResponse.findMany({
      where: { teamId, standupDate: new Date(date) },
      include: { user: { select: { slackUserId: true, username: true } } },
      orderBy: { submittedAt: "asc" },
    });
    res.json(
      responses.map((r) => ({
        id: r.id,
        user: {
          slackUserId: r.user.slackUserId,
          name: r.user.username || r.user.slackUserId,
        },
        yesterdayTasks: r.yesterdayTasks,
        todayTasks: r.todayTasks,
        blockers: r.blockers,
        hasBlockers: r.hasBlockers,
        isLate: r.isLate,
        submittedAt: r.submittedAt,
      }))
    );
  } catch (err) {
    console.error("GET /standups/:teamId/:date error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/scheduler?orgId=
router.get("/scheduler", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const teams = await prisma.team.findMany({
      where: { organizationId: orgId, isActive: true },
      select: {
        id: true,
        name: true,
        standupTime: true,
        postingTime: true,
        timezone: true,
      },
    });
    const jobs = schedulerService.scheduledJobs || new Map();
    const teamNameSlug = (name) => name.toLowerCase().replace(/\s+/g, "-");
    res.json(
      teams.map((t) => ({
        teamId: t.id,
        teamName: t.name,
        standupTime: t.standupTime,
        postingTime: t.postingTime,
        timezone: t.timezone,
        reminderJobActive: jobs.has(`dd-${teamNameSlug(t.name)}`),
        postJobActive: jobs.has(`posting-${t.id}`),
      }))
    );
  } catch (err) {
    console.error("GET /scheduler error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Zoho People integration ─────────────────────────────────────────────────
// Org-scoped, same tier as the /dd-zoho-* slash commands (org OWNER/ADMIN).

// GET /api/admin/zoho?orgId= — credential state, latest run per type, mappings
router.get("/zoho", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;

    const credential = await prisma.zohoCredential.findUnique({
      where: { organizationId: orgId },
      // Never send refreshToken/accessToken to the browser.
      select: { enabled: true, dataCenter: true },
    });

    // One query per type rather than one capped list — a burst of runs of one
    // type would otherwise push the other out of the window and read as
    // "never synced". Mirrors /dd-zoho-sync-status.
    const [holidayRun, leaveRun] = await Promise.all(
      ["HOLIDAY", "LEAVE"].map((syncType) =>
        prisma.zohoSyncRun.findFirst({
          where: { organizationId: orgId, syncType },
          orderBy: { startedAt: "desc" },
        })
      )
    );

    const mappings = await zohoMappingService.listMappings(orgId);

    res.json({
      credential,
      runs: {
        HOLIDAY: serializeSyncRun(holidayRun),
        LEAVE: serializeSyncRun(leaveRun),
      },
      mappings: mappings.map((m) => ({
        id: m.id,
        userId: m.userId,
        slackUserId: m.user.slackUserId,
        name: m.user.name || m.user.username || m.user.slackUserId,
        zohoEmployeeId: m.zohoEmployeeId,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error("GET /zoho error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/zoho/mappings ({ orgId, slackUserId, zohoEmployeeId })
router.post("/zoho/mappings", requireAuth, async (req, res) => {
  try {
    const { orgId, slackUserId, zohoEmployeeId } = req.body;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;

    if (!slackUserId || typeof slackUserId !== "string") {
      return res.status(400).json({ error: "A Slack user is required" });
    }

    // zohoMappingService.mapMember() goes through userService.findOrCreateUser(),
    // which *creates* a User for an unknown Slack ID — and fetchSlackUserData()
    // swallows a failed users.info lookup, so a typo would silently mint an
    // empty orphan User. In Slack that can't happen (the ID comes from a
    // resolved mention); through a web form it can. Same guard POST /members
    // uses, plus a membership check: mapping annotates an existing org member,
    // it is not a way to add one.
    const user = await prisma.user.findUnique({
      where: { slackUserId: slackUserId.trim() },
    });
    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found. They must sign in to the bot first." });
    }
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: user.id },
      },
    });
    if (!membership || !membership.isActive) {
      return res.status(400).json({
        error: "That user is not an active member of this organization",
      });
    }

    const mapping = await zohoMappingService.mapMember(
      orgId,
      slackUserId.trim(),
      typeof zohoEmployeeId === "string" ? zohoEmployeeId.trim() : "",
      slackClient
    );
    res.json({ id: mapping.id, zohoEmployeeId: mapping.zohoEmployeeId });
  } catch (err) {
    if (err.userFacing) return res.status(400).json({ error: err.message });
    console.error("POST /zoho/mappings error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/zoho/mappings/:id
router.delete("/zoho/mappings/:id", requireAuth, async (req, res) => {
  try {
    const mapping = await prisma.zohoUserMapping.findUnique({
      where: { id: req.params.id },
      select: { id: true, organizationId: true },
    });
    if (!mapping) return res.status(404).json({ error: "Not found" });
    // Authorize against the mapping's own org, never a caller-supplied one.
    const allowed = await verifyOrgAccess(req, res, mapping.organizationId);
    if (!allowed) return;

    // Deleted by primary key rather than via zohoMappingService.unmapMember():
    // the row is already fetched and authorized here, so the service's
    // slackUserId re-lookup and (org, user) deleteMany would add two queries
    // and re-validate what we just proved.
    await prisma.zohoUserMapping.delete({ where: { id: mapping.id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.userFacing) return res.status(400).json({ error: err.message });
    console.error("DELETE /zoho/mappings/:id error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/zoho/sync ({ orgId, type: 'HOLIDAY' | 'LEAVE' | 'ALL' })
// Runs the same sync the nightly cron does, on demand. Synchronous: it calls
// Zoho and upserts before responding, so the operator sees real counts rather
// than a fire-and-forget "started". Expect it to take seconds, not ms.
router.post("/zoho/sync", requireAuth, async (req, res) => {
  try {
    const { orgId, type = "ALL" } = req.body;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;

    if (!["HOLIDAY", "LEAVE", "ALL"].includes(type)) {
      return res.status(400).json({ error: "Invalid sync type" });
    }

    const runners = {
      HOLIDAY: zohoSyncService.syncHolidaysForOrganization,
      LEAVE: zohoSyncService.syncLeavesForOrganization,
    };
    const types = type === "ALL" ? ["HOLIDAY", "LEAVE"] : [type];

    // Caught per type, the way syncAllOrganizations does it: a holiday failure
    // must not erase a leave sync that already landed. ZohoAuthError /
    // ZohoApiError carry actionable setup detail (missing credential, revoked
    // token, insufficient Zoho permissions) and are passed through; anything
    // else is logged and generalized. Either way the sync already recorded a
    // FAILED ZohoSyncRun before rethrowing.
    const results = {};
    const errors = {};
    let anyUnexpected = false;

    for (const syncType of types) {
      try {
        results[syncType] = await runners[syncType](orgId);
      } catch (err) {
        if (err.name === "ZohoAuthError" || err.name === "ZohoApiError") {
          errors[syncType] = err.message;
        } else {
          console.error(`POST /zoho/sync ${syncType} error:`, err.message);
          errors[syncType] = "Sync failed — check the server logs";
          anyUnexpected = true;
        }
      }
    }

    // Only a total failure is an error response — a partial run still reports
    // what actually synced.
    if (Object.keys(results).length === 0) {
      return res
        .status(anyUnexpected ? 500 : 400)
        .json({ error: Object.values(errors)[0], errors });
    }

    res.json({ ...results, errors });
  } catch (err) {
    console.error("POST /zoho/sync error:", err.message);
    res.status(500).json({ error: "Sync failed — check the server logs" });
  }
});

// GET /api/admin/activity?orgId=&limit=50
router.get("/activity", requireAuth, async (req, res) => {
  try {
    const { orgId, limit = "50" } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;
    const responses = await prisma.standupResponse.findMany({
      where: { team: { organizationId: orgId } },
      include: {
        user: { select: { slackUserId: true, username: true } },
        team: { select: { name: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: Math.min(parseInt(limit, 10) || 50, 200),
    });
    res.json(
      responses.map((r) => ({
        type: "standup_submitted",
        user: r.user.username || r.user.slackUserId,
        team: r.team.name,
        date: r.standupDate,
        isLate: r.isLate,
        timestamp: r.submittedAt,
      }))
    );
  } catch (err) {
    console.error("GET /activity error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/stats/charts?orgId=&days=30 — time series behind the
// dashboard charts. One endpoint rather than four: the dashboard renders them
// together, and they share the same window and the same join.
//
// NOTE on the completion rate: `activeMembers` is the org's *current* active
// team-member count. Historical membership isn't tracked, so a day before
// someone joined is measured against today's roster and reads low. The
// dashboard's existing "Today's Completion" stat already works this way; the
// chart labels it as approximate rather than silently implying otherwise.
router.get("/stats/charts", requireAuth, async (req, res) => {
  try {
    const { orgId, days = "30" } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;

    const window = Math.min(Math.max(parseInt(days, 10) || 30, 7), 90);
    const since = new Date(Date.now() - window * 24 * 60 * 60 * 1000);
    since.setUTCHours(0, 0, 0, 0);

    const [daily, byTeam, activity, activeMembers] = await Promise.all([
      prisma.$queryRaw`
        SELECT r.standup_date::date AS day,
               COUNT(*)::int AS submitted,
               COUNT(*) FILTER (WHERE r.is_late)::int AS late
        FROM standup_responses r
        JOIN teams t ON t.id = r.team_id
        WHERE t.organization_id = ${orgId}
          AND t.deleted_at IS NULL
          AND r.deleted_at IS NULL
          AND r.standup_date >= ${since}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.$queryRaw`
        SELECT t.name AS team,
               COUNT(*)::int AS submitted,
               COUNT(*) FILTER (WHERE r.is_late)::int AS late
        FROM standup_responses r
        JOIN teams t ON t.id = r.team_id
        WHERE t.organization_id = ${orgId}
          AND t.deleted_at IS NULL
          AND r.deleted_at IS NULL
          AND r.standup_date >= ${since}
        GROUP BY 1
        ORDER BY 2 DESC
      `,
      prisma.$queryRaw`
        SELECT COALESCE(u.name, u.username, u.slack_user_id) AS member,
               r.standup_date::date AS day,
               BOOL_OR(r.is_late) AS late
        FROM standup_responses r
        JOIN teams t ON t.id = r.team_id
        JOIN users u ON u.id = r.user_id
        WHERE t.organization_id = ${orgId}
          AND t.deleted_at IS NULL
          AND r.deleted_at IS NULL
          AND r.standup_date >= ${since}
        GROUP BY 1, 2
        ORDER BY 1 ASC, 2 ASC
      `,
      prisma.teamMember.count({
        where: { team: { organizationId: orgId }, isActive: true },
      }),
    ]);

    const toDay = (d) => d.toISOString().slice(0, 10);

    res.json({
      days: window,
      activeMembers,
      daily: daily.map((r) => ({
        day: toDay(r.day),
        submitted: r.submitted,
        late: r.late,
      })),
      byTeam: byTeam.map((r) => ({
        team: r.team,
        submitted: r.submitted,
        late: r.late,
        onTime: r.submitted - r.late,
      })),
      activity: activity.map((r) => ({
        member: r.member,
        day: toDay(r.day),
        late: r.late,
      })),
    });
  } catch (err) {
    console.error("GET /stats/charts error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/mcp-usage — per-user MCP tool-call counts per day.
// A user in several orgs has their calls counted under each: the write path
// records no org, so membership is joined at read time.
router.get("/mcp-usage", requireAuth, async (req, res) => {
  try {
    const { orgId, days = "30" } = req.query;
    const allowed = await verifyOrgAccess(req, res, orgId);
    if (!allowed) return;

    const window = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
    const since = new Date(Date.now() - window * 24 * 60 * 60 * 1000);

    const rows = await prisma.$queryRaw`
      SELECT COALESCE(u.username, u.slack_user_id) AS user,
             DATE_TRUNC('day', c.created_at)::date AS day,
             COUNT(*)::int AS count
      FROM mcp_tool_calls c
      JOIN users u ON u.id = c.user_id
      JOIN organization_members m ON m.user_id = c.user_id
      WHERE m.organization_id = ${orgId}
        AND m.is_active = true
        AND c.created_at >= ${since}
      GROUP BY 1, 2
      ORDER BY 2 ASC
    `;

    res.json(
      rows.map((r) => ({
        user: r.user,
        day: r.day.toISOString().slice(0, 10),
        count: r.count,
      }))
    );
  } catch (err) {
    console.error("GET /mcp-usage error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Personal access tokens (self-service) ──────────────────────────────
// These routes are scoped to the logged-in admin user (req.adminUser) and
// let any signed-in member manage their OWN MCP tokens and OAuth connections
// from the admin panel — no org/super-admin gate, just an authenticated
// session. They mirror the public /api/mcp/* surface.

// GET /api/admin/tokens — list the caller's MCP tokens (no secrets)
router.get("/tokens", requireAuth, async (req, res) => {
  try {
    res.json(await mcpTokenService.listTokens(req.adminUser.id));
  } catch (err) {
    console.error("GET /tokens error:", err.message);
    res.status(500).json({ error: "Failed to list tokens" });
  }
});

// POST /api/admin/tokens — mint a token (raw value returned ONCE)
router.post("/tokens", requireAuth, async (req, res) => {
  try {
    const name =
      typeof req.body?.name === "string" ? req.body.name.slice(0, 100) : null;
    const { rawToken, id, expiresAt } = await mcpTokenService.mintToken(
      req.adminUser.id,
      name
    );
    res.status(201).json({ id, token: rawToken, expiresAt });
  } catch (err) {
    console.error("POST /tokens error:", err.message);
    res.status(500).json({ error: "Failed to mint token" });
  }
});

// DELETE /api/admin/tokens/:id — revoke one of the caller's tokens
router.delete("/tokens/:id", requireAuth, async (req, res) => {
  try {
    await mcpTokenService.revokeToken(req.adminUser.id, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /tokens/:id error:", err.message);
    res.status(500).json({ error: "Failed to revoke token" });
  }
});

// GET /api/admin/connections — list the caller's connected OAuth clients
router.get("/connections", requireAuth, async (req, res) => {
  try {
    res.json(await oauthTokenService.listConnections(req.adminUser.id));
  } catch (err) {
    console.error("GET /connections error:", err.message);
    res.status(500).json({ error: "Failed to list connections" });
  }
});

// DELETE /api/admin/connections/:clientId — revoke all grants for one client
router.delete("/connections/:clientId", requireAuth, async (req, res) => {
  try {
    await oauthTokenService.revokeConnection(
      req.adminUser.id,
      req.params.clientId
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /connections/:clientId error:", err.message);
    res.status(500).json({ error: "Failed to revoke connection" });
  }
});

module.exports = { router, requireAuth, requireSuperAdmin };
