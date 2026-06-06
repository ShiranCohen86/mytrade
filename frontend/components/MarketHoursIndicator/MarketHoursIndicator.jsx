
import { useState, useEffect } from 'react';
import { getMarketStatus } from '@/lib/marketHours';
import styles from './MarketHoursIndicator.module.scss';

const LABELS = {
  open:   'Market Open',
  pre:    'Pre-Market',
  after:  'After-Hours',
  closed: 'Market Closed',
};

export function MarketHoursIndicator() {
  const [status, setStatus] = useState('closed');

  useEffect(() => {
    setStatus(getMarketStatus());
    const interval = setInterval(() => setStatus(getMarketStatus()), 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={`${styles.badge} ${styles[status]}`} title="US equity market hours (NYSE/NASDAQ)">
      <span className={styles.dot} />
      {LABELS[status]}
    </span>
  );
}
