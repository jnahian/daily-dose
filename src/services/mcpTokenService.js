const crypto = require("crypto");
const prisma = require("../config/prisma");

const TOKEN_PREFIX = "ddm_";
const DEFAULT_TTL_DAYS = 90;

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function mintToken(userId, name = null, ttlDays = DEFAULT_TTL_DAYS) {
  const rawToken = TOKEN_PREFIX + crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const record = await prisma.mcp_tokens.create({
    data: {
      user_id: userId,
      token_hash: hashToken(rawToken),
      name,
      expires_at: expiresAt,
    },
  });

  // Raw token is returned ONCE; only the hash is persisted.
  return { rawToken, id: record.id, expiresAt };
}

async function validateToken(rawToken) {
  if (!rawToken || !rawToken.startsWith(TOKEN_PREFIX)) return null;

  const record = await prisma.mcp_tokens.findUnique({
    where: { token_hash: hashToken(rawToken) },
    include: { users: true },
  });

  if (!record || !record.users) return null;
  if (record.revoked_at) return null;
  if (record.expires_at <= new Date()) return null;

  await prisma.mcp_tokens.update({
    where: { id: record.id },
    data: { last_used_at: new Date() },
  });

  return record.users;
}

async function listTokens(userId) {
  return prisma.mcp_tokens.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      name: true,
      expires_at: true,
      revoked_at: true,
      last_used_at: true,
      created_at: true,
    },
  });
}

async function revokeToken(userId, tokenId) {
  // Scope by user_id so a caller can only revoke their own tokens.
  return prisma.mcp_tokens.updateMany({
    where: { id: tokenId, user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

module.exports = {
  hashToken,
  mintToken,
  validateToken,
  listTokens,
  revokeToken,
};
