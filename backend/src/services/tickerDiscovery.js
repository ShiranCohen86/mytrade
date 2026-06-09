/**
 * Ticker Discovery Service
 *
 * Aggregates the full set of tickers the platform should track for intelligence
 * scoring. Merges four sources:
 *
 *   1. Static universe  — ~420 curated S&P 500 / NASDAQ 100 tickers
 *   2. User watchlists  — every symbol ever added by any user
 *   3. Audit log        — every symbol any user ever interacted with
 *   4. Discovered       — validated tickers found via news scanning or movers
 *
 * Returns a deduplicated, uppercase Set<string>.
 */

const WatchlistItem = require('../models/WatchlistItem');
const AuditLog      = require('../models/AuditLog');
const DiscoveredTicker = require('../models/DiscoveredTicker');
const UNIVERSE      = require('../data/stockUniverse');
const logger        = require('../utils/logger');

// Symbols that look like tickers but are not stocks — always skip these.
const BLOCKLIST = new Set([
  'US', 'UK', 'EU', 'GDP', 'CEO', 'CFO', 'IPO', 'ETF', 'ESG', 'AI', 'PE',
  'VC', 'FED', 'SEC', 'NYSE', 'IMF', 'BTC', 'ETH', 'USD', 'EUR', 'GBP',
  'LLC', 'INC', 'LTD', 'PLC', 'SA', 'AG', 'NV',
]);

/**
 * Returns the full deduplicated set of tickers to track.
 * Safe to call concurrently — each source query is independent.
 *
 * @returns {Promise<Set<string>>}
 */
async function getAllTickers() {
  const [watchlistSymbols, auditSymbols, discoveredSymbols] = await Promise.all([
    WatchlistItem.distinct('symbol').then((r) => r || []),
    AuditLog.distinct('metadata.symbol', {
      'metadata.symbol': { $exists: true, $ne: null, $gt: '' },
    }).then((r) => r || []),
    DiscoveredTicker.distinct('ticker', { validated: true, rejected: false })
      .then((r) => r || []),
  ]);

  const merged = new Set(UNIVERSE.map((t) => t.toUpperCase()));

  for (const sym of [...watchlistSymbols, ...auditSymbols, ...discoveredSymbols]) {
    const t = (sym || '').trim().toUpperCase();
    if (t.length >= 1 && t.length <= 5 && !BLOCKLIST.has(t)) {
      merged.add(t);
    }
  }

  logger.info('[ticker-discovery] Universe compiled', {
    static: UNIVERSE.length,
    watchlist: watchlistSymbols.length,
    audit: auditSymbols.length,
    discovered: discoveredSymbols.length,
    total: merged.size,
  });

  return merged;
}

/**
 * Saves a batch of newly found tickers (unvalidated) from a given source.
 * Skips tickers already in the DB. Does not validate — validation happens
 * in the newsTickerScan job.
 *
 * @param {string[]} tickers
 * @param {string}   source  e.g. 'news', 'movers'
 */
async function recordCandidates(tickers, source) {
  if (!tickers.length) return;

  const clean = [...new Set(
    tickers
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length >= 1 && t.length <= 5 && !BLOCKLIST.has(t))
  )];

  if (!clean.length) return;

  // Upsert each: add source entry only if not already present for this source.
  const now = new Date();
  const ops = clean.map((ticker) => ({
    updateOne: {
      filter: { ticker },
      update: {
        $setOnInsert: { ticker, validated: false, rejected: false },
        $push: { sources: { source, discoveredAt: now } },
      },
      upsert: true,
    },
  }));

  try {
    await DiscoveredTicker.bulkWrite(ops, { ordered: false });
  } catch (err) {
    // Ignore duplicate-key errors from concurrent upserts
    if (err.code !== 11000) logger.warn('[ticker-discovery] bulkWrite error', { err: err.message });
  }
}

/**
 * Validates a single ticker by attempting a Yahoo Finance quote fetch.
 * Marks the DB record as validated or rejected.
 *
 * @param {string} ticker
 * @returns {Promise<boolean>} true if valid stock
 */
async function validateTicker(ticker) {
  try {
    const provider = require('../providers/ProviderFactory');
    const quote = await provider.getCurrentQuote(ticker);
    const valid = !!(quote && quote.price && quote.price > 0);

    await DiscoveredTicker.updateOne(
      { ticker },
      valid
        ? { $set: { validated: true, validatedAt: new Date(), rejected: false } }
        : { $set: { rejected: true, rejectedReason: 'no market data' } }
    );

    return valid;
  } catch {
    await DiscoveredTicker.updateOne(
      { ticker },
      { $set: { rejected: true, rejectedReason: 'validation fetch failed' } }
    );
    return false;
  }
}

module.exports = { getAllTickers, recordCandidates, validateTicker };
