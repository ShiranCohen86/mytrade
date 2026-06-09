const mongoose = require('mongoose');

const PUSH_CATEGORIES = ['price_alert', 'big_mover', 'earnings', 'digest', 'product'];

/**
 * A browser push subscription belonging to a user. One user can have several
 * (multiple devices / browsers). `endpoint` is globally unique.
 */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    platform: { type: String, default: '' }, // ios | android | desktop
    userAgent: { type: String, default: '' },
    categories: { type: [String], enum: PUSH_CATEGORIES, default: PUSH_CATEGORIES },
    lastSeenAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
module.exports.PUSH_CATEGORIES = PUSH_CATEGORIES;
