require('dotenv').config();
const logger = require('./utils/logger');

function validateCron(expr) {
  if (!expr) return false;
  const parts = expr.trim().split(/\s+/);
  return parts.length >= 5 && parts.length <= 6;
}

const cronSchedule = process.env.CRON_SCHEDULE || '0 */2 * * *';
if (!validateCron(cronSchedule)) {
  logger.warn(`Invalid CRON_SCHEDULE "${cronSchedule}" — falling back to "0 */2 * * *"`);
}

const config = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || '',
  CRON_SCHEDULE: validateCron(cronSchedule) ? cronSchedule : '0 */2 * * *',
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  NEWS_API_KEY: process.env.NEWS_API_KEY || '',
  NEWS_PROVIDER: (process.env.NEWS_PROVIDER || 'googlerss').toLowerCase(),
  CACHE_TTL_MINUTES: parseInt(process.env.CACHE_TTL_MINUTES, 10) || 15,
  SPY_TICKER: 'SPY',
  QQQ_TICKER: 'QQQ',
  STOCK_HISTORY_DAYS: 120,
  MARKET_HISTORY_DAYS: 250,
};

if (!process.env.ALLOWED_ORIGIN) {
  logger.warn('ALLOWED_ORIGIN not set — defaulting to http://localhost:3000');
}
if (!config.MONGO_URI) {
  logger.warn('MONGO_URI not set — will fall back to local in-memory store');
}
if (config.NEWS_API_KEY) {
  logger.info(`News provider: ${config.NEWS_PROVIDER} (API key set)`);
} else {
  logger.info('News provider: Google News RSS (no API key)');
}

module.exports = config;
