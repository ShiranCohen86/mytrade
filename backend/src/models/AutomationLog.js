const mongoose = require('mongoose');

const OUTCOMES = [
  'sent', 'digested', 'no_match',
  'suppressed_cooldown', 'suppressed_cap', 'suppressed_quiet', 'suppressed_dedupe', 'suppressed_global_cap',
  'error',
];

/**
 * Append-style execution log for the automation engine. One row per (rule, user)
 * fire attempt — records the outcome (sent / suppressed-with-reason / error) and
 * a context snapshot for debugging and analytics. Auto-expires after 90 days.
 */
const automationLogSchema = new mongoose.Schema(
  {
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AutomationRule', required: true, index: true },
    ruleName: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    ticker: { type: String, default: '' },
    category: { type: String, default: '' },
    triggerType: { type: String, default: '' },
    outcome: { type: String, enum: OUTCOMES, default: 'no_match' },
    channels: {
      inApp: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserNotification', default: null },
    variantKey: { type: String, default: '' },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: '' },
    firedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

automationLogSchema.index({ ruleId: 1, firedAt: -1 });
automationLogSchema.index({ userId: 1, firedAt: -1 });
automationLogSchema.index({ outcome: 1, firedAt: -1 });
// Auto-expire raw logs after 90 days.
automationLogSchema.index({ firedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('AutomationLog', automationLogSchema);
module.exports.OUTCOMES = OUTCOMES;
