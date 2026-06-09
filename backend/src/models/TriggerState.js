const mongoose = require('mongoose');

/**
 * Per (rule × user × key) anti-spam state — generalizes the priceAlerts
 * `lastAlertNotifiedAt` cooldown. `key` is usually the ticker (so a rule can fire
 * for AAPL and TSLA independently) or '' for keyless rules. Auto-expires when
 * idle to keep the collection bounded.
 */
const triggerStateSchema = new mongoose.Schema(
  {
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AutomationRule', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, default: '' },

    lastFiredAt: { type: Date, default: null },
    dayCount: { type: Number, default: 0 },
    dayResetAt: { type: Date, default: null },
    hourCount: { type: Number, default: 0 },
    hourResetAt: { type: Date, default: null },
    lastDedupeHash: { type: String, default: '' },

    // TTL — drop state ~45 days after last touch.
    expiresAt: { type: Date, default: () => new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) },
  },
  { timestamps: true }
);

triggerStateSchema.index({ ruleId: 1, userId: 1, key: 1 }, { unique: true });
triggerStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TriggerState', triggerStateSchema);
