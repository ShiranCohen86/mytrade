const Parser = require('rss-parser');
const Sentiment = require('sentiment');
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const rssParser = new Parser({ timeout: 4000 });
const sentimentAnalyzer = new Sentiment();

const GUIDANCE_RE = /guidance|forecast|outlook|raised|lowered|expects|estimate|beat|miss|earnings/i;
const HTML_TAG_RE = /<[^>]+>/g;

// In-memory cache — used regardless of DB mode to avoid hammering the provider
const memCache = new Map();
const CACHE_TTL_MS = (config.CACHE_TTL_MINUTES || 15) * 60 * 1000;

function analyzeHeadline(headline) {
  const result = sentimentAnalyzer.analyze(headline);
  return {
    score: result.score,
    comparative: result.comparative,
    label: result.comparative > 0.3 ? 'positive' : result.comparative < -0.3 ? 'negative' : 'neutral',
  };
}

// ─── NewsAPI.org provider ──────────────────────────────────────────────────────

async function fetchFromNewsAPI(ticker) {
  const url = 'https://newsapi.org/v2/everything';
  const res = await axios.get(url, {
    timeout: 8000,
    params: {
      q: `${ticker} stock`,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: 10,
      apiKey: config.NEWS_API_KEY,
    },
  });

  if (res.data.status !== 'ok') throw new Error(`NewsAPI error: ${res.data.message}`);

  return (res.data.articles || []).map((a) => {
    const headline = (a.title || '').replace(HTML_TAG_RE, '');
    const sentiment = analyzeHeadline(headline);
    return {
      ticker: ticker.toUpperCase(),
      headline,
      url: a.url || '',
      source: a.source?.name || 'NewsAPI',
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(),
      sentiment,
      isGuidanceRelated: GUIDANCE_RE.test(headline),
    };
  });
}

// ─── Google News RSS provider ──────────────────────────────────────────────────

async function fetchRSS(url) {
  return rssParser.parseURL(url);
}

async function fetchFromRSS(ticker) {
  const query = encodeURIComponent(`${ticker} stock`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  const feed = await fetchRSS(url);

  return (feed.items || []).slice(0, 10).map((item) => {
    const headline = (item.title || '').replace(HTML_TAG_RE, '');
    const sentiment = analyzeHeadline(headline);
    return {
      ticker: ticker.toUpperCase(),
      headline,
      url: item.link || '',
      source: item.source || 'Google News',
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      sentiment,
      isGuidanceRelated: GUIDANCE_RE.test(headline),
    };
  });
}

// ─── Main fetch function ───────────────────────────────────────────────────────

async function fetchAndStoreNews(ticker) {
  const t = ticker.toUpperCase();

  // In-memory cache
  const cached = memCache.get(t);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  let articles = [];
  const useNewsAPI = config.NEWS_API_KEY && config.NEWS_PROVIDER === 'newsapi';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function fetchRSSWithRetry(ticker) {
    try {
      return await fetchFromRSS(ticker);
    } catch (firstErr) {
      logger.warn(`RSS fetch failed for ${ticker}, retrying in 500ms`, { err: firstErr.message });
      await sleep(500);
      return await fetchFromRSS(ticker); // let caller catch on second failure
    }
  }

  try {
    if (useNewsAPI) {
      articles = await fetchFromNewsAPI(t);
    } else {
      articles = await fetchRSSWithRetry(t);
    }
  } catch (err) {
    logger.warn(`Primary news fetch failed for ${t}`, { err: err.message });
    // Fallback: if NewsAPI failed, try RSS (with retry); if RSS failed, return empty
    if (useNewsAPI) {
      try {
        articles = await fetchRSSWithRetry(t);
      } catch (rssErr) {
        logger.warn(`RSS fallback also failed for ${t}`, { err: rssErr.message });
      }
    }
  }

  if (articles.length > 0) {
    memCache.set(t, { data: articles, fetchedAt: Date.now() });
  }

  return articles;
}

const getNewsForTicker = fetchAndStoreNews;

module.exports = { fetchAndStoreNews, getNewsForTicker };
