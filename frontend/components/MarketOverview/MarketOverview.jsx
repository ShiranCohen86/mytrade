
import { useState, useEffect, useCallback } from 'react';
import { getMarketOverview } from '@/lib/apiClient';
import styles from './MarketOverview.module.scss';

const LABELS = { SPY: 'S&P 500', QQQ: 'Nasdaq', DIA: 'Dow', VIX: 'VIX' };

function fmtNum(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeMood(data) {
  const spy = data.find((d) => d.ticker === 'SPY');
  const qqq = data.find((d) => d.ticker === 'QQQ');
  const vix = data.find((d) => d.ticker === 'VIX');

  const spyPct = spy?.changePercent ?? 0;
  const qqqPct = qqq?.changePercent ?? 0;
  const vixPrice = vix?.price ?? 0;

  if (vixPrice >= 25) return { label: 'VOLATILE', cls: 'volatile', emoji: '⚡' };
  if (spyPct >= 0.5 && qqqPct >= 0.5) return { label: 'BULLISH', cls: 'bullish', emoji: '▲' };
  if (spyPct <= -0.5 && qqqPct <= -0.5) return { label: 'BEARISH', cls: 'bearish', emoji: '▼' };
  if (Math.abs(spyPct - qqqPct) > 1) return { label: 'MIXED', cls: 'mixed', emoji: '↔' };
  return { label: 'NEUTRAL', cls: 'neutral_mood', emoji: '—' };
}

export function MarketOverview() {
  const [data, setData] = useState([]);

  const load = useCallback(async () => {
    try {
      const quotes = await getMarketOverview();
      if (Array.isArray(quotes)) setData(quotes);
    } catch { /* silent — dashboard still usable */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (data.length === 0) return null;

  const mood = computeMood(data);

  return (
    <div className={styles.strip} aria-label="Market overview">
      {data.map(({ ticker, price, change, changePercent }) => {
        const pct = changePercent;
        const sign = pct > 0 ? '+' : '';
        const cls = pct > 0 ? styles.pos : pct < 0 ? styles.neg : styles.neutral;
        return (
          <div key={ticker} className={`${styles.item} ${cls}`}>
            <span className={styles.name}>{LABELS[ticker] || ticker}</span>
            <span className={styles.ticker}>{ticker}</span>
            <span className={styles.price}>{fmtNum(price)}</span>
            <span className={styles.change}>
              {change != null ? `${sign}${fmtNum(change)}` : '—'}
              {' '}
              <span className={styles.pct}>({sign}{pct != null ? pct.toFixed(2) : '—'}%)</span>
            </span>
          </div>
        );
      })}
      <div className={`${styles.item} ${styles.moodItem} ${styles[mood.cls]}`} aria-label={`Market mood: ${mood.label}`}>
        <span className={styles.name}>Market Mood</span>
        <span className={styles.ticker}>MOOD</span>
        <span className={styles.moodLabel}>{mood.emoji} {mood.label}</span>
      </div>
    </div>
  );
}
