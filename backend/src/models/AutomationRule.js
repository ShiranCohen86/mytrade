const mongoose = require('mongoose');

const CATEGORIES = ['watchlist_stock', 'user', 'ai_personalization', 'market', 'platform', 'engagement'];
const SCOPES = ['global', 'user'];
const STATUSES = ['active', 'paused', 'inactive']; // inactive = needs data source (scaffolded)
const TARGET_MODES = ['all', 'segment', 'multiple', 'single', 'watchlist_holders'];
const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'alert'];

/**
 * An admin-authored automation rule: WHEN <trigger + optional conditions> for
 * <targeted users> THEN send a notification across <channels>, governed by
 * anti-spam (cooldown/caps/quiet-hours/dedupe) and optional smart-digest + A/B.
 * The central entity of the Trigger & Automation Engine.
 */
const conditionItemSchema = new mongoose.Schema({
  field: { type: String, default: '' },        // dot-path into eval context, e.g. 'stock.analysis.riskScore'
  operator: { type: String, default: 'gte' },  // gte|lte|eq|neq|crossed_above|crossed_below|changed
  value: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false });

const variantSchema = new mongoose.Schema({
  key: { type: String, default: 'A' },
  weight: { type: Number, default: 1 },
  content: { type: mongoose.Schema.Types.Mixed, default: null }, // optional override of actions.content
}, { _id: false });

const automationRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 500 },
    category: { type: String, enum: CATEGORIES, default: 'watchlist_stock', index: true },
    scope: { type: String, enum: SCOPES, default: 'global' },
    status: { type: String, enum: STATUSES, default: 'paused', index: true }, // new rules start paused
    feasible: { type: Boolean, default: true },
    priority: { type: Number, default: 100 }, // lower = higher priority for cap arbitration

    trigger: {
      type: { type: String, required: true }, // registry key
      params: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    conditions: {
      op: { type: String, enum: ['AND', 'OR'], default: 'AND' },
      items: { type: [conditionItemSchema], default: [] },
    },

    targeting: {
      mode: { type: String, enum: TARGET_MODES, default: 'all' },
      userIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [], index: true },
      segment: { type: String, default: null },
    },

    actions: {
      channels: {
        inApp: { type: Boolean, default: true },
        push: { type: Boolean, default: false },
        email: { type: Boolean, default: false },   // adapter stub (future)
        sms: { type: Boolean, default: false },      // adapter stub (future)
        whatsapp: { type: Boolean, default: false }, // adapter stub (future)
      },
      templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationTemplate', default: null },
      content: {
        title: { type: String, default: '' },
        message: { type: String, default: '' },
        type: { type: String, enum: NOTIFICATION_TYPES, default: 'info' },
        icon: { type: String, default: '' },
        deepLink: { type: String, default: '' },
        actionText: { type: String, default: '' },
      },
    },

    antiSpam: {
      cooldownMinutes: { type: Number, default: 1440 },
      maxPerDay: { type: Number, default: 0 },  // 0 = unlimited (per-rule)
      maxPerHour: { type: Number, default: 0 },
      quietHours: {
        enabled: { type: Boolean, default: false },
        start: { type: String, default: '22:00' },
        end: { type: String, default: '07:00' },
        tz: { type: String, default: 'America/New_York' },
      },
      dedupe: { type: Boolean, default: true },
    },

    digest: {
      enabled: { type: Boolean, default: false },
      window: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
    },

    abTest: {
      enabled: { type: Boolean, default: false },
      variants: { type: [variantSchema], default: [] },
    },

    stats: {
      executions: { type: Number, default: 0 },   // times the rule matched + attempted a fire
      recipients: { type: Number, default: 0 },   // notifications actually sent
      delivered: {
        push: { type: Number, default: 0 },
        inApp: { type: Number, default: 0 },
      },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      suppressed: { type: Number, default: 0 },
      lastFiredAt: { type: Date, default: null },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByEmail: { type: String, default: '' },
  },
  { timestamps: true }
);

automationRuleSchema.index({ status: 1, category: 1 });
automationRuleSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AutomationRule', automationRuleSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.SCOPES = SCOPES;
module.exports.STATUSES = STATUSES;
module.exports.TARGET_MODES = TARGET_MODES;
