const mongoose = require('mongoose');

/**
 * Global per-user notification budget — enforces system-wide fatigue caps across
 * ALL automation rules (a user won't get more than N engine notifications per
 * hour/day regardless of how many rules match). Distinct from per-rule caps in
 * TriggerState.
 */
const userNotifyBudgetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    dayCount: { type: Number, default: 0 },
    dayResetAt: { type: Date, default: null },
    hourCount: { type: Number, default: 0 },
    hourResetAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserNotifyBudget', userNotifyBudgetSchema);
