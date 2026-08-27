const jwt = require('jsonwebtoken');

const DEFAULT_SECRET_MARKERS = ['dev-secret-change-me', 'change-this-secret-in-production-please'];

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Fail fast in production if someone forgot to set a real secret; warn loudly
// everywhere else so it isn't missed during setup.
if (!process.env.JWT_SECRET || DEFAULT_SECRET_MARKERS.includes(process.env.JWT_SECRET)) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is missing or using a known default value. Refusing to start in production. ' +
      'Set a strong, unique JWT_SECRET in server/.env before deploying.'
    );
  }
  // eslint-disable-next-line no-console
  console.warn(
    '\n[SECURITY WARNING] JWT_SECRET is missing or using a known default value.\n' +
    'This is only acceptable for local development. Generate a strong secret before deploying:\n' +
    '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n'
  );
}

const COOKIE_NAME = 'tmtp_token';

// The auth token is read from an httpOnly cookie (preferred — not reachable
// from JavaScript, so an XSS bug can't steal it) with a Bearer-header
// fallback for non-browser API clients / tooling.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const headerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = (req.cookies && req.cookies[COOKIE_NAME]) || headerToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, username, role, fullName }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

// Restricts a route to one or more roles. Must run after requireAuth.
// Usage: router.delete('/:id', requireAuth, requireRole('ADMIN'), handler)
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET, COOKIE_NAME };
