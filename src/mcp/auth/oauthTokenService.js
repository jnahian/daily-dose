const crypto = require("crypto");
const prisma = require("../../config/prisma");

const ACCESS_PREFIX = "mcat_";
const REFRESH_PREFIX = "mcrt_";
const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_DAYS = 90;

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function randomToken(prefix) {
  return prefix + crypto.randomBytes(32).toString("hex");
}

function accessExpiry() {
  return new Date(Date.now() + ACCESS_TTL_SECONDS * 1000);
}
function refreshExpiry() {
  return new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function mintGrant({ userId, clientId, scope = null, resource = null }) {
  const accessToken = randomToken(ACCESS_PREFIX);
  const refreshToken = randomToken(REFRESH_PREFIX);
  await prisma.oauth_tokens.create({
    data: {
      client_id: clientId,
      user_id: userId,
      access_token_hash: hashToken(accessToken),
      refresh_token_hash: hashToken(refreshToken),
      scope,
      resource,
      access_token_expires_at: accessExpiry(),
      refresh_token_expires_at: refreshExpiry(),
    },
  });
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

async function verifyAccessToken(raw) {
  if (!raw || !raw.startsWith(ACCESS_PREFIX)) return null;
  const row = await prisma.oauth_tokens.findUnique({
    where: { access_token_hash: hashToken(raw) },
    include: { user: true },
  });
  if (!row || !row.user) return null;
  if (row.revoked_at) return null;
  if (row.access_token_expires_at <= new Date()) return null;
  await prisma.oauth_tokens.update({
    where: { id: row.id },
    data: { last_used_at: new Date() },
  });
  return { row, user: row.user };
}

// Rotate in place: the connection row keeps its identity; old tokens stop matching.
async function rotateRefresh(raw, clientId) {
  if (!raw || !raw.startsWith(REFRESH_PREFIX)) {
    throw new Error("invalid refresh token");
  }
  const row = await prisma.oauth_tokens.findUnique({
    where: { refresh_token_hash: hashToken(raw) },
  });
  if (!row || row.revoked_at) throw new Error("invalid refresh token");
  if (row.refresh_token_expires_at <= new Date()) {
    throw new Error("refresh token expired");
  }
  if (row.client_id !== clientId) throw new Error("client mismatch");

  const accessToken = randomToken(ACCESS_PREFIX);
  const refreshToken = randomToken(REFRESH_PREFIX);
  await prisma.oauth_tokens.update({
    where: { id: row.id },
    data: {
      access_token_hash: hashToken(accessToken),
      refresh_token_hash: hashToken(refreshToken),
      access_token_expires_at: accessExpiry(),
      refresh_token_expires_at: refreshExpiry(),
      last_used_at: new Date(),
    },
  });
  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TTL_SECONDS,
    scope: row.scope,
    resource: row.resource,
  };
}

async function revokeRawToken(raw) {
  const h = hashToken(raw);
  return prisma.oauth_tokens.updateMany({
    where: {
      OR: [{ access_token_hash: h }, { refresh_token_hash: h }],
      revoked_at: null,
    },
    data: { revoked_at: new Date() },
  });
}

async function listConnections(userId) {
  const rows = await prisma.oauth_tokens.findMany({
    where: {
      user_id: userId,
      revoked_at: null,
      refresh_token_expires_at: { gt: new Date() },
    },
    orderBy: { last_used_at: "desc" },
    include: { client: { select: { client_name: true } } },
  });
  const byClient = new Map();
  for (const r of rows) {
    if (!byClient.has(r.client_id)) {
      byClient.set(r.client_id, {
        clientId: r.client_id,
        clientName: r.client?.client_name || null,
        lastUsedAt: r.last_used_at,
        createdAt: r.created_at,
      });
    }
  }
  return [...byClient.values()];
}

async function revokeConnection(userId, clientId) {
  return prisma.oauth_tokens.updateMany({
    where: { user_id: userId, client_id: clientId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

module.exports = {
  hashToken,
  mintGrant,
  verifyAccessToken,
  rotateRefresh,
  revokeRawToken,
  listConnections,
  revokeConnection,
  ACCESS_TTL_SECONDS,
};
