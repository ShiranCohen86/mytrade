/* Per-ticker market triggers. evaluatorClass='market'. ctx = {ticker, stock, hot, entry, user, market}. */
const h = require('./helpers');

const link = '/stocks/{{ticker}}';
const m = (cat, key, label, description, paramSchema, match, defaults, dedupeKey, extra = {}) => ({
  key, category: cat, evaluatorClass: 'market', feasible: true, label, description, paramSchema, match, defaults, dedupeKey, ...extra,
});

const STOCK = [
  m('watchlist_stock', 'stock_pct_up', 'Stock rises above %', 'Daily change ≥ threshold',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker (blank = any in scope)' }, { name: 'threshold', type: 'number', default: 5, label: 'Rise ≥ (%)' }],
    (c, p) => h.changePercent(c.stock) != null && h.changePercent(c.stock) >= Number(p.threshold || 5),
    () => ({ title: '{{ticker}} is up {{changePercent}}%', message: '{{name}} moved +{{changePercent}}% today.', type: 'success', icon: '📈', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:up:${Math.round(h.changePercent(c.stock))}`),

  m('watchlist_stock', 'stock_pct_down', 'Stock falls below %', 'Daily change ≤ -threshold',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'threshold', type: 'number', default: 5, label: 'Fall ≥ (%)' }],
    (c, p) => h.changePercent(c.stock) != null && h.changePercent(c.stock) <= -Number(p.threshold || 5),
    () => ({ title: '{{ticker}} is down {{changePercent}}%', message: '{{name}} fell {{changePercent}}% today.', type: 'warning', icon: '📉', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:down:${Math.round(h.changePercent(c.stock))}`),

  m('watchlist_stock', 'target_price_reached', 'Target price reached', 'Price crosses a target',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'targetPrice', type: 'number', default: 0, label: 'Target price ($)' }, { name: 'direction', type: 'select', default: 'above', label: 'Direction', options: ['above', 'below'] }],
    (c, p) => { const pr = h.price(c.stock); if (pr == null || !p.targetPrice) return false; return p.direction === 'below' ? pr <= p.targetPrice : pr >= p.targetPrice; },
    (c, p) => ({ title: '{{ticker}} reached ${{targetPrice}}', message: '{{ticker}} is now ${{price}} (target ${{targetPrice}}).', type: 'alert', icon: '🎯', deepLink: link, actionText: 'View {{ticker}}' }),
    (c, p) => `${c.ticker}:target:${p.targetPrice}:${p.direction}`),

  m('watchlist_stock', 'stop_loss_reached', 'Stop-loss reached', 'Holding fell X% below entry',
    [{ name: 'percent', type: 'number', default: 8, label: 'Drop below entry ≥ (%)' }],
    (c, p) => { const pr = h.price(c.stock); const e = c.entry && c.entry.entryPrice; if (pr == null || !e) return false; return pr <= e * (1 - Number(p.percent || 8) / 100); },
    () => ({ title: '{{ticker}} hit your stop-loss', message: '{{ticker}} is ${{price}}, {{value}}% below your entry.', type: 'alert', icon: '🛑', deepLink: link, actionText: 'Review' }),
    (c) => `${c.ticker}:stop`,
    { needsEntry: true }),

  m('watchlist_stock', 'fifty_two_week_high', '52-week high', 'Price at/near 52-week high',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }],
    (c) => { const pr = h.price(c.stock); const hi = h.cd(c.stock).fiftyTwoWeekHigh; return pr != null && hi && pr >= hi * 0.999; },
    () => ({ title: '{{ticker}} new 52-week high', message: '{{name}} hit a 52-week high at ${{price}}.', type: 'success', icon: '🚀', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:52h:${h.today()}`),

  m('watchlist_stock', 'fifty_two_week_low', '52-week low', 'Price at/near 52-week low',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }],
    (c) => { const pr = h.price(c.stock); const lo = h.cd(c.stock).fiftyTwoWeekLow; return pr != null && lo && pr <= lo * 1.001; },
    () => ({ title: '{{ticker}} new 52-week low', message: '{{name}} hit a 52-week low at ${{price}}.', type: 'warning', icon: '⬇️', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:52l:${h.today()}`),

  m('watchlist_stock', 'unusual_volume', 'Unusual volume', 'Volume ≥ N× 20-day average',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'multiple', type: 'number', default: 2, label: 'Volume ≥ (× avg)' }],
    (c, p) => { const v = h.cd(c.stock).volume; const av = h.avgVolume(c.stock); return v && av && v >= av * Number(p.multiple || 2); },
    () => ({ title: '{{ticker}} unusual volume', message: '{{ticker}} is trading on heavy volume today.', type: 'info', icon: '🔊', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:vol:${h.today()}`),

  m('watchlist_stock', 'unusual_volatility', 'Unusual volatility', 'Annualized volatility ≥ threshold',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'threshold', type: 'number', default: 60, label: 'Volatility ≥' }],
    (c, p) => (h.an(c.stock).riskBreakdown?.volatility || 0) >= Number(p.threshold || 60),
    () => ({ title: '{{ticker}} volatility spike', message: '{{ticker}} is showing elevated volatility.', type: 'warning', icon: '🌪️', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:volat:${h.today()}`),

  m('watchlist_stock', 'gap_up', 'Gap up', 'Pre-market gap up ≥ %',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'percent', type: 'number', default: 3, label: 'Gap ≥ (%)' }],
    (c, p) => (h.cd(c.stock).preMarketChangePercent || 0) >= Number(p.percent || 3),
    () => ({ title: '{{ticker}} gapping up', message: '{{ticker}} is gapping up pre-market.', type: 'success', icon: '⏫', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:gapu:${h.today()}`),

  m('watchlist_stock', 'gap_down', 'Gap down', 'Pre-market gap down ≥ %',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'percent', type: 'number', default: 3, label: 'Gap ≥ (%)' }],
    (c, p) => (h.cd(c.stock).preMarketChangePercent || 0) <= -Number(p.percent || 3),
    () => ({ title: '{{ticker}} gapping down', message: '{{ticker}} is gapping down pre-market.', type: 'warning', icon: '⏬', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:gapd:${h.today()}`),

  m('watchlist_stock', 'earnings_approaching', 'Earnings approaching', 'Earnings within N days',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'days', type: 'number', default: 3, label: 'Within (days)' }],
    (c, p) => { const d = h.cd(c.stock).earningsDate; if (!d) return false; const days = (new Date(d) - Date.now()) / 86400000; return days >= 0 && days <= Number(p.days || 3); },
    () => ({ title: '{{ticker}} earnings soon', message: '{{name}} reports earnings on {{value}}.', type: 'info', icon: '📅', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:earn:${h.cd(c.stock).earningsDate}`),

  m('watchlist_stock', 'earnings_released', 'Earnings released', 'Earnings date just passed',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }],
    (c) => { const d = h.cd(c.stock).earningsDate; if (!d) return false; const days = (Date.now() - new Date(d)) / 86400000; return days >= 0 && days <= 1.5; },
    () => ({ title: '{{ticker}} reported earnings', message: '{{name}} just reported. Tap for the reaction.', type: 'info', icon: '📊', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:earnrel:${h.cd(c.stock).earningsDate}`),

  m('watchlist_stock', 'analyst_upgrade', 'Analyst upgrade', 'Recommendation improved',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }],
    (c) => { const cur = h.recRank(h.cd(c.stock).recommendationKey); const prev = h.recRank(h.cd(c.stock).prevRecommendationKey); return cur != null && prev != null && cur < prev; },
    () => ({ title: '{{ticker}} analyst upgrade', message: '{{name}} was upgraded to {{value}}.', type: 'success', icon: '⭐', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:upg:${h.cd(c.stock).recommendationKey}`),

  m('watchlist_stock', 'analyst_downgrade', 'Analyst downgrade', 'Recommendation worsened',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }],
    (c) => { const cur = h.recRank(h.cd(c.stock).recommendationKey); const prev = h.recRank(h.cd(c.stock).prevRecommendationKey); return cur != null && prev != null && cur > prev; },
    () => ({ title: '{{ticker}} analyst downgrade', message: '{{name}} was downgraded to {{value}}.', type: 'warning', icon: '⚠️', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:dng:${h.cd(c.stock).recommendationKey}`),

  m('watchlist_stock', 'new_price_target', 'New price target', 'Mean analyst target changed',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'minChangePct', type: 'number', default: 3, label: 'Target Δ ≥ (%)' }],
    (c, p) => { const cur = h.cd(c.stock).analystTargetPrice; const prev = h.cd(c.stock).prevAnalystTargetPrice; if (!cur || !prev) return false; return Math.abs((cur - prev) / prev) * 100 >= Number(p.minChangePct || 3); },
    () => ({ title: '{{ticker}} new price target', message: 'Analyst target for {{ticker}} is now ${{value}}.', type: 'info', icon: '🎯', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:pt:${h.cd(c.stock).analystTargetPrice}`),

  m('watchlist_stock', 'technical_breakout', 'Technical breakout', 'Price breaks above recent high',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'lookback', type: 'number', default: 20, label: 'Lookback (days)' }],
    (c, p) => { const pr = h.price(c.stock); const hi = h.recentHigh(c.stock, Number(p.lookback || 20)); return pr != null && hi && pr > hi; },
    () => ({ title: '{{ticker}} breakout', message: '{{ticker}} broke above its recent high at ${{price}}.', type: 'success', icon: '📐', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:brk:${h.today()}`),

  m('watchlist_stock', 'technical_breakdown', 'Technical breakdown', 'Price breaks below recent low',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'lookback', type: 'number', default: 20, label: 'Lookback (days)' }],
    (c, p) => { const pr = h.price(c.stock); const lo = h.recentLow(c.stock, Number(p.lookback || 20)); return pr != null && lo && pr < lo; },
    () => ({ title: '{{ticker}} breakdown', message: '{{ticker}} broke below its recent low at ${{price}}.', type: 'warning', icon: '📉', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:brkd:${h.today()}`),

  m('watchlist_stock', 'ma_crossover', 'Moving-average crossover', 'Golden/death cross (SMA50×SMA200)',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'fast', type: 'number', default: 50, label: 'Fast MA' }, { name: 'slow', type: 'number', default: 200, label: 'Slow MA' }, { name: 'dir', type: 'select', default: 'golden', label: 'Type', options: ['golden', 'death'] }],
    (c, p) => {
      const f = Number(p.fast || 50); const s = Number(p.slow || 200);
      const fNow = h.sma(c.stock, f); const sNow = h.sma(c.stock, s);
      const fPrev = h.smaAt(c.stock, f, 1); const sPrev = h.smaAt(c.stock, s, 1);
      if ([fNow, sNow, fPrev, sPrev].some((x) => x == null)) return false;
      return p.dir === 'death' ? (fPrev >= sPrev && fNow < sNow) : (fPrev <= sPrev && fNow > sNow);
    },
    (c, p) => ({ title: '{{ticker}} ' + (p.dir === 'death' ? 'death cross' : 'golden cross'), message: '{{ticker}} SMA{{value}} crossed.', type: p.dir === 'death' ? 'warning' : 'success', icon: '✖️', deepLink: link, actionText: 'View {{ticker}}' }),
    (c, p) => `${c.ticker}:ma:${p.dir}:${h.today()}`),

  m('watchlist_stock', 'trending_stock', 'Trending stock', 'Hot-score trend stage reaches level',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'stage', type: 'select', default: 'trending', label: 'Stage', options: ['emerging', 'accelerating', 'trending'] }],
    (c, p) => c.hot && c.hot.trendStage === (p.stage || 'trending'),
    () => ({ title: '{{ticker}} is trending', message: '{{ticker}} is gaining attention on MyTrade.', type: 'info', icon: '🔥', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:trend:${c.hot && c.hot.trendStage}`),

  m('watchlist_stock', 'ai_hot_stock', 'AI hot stock', 'Hot-score crosses a level',
    [{ name: 'minScore', type: 'number', default: 70, label: 'Hot score ≥' }],
    (c, p) => c.hot && c.hot.hotScore >= Number(p.minScore || 70),
    () => ({ title: '🔥 {{ticker}} is hot', message: '{{ticker}} has a high MyTrade hot-score right now.', type: 'info', icon: '🔥', deepLink: link, actionText: 'View {{ticker}}' }),
    (c) => `${c.ticker}:hot:${h.today()}`),

  m('watchlist_stock', 'major_news', 'Major news', 'Significant news sentiment',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'minMagnitude', type: 'number', default: 3, label: 'Sentiment |score| ≥' }],
    (c, p) => { const st = h.an(c.stock).sentiment; return st && st.headlinesAnalyzed > 0 && Math.abs(st.score || 0) >= Number(p.minMagnitude || 3); },
    () => ({ title: '{{ticker}} in the news', message: 'Notable news sentiment detected for {{ticker}}.', type: 'info', icon: '📰', deepLink: link, actionText: 'Read' }),
    (c) => `${c.ticker}:news:${h.today()}`),

  m('watchlist_stock', 'breaking_news', 'Breaking news', 'Strong negative/positive news burst',
    [{ name: 'ticker', type: 'ticker', default: '', label: 'Ticker' }, { name: 'minMagnitude', type: 'number', default: 5, label: 'Sentiment |score| ≥' }],
    (c, p) => { const st = h.an(c.stock).sentiment; return st && st.headlinesAnalyzed > 0 && Math.abs(st.score || 0) >= Number(p.minMagnitude || 5); },
    () => ({ title: '🚨 Breaking: {{ticker}}', message: 'Breaking news activity for {{ticker}}.', type: 'alert', icon: '🚨', deepLink: link, actionText: 'Read' }),
    (c) => `${c.ticker}:breaking:${h.today()}`),
];

module.exports = STOCK;
