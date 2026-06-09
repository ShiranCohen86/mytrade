// Context-emphasis engine — pure, no React, no I/O.
// Given a watchlist stock (+ the user's per-stock portfolio entry / price alert),
// decide how strongly to emphasize or mute its row, and surface the reasons.
// Reuses already-loaded data (cachedData / analysis) — never refetches.

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function daysUntil(dateLike) {
  if (!dateLike) return null;
  const t = new Date(dateLike).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}

// Earnings date can live under a few different keys depending on the provider/cache.
function earningsDate(stock) {
  const c = stock?.cachedData || {};
  const a = stock?.analysis || {};
  return (
    c.earningsDate || c.nextEarningsDate || c.earningsTimestamp ||
    a.earningsDate || a.nextEarningsDate || stock?.earningsDate || null
  );
}

const fmtPct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

/**
 * @returns {{ level:'hot'|'watch'|'normal'|'muted', tone:('pos'|'neg'|'warn'|'accent'|null), signals:Array, score:number }}
 */
export function computeEmphasis({ stock, priceAlert = null, portfolioEntry = null } = {}) {
  const c = stock?.cachedData || {};
  const a = stock?.analysis || {};
  const signals = [];

  // 1) Strong move today
  const change = num(c.changePercent);
  if (change != null) {
    const mag = Math.abs(change);
    const tone = change >= 0 ? 'pos' : 'neg';
    if (mag >= 6) signals.push({ key: 'bigMove', label: `${fmtPct(change)} today`, tone, weight: 3 });
    else if (mag >= 3) signals.push({ key: 'bigMove', label: `${fmtPct(change)} today`, tone, weight: 2 });
    else if (mag >= 1.5) signals.push({ key: 'move', label: `${fmtPct(change)} today`, tone, weight: 1 });
  }

  // 2) Price-alert trigger / proximity
  const price = num(c.price);
  const alertTarget = num(priceAlert?.targetPrice);
  if (price != null && alertTarget != null) {
    const triggered = priceAlert.direction === 'above' ? price >= alertTarget : price <= alertTarget;
    const distPct = Math.abs((price - alertTarget) / alertTarget) * 100;
    if (triggered) signals.push({ key: 'alert', label: 'Alert triggered', tone: 'accent', weight: 3 });
    else if (distPct <= 2) signals.push({ key: 'alertNear', label: 'Near alert price', tone: 'accent', weight: 2 });
    else if (distPct <= 5) signals.push({ key: 'alertNear', label: 'Approaching alert', tone: 'accent', weight: 1 });
  }

  // 3) Near target / stop (only when those fields are set on the portfolio entry)
  const tgt = num(portfolioEntry?.targetPrice);
  const stop = num(portfolioEntry?.stopPrice);
  if (price != null && tgt != null && Math.abs((price - tgt) / tgt) * 100 <= 3) {
    signals.push({ key: 'target', label: 'Near target', tone: 'pos', weight: 2 });
  }
  if (price != null && stop != null && Math.abs((price - stop) / stop) * 100 <= 3) {
    signals.push({ key: 'stop', label: 'Near stop', tone: 'neg', weight: 2 });
  }

  // 4) Earnings soon
  const dEarn = daysUntil(earningsDate(stock));
  if (dEarn != null && dEarn >= 0) {
    if (dEarn <= 7) signals.push({ key: 'earnings', label: dEarn === 0 ? 'Earnings today' : `Earnings in ${dEarn}d`, tone: 'warn', weight: 2 });
    else if (dEarn <= 14) signals.push({ key: 'earnings', label: `Earnings in ${dEarn}d`, tone: 'warn', weight: 1 });
  }

  // 5) Expectation extremes (high = a lot already priced in → cautionary; low = room to run)
  const exp = num(a.expectationScore);
  const expLabel = a.expectationLabel;
  if (expLabel === 'VERY_HIGH' || (exp != null && exp >= 80)) {
    signals.push({ key: 'expHigh', label: 'Very high expectations', tone: 'warn', weight: 1 });
  } else if (expLabel === 'LOW' || (exp != null && exp <= 28)) {
    signals.push({ key: 'expLow', label: 'Low expectations · room to run', tone: 'pos', weight: 1 });
  }

  // 6) Elevated risk
  const risk = num(a.riskScore);
  if (risk != null && risk >= 72) signals.push({ key: 'risk', label: 'Elevated risk', tone: 'warn', weight: 1 });

  // Aggregate → level + dominant tone
  const total = signals.reduce((s, x) => s + x.weight, 0);
  const top = signals.slice().sort((x, y) => y.weight - x.weight)[0] || null;
  const maxWeight = top?.weight ?? 0;

  let level;
  if (maxWeight >= 3 || total >= 4) level = 'hot';
  else if (total >= 2) level = 'watch';
  else if (total >= 1) level = 'normal';
  else {
    const flat = change == null || Math.abs(change) < 0.6;
    level = flat ? 'muted' : 'normal';
  }

  return { level, tone: top?.tone ?? null, signals, score: total };
}

const HOT_CLASS = { pos: 'emph-hot-pos', neg: 'emph-hot-neg', accent: 'emph-hot-accent', warn: 'emph-hot-accent' };

// Map an emphasis result to a global utility class (defined in globals.scss).
export function emphasisClassName(emphasis) {
  if (!emphasis) return '';
  if (emphasis.level === 'hot') return HOT_CLASS[emphasis.tone] || 'emph-hot-accent';
  if (emphasis.level === 'watch') return 'emph-watch';
  if (emphasis.level === 'muted') return 'emph-muted';
  return '';
}
