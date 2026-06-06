// Detects the current macro market environment using SPY and QQQ moving averages.
// Golden cross (SMA50 > SMA200) = bullish. Death cross = bearish. Tight crossover = volatile.
// Requires at least 200 data points for SMA200 to be meaningful.

const SMA200_MIN_DAYS = 200;

function sma(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(prices.length - period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

function calculate({ spyHistorical, qqqHistorical }) {
  const defaults = { regime: 'NEUTRAL', spySma50: null, spySma200: null, qqqSma20: null, qqqSma50: null };

  if (!spyHistorical || spyHistorical.length < 50) return defaults;
  if (!qqqHistorical || qqqHistorical.length < 50) return defaults;

  const spyCloses = spyHistorical.map((p) => p.close);
  const qqqCloses = qqqHistorical.map((p) => p.close);

  const spySma50 = sma(spyCloses, 50);
  // Only compute SMA200 when we have sufficient data; otherwise fall back to NEUTRAL
  const spySma200 = spyCloses.length >= SMA200_MIN_DAYS ? sma(spyCloses, 200) : null;
  const qqqSma20 = sma(qqqCloses, 20);
  const qqqSma50 = sma(qqqCloses, 50);

  let regime = 'NEUTRAL';

  if (spySma200 !== null) {
    const spread = Math.abs(spySma50 - spySma200) / spySma200;

    if (spread < 0.015) {
      // SMA50 within 1.5% of SMA200 — indecisive / transitional
      regime = 'VOLATILE';
    } else if (spySma50 > spySma200 && qqqSma20 > qqqSma50) {
      regime = 'BULLISH';
    } else if (spySma50 < spySma200 && qqqSma20 < qqqSma50) {
      regime = 'BEARISH';
    } else {
      regime = 'NEUTRAL';
    }
  }

  return {
    regime,
    spySma50: spySma50 !== null ? parseFloat(spySma50.toFixed(2)) : null,
    spySma200: spySma200 !== null ? parseFloat(spySma200.toFixed(2)) : null,
    qqqSma20: qqqSma20 !== null ? parseFloat(qqqSma20.toFixed(2)) : null,
    qqqSma50: qqqSma50 !== null ? parseFloat(qqqSma50.toFixed(2)) : null,
  };
}

module.exports = { calculate };
