/**
 * Resolves a campaign audience into a concrete list of recipient userIds, and
 * provides a cached recipient-count preview for the compose/confirm UI.
 *
 * Segments are derived from existing data (no extra denormalization beyond
 * User.lastActiveAt):
 *   active        — active in the last 7 days
 *   inactive      — no activity for 30+ days (or never)
 *   new           — signed up in the last 7 days
 *   returning     — signed up >7 days ago but active in the last 7 days
 *   pwa_installed — has launched the installed (standalone) PWA
 *   notif_enabled — has at least one push subscription
 */
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const AnalyticsEvent = require('../models/AnalyticsEvent');

const DAY = 24 * 60 * 60 * 1000;
const ACTIVE_DAYS = 7;
const INACTIVE_DAYS = 30;
const NEW_DAYS = 7;

const countCache = new Map(); // key -> { count, exp }
const CACHE_MS = 30 * 1000;

const ago = (days) => new Date(Date.now() - days * DAY);
const ids = (docs) => docs.map((d) => String(d._id));

async function nonSuspendedSubset(idList) {
  if (!idList.length) return [];
  const users = await User.find({ _id: { $in: idList }, isSuspended: { $ne: true } })
    .select('_id').lean();
  return ids(users);
}

async function resolveSegment(segment) {
  const base = { isSuspended: { $ne: true } };
  switch (segment) {
    case 'active':
      return ids(await User.find({ ...base, lastActiveAt: { $gte: ago(ACTIVE_DAYS) } }).select('_id').lean());
    case 'inactive':
      return ids(await User.find({
        ...base,
        $or: [{ lastActiveAt: { $lt: ago(INACTIVE_DAYS) } }, { lastActiveAt: null }],
      }).select('_id').lean());
    case 'new':
      return ids(await User.find({ ...base, createdAt: { $gte: ago(NEW_DAYS) } }).select('_id').lean());
    case 'returning':
      return ids(await User.find({
        ...base,
        createdAt: { $lt: ago(NEW_DAYS) },
        lastActiveAt: { $gte: ago(ACTIVE_DAYS) },
      }).select('_id').lean());
    case 'pwa_installed': {
      const list = await AnalyticsEvent.distinct('userId', { standalone: true, userId: { $ne: null } });
      return nonSuspendedSubset(list);
    }
    case 'notif_enabled': {
      const list = await PushSubscription.distinct('userId');
      return nonSuspendedSubset(list);
    }
    default:
      return [];
  }
}

/** Resolve an audience descriptor → array of recipient userId strings. */
async function resolveUserIds(audience = {}) {
  switch (audience.mode) {
    case 'single':
    case 'multiple':
      return nonSuspendedSubset((audience.userIds || []).map(String));
    case 'all':
      return ids(await User.find({ isSuspended: { $ne: true } }).select('_id').lean());
    case 'segment':
      return resolveSegment(audience.segment);
    default:
      return [];
  }
}

/** Recipient count for a given audience (30s cached for snappy live previews). */
async function previewCount(audience = {}) {
  const key = JSON.stringify(audience);
  const hit = countCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.count;
  const list = await resolveUserIds(audience);
  const count = list.length;
  countCache.set(key, { count, exp: Date.now() + CACHE_MS });
  if (countCache.size > 500) countCache.clear();
  return count;
}

module.exports = { resolveUserIds, previewCount };
