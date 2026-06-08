const mongoose = require('mongoose');

const signalSchema = new mongoose.Schema(
  {
    name: { type: String },
    value: { type: mongoose.Schema.Types.Mixed },
    contribution: { type: Number },
  },
  { _id: false }
);

const historyEntrySchema = new mongoose.Schema(
  {
    hotScore: { type: Number },
    trendStage: { type: String },
    computedAt: { type: Date },
  },
  { _id: false }
);

const hotStockScoreSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, uppercase: true },
    name: { type: String, default: '' },
    sector: { type: String, default: 'Unknown' },

    hotScore: { type: Number, default: 0, min: 0, max: 100 },
    momentumScore: { type: Number, default: 0 },
    saturationIndex: { type: Number, default: 0 },

    trendStage: {
      type: String,
      enum: ['emerging', 'accelerating', 'trending', 'saturated'],
      default: 'emerging',
    },
    confidence: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },

    signals: {
      recentAdds_48h: { type: Number, default: 0 },
      prevAdds_48h: { type: Number, default: 0 },
      addGrowthRate: { type: Number, default: 0 },
      totalActiveWatchers: { type: Number, default: 0 },
      recentInteractions_48h: { type: Number, default: 0 },
      prevInteractions_48h: { type: Number, default: 0 },
      interactionGrowthRate: { type: Number, default: 0 },
      uniqueUsers_48h: { type: Number, default: 0 },
    },

    topContributors: [signalSchema],
    explanation: { type: String, default: '' },

    computedAt: { type: Date, default: () => new Date() },

    // Rolling window of last 30 score snapshots for trend graphs
    scoreHistory: {
      type: [historyEntrySchema],
      default: [],
    },
  },
  {
    timestamps: false,
    collection: 'hotstockscores',
  }
);

hotStockScoreSchema.index({ symbol: 1 }, { unique: true });
hotStockScoreSchema.index({ hotScore: -1 });
hotStockScoreSchema.index({ trendStage: 1, hotScore: -1 });
hotStockScoreSchema.index({ computedAt: -1 });

module.exports = mongoose.model('HotStockScore', hotStockScoreSchema);
