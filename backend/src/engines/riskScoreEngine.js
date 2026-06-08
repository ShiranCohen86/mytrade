// Composite risk score (0-100) across 6 dimensions.
// Weights: volatility(25) + sector(20) + earningsProximity(25) + momentum(15) + market(15) + beta bonus
// Special rule: >10% pre-earnings drift adds a flat +20 "sell-the-news" bonus.

const SECTOR_RISK = {
  Healthcare: 20,
  'Health Care': 20,
  Biotech: 20,
  Biotechnology: 20,
  Technology: 10,
  'Information Technology': 10,
  'Communication Services': 8,
  'Consumer Discretionary': 6,
  Financials: 8,
  Energy: 8,
  Industrials: 6,
  Materials: 6,
  'Real Estate': 4,
  Utilities: 0,
  'Consumer Staples': 0,
  default: 8,
};

function volatilityScore(historicalPrices) {
  if (!historicalPrices || historicalPrices.length < 20) return 10;

  const sorted = [...historicalPrices].sort((a, b) => new Date(a.date) - new Date(b.date));
  const recent = sorted.slice(-60);

  const returns = [];
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    // Skip returns that span a long gap (>5 calendar days) — data holes distort volatility
    const calendarGap = (new Date(curr.date) - new Date(prev.date)) / (1000 * 60 * 60 * 24);
    if (calendarGap > 5) continue;
    if (prev.close && prev.close > 0) {
      returns.push((curr.close - prev.close) / prev.close);
    }
  }

  if (returns.length < 5) return 10;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
  const dailyStdDev = Math.sqrt(variance);
  const annualizedVol = dailyStdDev * Math.sqrt(252) * 100; // as percentage

  if (annualizedVol > 80) return 25;
  if (annualizedVol > 50) return 18;
  if (annualizedVol > 30) return 12;
  return 5;
}

function sectorScore(sector) {
  return SECTOR_RISK[sector] !== undefined ? SECTOR_RISK[sector] : SECTOR_RISK.default;
}

function earningsProximityScore(earningsDate) {
  if (!earningsDate) return 0;
  const daysUntil = (new Date(earningsDate) - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysUntil < 0) return 0; // past earnings date — proximity risk is gone
  if (daysUntil <= 7) return 25;
  if (daysUntil <= 14) return 20;
  if (daysUntil <= 30) return 12;
  if (daysUntil <= 60) return 5;
  return 0;
}

function momentumScore(preEarningsDrift, expectationScore) {
  if (preEarningsDrift === 'RISING' && expectationScore > 70) return 15;
  if (preEarningsDrift === 'RISING') return 10;
  if (preEarningsDrift === 'FALLING') return 8;
  return 5;
}

function marketScore(marketRegime) {
  const map = { BEARISH: 15, VOLATILE: 12, NEUTRAL: 7, BULLISH: 3 };
  return map[marketRegime] || 7;
}

// Beta bonus: high-beta stocks amplify market moves — add up to 5 pts for beta > 1.5
function betaBonus(beta) {
  if (!beta || beta <= 0) return 0;
  if (beta >= 2.5) return 5;
  if (beta >= 2.0) return 4;
  if (beta >= 1.5) return 2;
  return 0;
}

// Volume anomaly bonus: unusual volume spikes (>2× 20-day average) signal heightened activity
function volumeAnomalyBonus(historicalPrices) {
  if (!historicalPrices || historicalPrices.length < 21) return 0;
  const sorted = [...historicalPrices].sort((a, b) => new Date(a.date) - new Date(b.date));
  const recent = sorted.slice(-21);
  const todayVol = recent[recent.length - 1].volume;
  if (!todayVol) return 0;
  const avg20 = recent.slice(0, 20).reduce((s, p) => s + (p.volume || 0), 0) / 20;
  if (avg20 === 0) return 0;
  const ratio = todayVol / avg20;
  if (ratio >= 3) return 8;
  if (ratio >= 2) return 5;
  if (ratio >= 1.5) return 2;
  return 0;
}

function riskLabel(score) {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

function calculate({ historicalPrices, sector, earningsDate, preEarningsDrift, isSellTheNewsRisk, marketRegime, expectationScore, beta }) {
  const breakdown = {
    volatility: volatilityScore(historicalPrices),
    sector: sectorScore(sector),
    earningsProximity: earningsProximityScore(earningsDate),
    momentum: momentumScore(preEarningsDrift, expectationScore),
    market: marketScore(marketRegime),
  };

  let total = Object.values(breakdown).reduce((s, v) => s + v, 0);

  // Beta bonus (not in breakdown to keep display clean)
  total += betaBonus(beta);

  // Volume anomaly: unusual volume spikes add risk signal
  total += volumeAnomalyBonus(historicalPrices);

  // Sell-the-news bonus: sharp pre-earnings rally significantly raises sell risk
  if (isSellTheNewsRisk) {
    total += 20;
  }

  total = Math.min(100, Math.round(total));

  return {
    total,
    label: riskLabel(total),
    breakdown,
    sellTheNewsBonusApplied: isSellTheNewsRisk,
  };
}

module.exports = { calculate };
