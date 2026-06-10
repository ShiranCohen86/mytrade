/**
 * Cross-process advisory lock for cron jobs. The app runs the scheduler in-process,
 * so a restart/redeploy (or a future second instance) can fire the same job twice —
 * the in-memory `isRunning` flag only guards a single process. A short-lived,
 * self-expiring lock here makes duplicate fan-out (= duplicate user notifications)
 * impossible across processes. `_id` is the job name; `lockedUntil` is the expiry.
 */
const mongoose = require('mongoose');

const cronLockSchema = new mongoose.Schema(
  {
    _id: { type: String }, // job name, e.g. 'automation-market'
    lockedUntil: { type: Date, required: true },
    startedAt: { type: Date },
  },
  { versionKey: false }
);

module.exports = mongoose.models.CronLock || mongoose.model('CronLock', cronLockSchema);
