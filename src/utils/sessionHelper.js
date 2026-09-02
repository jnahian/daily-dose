const crypto = require("crypto");
const prisma = require("../config/prisma");

/**
 * Mint a `sessions` row for `user` and set it as an httpOnly cookie. Shared by
 * the admin panel and the MCP token page, which differ only in cookie name
 * and lifetime.
 * @param {{id: string}} user
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {{cookieName: string, ttlMs: number}} opts
 * @returns {Promise<void>}
 */
async function createSession(user, req, res, { cookieName, ttlMs }) {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.sessions.create({
    data: {
      id: crypto.randomUUID(),
      user_id: user.id,
      token,
      expires_at: new Date(Date.now() + ttlMs),
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    },
  });
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: ttlMs,
    sameSite: "lax",
  });
}

module.exports = { createSession };
