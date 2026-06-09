const jwt = require('jsonwebtoken');

/** Verify an access token, returning the decoded payload or null (never throws). */
function verifyAccessToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

/** Best-effort: decoded payload from a request's Bearer header, or null. */
function bearerPayload(req) {
  const header = req && req.headers && req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return verifyAccessToken(header.slice(7));
}

module.exports = { verifyAccessToken, bearerPayload };
