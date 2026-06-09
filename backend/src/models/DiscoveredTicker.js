const mongoose = require('mongoose');

const discoveredTickerSchema = new mongoose.Schema(
  {
    ticker: { type: String, required: true, unique: true, uppercase: true, trim: true },
    sources: [
      {
        source: { type: String, required: true }, // 'news', 'watchlist', 'audit', 'movers'
        discoveredAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    validated: { type: Boolean, default: false },
    validatedAt: { type: Date, default: null },
    // Rejected tickers we should never retry (invalid symbols, ETFs we don't want, etc.)
    rejected: { type: Boolean, default: false },
    rejectedReason: { type: String, default: '' },
  },
  { timestamps: true, collection: 'discoveredtickers' }
);

discoveredTickerSchema.index({ validated: 1, rejected: 1 });

module.exports = mongoose.model('DiscoveredTicker', discoveredTickerSchema);
