const mongoose = require('mongoose');

const MAX_WATCHLIST = 25;

const portfolioEntrySchema = new mongoose.Schema(
  {
    ticker: { type: String, uppercase: true, trim: true },
    entryPrice: { type: Number, min: 0 },
    shares: { type: Number, min: 0, default: null },
  },
  { _id: false }
);

const priceAlertSchema = new mongoose.Schema(
  {
    ticker: { type: String, uppercase: true, trim: true },
    targetPrice: { type: Number, min: 0 },
    direction: { type: String, enum: ['above', 'below'], default: 'above' },
    lastAlertNotifiedAt: { type: Date, default: null },
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
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, sparse: true },
    displayName: { type: String, default: '' },
    avatar: { type: String, default: '' },
    onboardingDone: { type: Boolean, default: false },
    resetToken: { type: String, select: false },
    resetTokenExpiry: { type: Date, select: false },
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
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.resetToken;
        delete ret.resetTokenExpiry;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
