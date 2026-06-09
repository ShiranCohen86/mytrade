const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function auth(req, res, next) {
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

  // Enforce account suspension immediately. The JWT claims alone can't reflect a
  // suspension applied after the (15-min) access token was issued, so verify the
  // current state with a minimal lookup.
  try {
    const user = await User.findById(payload.sub).select('isSuspended').lean();
    if (!user) return res.status(401).json({ error: 'User not found.' });
    if (user.isSuspended) return res.status(403).json({ error: 'Account is suspended.' });
  } catch {
    return res.status(500).json({ error: 'Authentication check failed.' });
  }

  req.user = { id: payload.sub, email: payload.email, displayName: payload.displayName };
  // Throttled, fire-and-forget activity bump for segmentation.
  require('../services/activityTracker').touch(payload.sub);
  next();
};
