const BaseProvider = require('./BaseProvider');

// yahoo-finance2 v2.13+ ships ESM-only, so we load it via dynamic import()
// and cache the result to avoid repeated imports on every call.
// The cached instance is reset on any import error so the next call retries.
let _yf = null;
async function getYF() {
  if (_yf) return _yf;
  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    _yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });
    return _yf;
  } catch (err) {
    _yf = null; // reset so next call retries the import
    throw new Error(`Yahoo Finance failed to initialise: ${err.message}`);
  }
}

// Wraps a factory fn(signal) with a hard timeout.
// When the timeout fires, the AbortController cancels the in-flight HTTP request.
function withTimeout(fn, ms) {
  const ac = new AbortController();
  let timerId;
  const guard = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      ac.abort();
      reject(new Error(`Yahoo Finance request timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([fn(ac.signal), guard]).finally(() => clearTimeout(timerId));
}

const YF_TIMEOUT_MS = 10000;

class YahooFinanceProvider extends BaseProvider {
  constructor() {
    super();
    this.lastSuccessAt = null;
    this.lastErrorAt = null;
  }

  _markSuccess() { this.lastSuccessAt = new Date(); }
  _markError()   { this.lastErrorAt = new Date(); }

  async getCurrentQuote(ticker) {
    try {
      const yf = await getYF();
      const q = await withTimeout(sig => yf.quote(ticker, {}, { fetchOptions: { signal: sig } }), YF_TIMEOUT_MS);
      if (!q || q.regularMarketPrice == null) {
        throw new Error(`Ticker "${ticker}" not found or has no market data.`);
      }
      this._markSuccess();
      return {
        price: q.regularMarketPrice,
        change: q.regularMarketChange,
        changePercent: q.regularMarketChangePercent,
        volume: q.regularMarketVolume,
        marketCap: q.marketCap,
        dayHigh: q.regularMarketDayHigh,
        dayLow: q.regularMarketDayLow,
        fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
        dividendYield: q.trailingAnnualDividendYield ?? q.dividendYield ?? null,
        marketState: q.marketState ?? null,
        preMarketPrice: q.preMarketPrice ?? null,
        preMarketChange: q.preMarketChange ?? null,
        preMarketChangePercent: q.preMarketChangePercent ?? null,
        postMarketPrice: q.postMarketPrice ?? null,
        postMarketChange: q.postMarketChange ?? null,
        postMarketChangePercent: q.postMarketChangePercent ?? null,
      };
    } catch (err) {
      this._markError();
      throw this._wrap(err, ticker, 'getCurrentQuote');
    }
  }

  async getHistoricalData(ticker, days) {
    try {
      const yf = await getYF();
      const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]; // 'YYYY-MM-DD'
      const result = await withTimeout(
        sig => yf.chart(ticker, { period1, interval: '1d' }, { fetchOptions: { signal: sig } }),
        YF_TIMEOUT_MS
      );
      const data = (result.quotes || [])
        .filter((r) => r.close != null)
        .map((r) => ({
          date: r.date,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.adjclose ?? r.close,
          volume: r.volume,
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      this._markSuccess();
      return data;
    } catch (err) {
      this._markError();
      throw this._wrap(err, ticker, 'getHistoricalData');
    }
  }

  async getEarningsDate(ticker) {
    // Kept for standalone use (e.g. quick checks); stockService uses getCompanyAndEarningsInfo
    try {
      const yf = await getYF();
      const summary = await withTimeout(
        sig => yf.quoteSummary(ticker, { modules: ['calendarEvents'] }, { fetchOptions: { signal: sig } }),
        YF_TIMEOUT_MS
      );
      return this._parseEarningsDate(summary);
    } catch {
      return { date: null, confirmed: false };
    }
  }

  _parseEarningsDate(summary) {
    const dates = summary?.calendarEvents?.earnings?.earningsDate;
    const now = Date.now();
    const futureDates = (dates || [])
      .map((d) => new Date(d))
      .filter((d) => d.getTime() > now)
      .sort((a, b) => a - b);
    const futureDate = futureDates[0] || null;
    return { date: futureDate, confirmed: futureDate != null };
  }

  // Combined single quoteSummary call — replaces separate getCompanyInfo + getEarningsDate
  async getCompanyAndEarningsInfo(ticker) {
    try {
      const yf = await getYF();
      const summary = await withTimeout(
        sig => yf.quoteSummary(ticker, {
          modules: ['summaryProfile', 'defaultKeyStatistics', 'financialData', 'calendarEvents', 'quoteType'],
        }, { fetchOptions: { signal: sig } }),
        YF_TIMEOUT_MS
      );
      const profile = summary?.summaryProfile || {};
      const quoteType = summary?.quoteType || {};
      const stats = summary?.defaultKeyStatistics || {};
      const financial = summary?.financialData || {};

      const beta = stats.beta?.raw ?? stats.beta ?? null;

      const rawDesc = profile.longBusinessSummary || '';
      return {
        company: {
          name: quoteType.longName || quoteType.shortName || profile.longName || profile.shortName || ticker,
          sector: profile.sector || 'Unknown',
          industry: profile.industry || 'Unknown',
          description: rawDesc.length > 600 ? rawDesc.slice(0, 597) + '…' : rawDesc,
          employees: profile.fullTimeEmployees ?? null,
          website: profile.website ?? null,
          peRatio: stats.forwardPE?.raw ?? stats.forwardPE ?? stats.trailingPE?.raw ?? stats.trailingPE ?? null,
          analystTargetPrice: financial.targetMeanPrice?.raw ?? financial.targetMeanPrice ?? null,
          analystLowPrice: financial.targetLowPrice?.raw ?? financial.targetLowPrice ?? null,
          analystHighPrice: financial.targetHighPrice?.raw ?? financial.targetHighPrice ?? null,
          numberOfAnalysts: financial.numberOfAnalystOpinions?.raw ?? financial.numberOfAnalystOpinions ?? null,
          recommendationKey: financial.recommendationKey ?? null,
          beta,
        },
        earnings: this._parseEarningsDate(summary),
      };
    } catch {
      return {
        company: { name: ticker, sector: 'Unknown', industry: 'Unknown', peRatio: null, analystTargetPrice: null, beta: null },
        earnings: { date: null, confirmed: false },
      };
    }
  }

  async getCompanyInfo(ticker) {
    const { company } = await this.getCompanyAndEarningsInfo(ticker);
    return company;
  }

  async search(query) {
    try {
      const yf = await getYF();
      const result = await withTimeout(
        (sig) => yf.search(query, { newsCount: 0 }, { fetchOptions: { signal: sig } }),
        YF_TIMEOUT_MS
      );
      return (result.quotes || [])
        .filter((r) => r.quoteType === 'EQUITY' && r.symbol)
        .slice(0, 8)
        .map((r) => ({
          ticker: r.symbol,
          name: r.longname || r.shortname || r.symbol,
          exchange: r.exchange || '',
        }));
    } catch {
      return [];
    }
  }

  _wrap(err, ticker, method) {
    const e = new Error(`[Yahoo] ${method}(${ticker}) failed: ${err.message}`);
    e.code = 'PROVIDER_ERROR';
    e.provider = 'yahoo';
    e.ticker = ticker;
    return e;
  }
}

module.exports = YahooFinanceProvider;
