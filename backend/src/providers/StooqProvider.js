const axios = require('axios');
const BaseProvider = require('./BaseProvider');

// NOTE: Stooq has CAPTCHA-protected its API since 2020.
// This provider is best-effort only — getHistoricalData() will work intermittently.
// Manual CSV download from stooq.com is the reliable path.
// getCurrentQuote, getEarningsDate, getCompanyInfo are not available from Stooq CSV.

class StooqProvider extends BaseProvider {
  async getHistoricalData(ticker, days) {
    const today = new Date();
    const from = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    const fmt = (d) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

    const url = `https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&d1=${fmt(from)}&d2=${fmt(today)}&i=d`;

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      const body = response.data;

      // Detect CAPTCHA / HTML page returned instead of CSV
      if (typeof body === 'string' && body.trim().startsWith('<')) {
        const e = new Error('Stooq returned HTML (CAPTCHA blocked)');
        e.code = 'STOOQ_CAPTCHA_BLOCKED';
        throw e;
      }

      const lines = body.trim().split('\n').slice(1); // skip header
      return lines
        .map((line) => {
          const [date, open, high, low, close, volume] = line.split(',');
          if (!date || !close) return null;
          return {
            date: new Date(date.trim()),
            open: parseFloat(open),
            high: parseFloat(high),
            low: parseFloat(low),
            close: parseFloat(close),
            volume: parseInt(volume, 10) || 0,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.date - b.date);
    } catch (err) {
      if (err.code === 'STOOQ_CAPTCHA_BLOCKED') throw err;
      const e = new Error(`[Stooq] getHistoricalData(${ticker}) failed: ${err.message}`);
      e.code = 'STOOQ_ERROR';
      throw e;
    }
  }

  async getCurrentQuote(_ticker) {
    const e = new Error('Stooq does not support real-time quotes');
    e.code = 'STOOQ_NOT_SUPPORTED';
    throw e;
  }

  async getEarningsDate(_ticker) {
    const e = new Error('Stooq does not support earnings dates');
    e.code = 'STOOQ_NOT_SUPPORTED';
    throw e;
  }

  async getCompanyInfo(_ticker) {
    const e = new Error('Stooq does not support company info');
    e.code = 'STOOQ_NOT_SUPPORTED';
    throw e;
  }
}

module.exports = StooqProvider;
