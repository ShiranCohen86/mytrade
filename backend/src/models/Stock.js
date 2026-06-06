const mongoose = require('mongoose');

const historicalPointSchema = new mongoose.Schema(
  {
    date: Date,
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number,
  },
  { _id: false }
);

const scenarioSchema = new mongoose.Schema(
  {
    priceTarget: Number,
    percentMove: Number,
    description: String,
    probability: Number,
  },
  { _id: false }
);

const scoreSnapshotSchema = new mongoose.Schema(
  {
    riskScore: Number,
    expectationScore: Number,
    analyzedAt: Date,
  },
  { _id: false }
);

const stockSchema = new mongoose.Schema(
  {
    ticker: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: { type: String, default: '' },
    sector: { type: String, default: 'Unknown' },

    cachedData: {
      price: Number,
      change: Number,
      changePercent: Number,
      volume: Number,
      marketCap: Number,
      peRatio: Number,
      analystTargetPrice: Number,
      beta: Number,
      historical: [historicalPointSchema],
      earningsDate: Date,
      earningsConfirmed: { type: Boolean, default: false },
      dayHigh: Number,
      dayLow: Number,
      fiftyTwoWeekHigh: Number,
      fiftyTwoWeekLow: Number,
      dividendYield: Number,
      spyPrice: Number,
    },
    // Set once on first analysis; used for relative-performance vs SPY calculation
    stockPriceAtAdd: Number,
    spyPriceAtAdd: Number,

    // Rolling score history — last 30 snapshots, most recent last
    scoreHistory: { type: [scoreSnapshotSchema], default: [] },

    analysis: {
      expectationScore: { type: Number, default: 0 },
      expectationLabel: { type: String, default: 'MODERATE' },
      riskScore: { type: Number, default: 0 },
      riskLabel: { type: String, default: 'MEDIUM' },
      riskBreakdown: {
        volatility: { type: Number, default: 0 },
        sector: { type: Number, default: 0 },
        earningsProximity: { type: Number, default: 0 },
        momentum: { type: Number, default: 0 },
        market: { type: Number, default: 0 },
      },
      scenarios: {
        bullish: scenarioSchema,
        neutral: scenarioSchema,
        bearish: scenarioSchema,
      },
      sentiment: {
        score: { type: Number, default: 0 },
        comparative: { type: Number, default: 0 },
        label: { type: String, default: 'neutral' },
        headlinesAnalyzed: { type: Number, default: 0 },
      },
      marketRegime: {
        type: String,
        enum: ['BULLISH', 'BEARISH', 'VOLATILE', 'NEUTRAL'],
        default: 'NEUTRAL',
      },
      preEarningsDrift: {
        type: String,
        enum: ['RISING', 'FLAT', 'FALLING'],
        default: 'FLAT',
      },
      driftPercent: { type: Number, default: 0 },
      isSellTheNewsRisk: { type: Boolean, default: false },
      analyzedAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { delete ret.__v; return ret; } },
  }
);

module.exports = mongoose.model('Stock', stockSchema);
