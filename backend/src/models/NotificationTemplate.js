const mongoose = require('mongoose');

const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'alert'];
const TEMPLATE_KEYS = [
  'welcome', 'feature_update', 'market_alert', 'system_alert',
  'breaking_news', 'maintenance', 'engagement_reminder', 'reactivation',
];
const TEMPLATE_STATUSES = ['active', 'archived'];

/**
 * A reusable notification template an admin can author a campaign from. Ships
 * with 8 idempotently-seeded defaults (see services/templateSeeder).
 */
const notificationTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    key: { type: String, enum: TEMPLATE_KEYS, default: 'system_alert', index: true },

    // Content defaults
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'info' },
    icon: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    deepLink: { type: String, default: '' },
    actionText: { type: String, default: '' },
    defaultChannels: {
      push: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true },
    },

    status: { type: String, enum: TEMPLATE_STATUSES, default: 'active', index: true },
    isSystem: { type: Boolean, default: false }, // seeded defaults
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.TEMPLATE_KEYS = TEMPLATE_KEYS;
module.exports.TEMPLATE_STATUSES = TEMPLATE_STATUSES;
