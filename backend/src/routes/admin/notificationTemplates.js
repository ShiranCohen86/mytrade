const express = require('express');
const { Types } = require('mongoose');
const NotificationTemplate = require('../../models/NotificationTemplate');
const { TEMPLATE_KEYS } = require('../../models/NotificationTemplate');
const adminAuth = require('../../middleware/adminAuth');
const audit = require('../../services/auditService');

const router = express.Router();
const TYPES = ['info', 'success', 'warning', 'alert'];

function parseTemplate(body) {
  const b = body || {};
  const name = String(b.name || '').trim();
  if (!name) return { error: 'Template name is required.' };
  return {
    value: {
      name: name.slice(0, 80),
      key: TEMPLATE_KEYS.includes(b.key) ? b.key : 'system_alert',
      title: String(b.title || '').slice(0, 120),
      message: String(b.message || '').slice(0, 1000),
      type: TYPES.includes(b.type) ? b.type : 'info',
      icon: String(b.icon || '').slice(0, 16),
      imageUrl: String(b.imageUrl || '').slice(0, 500),
      deepLink: String(b.deepLink || '').slice(0, 300),
      actionText: String(b.actionText || '').slice(0, 40),
      defaultChannels: {
        push: !!(b.defaultChannels && b.defaultChannels.push),
        inApp: b.defaultChannels ? !!b.defaultChannels.inApp : true,
      },
    },
  };
}

// GET /api/admin/notification-templates?status=active
router.get('/', adminAuth('notifications.read'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status === 'archived') filter.status = 'archived';
    else if (req.query.status !== 'all') filter.status = 'active';
    const templates = await NotificationTemplate.find(filter).sort({ isSystem: -1, name: 1 }).lean();
    res.json({ templates });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/admin/notification-templates
router.post('/', adminAuth('notifications.send'), async (req, res) => {
  try {
    const dto = parseTemplate(req.body);
    if (dto.error) return res.status(400).json({ error: dto.error });
    const template = await NotificationTemplate.create({ ...dto.value, createdBy: req.adminUser.id });
    audit.logAdmin(req, 'admin.notification.template.create', null, { templateId: String(template._id) });
    res.status(201).json({ template });
  } catch {
    res.status(500).json({ error: 'Failed to create template.' });
  }
});

// PUT /api/admin/notification-templates/:id
router.put('/:id', adminAuth('notifications.send'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const dto = parseTemplate(req.body);
    if (dto.error) return res.status(400).json({ error: dto.error });
    const template = await NotificationTemplate.findByIdAndUpdate(req.params.id, dto.value, { new: true });
    if (!template) return res.status(404).json({ error: 'Not found.' });
    audit.logAdmin(req, 'admin.notification.template.update', null, { templateId: String(template._id) });
    res.json({ template });
  } catch {
    res.status(500).json({ error: 'Failed to update template.' });
  }
});

// POST /api/admin/notification-templates/:id/duplicate
router.post('/:id/duplicate', adminAuth('notifications.send'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const src = await NotificationTemplate.findById(req.params.id).lean();
    if (!src) return res.status(404).json({ error: 'Not found.' });
    const { _id, createdAt, updatedAt, __v, isSystem, ...rest } = src;
    const template = await NotificationTemplate.create({
      ...rest, name: `${src.name} (copy)`, isSystem: false, status: 'active', createdBy: req.adminUser.id,
    });
    audit.logAdmin(req, 'admin.notification.template.duplicate', null, { from: String(_id), to: String(template._id) });
    res.status(201).json({ template });
  } catch {
    res.status(500).json({ error: 'Failed to duplicate template.' });
  }
});

// POST /api/admin/notification-templates/:id/archive  { archived: bool }
router.post('/:id/archive', adminAuth('notifications.send'), async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
    const status = req.body && req.body.archived === false ? 'active' : 'archived';
    const template = await NotificationTemplate.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!template) return res.status(404).json({ error: 'Not found.' });
    audit.logAdmin(req, 'admin.notification.template.archive', null, { templateId: String(template._id), status });
    res.json({ template });
  } catch {
    res.status(500).json({ error: 'Failed to archive template.' });
  }
});

module.exports = router;
