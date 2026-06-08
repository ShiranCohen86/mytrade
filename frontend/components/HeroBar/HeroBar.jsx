import { Link } from 'react-router-dom';
import { fmtPrice } from '@/lib/format';
import styles from './HeroBar.module.scss';

export function HeroBar({
  ticker, name, sector, price, change, changePercent,
  preMarketPrice, preMarketChange, preMarketChangePercent,
  postMarketPrice, postMarketChange, postMarketChangePercent,
  marketState,
  onRefresh, isRefreshing,
}) {
  const pct = changePercent ?? 0;
  const isPos = pct >= 0;

  const isPreMarket  = marketState === 'PRE'  && preMarketPrice != null;
  const isPostMarket = marketState === 'POST' && postMarketPrice != null;

  const extPrice  = isPreMarket ? preMarketPrice  : isPostMarket ? postMarketPrice  : null;
  const extPct    = isPreMarket ? preMarketChangePercent  : isPostMarket ? postMarketChangePercent  : null;
  const extChange = isPreMarket ? preMarketChange  : isPostMarket ? postMarketChange  : null;
  const extLabel  = isPreMarket ? 'PRE' : 'AFTER';
  const extIsPos  = (extPct ?? 0) >= 0;

  return (
    <div className={styles.hero}>
      <div className={styles.left}>
        <Link to="/dashboard" className={styles.backLink}>
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
        <div className={styles.priceBlock}>
          <span className={styles.price}>{fmtPrice(price)}</span>
          <span className={`${styles.change} ${isPos ? styles.pos : styles.neg}`}>
            {isPos ? '+' : ''}{pct.toFixed(2)}%
            {change != null && (
              <span className={styles.changeAbs}>
                {' '}({isPos ? '+' : ''}{fmtPrice(change)})
              </span>
            )}
          </span>
          {extPrice != null && (
            <div className={styles.extRow}>
              <span className={styles.extBadge}>{extLabel}</span>
              <span className={styles.extPrice}>{fmtPrice(extPrice)}</span>
              {extPct != null && (
                <span className={`${styles.extChange} ${extIsPos ? styles.pos : styles.neg}`}>
                  {extIsPos ? '+' : ''}{extPct.toFixed(2)}%
                  {extChange != null && (
                    <span className={styles.changeAbs}>
                      {' '}({extIsPos ? '+' : ''}{fmtPrice(extChange)})
                    </span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
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
