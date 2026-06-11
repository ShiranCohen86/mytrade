/**
 * News Ticker Scan — discovers new stock tickers from broad financial news feeds.
 *
 * Schedule: every 6 hours.
 * Each run:
 *   1. Fetches headlines from several general financial RSS feeds
 *   2. Extracts ticker-like patterns (e.g. $AAPL, NYSE: AAPL, (AAPL))
 *   3. Saves new candidates to DiscoveredTicker (unvalidated)
 *   4. Validates up to MAX_VALIDATE_PER_RUN unvalidated tickers via Yahoo Finance
 *
 * Also runs once on startup to pick up movers from /api/market/movers.
 */

const cron = require('node-cron');
const Parser = require('rss-parser');
const logger = require('../utils/logger');
const { recordCandidates, validateTicker } = require('../services/tickerDiscovery');
const DiscoveredTicker = require('../models/DiscoveredTicker');
const { withCronLock } = require('../utils/cronLock');

const rssParser = new Parser({ timeout: 6000 });
const MAX_VALIDATE_PER_RUN = 20;

// ─── RSS Feeds ────────────────────────────────────────────────────────────────
// General financial market news — not per-ticker queries
const FEEDS = [
  { url: 'https://finance.yahoo.com/news/rssindex',                 name: 'Yahoo Finance' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/',   name: 'MarketWatch'   },
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',          name: 'WSJ Markets'   },
  { url: 'https://news.google.com/rss/search?q=business+finance+site:reuters.com&hl=en-US&gl=US&ceid=US:en', name: 'Reuters' },
  { url: 'https://news.google.com/rss/search?q=stock+market+earnings&hl=en-US&gl=US&ceid=US:en', name: 'Google News' },
];

// ─── Ticker Extraction ────────────────────────────────────────────────────────

// Patterns that reliably indicate a stock ticker (not random uppercase words):
//   $AAPL  |  (NASDAQ: AAPL)  |  NYSE: AAPL  |  AMEX: AAPL  |  (AAPL)
const TICKER_PATTERNS = [
  /\$([A-Z]{1,5})\b/g,                             // $AAPL
  /\b(?:NASDAQ|NYSE|AMEX|NYSEARCA):\s*([A-Z]{1,5})\b/g,  // NYSE: AAPL
  /\(([A-Z]{1,5})\)/g,                             // (AAPL)  — in financial context
];

// Words that are valid uppercase but are NOT tickers — supplement the service-level blocklist
const HEADLINE_NOISE = new Set([
  'CEO', 'CFO', 'CTO', 'IPO', 'ETF', 'GDP', 'FED', 'SEC', 'IMF', 'WHO',
  'EUR', 'USD', 'GBP', 'JPY', 'BTC', 'ETH', 'NFT', 'AI', 'US', 'UK',
  'EU', 'UN', 'PE', 'VC', 'ESG', 'LLC', 'INC', 'LTD', 'AND', 'FOR',
  'THE', 'BUT', 'NOT', 'NEW', 'ALL', 'OUT', 'OFF', 'TOP', 'LOW', 'HIGH',
  'BUY', 'SELL', 'HOLD', 'NOW', 'SAY', 'SAYS', 'SET', 'GET', 'PUT',
  'IRS', 'DOJ', 'FDA', 'CDC', 'NASA', 'DOD', 'CIA', 'FBI',
]);

function extractTickers(text) {
  const found = new Set();
  for (const pattern of TICKER_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const t = match[1].toUpperCase();
      if (!HEADLINE_NOISE.has(t)) found.add(t);
    }
  }
  return [...found];
}

// ─── Feed Fetcher ─────────────────────────────────────────────────────────────

async function fetchFeedTickers(feed) {
  try {
    const parsed = await rssParser.parseURL(feed.url);
    const tickers = [];
    for (const item of parsed.items || []) {
      const text = `${item.title || ''} ${item.contentSnippet || ''} ${item.content || ''}`;
      tickers.push(...extractTickers(text));
    }
    const unique = [...new Set(tickers)];
    logger.info(`[news-scan] ${feed.name}: ${parsed.items?.length ?? 0} items → ${unique.length} candidates`);
    return { feed, ok: true, tickers: unique };
  } catch (err) {
    logger.warn(`[news-scan] Feed failed: ${feed.name}`, { err: err.message });
    return { feed, ok: false, tickers: [] };
  }
}

// ─── Yahoo Movers ─────────────────────────────────────────────────────────────

async function fetchMoverTickers() {
  try {
    // yahoo-finance2 v3: instantiate the class; dailyGainers/dailyLosers are
    // deprecated and now throw — screener() is the supported replacement.
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
    const [gainers, losers] = await Promise.allSettled([
      yf.screener({ scrIds: 'day_gainers', count: 10, region: 'US' }),
      yf.screener({ scrIds: 'day_losers', count: 10, region: 'US' }),
    ]);
    const pick = (r) => (r.status === 'fulfilled' ? (r.value.quotes || []) : []);
    const tickers = [
      ...pick(gainers).map((q) => q.symbol),
      ...pick(losers).map((q) => q.symbol),
    ].filter(Boolean);
    logger.info(`[news-scan] Yahoo movers: ${tickers.length} tickers`);
    return tickers;
  } catch (err) {
    logger.warn('[news-scan] Movers fetch failed', { err: err.message });
    return [];
  }
}

// ─── Validation Pass ──────────────────────────────────────────────────────────

async function validatePending() {
  const pending = await DiscoveredTicker.find({ validated: false, rejected: false })
    .sort({ createdAt: 1 })
    .limit(MAX_VALIDATE_PER_RUN)
    .select('ticker')
    .lean();

  if (pending.length === 0) return;

  logger.info(`[news-scan] Validating ${pending.length} pending tickers`);

  let valid = 0;
  let invalid = 0;

  // Validate sequentially with a small delay to avoid hammering Yahoo
  for (const { ticker } of pending) {
    const ok = await validateTicker(ticker);
    if (ok) valid++; else invalid++;
    // 300ms between calls — same throttle as cacheRefresh
    await new Promise((r) => setTimeout(r, 300));
  }

  logger.info(`[news-scan] Validation done — ✓ ${valid}  ✗ ${invalid}`);
}

// ─── Main Scan ────────────────────────────────────────────────────────────────

let isRunning = false;

async function runScan() {
  if (isRunning) {
    logger.warn('[news-scan] Previous run still in progress — skipping');
    return;
  }
  isRunning = true;

  try {
    // 1. Fetch all feeds in parallel
    const feedResults = await Promise.all(FEEDS.map(fetchFeedTickers));
    const newsTickers = feedResults.flatMap((r) => r.tickers);

    // Consolidated feed-health summary — glanceable alternative to scanning per-feed logs
    const dead = feedResults.filter((r) => !r.ok).map((r) => r.feed.name);
    logger.info(
      `[news-scan] Feed health — ✓ ${FEEDS.length - dead.length}/${FEEDS.length} alive` +
        (dead.length ? `  ✗ dead: ${dead.join(', ')}` : '')
    );

    if (newsTickers.length > 0) {
      await recordCandidates(newsTickers, 'news');
    }

    // 2. Pull movers
    const moverTickers = await fetchMoverTickers();
    if (moverTickers.length > 0) {
      await recordCandidates(moverTickers, 'movers');
    }

    // 3. Validate a batch of pending tickers
    await validatePending();
  } catch (err) {
    logger.error('[news-scan] Scan failed', { err: err.message });
  } finally {
    isRunning = false;
  }
}

// Every 30 minutes. withCronLock keeps only one instance scanning feeds + validating
// tickers per tick on a multi-instance deploy (the exported runScan stays unguarded
// for intentional on-demand admin refreshes).
cron.schedule('*/30 * * * *', () => withCronLock('news-scan', 25 * 60 * 1000, async () => {
  logger.info('[news-scan] Starting scheduled ticker scan');
  await runScan();
}));

// Export for on-demand use (e.g. admin intelligence refresh)
module.exports = { runScan };

// Run once on startup (after a short delay to let DB connect)
setTimeout(() => {
  logger.info('[news-scan] Running startup scan');
  runScan();
}, 15_000);

logger.info('[news-scan] Registered — runs every 30 minutes');
