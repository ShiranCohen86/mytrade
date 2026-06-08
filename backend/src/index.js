const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const config = require('./config');
const db = require('./db');
const logger = require('./utils/logger');

// Initialize passport strategies
require('./config/passport');

const app = express();

// Security headers
app.use(helmet());

// CSP — helmet's default CSP is too restrictive for this SPA; override it
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https:",
    "font-src 'self' https://fonts.gstatic.com",
  ].join('; '));
  next();
});

// Attach a unique request ID to every request for tracing
app.use((req, res, next) => {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
});

// Response compression
app.use(compression());

// CORS — needed for local dev (Vite on :3000 → Express on :5000); not needed in prod (same origin)
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

// Body parser with size limit (prevents DoS via large payloads)
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Rate limiter — 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Stricter limiter on expensive analysis endpoints
const analysisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Analysis rate limit reached. Please wait before refreshing again.' },
});
app.use('/api/refresh', analysisLimiter);
app.use('/api/stocks', (req, res, next) => {
  if (req.method === 'POST') return analysisLimiter(req, res, next);
  next();
});

// Auth rate limiter — 20 auth attempts per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Please try again later.' },
});
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/auth/forgot-password', authLimiter);

// Public market overview endpoint — must be registered BEFORE the stocks router
// (stocks router has router.use(auth) which would block unauthenticated requests)
let _overviewCache = null;
let _overviewCacheAt = 0;
const OVERVIEW_TTL_MS = 60 * 1000; // 1 minute — matches frontend poll interval

app.get('/api/market/overview', async (_req, res) => {
  try {
    if (_overviewCache && Date.now() - _overviewCacheAt < OVERVIEW_TTL_MS) {
      return res.json(_overviewCache);
    }
    const provider = require('./providers/ProviderFactory');
    const tickers = ['SPY', 'QQQ', 'DIA', 'VIX'];
    const quotes = await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const q = await provider.getCurrentQuote(ticker);
          return { ticker, price: q.price, change: q.change, changePercent: q.changePercent };
        } catch {
          return { ticker, price: null, change: null, changePercent: null };
        }
      })
    );
    _overviewCache = quotes;
    _overviewCacheAt = Date.now();
    res.json(quotes);
  } catch (err) {
    logger.error('GET /api/market/overview', { err: err.message });
    if (_overviewCache) return res.json(_overviewCache); // serve stale on error
    res.status(500).json({ error: 'Failed to fetch market overview.' });
  }
});

// Public top-movers endpoint — cached server-side for 5 minutes to limit Yahoo rate load
let _moversCache = null;
let _moversCacheAt = 0;
const MOVERS_TTL_MS = 5 * 60 * 1000;

app.get('/api/market/movers', async (_req, res) => {
  try {
    if (_moversCache && Date.now() - _moversCacheAt < MOVERS_TTL_MS) {
      return res.json(_moversCache);
    }
    const { default: yf } = await import('yahoo-finance2');
    const [gainers, losers] = await Promise.allSettled([
      yf.dailyGainers({ count: 5, region: 'US' }),
      yf.dailyLosers({ count: 5, region: 'US' }),
    ]);
    const pick = (r) => (r.status === 'fulfilled' ? (r.value.quotes || []) : []);
    const fmt = (q) => ({
      ticker: q.symbol,
      name: q.shortName || q.longName || q.symbol,
      price: q.regularMarketPrice ?? null,
      change: q.regularMarketChange ?? null,
      changePercent: q.regularMarketChangePercent ?? null,
    });
    const payload = {
      gainers: pick(gainers).slice(0, 5).map(fmt),
      losers: pick(losers).slice(0, 5).map(fmt),
    };
    _moversCache = payload;
    _moversCacheAt = Date.now();
    res.json(payload);
  } catch (err) {
    logger.error('GET /api/market/movers', { err: err.message });
    if (_moversCache) return res.json(_moversCache); // serve stale on error
    res.status(500).json({ error: 'Failed to fetch market movers.' });
  }
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/stocks'));

app.get('/health', async (_req, res) => {
  let dbOk = true;
  if (db.mode === 'mongo') {
    try {
      const mongoose = require('mongoose');
      dbOk = mongoose.connection.readyState === 1;
    } catch {
      dbOk = false;
    }
  }

  const provider = require('./providers/ProviderFactory');
  const providerStatus = provider.getStatus();

  const status = dbOk ? 'ok' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    db: dbOk ? 'connected' : 'disconnected',
    provider: providerStatus,
  });
});

// Serve Vite build + SPA fallback in production
if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// Catch-all error handler — MUST be registered last, after all routes
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error(`Unhandled error [${req.id}]`, { err: err.message });
  res.status(500).json({ error: 'An unexpected error occurred' });
});

let server;

async function start() {
  try {
    await db.connect();

    try {
      require('./jobs/cacheRefresh');
    } catch (cronErr) {
      logger.error('Failed to load cron job', { err: cronErr.message });
    }

    server = app.listen(config.PORT, () => {
      logger.info(`Server running on port ${config.PORT}`, { storage: db.mode });
    });
  } catch (err) {
    logger.error('Failed to start server', { err: err.message });
    process.exit(1);
  }
}

// Graceful shutdown — close DB connection and in-flight requests cleanly
function shutdown(signal) {
  logger.info(`${signal} received — closing server`);
  if (server) {
    server.close(async () => {
      if (db.mode === 'mongo') {
        try {
          const mongoose = require('mongoose');
          await mongoose.connection.close();
          logger.info('MongoDB disconnected');
        } catch { /* ignore */ }
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
