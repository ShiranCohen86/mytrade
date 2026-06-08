const provider = require('../providers/ProviderFactory');
const newsService = require('./newsService');
const config = require('../config');
const logger = require('../utils/logger');

const driftEngine = require('../engines/preEarningsDriftEngine');
const marketRegimeEngine = require('../engines/marketRegimeEngine');
const sentimentEngine = require('../engines/sentimentEngine');
const expectationEngine = require('../engines/expectationEngine');
const riskScoreEngine = require('../engines/riskScoreEngine');
const scenariosEngine = require('../engines/earningsScenariosEngine');

const { Stock, User } = require('../db');

const ANALYSIS_TIMEOUT_MS = 30_000;

function withTimeout(promise, ms, label) {
  let timerId;
  const guard = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timerId));
}

async function analyzeStock(ticker) {
  const t = ticker.toUpperCase();
  logger.info(`Analyzing ${t}`);

  // Fetch all data in parallel — company info + earnings merged into one quoteSummary call
  const [quote, history, companyAndEarnings, spyHistory, qqqHistory, newsItems] =
    await withTimeout(
      Promise.all([
        provider.getCurrentQuote(t),
        provider.getHistoricalData(t, config.STOCK_HISTORY_DAYS),
        provider.getCompanyAndEarningsInfo(t),
        provider.getHistoricalData(config.SPY_TICKER, config.MARKET_HISTORY_DAYS),
        provider.getHistoricalData(config.QQQ_TICKER, config.MARKET_HISTORY_DAYS),
        newsService.fetchAndStoreNews(t),
      ]),
      ANALYSIS_TIMEOUT_MS,
      `analyzeStock(${t})`
    );
  const { company: companyInfo, earnings: earningsInfo } = companyAndEarnings;

  // Clear stale earnings date — if earnings already passed, treat as no upcoming date.
  // Compare against start-of-today (local midnight) so same-day earnings are not nulled out.
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const earningsDate = earningsInfo.date && new Date(earningsInfo.date) >= todayMidnight
    ? earningsInfo.date
    : null;

  // Run engines
  const drift = driftEngine.calculate({ historicalPrices: history, earningsDate });
  const marketRegime = marketRegimeEngine.calculate({
    spyHistorical: spyHistory,
    qqqHistorical: qqqHistory,
  });
  const sentiment = sentimentEngine.calculate(newsItems);
  const expectation = expectationEngine.calculate({
    currentPrice: quote.price,
    analystTargetPrice: companyInfo.analystTargetPrice,
    peRatio: companyInfo.peRatio,
    sector: companyInfo.sector,
    historicalPrices: history,
    recommendationKey: companyInfo.recommendationKey,
  });
  const risk = riskScoreEngine.calculate({
    historicalPrices: history,
    sector: companyInfo.sector,
    earningsDate,
    preEarningsDrift: drift.drift,
    isSellTheNewsRisk: drift.isSellTheNewsRisk,
    marketRegime: marketRegime.regime,
    expectationScore: expectation.score,
    beta: companyInfo.beta,
  });
  const scenarios = scenariosEngine.calculate({
    currentPrice: quote.price,
    historicalPrices: history,
    sector: companyInfo.sector,
    preEarningsDrift: drift.drift,
    sentimentLabel: sentiment.label,
    marketRegime: marketRegime.regime,
    earningsDate,
    analystHighPrice: companyInfo.analystHighPrice,
    analystLowPrice: companyInfo.analystLowPrice,
    analystTargetPrice: companyInfo.analystTargetPrice,
    recommendationKey: companyInfo.recommendationKey,
  });

  const currentSpyPrice = spyHistory.length > 0 ? spyHistory[spyHistory.length - 1].close : null;

  const stockDoc = await Stock.findOneAndUpdate(
    { ticker: t },
    {
      $set: {
        ticker: t,
        name: companyInfo.name,
        sector: companyInfo.sector,
        industry: companyInfo.industry || '',
        description: companyInfo.description || '',
        employees: companyInfo.employees ?? null,
        website: companyInfo.website || '',
        cachedData: {
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          marketCap: quote.marketCap,
          peRatio: companyInfo.peRatio,
          analystTargetPrice: companyInfo.analystTargetPrice,
          analystLowPrice: companyInfo.analystLowPrice,
          analystHighPrice: companyInfo.analystHighPrice,
          numberOfAnalysts: companyInfo.numberOfAnalysts,
          recommendationKey: companyInfo.recommendationKey,
          beta: companyInfo.beta,
          historical: history,
          earningsDate,
          earningsConfirmed: earningsDate ? earningsInfo.confirmed : false,
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
          dividendYield: quote.dividendYield,
          spyPrice: currentSpyPrice,
        },
        analysis: {
          expectationScore: expectation.score,
          expectationLabel: expectation.label,
          riskScore: risk.total,
          riskLabel: risk.label,
          riskBreakdown: risk.breakdown,
          scenarios,
          sentiment,
          marketRegime: marketRegime.regime,
          preEarningsDrift: drift.drift,
          driftPercent: drift.driftPercent,
          isSellTheNewsRisk: drift.isSellTheNewsRisk,
          analyzedAt: new Date(),
        },
      },
      // Only set on insert (first time this ticker is analyzed)
      $setOnInsert: {
        stockPriceAtAdd: quote.price,
        spyPriceAtAdd: currentSpyPrice,
      },
      // Append snapshot; keep last 30 entries
      $push: {
        scoreHistory: {
          $each: [{ riskScore: risk.total, expectationScore: expectation.score, analyzedAt: new Date() }],
          $slice: -30,
        },
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  if (!stockDoc) throw new Error(`No stock document returned for ${t}`);

  logger.info(`${t} analyzed`, { risk: risk.total, expectation: expectation.score, regime: marketRegime.regime });
  return stockDoc;
}

async function getWatchlist(userId) {
  const user = await User.findById(userId);
  if (!user || !user.watchlist.length) return [];

  const stocks = await Stock.find({ ticker: { $in: user.watchlist } }).select('-__v').lean();

  // D6: O(n) — build Map once instead of repeated .find() calls
  const stockMap = new Map(stocks.map((s) => [s.ticker, s]));
  return user.watchlist.map((t) => stockMap.get(t)).filter(Boolean);
}

module.exports = { analyzeStock, getWatchlist };
