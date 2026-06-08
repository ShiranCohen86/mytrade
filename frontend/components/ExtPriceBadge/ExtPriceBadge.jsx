import { fmtPrice } from '@/lib/format';
import styles from './ExtPriceBadge.module.scss';

// Shows pre-market (PRE) or after-hours (AH) price badge when applicable.
// Pass cachedData directly — component renders nothing if no extended-hours data.
export function ExtPriceBadge({ cachedData }) {
  const state = cachedData?.marketState;
  const isPreMarket  = state === 'PRE'  && cachedData?.preMarketPrice  != null;
  const isPostMarket = state === 'POST' && cachedData?.postMarketPrice != null;
  if (!isPreMarket && !isPostMarket) return null;

  const price = isPreMarket ? cachedData.preMarketPrice  : cachedData.postMarketPrice;
  const pct   = isPreMarket ? cachedData.preMarketChangePercent : cachedData.postMarketChangePercent;
  const label = isPreMarket ? 'PRE' : 'AH';
  const isPos = (pct ?? 0) >= 0;

  return (
    <span className={styles.wrap}>
      <span className={styles.badge}>{label}</span>
      <span className={`${styles.price} ${isPos ? styles.pos : styles.neg}`}>
        {fmtPrice(price)}
        {pct != null && (
          <span className={styles.pct}>{' '}{isPos ? '+' : ''}{pct.toFixed(2)}%</span>
        )}
      </span>
    </span>
  );
}
