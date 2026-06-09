const mongoose = require('mongoose');

/**
 * Product-analytics event (client funnel telemetry: install, notifications,
 * activation, retention, PWA health). Separate from the immutable AuditLog —
 * this is high-volume, best-effort, and auto-expires.
 */
const analyticsEventSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    deviceId: { type: String, default: '', index: true },
    sessionId: { type: String, default: '' },
    platform: { type: String, default: '' }, // ios | android | desktop
    standalone: { type: Boolean, default: false },
    appVersion: { type: String, default: '' },
    appBuild: { type: String, default: '' },
    lang: { type: String, default: '' },
    props: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    ts: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false, collection: 'analyticsevents' }
);

// Common aggregation paths.
analyticsEventSchema.index({ event: 1, ts: -1 });
analyticsEventSchema.index({ userId: 1, ts: -1 });
analyticsEventSchema.index({ deviceId: 1, ts: -1 });

// Bound storage: auto-expire raw events after 180 days (also serves ts lookups).
analyticsEventSchema.index({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
