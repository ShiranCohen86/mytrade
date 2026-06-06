const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const config = require('./config');
const db = require('./db');
const logger = require('./utils/logger');

const app = express();

// Security headers
app.use(helmet());

// CSP — helmet's default CSP is too restrictive for this SPA; override it
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src 'self' ${process.env.ALLOWED_ORIGIN || 'http://localhost:3000'} https:`,
    "font-src 'self'",
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

// CORS — explicit allowed origin; never wildcard with credentials
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

// Body parser with size limit (prevents DoS via large payloads)
app.use(express.json({ limit: '10kb' }));

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

    const { User } = db;
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.create({ watchlist: [] });
      logger.info('Default user seeded');
    }

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
    // Force exit if server takes > 10s to close
    setTimeout(() => process.exit(1), 10_000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
