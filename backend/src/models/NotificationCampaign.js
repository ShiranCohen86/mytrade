const mongoose = require('mongoose');

const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'alert'];
const SEGMENTS = ['active', 'inactive', 'new', 'returning', 'pwa_installed', 'notif_enabled'];
const AUDIENCE_MODES = ['single', 'multiple', 'segment', 'all'];
const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'failed', 'canceled'];

/**
 * An admin-authored notification "campaign" — a single compose+send action that
 * fans out to one or many recipients across the push and/or in-app channels.
 * Holds the authored content, targeting, lifecycle, and denormalized stats.
 */
const notificationCampaignSchema = new mongoose.Schema(
  {
    // ── Content ──────────────────────────────────────────────────────────────
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'info' },
    icon: { type: String, default: '' },        // emoji or icon key
    imageUrl: { type: String, default: '' },     // optional hero image (push/in-app)
    deepLink: { type: String, default: '' },     // in-app relative path, e.g. /stocks/AAPL
    actionText: { type: String, default: '', maxlength: 40 },
    expiresAt: { type: Date, default: null },    // in-app auto-expiry

    // ── Channels ─────────────────────────────────────────────────────────────
    channels: {
      push: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true },
    },

    // ── Targeting ────────────────────────────────────────────────────────────
    audience: {
      mode: { type: String, enum: AUDIENCE_MODES, default: 'all' },
      userIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
      segment: { type: String, enum: [...SEGMENTS, null], default: null },
    },

    // ── Lifecycle ────────────────────────────────────────────────────────────
    status: { type: String, enum: CAMPAIGN_STATUSES, default: 'draft', index: true },
    scheduledAt: { type: Date, default: null },
    timezone: { type: String, default: 'UTC' },  // for admin display only
    sentAt: { type: Date, default: null },
    recipientCount: { type: Number, default: 0 },
    error: { type: String, default: '' },

    // ── Provenance ───────────────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByEmail: { type: String, default: '' },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationTemplate', default: null },

    // ── Denormalized stats (updated during/after dispatch) ───────────────────
    stats: {
      push: {
        sent: { type: Number, default: 0 },      // provider-accepted
        failed: { type: Number, default: 0 },
        opened: { type: Number, default: 0 },    // SW "shown" beacon
        clicked: { type: Number, default: 0 },   // SW "click" beacon
      },
      inApp: {
        created: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 }, // emitted to a live socket
        seen: { type: Number, default: 0 },      // impressions (surfaced in UI)
        read: { type: Number, default: 0 },
        dismissed: { type: Number, default: 0 },
        clicked: { type: Number, default: 0 },
      },
    },
  },
  { timestamps: true }
);

notificationCampaignSchema.index({ status: 1, scheduledAt: 1 });
notificationCampaignSchema.index({ createdAt: -1 });

module.exports = mongoose.model('NotificationCampaign', notificationCampaignSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.SEGMENTS = SEGMENTS;
module.exports.AUDIENCE_MODES = AUDIENCE_MODES;
module.exports.CAMPAIGN_STATUSES = CAMPAIGN_STATUSES;
