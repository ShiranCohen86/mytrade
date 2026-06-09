/* Market-level triggers. evaluatorClass='market_level'. ctx = {market:{SPY,QQQ,DIA,VIX,regime,regimeChanged}}. */
const today = () => new Date().toISOString().slice(0, 10);
const idx = (c, s) => (c.market && c.market[s]) || {};
const mk = (key, label, description, paramSchema, match, defaults, dedupeKey) => ({
  key, category: 'market', evaluatorClass: 'market_level', feasible: true, label, description, paramSchema, match, defaults, dedupeKey,
});

module.exports = [
  mk('index_move', 'Major index move', 'An index moves ≥ threshold',
    [{ name: 'index', type: 'select', default: 'SPY', label: 'Index', options: ['SPY', 'QQQ', 'DIA'] }, { name: 'threshold', type: 'number', default: 1.5, label: 'Move ≥ (%)' }, { name: 'direction', type: 'select', default: 'either', label: 'Direction', options: ['up', 'down', 'either'] }],
    (c, p) => { const cp = idx(c, p.index || 'SPY').changePercent; if (cp == null) return false; const t = Number(p.threshold || 1.5); return p.direction === 'up' ? cp >= t : p.direction === 'down' ? cp <= -t : Math.abs(cp) >= t; },
    (c, p) => ({ title: '{{index}} {{changePercent}}% today', message: 'The {{index}} index moved {{changePercent}}% today.', type: 'info', icon: '📊', deepLink: '/dashboard', actionText: 'View markets' }),
    (c, p) => `idx:${p.index}:${today()}`),

  mk('market_correction', 'Market correction', 'S&P falls sharply on the day',
    [{ name: 'threshold', type: 'number', default: 2, label: 'SPY fall ≥ (%)' }],
    (c, p) => (idx(c, 'SPY').changePercent ?? 0) <= -Number(p.threshold || 2),
    () => ({ title: 'Markets selling off', message: 'The S&P 500 is down {{changePercent}}% today.', type: 'warning', icon: '🐻', deepLink: '/dashboard', actionText: 'View markets' }),
    () => `correction:${today()}`),

  mk('market_rally', 'Market rally', 'S&P rises sharply on the day',
    [{ name: 'threshold', type: 'number', default: 2, label: 'SPY rise ≥ (%)' }],
    (c, p) => (idx(c, 'SPY').changePercent ?? 0) >= Number(p.threshold || 2),
    () => ({ title: 'Markets rallying', message: 'The S&P 500 is up {{changePercent}}% today.', type: 'success', icon: '🐂', deepLink: '/dashboard', actionText: 'View markets' }),
    () => `rally:${today()}`),

  mk('vix_spike', 'VIX spike', 'Volatility index above a level',
    [{ name: 'level', type: 'number', default: 25, label: 'VIX ≥' }],
    (c, p) => (idx(c, 'VIX').price ?? 0) >= Number(p.level || 25),
    () => ({ title: 'Volatility spike', message: 'The VIX is elevated at {{value}}.', type: 'warning', icon: '🌡️', deepLink: '/dashboard', actionText: 'View markets' }),
    () => `vix:${today()}`),

  mk('market_regime_change', 'Market regime change', 'Macro regime flips',
    [{ name: 'regime', type: 'select', default: 'any', label: 'New regime', options: ['any', 'BULLISH', 'BEARISH', 'VOLATILE', 'NEUTRAL'] }],
    (c, p) => c.market && c.market.regimeChanged && (p.regime === 'any' || !p.regime || c.market.regime === p.regime),
    (c) => ({ title: 'Market regime: {{value}}', message: 'The market regime shifted to {{value}}.', type: 'info', icon: '🔀', deepLink: '/dashboard', actionText: 'View markets' }),
    (c) => `regime:${c.market && c.market.regime}:${today()}`),
];
