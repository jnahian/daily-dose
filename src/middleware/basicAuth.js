/**
 * Basic HTTP Authentication Middleware
 *
 * Provides HTTP Basic Authentication for protected routes.
 * Credentials are configurable via environment variables.
 */

/**
 * Basic auth middleware for protecting routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
function basicAuth(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Scripts Documentation"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  // Get credentials from environment variables with fallback defaults
  const validUsername = process.env.SCRIPTS_AUTH_USERNAME || 'admin';
  const validPassword = process.env.SCRIPTS_AUTH_PASSWORD || 'daily-dose-admin';

  if (username === validUsername && password === validPassword) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Scripts Documentation"');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
}

module.exports = { basicAuth };