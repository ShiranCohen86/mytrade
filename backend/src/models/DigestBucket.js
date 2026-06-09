const mongoose = require('mongoose');

/**
 * Smart-digest accumulator. When a rule has digest enabled, matched fires append
 * an item here instead of sending immediately; automationDigestFlush later
 * combines a user's items into ONE notification ("3 stocks in your watchlist
 * moved significantly today") to prevent notification fatigue.
 */
const digestItemSchema = new mongoose.Schema({
  ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AutomationRule' },
  ticker: { type: String, default: '' },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  deepLink: { type: String, default: '' },
  context: { type: mongoose.Schema.Types.Mixed, default: {} },
  addedAt: { type: Date, default: () => new Date() },
}, { _id: false });

const digestBucketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    window: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
    items: { type: [digestItemSchema], default: [] },
  },
  { timestamps: true }
);

digestBucketSchema.index({ userId: 1, window: 1 }, { unique: true });

module.exports = mongoose.model('DigestBucket', digestBucketSchema);
