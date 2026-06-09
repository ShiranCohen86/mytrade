const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Permission map — each role grants an ordered set of capabilities
const ROLE_PERMISSIONS = {
  super_admin: [
    'users.read', 'users.write', 'logs.read', 'logs.export',
    'system.config', 'watchlist.edit', 'user.suspend', 'audit.read',
    'notifications.read', 'notifications.send',
  ],
  admin: [
    'users.read', 'users.write', 'logs.read', 'logs.export',
    'watchlist.edit', 'user.suspend', 'audit.read',
    'notifications.read', 'notifications.send',
  ],
  support_agent: ['users.read', 'logs.read', 'watchlist.edit'],
  analyst: ['logs.read', 'logs.export', 'audit.read', 'notifications.read'],
  user: [],
};

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'support_agent', 'analyst']);

/**
 * Returns Express middleware that:
 *  1. Verifies the Bearer JWT
 *  2. Loads the user from DB (so role changes take effect immediately)
 *  3. Checks the user has the required permission(s)
 *
 * @param {string|string[]} required  One or more permission strings
 */
function adminAuth(required) {
  const needed = Array.isArray(required) ? required : [required];

  return async function (req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const token = header.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    let user;
    try {
      user = await User.findById(payload.sub).lean();
    } catch {
      return res.status(500).json({ error: 'Authentication check failed.' });
    }

    if (!user) return res.status(401).json({ error: 'User not found.' });
    if (!ADMIN_ROLES.has(user.role)) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    if (user.isSuspended) {
      return res.status(403).json({ error: 'Account is suspended.' });
    }

    const granted = ROLE_PERMISSIONS[user.role] || [];
    const missing = needed.filter((p) => !granted.includes(p));
    if (missing.length > 0) {
      return res.status(403).json({
        error: `Insufficient permissions. Required: ${missing.join(', ')}.`,
      });
    }

    // Attach full admin user context for downstream handlers
    req.adminUser = {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      permissions: granted,
    };
    // Also attach req.user so existing helpers work
    req.user = { id: user._id.toString(), email: user.email, displayName: user.displayName };

    next();
  };
}

adminAuth.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
adminAuth.ADMIN_ROLES = ADMIN_ROLES;

module.exports = adminAuth;
