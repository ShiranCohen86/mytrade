/**
 * withCronLock(name, ttlMs, fn) — run `fn` only if no other process is currently
 * running the same job. The lock auto-expires after `ttlMs` (so a crashed/hung run
 * can't wedge the job forever) and is released as soon as `fn` settles. Logs a
 * warning if a run overruns its TTL (a signal the job is getting too slow for its
 * interval). On any lock-system error we fail OPEN (run anyway) so a transient DB
 * blip can't silently halt all scheduled work.
 */
const CronLock = require('../models/CronLock');
const logger = require('../utils/logger');

async function acquire(name, ttlMs) {
  const now = new Date();
  const until = new Date(now.getTime() + ttlMs);
  // Take over an existing free/expired lock atomically…
  const taken = await CronLock.findOneAndUpdate(
    { _id: name, lockedUntil: { $lte: now } },
    { $set: { lockedUntil: until, startedAt: now } },
    { new: true }
  );
  if (taken) return true;
  // …otherwise it either doesn't exist yet (first run) or is still held.
  try {
    await CronLock.create({ _id: name, lockedUntil: until, startedAt: now });
    return true;
  } catch (err) {
    if (err && err.code === 11000) return false; // exists & still locked → held elsewhere
    throw err;
  }
}

async function release(name) {
  // Mark expired so the next scheduled tick can re-acquire immediately.
  await CronLock.updateOne({ _id: name }, { $set: { lockedUntil: new Date(0) } });
}

async function withCronLock(name, ttlMs, fn) {
  let acquired;
  try {
    acquired = await acquire(name, ttlMs);
  } catch (err) {
    logger.warn('[cronlock] acquire failed — running unguarded', { name, err: err.message });
    acquired = true; // fail open
  }
  if (!acquired) {
    logger.info(`[cronlock] ${name} skipped — already running in another process`);
    return undefined;
  }

  const startedAt = Date.now();
  try {
    return await fn();
  } finally {
    const elapsed = Date.now() - startedAt;
    if (elapsed > ttlMs) {
      logger.warn(`[cronlock] ${name} overran its lock window`, {
        ranMs: elapsed, ttlMs,
      });
    }
    try { await release(name); } catch { /* lock will self-expire */ }
  }
}

module.exports = { withCronLock };
