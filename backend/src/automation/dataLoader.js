/**
 * Batch data loaders for the automation jobs/engine — keeps evaluation cheap by
 * loading stocks, market indices, candidate users, and per-user flags once per
 * scan rather than per rule.
 */
const Stock = require('../models/Stock');
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const HotStockScore = require('../models/HotStockScore');
const provider = require('../providers/ProviderFactory');
const logger = require('../utils/logger');

const USER_FIELDS = '_id email displayName watchlist portfolio onboardingDone createdAt lastActiveAt isSuspended';

/** All non-suspended users (small-scale friendly; revisit with pagination at scale). */
async function loadActiveUsers() {
  return User.find({ isSuspended: { $ne: true } }).select(USER_FIELDS).lean();
}

/** Stocks + hot-scores for a ticker set, plus the four market indices. */
async function loadMarketData(tickers) {
  const list = [...new Set((tickers || []).filter(Boolean).map((t) => t.toUpperCase()))];
  const stocks = new Map();
  const hot = new Map();

  if (list.length) {
    const [stockDocs, hotDocs] = await Promise.all([
      Stock.find({ ticker: { $in: list } }).lean(),
      HotStockScore.find({ ticker: { $in: list } }).select('ticker hotScore trendStage').lean().catch(() => []),
    ]);
    stockDocs.forEach((s) => stocks.set(s.ticker, s));
    (hotDocs || []).forEach((hh) => hot.set(hh.ticker, hh));
  }

  const market = await loadIndices();
  return { stocks, hot, market };
}

async function loadIndices() {
  const map = { SPY: 'SPY', QQQ: 'QQQ', DIA: 'DIA', VIX: '^VIX' };
  const out = {};
  await Promise.all(Object.entries(map).map(async ([label, sym]) => {
    try {
      const q = await provider.getCurrentQuote(sym);
      out[label] = { price: q.price, change: q.change, changePercent: q.changePercent };
    } catch { out[label] = { price: null, change: null, changePercent: null }; }
  }));
  return out;
}

/** Coarse market regime from indices (used for market_regime_change). */
function deriveRegime(market) {
  const vix = market.VIX && market.VIX.price;
  const spy = market.SPY && market.SPY.changePercent;
  if (vix != null && vix >= 28) return 'VOLATILE';
  if (spy != null && spy <= -1.5) return 'BEARISH';
  if (spy != null && spy >= 1.5) return 'BULLISH';
  return 'NEUTRAL';
}

/** Sets of userIds that have notifications enabled / have installed the PWA. */
async function loadUserFlags(userIds) {
  const ids = userIds || [];
  const [notif, pwa] = await Promise.all([
    PushSubscription.distinct('userId', ids.length ? { userId: { $in: ids } } : {}),
    AnalyticsEvent.distinct('userId', { standalone: true, userId: ids.length ? { $in: ids } : { $ne: null } }),
  ]);
  return {
    hasNotif: new Set(notif.map(String)),
    isPwa: new Set(pwa.map(String)),
  };
}

/** Distinct tickers across all users' watchlists. */
async function allWatchlistTickers() {
  try { return (await User.distinct('watchlist', { isSuspended: { $ne: true } })).filter(Boolean); }
  catch { return []; }
}

function portfolioEntry(user, ticker) {
  return (user.portfolio || []).find((p) => p.ticker === ticker) || null;
}

module.exports = {
  loadActiveUsers, loadMarketData, loadIndices, deriveRegime, loadUserFlags, allWatchlistTickers, portfolioEntry,
};
