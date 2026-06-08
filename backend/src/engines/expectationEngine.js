// Estimates how much "good news" is already priced in (0-100).
// HIGH score = high bar to beat at earnings → harder to move stock up.

// Updated to 2024-2025 market multiples (source: S&P 500 sector P/E ranges)
const SECTOR_AVG_PE = {
  Technology: 38,
  'Information Technology': 38,
  Healthcare: 23,
  'Health Care': 23,
  Financials: 15,
  Energy: 13,
  Utilities: 18,
  'Consumer Discretionary': 28,
  'Consumer Staples': 22,
  Industrials: 24,
  Materials: 19,
  'Real Estate': 32,
  'Communication Services': 24,
  Biotech: 30,
  Biotechnology: 30,
  default: 22,
};

function momentumScore(historicalPrices) {
  if (!historicalPrices || historicalPrices.length < 30) return 15;

  const sorted = [...historicalPrices].sort((a, b) => new Date(a.date) - new Date(b.date));
  const current = sorted[sorted.length - 1].close;
  const price10 = sorted[Math.max(sorted.length - 11, 0)].close;
  const price30 = sorted[Math.max(sorted.length - 31, 0)].close;

  const momentum10 = ((current - price10) / price10) * 100;
  const momentum30 = ((current - price30) / price30) * 100;
  const avgMomentum = (momentum10 + momentum30) / 2;

  if (avgMomentum > 15) return 40;
  if (avgMomentum > 8) return 30;
  if (avgMomentum > 3) return 20;
  if (avgMomentum > 0) return 12;
  return 5;
}

function peScore(peRatio, sector) {
  if (!peRatio || peRatio <= 0) return 10;
  const sectorAvg = SECTOR_AVG_PE[sector] || SECTOR_AVG_PE.default;
  const ratio = peRatio / sectorAvg;

  if (ratio > 2.5) return 30;
  if (ratio > 2.0) return 25;
  if (ratio > 1.5) return 18;
  if (ratio > 1.0) return 12;
  return 5;
}

function analystTargetScore(currentPrice, analystTargetPrice) {
  if (!analystTargetPrice || !currentPrice || analystTargetPrice <= 0) return 10;
  const diff = ((currentPrice - analystTargetPrice) / analystTargetPrice) * 100;

  if (diff > 10) return 30;   // Price above analyst target — very high expectations
  if (diff > 5) return 24;
  if (diff > 0) return 18;
  if (diff > -5) return 12;
  if (diff > -10) return 8;
  return 3;
}

function recommendationScore(key) {
  if (!key) return 5;
  switch (key.toLowerCase()) {
    case 'strong_buy': return 22;
    case 'buy':        return 16;
    case 'hold':       return 8;
    case 'underperform':
    case 'sell':       return 2;
    case 'strong_sell': return 0;
    default: return 5;
  }
}

function expectationLabel(score) {
  if (score >= 76) return 'VERY_HIGH';
  if (score >= 56) return 'HIGH';
  if (score >= 34) return 'MODERATE';
  return 'LOW';
}

function calculate({ currentPrice, analystTargetPrice, peRatio, sector, historicalPrices, recommendationKey }) {
  const pts = {
    momentum: momentumScore(historicalPrices),
    pe: peScore(peRatio, sector),
    analystTarget: analystTargetScore(currentPrice, analystTargetPrice),
    recommendation: recommendationScore(recommendationKey),
  };

  const total = Math.min(100, pts.momentum + pts.pe + pts.analystTarget + pts.recommendation);

  return {
    score: Math.round(total),
    label: expectationLabel(total),
    breakdown: pts,
  };
}

module.exports = { calculate, SECTOR_AVG_PE };
