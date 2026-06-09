const mongoose = require('mongoose');

const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'alert'];

/**
 * A single in-app notification delivered to one user (fan-out on write). Content
 * is denormalized from the parent campaign so edits/deletes of the campaign never
 * break a user's history. Also serves as the in-app delivery log (read/dismiss/
 * click/seen state + timestamps).
 */
const userNotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationCampaign', default: null, index: true },

    // ── Content (denormalized snapshot) ──────────────────────────────────────
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'info' },
    icon: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    deepLink: { type: String, default: '' },
    actionText: { type: String, default: '' },

    // ── Per-user state ───────────────────────────────────────────────────────
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    dismissed: { type: Boolean, default: false },
    dismissedAt: { type: Date, default: null },
    clickedAt: { type: Date, default: null },
    seenAt: { type: Date, default: null },        // first impression in dropdown/center

    expiresAt: { type: Date, default: null },     // TTL auto-cleanup when set
  },
  { timestamps: true }
);

// Feed + unread queries
userNotificationSchema.index({ userId: 1, read: 1 });
userNotificationSchema.index({ userId: 1, createdAt: -1 });
// (campaignId already indexed at field level for delivery-log aggregation)
// MongoDB TTL — documents auto-delete once expiresAt passes (only when set)
userNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UserNotification', userNotificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
