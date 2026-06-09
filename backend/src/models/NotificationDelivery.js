const mongoose = require('mongoose');

const DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'opened', 'clicked'];

/**
 * Per-recipient PUSH delivery log (the in-app delivery log lives in
 * UserNotification). One row per (campaign, user) push attempt. Tracks provider
 * acceptance, errors/retries, and engagement reported back by the service worker
 * (shown → opened, click → clicked).
 */
const notificationDeliverySchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationCampaign', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    channel: { type: String, default: 'push' },
    status: { type: String, enum: DELIVERY_STATUSES, default: 'pending' },
    // Opaque capability token echoed in the push payload so the service worker
    // (which has no access to the user's JWT) can report shown/click events back
    // to an unauthenticated, token-gated endpoint without spoofing risk.
    token: { type: String, default: '', index: true },
    sentCount: { type: Number, default: 0 },     // provider-accepted subscriptions
    error: { type: String, default: '' },
    retryCount: { type: Number, default: 0 },
    openedAt: { type: Date, default: null },
    clickedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationDeliverySchema.index({ campaignId: 1, status: 1 });
notificationDeliverySchema.index({ campaignId: 1, userId: 1 });

module.exports = mongoose.model('NotificationDelivery', notificationDeliverySchema);
module.exports.DELIVERY_STATUSES = DELIVERY_STATUSES;
