const express = require('express');
const router = express.Router();
const stockService = require('../services/stockService');
const newsService = require('../services/newsService');
const { Stock, User } = require('../db');
const WatchlistItem = require('../models/WatchlistItem');
const provider = require('../providers/ProviderFactory');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const audit = require('../services/auditService');
const { getSector } = require('../services/sectorService');

const MAX_WATCHLIST = 25;

// All stock routes require authentication
router.use(auth);

function safeError(err) {
  if (!err || !err.message) return 'An unexpected error occurred.';
  const msg = err.message;
  if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no market data')) {
    return msg;
  }
  if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
    return 'Data provider rate limit reached. Please try again later.';
  }
  return 'An unexpected error occurred. Please try again.';
}

async function getUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found.');
  return user;
}

function sanitizeTicker(raw) {
  return raw.toUpperCase().replace(/[^A-Z0-9.]/g, '');
}

// GET /api/search?q=AAPL — typeahead search (max 8 equity results)
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 10);
  if (!q) return res.json([]);
  try {
    const results = await provider.search(q);
    // Log search events for queries of meaningful length (avoids single-char noise)
    if (q.length >= 2) {
      audit.logUser(req, 'stock.searched', { query: q, resultCount: results.length });
    }
    res.json(results);
  } catch {
    res.json([]);
  }
});

// GET /api/stocks — list watchlist with latest analysis
router.get('/stocks', async (req, res) => {
  try {
    const stocks = await stockService.getWatchlist(req.user.id);
    res.json(stocks);
  } catch (err) {
    logger.error('GET /stocks', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// POST /api/stocks — add ticker, run full analysis
router.post('/stocks', async (req, res) => {
  try {
    const { ticker } = req.body;
    if (!ticker || !/^[A-Za-z]{1,5}$/.test(ticker.trim())) {
      return res.status(400).json({ error: 'Invalid ticker. Must be 1–5 letters (e.g. AAPL).' });
    }

    const t = ticker.trim().toUpperCase();
    const user = await getUser(req.user.id);

    if (user.watchlist.includes(t)) {
      return res.status(409).json({ error: `${t} is already in your watchlist.` });
    }

    if (user.watchlist.length >= MAX_WATCHLIST) {
      return res.status(400).json({ error: `Watchlist limit reached (max ${MAX_WATCHLIST} stocks).` });
    }

    try {
      const q = await provider.getCurrentQuote(t);
      if (!q || q.price == null) {
        return res.status(404).json({ error: `Ticker "${t}" not found or has no market data.` });
      }
    } catch (checkErr) {
      const isNotFound = checkErr.message && (
        checkErr.message.includes('not found') ||
        checkErr.message.includes('no market data') ||
        checkErr.message.includes('No fundamentals')
      );
      return res.status(isNotFound ? 404 : 500).json({ error: safeError(checkErr) });
    }

    const stock = await stockService.analyzeStock(t);

    try {
      await User.updateOne({ _id: req.user.id }, { $addToSet: { watchlist: t } });
    } catch (watchlistErr) {
      // Only clean up the Stock doc if no other user tracks this ticker
      const otherTrackers = await User.countDocuments({ _id: { $ne: req.user.id }, watchlist: t }).catch(() => 1);
      if (otherTrackers === 0) await Stock.deleteOne({ ticker: t }).catch(() => {});
      throw watchlistErr;
    }

    // Soft-delete tracking: upsert WatchlistItem (re-enable if previously disabled)
    WatchlistItem.findOneAndUpdate(
      { userId: req.user.id, symbol: t },
      { $set: { isDisabled: false, disabledAt: null, disabledBy: null, disableReason: '' }, $inc: { addCount: 1 } },
      { upsert: true, new: true }
    ).catch(() => {});

    audit.logUser(req, 'watchlist.add', { symbol: t, sector: getSector(t) });

    res.status(201).json(stock);
  } catch (err) {
    logger.error('POST /stocks', { err: err.message });
    const isNotFound = err.message && (
      err.message.includes('not found') ||
      err.message.includes('no market data') ||
      err.message.includes('No fundamentals data found')
    );
    res.status(isNotFound ? 404 : 500).json({ error: safeError(err) });
  }
});

// DELETE /api/stocks/:ticker — remove from watchlist; delete Stock doc only if no other user tracks it
router.delete('/stocks/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const user = await getUser(req.user.id);
    if (!user.watchlist.includes(t)) {
      return res.status(404).json({ error: `${t} is not in your watchlist.` });
    }
    await User.updateOne({ _id: req.user.id }, { $pull: { watchlist: t } });
    const otherUsers = await User.countDocuments({ _id: { $ne: req.user.id }, watchlist: t });
    if (otherUsers === 0) await Stock.deleteOne({ ticker: t });

    // Soft-delete tracking: mark as disabled instead of deleting
    WatchlistItem.findOneAndUpdate(
      { userId: req.user.id, symbol: t },
      { $set: { isDisabled: true, disabledAt: new Date(), disabledBy: null, disableReason: '' } }
    ).catch(() => {});

    audit.logUser(req, 'watchlist.remove', { symbol: t, sector: getSector(t) });

    res.status(204).send();
  } catch (err) {
    logger.error('DELETE /stocks/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// GET /api/stocks/:ticker/analysis — full analysis for a ticker in the watchlist
router.get('/stocks/:ticker/analysis', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const user = await getUser(req.user.id);
    if (!user.watchlist.includes(t)) {
      return res.status(403).json({ error: `${t} is not in your watchlist.` });
    }
    const stock = await Stock.findOne({ ticker: t }).lean();
    if (!stock) {
      return res.status(404).json({ error: `${t} not found. Add it to your watchlist first.` });
    }
    // Fire-and-forget: log view event enriched with live price context
    audit.logUser(req, 'stock.viewed', {
      symbol:          t,
      sector:          getSector(t),
      price_at_event:  stock.currentPrice ?? stock.price ?? null,
      price_change_24h: stock.changePercent ?? stock.dailyChangePercent ?? null,
    });
    res.json(stock);
  } catch (err) {
    logger.error('GET /stocks/:ticker/analysis', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// POST /api/refresh/:ticker — force re-fetch and re-analyze
router.post('/refresh/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const user = await getUser(req.user.id);
    if (!user.watchlist.includes(t)) {
      return res.status(404).json({ error: `${t} is not in your watchlist.` });
    }
    const stock = await stockService.analyzeStock(t);
    res.json(stock);
  } catch (err) {
    logger.error('POST /refresh/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// GET /api/stocks/:ticker/quote — single-ticker live price (used by detail page polling)
router.get('/stocks/:ticker/quote', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const user = await getUser(req.user.id);
    if (!user.watchlist.includes(t)) {
      return res.status(403).json({ error: `${t} is not in your watchlist.` });
    }
    const q = await provider.getCurrentQuote(t);
    res.json({
      ticker: t,
      price: q.price, change: q.change, changePercent: q.changePercent,
      marketState: q.marketState,
      preMarketPrice: q.preMarketPrice, preMarketChange: q.preMarketChange, preMarketChangePercent: q.preMarketChangePercent,
      postMarketPrice: q.postMarketPrice, postMarketChange: q.postMarketChange, postMarketChangePercent: q.postMarketChangePercent,
    });
  } catch (err) {
    logger.error('GET /stocks/:ticker/quote', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// GET /api/quotes — live price + change for all watchlist tickers (fast, no analysis)
router.get('/quotes', async (req, res) => {
  try {
    const user = await getUser(req.user.id);
    if (!user.watchlist.length) return res.json([]);

    const quotes = await Promise.all(
      user.watchlist.map(async (ticker) => {
        try {
          const q = await provider.getCurrentQuote(ticker);
          return {
            ticker, price: q.price, change: q.change, changePercent: q.changePercent,
            marketState: q.marketState,
            preMarketPrice: q.preMarketPrice, preMarketChange: q.preMarketChange, preMarketChangePercent: q.preMarketChangePercent,
            postMarketPrice: q.postMarketPrice, postMarketChange: q.postMarketChange, postMarketChangePercent: q.postMarketChangePercent,
          };
        } catch {
          return { ticker, price: null, change: null, changePercent: null };
        }
      })
    );
    res.json(quotes);
  } catch (err) {
    logger.error('GET /quotes', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// ─── Portfolio (P&L) endpoints ────────────────────────────────────────────────

router.get('/portfolio', async (req, res) => {
  try {
    const user = await getUser(req.user.id);
    res.json(user.portfolio || []);
  } catch (err) {
    logger.error('GET /portfolio', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

router.put('/portfolio/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const entryPrice = parseFloat(req.body.entryPrice);
    if (!isFinite(entryPrice) || entryPrice < 0) {
      return res.status(400).json({ error: 'entryPrice must be a non-negative number.' });
    }
    const sharesRaw = req.body.shares;
    const shares = sharesRaw != null ? parseFloat(sharesRaw) : null;
    if (shares !== null && (!isFinite(shares) || shares < 0)) {
      return res.status(400).json({ error: 'shares must be a non-negative number.' });
    }
    const user = await getUser(req.user.id);
    if (!user.watchlist.includes(t)) {
      return res.status(403).json({ error: `${t} is not in your watchlist.` });
    }
    const idx = user.portfolio.findIndex((p) => p.ticker === t);
    if (idx >= 0) {
      user.portfolio[idx].entryPrice = entryPrice;
      user.portfolio[idx].shares = shares;
    } else {
      user.portfolio.push({ ticker: t, entryPrice, shares });
    }
    await user.save();
    audit.logUser(req, 'portfolio.set', { symbol: t, sector: getSector(t), entryPrice, shares });
    res.json({ ticker: t, entryPrice, shares });
  } catch (err) {
    logger.error('PUT /portfolio/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/portfolio/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const user = await getUser(req.user.id);
    user.portfolio = user.portfolio.filter((p) => p.ticker !== t);
    await user.save();
    audit.logUser(req, 'portfolio.removed', { symbol: t, sector: getSector(t) });
    res.status(204).send();
  } catch (err) {
    logger.error('DELETE /portfolio/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// ─── Price Alerts endpoints ────────────────────────────────────────────────────

router.get('/alerts', async (req, res) => {
  try {
    const user = await getUser(req.user.id);
    res.json(user.priceAlerts || []);
  } catch (err) {
    logger.error('GET /alerts', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

router.put('/alerts/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const targetPrice = parseFloat(req.body.targetPrice);
    const direction = req.body.direction === 'below' ? 'below' : 'above';
    if (!isFinite(targetPrice) || targetPrice < 0) {
      return res.status(400).json({ error: 'targetPrice must be a non-negative number.' });
    }
    const user = await getUser(req.user.id);
    if (!user.watchlist.includes(t)) {
      return res.status(403).json({ error: `${t} is not in your watchlist.` });
    }
    const idx = user.priceAlerts.findIndex((a) => a.ticker === t);
    if (idx >= 0) {
      user.priceAlerts[idx].targetPrice = targetPrice;
      user.priceAlerts[idx].direction = direction;
    } else {
      user.priceAlerts.push({ ticker: t, targetPrice, direction });
    }
    await user.save();
    audit.logUser(req, 'alert.set', { symbol: t, sector: getSector(t), targetPrice, direction });
    res.json({ ticker: t, targetPrice, direction });
  } catch (err) {
    logger.error('PUT /alerts/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/alerts/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const user = await getUser(req.user.id);
    user.priceAlerts = user.priceAlerts.filter((a) => a.ticker !== t);
    await user.save();
    audit.logUser(req, 'alert.removed', { symbol: t, sector: getSector(t) });
    res.status(204).send();
  } catch (err) {
    logger.error('DELETE /alerts/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// ─── Watchlist reorder ────────────────────────────────────────────────────────

router.put('/watchlist/order', async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order) || order.some((t) => typeof t !== 'string')) {
      return res.status(400).json({ error: 'order must be an array of ticker strings.' });
    }
    const user = await getUser(req.user.id);
    const sanitized = order.map(sanitizeTicker);
    const valid = sanitized.filter((t) => user.watchlist.includes(t));
    const missing = user.watchlist.filter((t) => !valid.includes(t));
    user.watchlist = [...valid, ...missing];
    await user.save();
    res.json({ order: user.watchlist });
  } catch (err) {
    logger.error('PUT /watchlist/order', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// ─── Stock Notes endpoints ────────────────────────────────────────────────────

router.get('/notes', async (req, res) => {
  try {
    const user = await getUser(req.user.id);
    res.json(user.notes || []);
  } catch (err) {
    logger.error('GET /notes', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

router.put('/notes/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const text = String(req.body.text || '').slice(0, 1000);
    const user = await getUser(req.user.id);
    if (!user.watchlist.includes(t)) {
      return res.status(403).json({ error: `${t} is not in your watchlist.` });
    }
    const idx = user.notes.findIndex((n) => n.ticker === t);
    if (idx >= 0) {
      user.notes[idx].text = text;
    } else {
      user.notes.push({ ticker: t, text });
    }
    await user.save();
    audit.logUser(req, 'note.saved', { symbol: t, sector: getSector(t) });
    res.json({ ticker: t, text });
  } catch (err) {
    logger.error('PUT /notes/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/notes/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const user = await getUser(req.user.id);
    user.notes = user.notes.filter((n) => n.ticker !== t);
    await user.save();
    audit.logUser(req, 'note.removed', { symbol: t, sector: getSector(t) });
    res.status(204).send();
  } catch (err) {
    logger.error('DELETE /notes/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// GET /api/news/:ticker
router.get('/news/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const news = await newsService.getNewsForTicker(t);
    res.json(news);
  } catch (err) {
    logger.error('GET /news/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

module.exports = router;
