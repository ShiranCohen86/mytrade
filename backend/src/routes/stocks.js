const express = require('express');
const router = express.Router();
const stockService = require('../services/stockService');
const newsService = require('../services/newsService');
const { Stock, User } = require('../db');
// D14: require provider once at module load, not inside handlers
const provider = require('../providers/ProviderFactory');
const logger = require('../utils/logger');

const MAX_WATCHLIST = 25;

function safeError(err) {
  // Never expose raw internal errors (stack traces, file paths, Yahoo errors) to clients
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

async function getUser() {
  const user = await User.findOne();
  if (!user) throw new Error('User not initialized. Please restart the server.');
  return user;
}

// D19: Strip any non-ticker characters after uppercasing
function sanitizeTicker(raw) {
  return raw.toUpperCase().replace(/[^A-Z0-9.]/g, '');
}

// GET /api/stocks — list watchlist with latest analysis
router.get('/stocks', async (req, res) => {
  try {
    const stocks = await stockService.getWatchlist();
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
    const user = await getUser();

    if (user.watchlist.includes(t)) {
      return res.status(409).json({ error: `${t} is already in your watchlist.` });
    }

    if (user.watchlist.length >= MAX_WATCHLIST) {
      return res.status(400).json({ error: `Watchlist limit reached (max ${MAX_WATCHLIST} stocks).` });
    }

    // Quick existence check before running full analysis — rejects fake tickers early
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

    // Run analysis first — if it fails (ticker not found), nothing gets persisted
    const stock = await stockService.analyzeStock(t);

    // Only add to watchlist after successful analysis; compensate if watchlist update fails
    try {
      await User.updateOne({}, { $addToSet: { watchlist: t } });
    } catch (watchlistErr) {
      await Stock.deleteOne({ ticker: t }).catch(() => {});
      throw watchlistErr;
    }

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

// DELETE /api/stocks/:ticker — remove from watchlist AND delete cached Stock document
router.delete('/stocks/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const user = await getUser();
    if (!user.watchlist.includes(t)) {
      return res.status(404).json({ error: `${t} is not in your watchlist.` });
    }
    await Promise.all([
      User.updateOne({}, { $pull: { watchlist: t } }),
      Stock.deleteOne({ ticker: t }),
    ]);
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
    const user = await getUser();
    if (!user.watchlist.includes(t)) {
      return res.status(403).json({ error: `${t} is not in your watchlist.` });
    }
    const stock = await Stock.findOne({ ticker: t }).lean();
    if (!stock) {
      return res.status(404).json({ error: `${t} not found. Add it to your watchlist first.` });
    }
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

    // Verify ticker is in the watchlist before doing expensive analysis
    const user = await getUser();
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
    const user = await getUser();
    if (!user.watchlist.includes(t)) {
      return res.status(403).json({ error: `${t} is not in your watchlist.` });
    }
    const q = await provider.getCurrentQuote(t);
    res.json({ ticker: t, price: q.price, change: q.change, changePercent: q.changePercent });
  } catch (err) {
    logger.error('GET /stocks/:ticker/quote', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// GET /api/quotes — live price + change for all watchlist tickers (fast, no analysis)
router.get('/quotes', async (req, res) => {
  try {
    const user = await getUser();
    if (!user.watchlist.length) return res.json([]);

    const quotes = await Promise.all(
      user.watchlist.map(async (ticker) => {
        try {
          const q = await provider.getCurrentQuote(ticker);
          return { ticker, price: q.price, change: q.change, changePercent: q.changePercent };
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

// GET /api/portfolio — return all entry prices
router.get('/portfolio', async (req, res) => {
  try {
    const user = await getUser();
    res.json(user.portfolio || []);
  } catch (err) {
    logger.error('GET /portfolio', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// PUT /api/portfolio/:ticker — set entry price (upsert)
router.put('/portfolio/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const entryPrice = parseFloat(req.body.entryPrice);
    if (!isFinite(entryPrice) || entryPrice < 0) {
      return res.status(400).json({ error: 'entryPrice must be a non-negative number.' });
    }
    const user = await getUser();
    if (!user.watchlist.includes(t)) {
      return res.status(403).json({ error: `${t} is not in your watchlist.` });
    }
    const idx = user.portfolio.findIndex((p) => p.ticker === t);
    if (idx >= 0) {
      user.portfolio[idx].entryPrice = entryPrice;
    } else {
      user.portfolio.push({ ticker: t, entryPrice });
    }
    await user.save();
    res.json({ ticker: t, entryPrice });
  } catch (err) {
    logger.error('PUT /portfolio/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// DELETE /api/portfolio/:ticker — remove entry price
router.delete('/portfolio/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const user = await getUser();
    user.portfolio = user.portfolio.filter((p) => p.ticker !== t);
    await user.save();
    res.status(204).send();
  } catch (err) {
    logger.error('DELETE /portfolio/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// ─── Price Alerts endpoints ────────────────────────────────────────────────────

// GET /api/alerts — return all price alerts
router.get('/alerts', async (req, res) => {
  try {
    const user = await getUser();
    res.json(user.priceAlerts || []);
  } catch (err) {
    logger.error('GET /alerts', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// PUT /api/alerts/:ticker — set/update price alert
router.put('/alerts/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const targetPrice = parseFloat(req.body.targetPrice);
    const direction = req.body.direction === 'below' ? 'below' : 'above';
    if (!isFinite(targetPrice) || targetPrice < 0) {
      return res.status(400).json({ error: 'targetPrice must be a non-negative number.' });
    }
    const user = await getUser();
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
    res.json({ ticker: t, targetPrice, direction });
  } catch (err) {
    logger.error('PUT /alerts/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// DELETE /api/alerts/:ticker — remove price alert
router.delete('/alerts/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const user = await getUser();
    user.priceAlerts = user.priceAlerts.filter((a) => a.ticker !== t);
    await user.save();
    res.status(204).send();
  } catch (err) {
    logger.error('DELETE /alerts/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// ─── Watchlist reorder ────────────────────────────────────────────────────────

// PUT /api/watchlist/order — reorder watchlist
router.put('/watchlist/order', async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order) || order.some((t) => typeof t !== 'string')) {
      return res.status(400).json({ error: 'order must be an array of ticker strings.' });
    }
    const user = await getUser();
    const sanitized = order.map(sanitizeTicker);
    // Only keep tickers that are actually in the watchlist
    const valid = sanitized.filter((t) => user.watchlist.includes(t));
    // Append any missing (shouldn't happen, but guard)
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

// GET /api/notes — return all notes
router.get('/notes', async (req, res) => {
  try {
    const user = await getUser();
    res.json(user.notes || []);
  } catch (err) {
    logger.error('GET /notes', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// PUT /api/notes/:ticker — upsert note text (max 1000 chars)
router.put('/notes/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const text = String(req.body.text || '').slice(0, 1000);
    const user = await getUser();
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
    res.json({ ticker: t, text });
  } catch (err) {
    logger.error('PUT /notes/:ticker', { err: err.message });
    res.status(500).json({ error: safeError(err) });
  }
});

// DELETE /api/notes/:ticker — remove note
router.delete('/notes/:ticker', async (req, res) => {
  try {
    const t = sanitizeTicker(req.params.ticker);
    const user = await getUser();
    user.notes = user.notes.filter((n) => n.ticker !== t);
    await user.save();
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
