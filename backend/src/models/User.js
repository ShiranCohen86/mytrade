const mongoose = require('mongoose');

const MAX_WATCHLIST = 25;

const portfolioEntrySchema = new mongoose.Schema(
  { ticker: { type: String, uppercase: true, trim: true }, entryPrice: { type: Number, min: 0 } },
  { _id: false }
);

const priceAlertSchema = new mongoose.Schema(
  {
    ticker: { type: String, uppercase: true, trim: true },
    targetPrice: { type: Number, min: 0 },
    direction: { type: String, enum: ['above', 'below'], default: 'above' },
  },
  { _id: false }
);

const stockNoteSchema = new mongoose.Schema(
  {
    ticker: { type: String, uppercase: true, trim: true },
    text: { type: String, maxlength: 1000, default: '' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    watchlist: {
      type: [{ type: String, uppercase: true, trim: true }],
      validate: {
        validator: (arr) => arr.length <= MAX_WATCHLIST,
        message: `Watchlist cannot exceed ${MAX_WATCHLIST} stocks.`,
      },
    },
    portfolio: { type: [portfolioEntrySchema], default: [] },
    priceAlerts: { type: [priceAlertSchema], default: [] },
    notes: { type: [stockNoteSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { delete ret.__v; return ret; } },
  }
);

module.exports = mongoose.model('User', userSchema);
