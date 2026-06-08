const mongoose = require('mongoose');

const watchlistItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    isDisabled: { type: Boolean, default: false, index: true },
    disabledAt: { type: Date, default: null },
    // null = user removed it themselves; ObjectId = admin force-disabled it
    disabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    disableReason: { type: String, default: '' },
    // Tracks how many times this item was re-added after removal
    addCount: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    collection: 'watchlistitems',
  }
);

// Unique per user+symbol pair — one row per user/symbol relationship
watchlistItemSchema.index({ userId: 1, symbol: 1 }, { unique: true });
watchlistItemSchema.index({ symbol: 1, isDisabled: 1 });

module.exports = mongoose.model('WatchlistItem', watchlistItemSchema);
