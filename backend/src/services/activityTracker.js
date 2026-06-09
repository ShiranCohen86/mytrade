/**
 * Throttled last-activity tracker. Bumps User.lastActiveAt at most once per
 * THROTTLE_MS per user (tracked in-memory) so authenticated traffic doesn't
 * cause a DB write on every request. Fire-and-forget — never blocks or throws.
 * Powers active/inactive/returning notification segments.
 */
const User = require('../models/User');

const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TRACKED = 50_000;
const lastBump = new Map(); // userId(string) -> epoch ms

function touch(userId) {
  if (!userId) return;
  const id = String(userId);
  const now = Date.now();
  const prev = lastBump.get(id);
  if (prev && now - prev < THROTTLE_MS) return;
  lastBump.set(id, now);
  if (lastBump.size > MAX_TRACKED) lastBump.clear(); // bound memory
  User.updateOne({ _id: id }, { $set: { lastActiveAt: new Date() } }).catch(() => {});
}

module.exports = { touch };
