const mongoose = require('mongoose');

const actorSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['user', 'admin', 'system'], required: true },
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    email: { type: String, default: '' },
    role: { type: String, default: 'user' },
  },
  { _id: false }
);

const auditLogSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    actor: { type: actorSchema, required: true },
    actionType: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true, default: () => new Date() },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    correlationId: { type: String, default: '' },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
      index: true,
    },
  },
  {
    timestamps: false,
    // Append-only: disable update and delete operations at schema level via middleware
    collection: 'auditlogs',
  }
);

// Compound indexes for common admin queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ actionType: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ 'actor.id': 1, timestamp: -1 });

// Block update and delete at the model level (immutability enforcement)
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], function () {
  throw new Error('AuditLog is immutable — records cannot be modified.');
});
auditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function () {
  throw new Error('AuditLog is immutable — records cannot be deleted.');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
