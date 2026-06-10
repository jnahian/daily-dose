const crypto = require("crypto");

function timingSafeEqualString(a, b) {
  const ah = crypto.createHash("sha256").update(String(a), "utf8").digest();
  const bh = crypto.createHash("sha256").update(String(b), "utf8").digest();
  return crypto.timingSafeEqual(ah, bh);
}

function createBasicAuth() {
  const validUsername = process.env.SCRIPTS_AUTH_USERNAME;
  const validPassword = process.env.SCRIPTS_AUTH_PASSWORD;

  if (!validUsername || !validPassword) {
    throw new Error(
      "SCRIPTS_AUTH_USERNAME and SCRIPTS_AUTH_PASSWORD must be set in env to enable /scripts auth. See DEPLOYMENT.md."
    );
  }

  return function basicAuth(req, res, next) {
    const auth = req.headers && req.headers.authorization;
    if (!auth || !auth.startsWith("Basic ")) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Scripts Documentation"');
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
    const idx = decoded.indexOf(":");
    if (idx === -1) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Scripts Documentation"');
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const username = decoded.slice(0, idx);
    const password = decoded.slice(idx + 1);

    if (
      timingSafeEqualString(username, validUsername) &&
      timingSafeEqualString(password, validPassword)
    ) {
      return next();
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="Scripts Documentation"');
    return res.status(401).json({ error: "Invalid credentials" });
  };
}

module.exports = { createBasicAuth };
