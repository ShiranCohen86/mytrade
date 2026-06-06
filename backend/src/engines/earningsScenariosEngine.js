// Generates 3 earnings outcome scenarios with price targets and probabilities.
// Sector multipliers reflect how volatile earnings reactions tend to be by industry.

const SECTOR_MULTIPLIERS = {
  Biotech: 3.0,
  Biotechnology: 3.0,
  Healthcare: 2.5,
  'Health Care': 2.5,
  Technology: 2.0,
  'Information Technology': 2.0,
  'Communication Services': 1.8,
  'Consumer Discretionary': 1.5,
  Financials: 1.4,
  Energy: 1.4,
  Industrials: 1.3,
  Materials: 1.3,
  'Real Estate': 1.2,
  Utilities: 1.0,
  'Consumer Staples': 1.0,
  default: 1.5,
};

function annualizedVolatility(historicalPrices) {
  if (!historicalPrices || historicalPrices.length < 10) return 0.3;

  const sorted = [...historicalPrices].sort((a, b) => new Date(a.date) - new Date(b.date));
  const recent = sorted.slice(-30);

  const returns = [];
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1].close;
    const curr = recent[i].close;
    if (prev && prev > 0) returns.push((curr - prev) / prev);
  }

  if (returns.length < 5) return 0.3;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252);
}

function calculate({ currentPrice, historicalPrices, sector, preEarningsDrift, sentimentLabel, marketRegime, earningsDate }) {
  const annVol = annualizedVolatility(historicalPrices);
  const dailyVol = annVol / Math.sqrt(252);
  const multiplier = SECTOR_MULTIPLIERS[sector] || SECTOR_MULTIPLIERS.default;
  const baseMove = dailyVol * multiplier;

  // Base probabilities adjust with market regime
  let bullProb = 25;
  let neutralProb;
  if (marketRegime === 'BULLISH') {
    neutralProb = 30; bullProb += 5;
  } else if (marketRegime === 'BEARISH') {
    neutralProb = 30; bullProb -= 5;
  } else if (marketRegime === 'VOLATILE') {
    neutralProb = 25; // VOLATILE → wider tails, less neutral
  } else {
    neutralProb = 35;
  }

  // Earnings proximity: far-away earnings → higher neutral (less binary outcome)
  if (earningsDate) {
    const daysToEarnings = (new Date(earningsDate) - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysToEarnings > 30) neutralProb += 5; // earnings are far out — more time for mean reversion
  }

  if (preEarningsDrift === 'RISING') bullProb += 5;
  if (preEarningsDrift === 'FALLING') bullProb -= 5;
  if (sentimentLabel === 'positive') bullProb += 5;
  if (sentimentLabel === 'negative') bullProb -= 5;

  bullProb = Math.max(10, Math.min(50, bullProb));
  const bearProb = Math.max(5, 100 - bullProb - neutralProb);

  const upMove = currentPrice * baseMove * 1.5;
  const downMove = currentPrice * baseMove * 1.5;
  // Neutral: follows recent drift direction, flat (0) when no clear drift
  const neutralDir = preEarningsDrift === 'RISING' ? 1 : preEarningsDrift === 'FALLING' ? -1 : 0;
  const neutralShift = currentPrice * baseMove * 0.2 * neutralDir;

  const bullTarget = parseFloat((currentPrice + upMove).toFixed(2));
  const neutralTarget = parseFloat((currentPrice + neutralShift).toFixed(2));
  // Bear target capped at $0.01 but percentMove uses the capped price
  const rawBearTarget = currentPrice - downMove;
  const bearTarget = parseFloat(Math.max(rawBearTarget, 0.01).toFixed(2));

  const bullPct = parseFloat(((bullTarget - currentPrice) / currentPrice * 100).toFixed(1));
  const neutralPct = parseFloat(((neutralTarget - currentPrice) / currentPrice * 100).toFixed(1));
  const bearPct = parseFloat(((bearTarget - currentPrice) / currentPrice * 100).toFixed(1));

  return {
    bullish: {
      priceTarget: bullTarget,
      percentMove: bullPct,
      description: sentimentLabel === 'positive'
        ? 'Beat + raise guidance — strong market reaction expected'
        : 'Beat estimates with positive guidance revision',
      probability: bullProb,
    },
    neutral: {
      priceTarget: neutralTarget,
      percentMove: neutralPct,
      description: 'In-line results, no guidance change — muted price reaction',
      probability: neutralProb,
    },
    bearish: {
      priceTarget: bearTarget,
      percentMove: bearPct,
      description: preEarningsDrift === 'RISING'
        ? 'Sell-the-news — any miss or in-line result may trigger profit-taking'
        : 'Miss or guidance cut — sharp downside move',
      probability: bearProb,
    },
  };
}

module.exports = { calculate };
