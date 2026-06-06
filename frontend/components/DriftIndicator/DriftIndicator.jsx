import styles from './DriftIndicator.module.scss';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';

const ARROWS = {
  RISING: '↑',
  FLAT: '→',
  FALLING: '↓',
};

export function DriftIndicator({ drift, driftPercent, isSellTheNewsRisk }) {
  const sign = driftPercent > 0 ? '+' : '';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>Pre-Earnings Drift
          <InfoTooltip content="10-day pre-earnings price drift. RISING means the stock has rallied into earnings, which can set up a sell-the-news scenario even on a beat." position="bottom" />
        </span>
        <span className={styles.subLabel}>(10-day)</span>
      </div>

      <div className={styles.row}>
        <span className={`${styles.arrow} ${styles[drift.toLowerCase()]}`}>
          {ARROWS[drift]}
        </span>
        <span className={`${styles.drift} ${styles[drift.toLowerCase()]}`}>
          {drift}
        </span>
        <span className={`${styles.percent} ${styles[drift.toLowerCase()]}`}>
          {sign}{driftPercent.toFixed(1)}%
        </span>
      </div>

      {isSellTheNewsRisk && (
        <div className={styles.warning}>
          ⚠ Sell-the-News Risk — sharp pre-earnings rally detected
        </div>
      )}
    </div>
  );
}
