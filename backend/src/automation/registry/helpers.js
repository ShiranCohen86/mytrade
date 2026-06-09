/** Shared accessors/indicators over a Stock doc's cachedData.historical series. */
const cd = (s) => (s && s.cachedData) || {};
const an = (s) => (s && s.analysis) || {};
const hist = (s) => cd(s).historical || [];

const price = (s) => cd(s).price;
const changePercent = (s) => cd(s).changePercent;

function closes(s, n) {
  return hist(s).map((h) => h.close).filter((x) => x != null).slice(-n);
}
function sma(s, n) {
  const c = closes(s, n);
  return c.length >= n ? c.reduce((a, b) => a + b, 0) / c.length : null;
}
function smaAt(s, n, backFromEnd) {
  // SMA computed ending `backFromEnd` bars before the last bar (for cross detection).
  const all = hist(s).map((h) => h.close).filter((x) => x != null);
  const end = all.length - backFromEnd;
  if (end < n) return null;
  const slice = all.slice(end - n, end);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}
function avgVolume(s, n = 20) {
  const v = hist(s).map((h) => h.volume).filter((x) => x != null).slice(-(n + 1), -1);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function recentHigh(s, n) {
  const h = hist(s).map((x) => x.high).filter((x) => x != null).slice(-(n + 1), -1);
  return h.length ? Math.max(...h) : null;
}
function recentLow(s, n) {
  const l = hist(s).map((x) => x.low).filter((x) => x != null).slice(-(n + 1), -1);
  return l.length ? Math.min(...l) : null;
}
const REC_ORDER = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'];
function recRank(k) {
  const i = REC_ORDER.indexOf(String(k || '').toLowerCase());
  return i < 0 ? null : i;
}
const round = (n, d = 2) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
const today = () => new Date().toISOString().slice(0, 10);

module.exports = {
  cd, an, hist, price, changePercent, closes, sma, smaAt, avgVolume,
  recentHigh, recentLow, recRank, round, today,
};
