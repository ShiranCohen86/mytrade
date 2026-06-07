const YahooFinanceProvider = require('./YahooFinanceProvider');
const StooqProvider = require('./StooqProvider');
const logger = require('../utils/logger');

class ProviderFactory {
  constructor() {
    this.primary = new YahooFinanceProvider();
    this.fallback = new StooqProvider();
  }

  async _withFallback(method, ...args) {
    try {
      return await this.primary[method](...args);
    } catch (primaryErr) {
      // Only fall back for methods Stooq supports
      if (method !== 'getHistoricalData') throw primaryErr;

      logger.warn(`Primary provider failed for ${method}(${args[0]}), trying Stooq fallback`, { err: primaryErr.message });
      try {
        return await this.fallback[method](...args);
      } catch (fallbackErr) {
        const e = new Error(
          `Both providers failed for ${method}(${args[0]}). Primary: ${primaryErr.message}. Fallback: ${fallbackErr.message}`
        );
        e.code = 'ALL_PROVIDERS_FAILED';
        throw e;
      }
    }
  }

  getCurrentQuote(ticker) {
    return this._withFallback('getCurrentQuote', ticker);
  }

  getHistoricalData(ticker, days) {
    return this._withFallback('getHistoricalData', ticker, days);
  }

  getEarningsDate(ticker) {
    return this._withFallback('getEarningsDate', ticker);
  }

  getCompanyInfo(ticker) {
    return this._withFallback('getCompanyInfo', ticker);
  }

  getCompanyAndEarningsInfo(ticker) {
    return this._withFallback('getCompanyAndEarningsInfo', ticker);
  }

  search(query) {
    return this.primary.search(query);
  }

  // Returns a lightweight status object for the /health endpoint
  getStatus() {
    const last = this.primary.lastSuccessAt;
    const lastErr = this.primary.lastErrorAt;
    const staleThresholdMs = 4 * 60 * 60 * 1000; // 4 hours — longer than cron interval
    const recentOk = last && (Date.now() - last.getTime()) < staleThresholdMs;
    return {
      lastSuccessAt: last ? last.toISOString() : null,
      lastErrorAt: lastErr ? lastErr.toISOString() : null,
      status: last === null ? 'unknown' : recentOk ? 'ok' : 'stale',
    };
  }
}

module.exports = new ProviderFactory();
