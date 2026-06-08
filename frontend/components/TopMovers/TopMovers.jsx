
import { useState, useEffect, useCallback } from 'react';
import { getMarketMovers } from '@/lib/apiClient';
import styles from './TopMovers.module.scss';

function MoverRow({ ticker, name, changePercent, onAdd, adding }) {
  const sign = changePercent >= 0 ? '+' : '';
  const cls = changePercent >= 0 ? styles.pos : styles.neg;
  return (
    <div className={`${styles.row} ${cls}`}>
      <span className={styles.ticker}>{ticker}</span>
      <span className={styles.name}>{name}</span>
      <span className={styles.pct}>{sign}{changePercent?.toFixed(2)}%</span>
      {onAdd && (
        <button
          className={styles.addBtn}
          onClick={() => onAdd(ticker)}
          disabled={adding}
          aria-label={`Add ${ticker} to watchlist`}
          title={`Add ${ticker} to watchlist`}
        >
          {adding ? '…' : '+'}
        </button>
      )}
    </div>
  );
}

export function TopMovers({ onAdd }) {
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await getMarketMovers();
      if (result?.gainers || result?.losers) setData(result);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const handleAdd = useCallback(async (ticker) => {
    if (!onAdd || adding) return;
    setAdding(ticker);
    try {
      await onAdd(ticker);
    } finally {
      setAdding(null);
    }
  }, [onAdd, adding]);

  if (!data || (!data.gainers?.length && !data.losers?.length)) return null;

  return (
    <div className={styles.panel}>
      {data.gainers?.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.heading}>
            <span className={`${styles.headingDot} ${styles.dotPos}`} />
            Top Gainers
          </h3>
          <div className={styles.list}>
            {data.gainers.map((m) => (
              <MoverRow key={m.ticker} {...m} onAdd={onAdd ? handleAdd : null} adding={adding === m.ticker} />
            ))}
          </div>
        </div>
      )}
      {data.losers?.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.heading}>
            <span className={`${styles.headingDot} ${styles.dotNeg}`} />
            Top Losers
          </h3>
          <div className={styles.list}>
            {data.losers.map((m) => (
              <MoverRow key={m.ticker} {...m} onAdd={onAdd ? handleAdd : null} adding={adding === m.ticker} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
