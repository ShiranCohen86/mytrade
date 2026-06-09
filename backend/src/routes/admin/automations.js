const express = require('express');
const { Types } = require('mongoose');
const AutomationRule = require('../../models/AutomationRule');
const AutomationLog = require('../../models/AutomationLog');
const UserNotification = require('../../models/UserNotification');
const adminAuth = require('../../middleware/adminAuth');
const audit = require('../../services/auditService');
const registry = require('../../automation/registry');
const engine = require('../../automation/automationEngine');

const router = express.Router();

const TYPES = ['info', 'success', 'warning', 'alert'];
const MODES = ['all', 'segment', 'multiple', 'single', 'watchlist_holders'];

function sanitizeAntiSpam(a = {}) {
  const q = a.quietHours || {};
  return {
    cooldownMinutes: Math.max(0, parseInt(a.cooldownMinutes, 10) || 1440),
    maxPerDay: Math.max(0, parseInt(a.maxPerDay, 10) || 0),
    maxPerHour: Math.max(0, parseInt(a.maxPerHour, 10) || 0),
    quietHours: {
      enabled: !!q.enabled,
      start: String(q.start || '22:00').slice(0, 5),
      end: String(q.end || '07:00').slice(0, 5),
      tz: String(q.tz || 'America/New_York').slice(0, 64),
    },
    dedupe: a.dedupe !== false,
  };
}

function parseDto(body) {
  const b = body || {};
  const name = String(b.name || '').trim();
  if (!name) return { error: 'Name is required.' };
  const trig = b.trigger || {};
  const def = registry.get(trig.type);
  if (!def) return { error: 'Unknown trigger type.' };

  const ch = (b.actions && b.actions.channels) || {};
  if (!ch.inApp && !ch.push && !ch.email && !ch.sms && !ch.whatsapp) return { error: 'Select at least one channel.' };
  const content = (b.actions && b.actions.content) || {};
  if (content.deepLink && !String(content.deepLink).startsWith('/')) return { error: 'Deep link must start with "/".' };

  const tg = b.targeting || {};
  if (!MODES.includes(tg.mode)) return { error: 'Invalid targeting mode.' };
  if ((tg.mode === 'single' || tg.mode === 'multiple')) {
    const ids = tg.userIds || [];
    if (!ids.length) return { error: 'Select at least one target user.' };
    if (ids.some((id) => !Types.ObjectId.isValid(id))) return { error: 'Invalid user id in targeting.' };
  }
  if (tg.mode === 'segment' && !tg.segment) return { error: 'Select a segment.' };

  return {
    def,
    value: {
      name,
      description: String(b.description || '').slice(0, 500),
      category: def.category,
      scope: b.scope === 'user' ? 'user' : 'global',
      feasible: def.feasible !== false,
      priority: Number.isFinite(+b.priority) ? +b.priority : 100,
      trigger: { type: trig.type, params: trig.params || {} },
      conditions: {
        op: (b.conditions && b.conditions.op) === 'OR' ? 'OR' : 'AND',
        items: Array.isArray(b.conditions && b.conditions.items) ? b.conditions.items.slice(0, 10) : [],
      },
      targeting: { mode: tg.mode, userIds: (tg.userIds || []).map(String), segment: tg.mode === 'segment' ? tg.segment : null },
      actions: {
        channels: { inApp: !!ch.inApp, push: !!ch.push, email: !!ch.email, sms: !!ch.sms, whatsapp: !!ch.whatsapp },
        templateId: Types.ObjectId.isValid(b.actions && b.actions.templateId) ? b.actions.templateId : null,
        content: {
          title: String(content.title || '').slice(0, 120),
          message: String(content.message || '').slice(0, 1000),
          type: TYPES.includes(content.type) ? content.type : 'info',
          icon: String(content.icon || '').slice(0, 16),
          deepLink: String(content.deepLink || '').slice(0, 300),
          actionText: String(content.actionText || '').slice(0, 40),
        },
      },
      antiSpam: sanitizeAntiSpam(b.antiSpam),
      digest: { enabled: !!(b.digest && b.digest.enabled), window: (b.digest && b.digest.window) === 'weekly' ? 'weekly' : 'daily' },
      abTest: { enabled: !!(b.abTest && b.abTest.enabled), variants: Array.isArray(b.abTest && b.abTest.variants) ? b.abTest.variants.slice(0, 5) : [] },
    },
  };
}

// ── Registry catalog (for the builder) ─────────────────────────────────────────
router.get('/registry', adminAuth('notifications.read'), (_req, res) => {
  res.json({ triggers: registry.catalog() });
});

// ── Analytics ──────────────────────────────────────────────────────────────────
router.get('/analytics', adminAuth('notifications.read'), async (req, res) => {
  try {
    const days = Math.min(180, Math.max(1, parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 86_400_000);

    const [outcomes, trend, engagement, ruleAgg] = await Promise.all([
      AutomationLog.aggregate([{ $match: { firedAt: { $gte: since } } }, { $group: { _id: '$outcome', count: { $sum: 1 } } }]),
      AutomationLog.aggregate([
        { $match: { firedAt: { $gte: since }, outcome: 'sent' } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$firedAt' } }, count: { $sum: 1 } } },
        { $project: { _id: 0, date: '$_id', count: 1 } }, { $sort: { date: 1 } },
      ]),
      UserNotification.aggregate([
        { $match: { automationRuleId: { $ne: null }, createdAt: { $gte: since } } },
        { $group: { _id: '$automationRuleId', created: { $sum: 1 }, read: { $sum: { $cond: ['$read', 1, 0] } }, clicked: { $sum: { $cond: [{ $ifNull: ['$clickedAt', false] }, 1, 0] } } } },
      ]),
      AutomationRule.aggregate([{ $group: { _id: null, executions: { $sum: '$stats.executions' }, recipients: { $sum: '$stats.recipients' }, suppressed: { $sum: '$stats.suppressed' } } }]),
    ]);

    const ruleIds = engagement.map((e) => e._id);
    const rules = await AutomationRule.find({ _id: { $in: ruleIds } }).select('name').lean();
    const nameById = new Map(rules.map((r) => [String(r._id), r.name]));
    const perRule = engagement.map((e) => ({
      ruleId: String(e._id), name: nameById.get(String(e._id)) || '—',
      created: e.created, read: e.read, clicked: e.clicked,
      ctr: e.created ? Math.round((e.clicked / e.created) * 1000) / 10 : 0,
    }));
    const sorted = [...perRule].sort((a, b) => b.ctr - a.ctr);

    res.json({
      totals: ruleAgg[0] || { executions: 0, recipients: 0, suppressed: 0 },
      outcomes: Object.fromEntries(outcomes.map((o) => [o._id, o.count])),
      trend,
      best: sorted.slice(0, 5),
      worst: sorted.filter((r) => r.created >= 3).slice(-5).reverse(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load analytics.' });
  }
});

// ── List ─────────────────────────────────────────────────────────────────────
router.get('/', adminAuth('notifications.read'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.scope) filter.scope = req.query.scope;
    if (req.query.userId && Types.ObjectId.isValid(req.query.userId)) filter['targeting.userIds'] = req.query.userId;
    if (req.query.search) {
      const safe = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
      filter.name = { $regex: safe, $options: 'i' };
    }
    const [rules, total] = await Promise.all([
      AutomationRule.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AutomationRule.countDocuments(filter),
    ]);
    res.json({ rules, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── Create ───────────────────────────────────────────────────────────────────
router.post('/', adminAuth('notifications.send'), async (req, res) => {
  try {
    const dto = parseDto(req.body);
    if (dto.error) return res.status(400).json({ error: dto.error });
    let status = ['active', 'paused'].includes(req.body.status) ? req.body.status : 'paused';
    if (!dto.value.feasible) status = 'inactive';
    const rule = await AutomationRule.create({ ...dto.value, status, createdBy: req.adminUser.id, createdByEmail: req.adminUser.email });
    audit.logAdmin(req, 'admin.automation.create', null, { ruleId: String(rule._id), trigger: rule.trigger.type, status }, 'warning');
    res.status(201).json({ rule });
  } catch {
    res.status(500).json({ error: 'Failed to create rule.' });
  }
});

// ── Detail / update / delete ───────────────────────────────────────────────────
router.get('/:id', adminAuth('notifications.read'), async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
  const rule = await AutomationRule.findById(req.params.id).lean();
  if (!rule) return res.status(404).json({ error: 'Not found.' });
  res.json({ rule });
});

router.put('/:id', adminAuth('notifications.send'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const rule = await AutomationRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Not found.' });
    const dto = parseDto(req.body);
    if (dto.error) return res.status(400).json({ error: dto.error });
    Object.assign(rule, dto.value);
    if (!dto.value.feasible) rule.status = 'inactive';
    else if (['active', 'paused'].includes(req.body.status)) rule.status = req.body.status;
    await rule.save();
    audit.logAdmin(req, 'admin.automation.update', null, { ruleId: String(rule._id) });
    res.json({ rule });
  } catch {
    res.status(500).json({ error: 'Failed to update rule.' });
  }
});

router.delete('/:id', adminAuth('notifications.send'), async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
  const rule = await AutomationRule.findByIdAndDelete(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Not found.' });
  audit.logAdmin(req, 'admin.automation.delete', null, { ruleId: String(rule._id) }, 'warning');
  res.json({ ok: true });
});

// ── Lifecycle actions ──────────────────────────────────────────────────────────
async function setStatus(req, res, status) {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
  const rule = await AutomationRule.findById(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Not found.' });
  if (status === 'active' && !rule.feasible) return res.status(409).json({ error: 'This trigger needs a data source and cannot be activated yet.' });
  rule.status = status;
  await rule.save();
  audit.logAdmin(req, `admin.automation.${status === 'active' ? 'resume' : 'pause'}`, null, { ruleId: String(rule._id) });
  res.json({ rule });
}
router.post('/:id/pause', adminAuth('notifications.send'), (req, res) => setStatus(req, res, 'paused'));
router.post('/:id/resume', adminAuth('notifications.send'), (req, res) => setStatus(req, res, 'active'));

router.post('/:id/duplicate', adminAuth('notifications.send'), async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
  const src = await AutomationRule.findById(req.params.id).lean();
  if (!src) return res.status(404).json({ error: 'Not found.' });
  const { _id, createdAt, updatedAt, __v, stats, ...rest } = src;
  const rule = await AutomationRule.create({ ...rest, name: `${src.name} (copy)`, status: 'paused', createdBy: req.adminUser.id, createdByEmail: req.adminUser.email });
  audit.logAdmin(req, 'admin.automation.duplicate', null, { from: String(_id), to: String(rule._id) });
  res.status(201).json({ rule });
});

// Dry-run simulate — NEVER sends.
router.post('/:id/test', adminAuth('notifications.read'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const rule = await AutomationRule.findById(req.params.id).lean();
    if (!rule) return res.status(404).json({ error: 'Not found.' });
    const result = await engine.simulate(rule);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Simulation failed.' });
  }
});

// Force-run now (real sends, respects anti-spam).
router.post('/:id/run', adminAuth('notifications.send'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const rule = await AutomationRule.findById(req.params.id).lean();
    if (!rule) return res.status(404).json({ error: 'Not found.' });
    if (!rule.feasible) return res.status(409).json({ error: 'This trigger needs a data source.' });
    audit.logAdmin(req, 'admin.automation.run', null, { ruleId: String(rule._id) }, 'warning');
    const result = await engine.runNow(rule);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Run failed.' });
  }
});

// ── Logs ─────────────────────────────────────────────────────────────────────
router.get('/:id/logs', adminAuth('notifications.read'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = { ruleId: req.params.id };
    if (req.query.outcome) filter.outcome = req.query.outcome;
    const [logs, total] = await Promise.all([
      AutomationLog.find(filter).sort({ firedAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('userId', 'email').lean(),
      AutomationLog.countDocuments(filter),
    ]);
    res.json({
      logs: logs.map((l) => ({ email: l.userId && l.userId.email, ticker: l.ticker, outcome: l.outcome, channels: l.channels, firedAt: l.firedAt, error: l.error })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch {
    res.status(500).json({ error: 'Failed to load logs.' });
  }
});

module.exports = router;
