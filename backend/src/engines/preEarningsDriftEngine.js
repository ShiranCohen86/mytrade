// Measures how much the stock has moved in the 10 trading days before earnings.
// Only meaningful when earnings are within the next 60 days.
// A large upward drift (>10% or >1.5× 10-day expected move) is the primary "sell-the-news" risk indicator.

function dailyStdDev(prices) {
  if (prices.length < 5) return null;
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1].close;
    const curr = prices[i].close;
    if (prev && prev > 0) returns.push((curr - prev) / prev);
  }
  if (returns.length < 4) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

function calculate({ historicalPrices, earningsDate }) {
  const noSignal = { drift: 'FLAT', driftPercent: 0, isSellTheNewsRisk: false };

  if (!historicalPrices || historicalPrices.length < 11) return noSignal;

  // Drift is only relevant when earnings are imminent (within 60 days)
  if (earningsDate) {
    const daysToEarnings = (new Date(earningsDate) - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysToEarnings < 0 || daysToEarnings > 60) return noSignal;
  } else {
    return noSignal; // No upcoming earnings known → drift has no context
  }

  const sorted = [...historicalPrices].sort((a, b) => new Date(a.date) - new Date(b.date));
  const current = sorted[sorted.length - 1].close;
  const past = sorted[Math.max(sorted.length - 11, 0)].close;

  if (!past || past === 0) return noSignal;

  const driftPercent = ((current - past) / past) * 100;

  // Use stock's own recent volatility to set a dynamic drift threshold.
  // 1-sigma 10-day expected move: dailyStdDev * sqrt(10) * 100%.
  // Threshold = max(3%, 0.75 × 1-sigma 10-day move).
  const sigma = dailyStdDev(sorted.slice(-20));
  const dynamicThreshold = sigma
    ? Math.max(3, 0.75 * sigma * Math.sqrt(10) * 100)
    : 3;

  let drift;
  if (driftPercent > dynamicThreshold) drift = 'RISING';
  else if (driftPercent < -dynamicThreshold) drift = 'FALLING';
  else drift = 'FLAT';

  // STN: drift must exceed 10% OR 1.5× the stock's own 10-day expected move (whichever is higher).
  // High-vol stocks need a larger absolute move to signal unusual pre-earnings run-up.
  const expectedMove10d = sigma ? 1.5 * sigma * Math.sqrt(10) * 100 : 10;
  const stnThreshold = Math.max(10, expectedMove10d);

  return {
    drift,
    driftPercent: parseFloat(driftPercent.toFixed(2)),
    isSellTheNewsRisk: driftPercent > stnThreshold,
  };
}

module.exports = { calculate };
