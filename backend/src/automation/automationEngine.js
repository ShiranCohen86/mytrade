/**
 * Automation engine — the brain. Evaluates a rule's trigger (+ optional one-level
 * AND/OR conditions) for a (user, context), passes the anti-spam gate, then either
 * delivers immediately (via channel adapters) or accumulates into a smart-digest,
 * recording an AutomationLog + per-rule stats. Also powers simulate() (dry-run)
 * and runNow(), and handleEvent() for event-class triggers.
 */
const AutomationRule = require('../models/AutomationRule');
const AutomationLog = require('../models/AutomationLog');
const DigestBucket = require('../models/DigestBucket');
const registry = require('./registry');
const antiSpam = require('./antiSpam');
const adapters = require('./channels');
const dataLoader = require('./dataLoader');
const segmentService = require('../services/segmentService');
const { interpolate, getByPath } = require('./config');
const logger = require('../utils/logger');

const round = (n, d = 2) => (n == null || Number.isNaN(Number(n)) ? null : Math.round(Number(n) * 10 ** d) / 10 ** d);

/** Recipient's first name from displayName, falling back to the email local-part. */
function firstNameOf(user) {
  if (!user) return '';
  const dn = String(user.displayName || '').trim();
  if (dn) return dn.split(/\s+/)[0];
  const local = String(user.email || '').split('@')[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : '';
}

// ── Content / tokens ──────────────────────────────────────────────────────────
function buildTokens(ctx, rule) {
  const t = {};
  const cd = (ctx.stock && ctx.stock.cachedData) || {};
  const type = rule.trigger.type;
  const params = rule.trigger.params || {};
  if (ctx.ticker) { t.ticker = ctx.ticker; t.name = (ctx.stock && ctx.stock.name) || ctx.ticker; }
  if (cd.price != null) t.price = round(cd.price);
  if (cd.changePercent != null) t.changePercent = round(cd.changePercent);
  if (params.targetPrice) t.targetPrice = params.targetPrice;

  if (type === 'analyst_upgrade' || type === 'analyst_downgrade') t.value = cd.recommendationKey;
  else if (type === 'new_price_target') t.value = round(cd.analystTargetPrice);
  else if (type === 'earnings_approaching' || type === 'earnings_released') t.value = cd.earningsDate ? new Date(cd.earningsDate).toLocaleDateString() : '';
  else if (type === 'stop_loss_reached' && ctx.entry) t.value = round(((cd.price - ctx.entry.entryPrice) / ctx.entry.entryPrice) * 100);
  else if (type === 'ma_crossover') t.value = `${params.fast || 50}/${params.slow || 200}`;

  if (ctx.market && !ctx.ticker) {
    t.index = params.index || 'SPY';
    const ix = ctx.market[t.index] || ctx.market.SPY || {};
    if (ix.changePercent != null) t.changePercent = round(ix.changePercent);
    if (type === 'vix_spike') t.value = round(ctx.market.VIX && ctx.market.VIX.price);
    if (type === 'market_regime_change') t.value = ctx.market.regime;
  }
  if (ctx.recommendation) t.ticker = ctx.recommendation.ticker;
  if (ctx.summary) t.summary = ctx.summary;

  // Recipient tokens — always available (every eval context carries the user).
  if (ctx.user) {
    t.firstName = firstNameOf(ctx.user);
    t.userName = String(ctx.user.displayName || '').trim() || t.firstName;
    t.email = ctx.user.email || '';
  }
  // Event-subject tokens (e.g. the just-registered user) — distinct from the
  // recipient, so an admin-alert rule can name who triggered the event.
  if (ctx.subject) {
    t.newUserFirstName = firstNameOf(ctx.subject);
    t.newUserName = String(ctx.subject.displayName || '').trim() || t.newUserFirstName;
    t.newUserEmail = ctx.subject.email || '';
  }
  return t;
}

function resolveContent(rule, trigger, ctx, variant) {
  const base = (trigger.defaults && trigger.defaults(ctx, rule.trigger.params || {})) || {};
  const rc = (variant && variant.content) || (rule.actions && rule.actions.content) || {};
  const merged = {
    title: rc.title || base.title || '',
    message: rc.message || base.message || '',
    type: rc.type || base.type || 'info',
    icon: rc.icon || base.icon || '',
    deepLink: rc.deepLink || base.deepLink || '',
    actionText: rc.actionText || base.actionText || '',
  };
  const tokens = buildTokens(ctx, rule);
  return {
    title: interpolate(merged.title, tokens),
    message: interpolate(merged.message, tokens),
    type: merged.type,
    icon: merged.icon,
    deepLink: interpolate(merged.deepLink, tokens),
    actionText: interpolate(merged.actionText, tokens),
  };
}

// ── Conditions / variants ──────────────────────────────────────────────────────
function evaluateConditions(conditions, ctx) {
  if (!conditions || !conditions.items || !conditions.items.length) return true;
  const test = (item) => {
    const a = getByPath(ctx, item.field);
    const v = item.value;
    switch (item.operator) {
      case 'gte': return Number(a) >= Number(v);
      case 'lte': return Number(a) <= Number(v);
      case 'eq': return String(a) === String(v);
      case 'neq': return String(a) !== String(v);
      default: return false; // crossed_*/changed need history — not supported in one-level filter
    }
  };
  const res = conditions.items.map(test);
  return conditions.op === 'OR' ? res.some(Boolean) : res.every(Boolean);
}

function pickVariant(rule) {
  if (!rule.abTest || !rule.abTest.enabled || !(rule.abTest.variants || []).length) return null;
  const total = rule.abTest.variants.reduce((s, v) => s + (v.weight || 1), 0);
  let r = Math.random() * total;
  for (const v of rule.abTest.variants) { r -= (v.weight || 1); if (r <= 0) return v; }
  return rule.abTest.variants[0];
}

const safeDedupe = (trigger, ctx, rule) => {
  try { return trigger.dedupeKey ? trigger.dedupeKey(ctx, rule.trigger.params || {}, rule._runId) : ''; }
  catch { return ''; }
};

// ── Delivery + persistence ──────────────────────────────────────────────────────
async function deliver(channels, userId, content, meta) {
  const out = { inApp: 0, push: 0, notificationId: null };
  if (channels.inApp) { const r = await adapters.inApp.send(userId, content, meta); out.inApp = r.sent; out.notificationId = r.notificationId; }
  if (channels.push) { const r = await adapters.push.send(userId, content, meta); out.push = r.sent; }
  for (const ch of ['email', 'sms', 'whatsapp']) if (channels[ch]) { try { await adapters[ch].send(userId, content, meta); } catch { /* stub */ } }
  return out;
}

async function logFire(rule, user, ctx, outcome, notificationId = null, variant = null) {
  try {
    await AutomationLog.create({
      ruleId: rule._id, ruleName: rule.name, userId: user._id, ticker: ctx.ticker || '',
      category: rule.category, triggerType: rule.trigger.type, outcome,
      channels: { inApp: !!rule.actions.channels.inApp, push: !!rule.actions.channels.push },
      notificationId, variantKey: variant ? variant.key : '',
      context: { price: ctx.stock && ctx.stock.cachedData && ctx.stock.cachedData.price, changePercent: ctx.stock && ctx.stock.cachedData && ctx.stock.cachedData.changePercent },
    });
  } catch (err) { logger.warn('[automation] log failed', { err: err.message }); }
}

async function pushToDigest(userId, rule, ctx, content) {
  const item = { ruleId: rule._id, ticker: ctx.ticker || '', title: content.title, message: content.message, deepLink: content.deepLink, context: {} };
  await DigestBucket.updateOne(
    { userId, window: rule.digest.window || 'daily' },
    { $push: { items: item } },
    { upsert: true }
  );
}

// ── Core per-(rule,user) fire ───────────────────────────────────────────────────
async function fireOne(rule, user, ctx, opts = {}) {
  const trigger = registry.get(rule.trigger.type);
  if (!trigger || trigger.feasible === false) return null;

  let matched;
  try { matched = trigger.match(ctx, rule.trigger.params || {}); } catch { matched = false; }
  if (matched && rule.conditions && rule.conditions.items && rule.conditions.items.length) {
    matched = evaluateConditions(rule.conditions, ctx);
  }
  if (!matched) return null;

  const variant = pickVariant(rule);
  const content = resolveContent(rule, trigger, ctx, variant);
  if (!content.title) return null;

  if (opts.dryRun) {
    return { userId: String(user._id), email: user.email, ticker: ctx.ticker || '', variantKey: variant ? variant.key : '', preview: content };
  }

  // For subject-bound events (e.g. registration) scope anti-spam by the event subject,
  // so an admin-alert rule fires once per *new user* rather than being collapsed into a
  // single per-recipient cooldown/dedupe across every registration.
  const key = ctx.ticker || (ctx.subject && ctx.subject._id ? `subject:${ctx.subject._id}` : '');
  const dedupeHash = safeDedupe(trigger, ctx, rule);

  const gate = await antiSpam.check(rule, user._id, key, dedupeHash);
  if (!gate.allow) {
    await AutomationRule.updateOne({ _id: rule._id }, { $inc: { 'stats.suppressed': 1 } });
    await logFire(rule, user, ctx, gate.reason, null, variant);
    return { outcome: gate.reason };
  }

  if (rule.digest && rule.digest.enabled) {
    await pushToDigest(user._id, rule, ctx, content);
    await antiSpam.record(rule, user._id, key, dedupeHash);
    await logFire(rule, user, ctx, 'digested', null, variant);
    return { outcome: 'digested' };
  }

  const meta = { automationRuleId: rule._id, urgency: content.type === 'alert' ? 'high' : 'normal', tag: `auto-${rule._id}` };
  let delivered;
  try {
    delivered = await deliver(rule.actions.channels, user._id, content, meta);
  } catch (err) {
    await logFire(rule, user, ctx, 'error', null, variant);
    return { outcome: 'error', error: err.message };
  }
  await antiSpam.record(rule, user._id, key, dedupeHash);
  await AutomationRule.updateOne({ _id: rule._id }, {
    $inc: { 'stats.executions': 1, 'stats.recipients': 1, 'stats.delivered.inApp': delivered.inApp, 'stats.delivered.push': delivered.push },
    $set: { 'stats.lastFiredAt': new Date() },
  });
  await logFire(rule, user, ctx, 'sent', delivered.notificationId, variant);
  return { outcome: 'sent' };
}

// ── Per-rule runners (used by jobs with preloaded data, and by simulate/runNow) ─
async function resolveTargetUserIds(rule, allUsersById) {
  const tg = rule.targeting || {};
  if (tg.mode === 'single' || tg.mode === 'multiple') return (tg.userIds || []).map(String);
  if (tg.mode === 'all') return [...allUsersById.keys()];
  if (tg.mode === 'segment') return (await segmentService.resolveUserIds({ mode: 'segment', segment: tg.segment })).map(String);
  return null; // watchlist_holders → per-ticker
}

async function runMarketRule(rule, data, allUsers, opts = {}) {
  const params = rule.trigger.params || {};
  const allUsersById = new Map(allUsers.map((u) => [String(u._id), u]));
  const targetIds = await resolveTargetUserIds(rule, allUsersById);
  const tickers = params.ticker ? [String(params.ticker).toUpperCase()] : [...data.stocks.keys()];
  const results = [];
  for (const ticker of tickers) {
    const stock = data.stocks.get(ticker);
    if (!stock) continue;
    let users;
    if (rule.targeting.mode === 'watchlist_holders' || !targetIds) users = allUsers.filter((u) => (u.watchlist || []).includes(ticker));
    else users = targetIds.map((id) => allUsersById.get(id)).filter(Boolean);
    for (const user of users) {
      const ctx = { ticker, stock, hot: data.hot.get(ticker) || null, market: data.market, user, entry: dataLoader.portfolioEntry(user, ticker) };
      const r = await fireOne(rule, user, ctx, opts); // eslint-disable-line no-await-in-loop
      if (r) results.push(r);
    }
  }
  return results;
}

async function runMarketLevelRule(rule, market, allUsers, opts = {}) {
  const allUsersById = new Map(allUsers.map((u) => [String(u._id), u]));
  const targetIds = (await resolveTargetUserIds(rule, allUsersById)) || [...allUsersById.keys()];
  const results = [];
  for (const id of targetIds) {
    const user = allUsersById.get(id);
    if (!user) continue;
    const r = await fireOne(rule, user, { market, user }, opts); // eslint-disable-line no-await-in-loop
    if (r) results.push(r);
  }
  return results;
}

async function runUserRule(rule, allUsers, flags, extras = {}, opts = {}) {
  const allUsersById = new Map(allUsers.map((u) => [String(u._id), u]));
  const targetIds = (await resolveTargetUserIds(rule, allUsersById)) || [...allUsersById.keys()];
  const results = [];
  for (const id of targetIds) {
    const user = allUsersById.get(id);
    if (!user) continue;
    const daysInactive = user.lastActiveAt
      ? (Date.now() - new Date(user.lastActiveAt)) / 86400000
      : (Date.now() - new Date(user.createdAt)) / 86400000;
    const ctx = {
      user,
      hasNotif: flags.hasNotif.has(id),
      isPwa: flags.isPwa.has(id),
      hasWatchlist: (user.watchlist || []).length > 0,
      daysInactive,
      returned: (extras.returnedSet && extras.returnedSet.has(id)) || false,
      recommendation: (extras.recommendations && extras.recommendations.get(id)) || null,
    };
    const r = await fireOne(rule, user, ctx, opts); // eslint-disable-line no-await-in-loop
    if (r) results.push(r);
  }
  return results;
}

async function runEventRule(rule, allUsers, opts = {}) {
  const allUsersById = new Map(allUsers.map((u) => [String(u._id), u]));
  const targetIds = (await resolveTargetUserIds(rule, allUsersById)) || [...allUsersById.keys()];
  const results = [];
  for (const id of targetIds) {
    const user = allUsersById.get(id);
    if (!user) continue;
    const r = await fireOne(rule, user, { user }, opts); // eslint-disable-line no-await-in-loop
    if (r) results.push(r);
  }
  return results;
}

// ── Single-rule entry points (simulate / run now / events) ──────────────────────
async function evaluateRuleStandalone(rule, opts = {}) {
  const trigger = registry.get(rule.trigger.type);
  if (!trigger) return [];
  const cls = trigger.evaluatorClass;
  const allUsers = await dataLoader.loadActiveUsers();

  if (cls === 'market') {
    const tickers = rule.trigger.params && rule.trigger.params.ticker
      ? [rule.trigger.params.ticker] : await dataLoader.allWatchlistTickers();
    const data = await dataLoader.loadMarketData(tickers);
    return runMarketRule(rule, data, allUsers, opts);
  }
  if (cls === 'market_level') {
    const market = await dataLoader.loadIndices();
    market.regime = dataLoader.deriveRegime(market);
    market.regimeChanged = true; // simulate treats regime as changed
    return runMarketLevelRule(rule, market, allUsers, opts);
  }
  if (cls === 'user') {
    const flags = await dataLoader.loadUserFlags(allUsers.map((u) => u._id));
    return runUserRule(rule, allUsers, flags, {}, opts);
  }
  // event / scheduled → broadcast to targeting
  return runEventRule(rule, allUsers, opts);
}

async function simulate(rule) {
  const matched = await evaluateRuleStandalone(rule, { dryRun: true });
  return { count: matched.length, matched: matched.slice(0, 25) };
}

async function runNow(rule) {
  const fired = await evaluateRuleStandalone(rule, { dryRun: false });
  const sent = fired.filter((r) => r && r.outcome === 'sent').length;
  return { attempted: fired.length, sent };
}

/**
 * Real-time fire for one event-class rule (e.g. on registration). Recipients follow
 * the rule's targeting; the event subject (the user who triggered it) rides along in
 * ctx.subject for token interpolation. Default/'all' targeting on a subject-bound event
 * means "notify the subject" (the welcome use-case) — NOT a broadcast to every user.
 */
async function fireEventRule(rule, eventCtx = {}, opts = {}) {
  const subject = eventCtx.user || null;
  const tg = rule.targeting || {};
  const results = [];

  if (subject && (!tg.mode || tg.mode === 'all')) {
    const r = await fireOne(rule, subject, { user: subject, subject }, opts);
    if (r) results.push(r);
    return results;
  }

  // Explicit targeting → resolve recipients; the subject stays in context for tokens.
  const allUsers = await dataLoader.loadActiveUsers();
  const allUsersById = new Map(allUsers.map((u) => [String(u._id), u]));
  const targetIds = (await resolveTargetUserIds(rule, allUsersById)) || [...allUsersById.keys()];
  for (const id of targetIds) {
    const user = allUsersById.get(id);
    if (!user) continue;
    const r = await fireOne(rule, user, { user, subject }, opts); // eslint-disable-line no-await-in-loop
    if (r) results.push(r);
  }
  return results;
}

/** Fire event-class rules of a given trigger type (e.g. on registration). */
async function handleEvent(triggerType, eventCtx = {}) {
  try {
    const rules = await AutomationRule.find({ status: 'active', 'trigger.type': triggerType });
    for (const rule of rules) {
      if (eventCtx.user) {
        await fireEventRule(rule, eventCtx, {}); // eslint-disable-line no-await-in-loop
      } else {
        await runNow(rule); // eslint-disable-line no-await-in-loop
      }
    }
  } catch (err) { logger.warn('[automation] handleEvent failed', { triggerType, err: err.message }); }
}

module.exports = {
  fireOne, runMarketRule, runMarketLevelRule, runUserRule, runEventRule, fireEventRule,
  resolveTargetUserIds, resolveContent, simulate, runNow, handleEvent,
};
