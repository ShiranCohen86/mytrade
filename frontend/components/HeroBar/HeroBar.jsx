import { Link } from 'react-router-dom';
import { fmtPrice } from '@/lib/format';
import styles from './HeroBar.module.scss';

export function HeroBar({ ticker, name, sector, price, change, changePercent, onRefresh, isRefreshing }) {
  const pct = changePercent ?? 0;
  const isPos = pct >= 0;

  return (
    <div className={styles.hero}>
      <div className={styles.left}>
        <Link to="/" className={styles.backLink}>
          ← Watchlist
        </Link>
        <div className={styles.identity}>
          <span className={styles.ticker}>{ticker}</span>
          <span className={styles.sep}>·</span>
          <span className={styles.name}>{name}</span>
          {sector && (
            <>
              <span className={styles.sep}>·</span>
              <span className={styles.sector}>{sector}</span>
            </>
          )}
        </div>
      </div>
      <div className={styles.right}>
        <span className={styles.price}>{fmtPrice(price)}</span>
        <span className={`${styles.change} ${isPos ? styles.pos : styles.neg}`}>
          {isPos ? '+' : ''}{pct.toFixed(2)}%
          {change != null && (
            <span className={styles.changeAbs}>
              {' '}({isPos ? '+' : ''}{fmtPrice(change)})
            </span>
          )}
        </span>
        <button
          className={styles.refreshBtn}
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh analysis"
        >
          {isRefreshing ? <span className={styles.spinning}>⟳</span> : '↻'} Refresh
        </button>
      </div>
    </div>
  );
}
