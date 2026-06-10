/**
 * Optional error tracking (Sentry). Entirely env-gated: with no SENTRY_DSN this is
 * a no-op, so the app runs unchanged in dev / on the free tier. When SENTRY_DSN is
 * set (and @sentry/node is installed) unhandled errors, rejections and 500s are
 * reported. Lazy-requires the SDK so it's never loaded unless actually enabled.
 */
const logger = require('./logger');

let sentry = null;

function init() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    sentry = require('@sentry/node');
    sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0, // errors only; no perf tracing (keep cost predictable)
    });
    logger.info('[observability] Sentry error tracking enabled');
  } catch (err) {
    sentry = null;
    logger.warn('[observability] SENTRY_DSN set but @sentry/node is not installed — error tracking disabled', { err: err.message });
  }
}

function captureException(err, context) {
  if (!sentry) return;
  try {
    sentry.captureException(err, context ? { extra: context } : undefined);
  } catch { /* never let telemetry throw */ }
}

function isEnabled() { return !!sentry; }

module.exports = { init, captureException, isEnabled };
