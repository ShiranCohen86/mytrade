/**
 * Anti-spam gate — the safety core that prevents notification fatigue. Every fire
 * passes through check(); a successful delivery is then recorded via record().
 *
 * Enforces: quiet hours (rule tz), global per-user caps (UserNotifyBudget),
 * per-rule×user×key cooldown + caps + dedupe (TriggerState).
 */
const TriggerState = require('../models/TriggerState');
const UserNotifyBudget = require('../models/UserNotifyBudget');
const config = require('./config');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const STATE_TTL_MS = 45 * DAY_MS;

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

function inQuietHours(quiet, now = new Date()) {
  if (!quiet || !quiet.enabled) return false;
  let cur;
  try {
    const s = new Intl.DateTimeFormat('en-GB', { timeZone: quiet.tz || 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    cur = toMinutes(s);
  } catch { cur = now.getUTCHours() * 60 + now.getUTCMinutes(); }
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  if (start === end) return false;
  return start < end ? (cur >= start && cur < end) : (cur >= start || cur < end);
}

/** Effective count given a rolling window: 0 if the window has elapsed. */
function effective(count, resetAt, now) {
  if (!resetAt || now >= new Date(resetAt).getTime()) return 0;
  return count || 0;
}

async function check(rule, userId, key, dedupeHash) {
  const now = Date.now();
  const as = rule.antiSpam || {};

  if (inQuietHours(as.quietHours)) return { allow: false, reason: 'suppressed_quiet' };

  const budget = await UserNotifyBudget.findOne({ userId }).lean();
  if (budget) {
    if (config.GLOBAL_MAX_PER_HOUR && effective(budget.hourCount, budget.hourResetAt, now) >= config.GLOBAL_MAX_PER_HOUR) {
      return { allow: false, reason: 'suppressed_global_cap' };
    }
    if (config.GLOBAL_MAX_PER_DAY && effective(budget.dayCount, budget.dayResetAt, now) >= config.GLOBAL_MAX_PER_DAY) {
      return { allow: false, reason: 'suppressed_global_cap' };
    }
  }

  const state = await TriggerState.findOne({ ruleId: rule._id, userId, key }).lean();
  if (state) {
    if (as.cooldownMinutes && state.lastFiredAt && now - new Date(state.lastFiredAt).getTime() < as.cooldownMinutes * 60000) {
      return { allow: false, reason: 'suppressed_cooldown' };
    }
    if (as.dedupe && dedupeHash && state.lastDedupeHash === dedupeHash) {
      return { allow: false, reason: 'suppressed_dedupe' };
    }
    if (as.maxPerHour && effective(state.hourCount, state.hourResetAt, now) >= as.maxPerHour) {
      return { allow: false, reason: 'suppressed_cap' };
    }
    if (as.maxPerDay && effective(state.dayCount, state.dayResetAt, now) >= as.maxPerDay) {
      return { allow: false, reason: 'suppressed_cap' };
    }
  }
  return { allow: true };
}

function roll(doc, now) {
  // Reset rolling windows in place if elapsed.
  if (!doc.hourResetAt || now >= new Date(doc.hourResetAt).getTime()) { doc.hourCount = 0; doc.hourResetAt = new Date(now + HOUR_MS); }
  if (!doc.dayResetAt || now >= new Date(doc.dayResetAt).getTime()) { doc.dayCount = 0; doc.dayResetAt = new Date(now + DAY_MS); }
}

async function record(rule, userId, key, dedupeHash) {
  const now = Date.now();

  const state = (await TriggerState.findOne({ ruleId: rule._id, userId, key }))
    || new TriggerState({ ruleId: rule._id, userId, key });
  roll(state, now);
  state.hourCount += 1;
  state.dayCount += 1;
  state.lastFiredAt = new Date(now);
  if (dedupeHash) state.lastDedupeHash = dedupeHash;
  state.expiresAt = new Date(now + STATE_TTL_MS);
  await state.save();

  const budget = (await UserNotifyBudget.findOne({ userId })) || new UserNotifyBudget({ userId });
  roll(budget, now);
  budget.hourCount += 1;
  budget.dayCount += 1;
  await budget.save();
}

module.exports = { check, record, inQuietHours };
