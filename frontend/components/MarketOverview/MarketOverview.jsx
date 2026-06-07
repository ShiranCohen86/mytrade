
import { useState, useEffect, useCallback } from 'react';
import { getMarketOverview } from '@/lib/apiClient';
import styles from './MarketOverview.module.scss';

const LABELS = { SPY: 'S&P 500', QQQ: 'Nasdaq', DIA: 'Dow', VIX: 'VIX' };

function fmtNum(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    </div>
  );
}
