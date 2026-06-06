const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  ticker: { type: String, uppercase: true, index: true },
  headline: String,
  url: String,
  source: String,
  publishedAt: Date,
  sentiment: {
    score: Number,
    comparative: Number,
    label: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' },
  },
  isGuidanceRelated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: '7d' },
});

module.exports = mongoose.model('News', newsSchema);
