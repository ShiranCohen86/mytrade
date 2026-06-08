import { fmtPrice } from '@/lib/format';
import { ExtPriceBadge } from '@/components/ExtPriceBadge/ExtPriceBadge';
import styles from './ScenarioPanel.module.scss';

export function ScenarioPanel({ scenarios, currentPrice, cachedData }) {
  if (!scenarios?.bullish) {
    return <div className={styles.empty}>Scenario data unavailable</div>;
  }

  const items = [
    { key: 'bullish', icon: '▲', label: 'Bullish', colorClass: styles.bullish, ...scenarios.bullish },
    { key: 'neutral', icon: '→', label: 'Neutral', colorClass: styles.neutral, ...scenarios.neutral },
    { key: 'bearish', icon: '▼', label: 'Bearish', colorClass: styles.bearish, ...scenarios.bearish },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Earnings Scenarios</span>
        <span className={styles.current}>
          Now: {fmtPrice(currentPrice)}
          <ExtPriceBadge cachedData={cachedData} />
        </span>
      </div>

      <div className={styles.headerRow}>
        <span className={styles.colLabel}>Scenario</span>
        <span className={styles.colLabel}>Target</span>
        <span className={styles.colLabel}>Move</span>
        <span className={styles.colLabel}></span>
        <span className={styles.colLabel}>Prob</span>
      </div>

      {items.map((item) => (
        <div key={item.key} className={`${styles.row} ${item.colorClass}`} title={item.description || undefined}>
          <div className={styles.scenarioCell}>
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.scenarioLabel}>{item.label}</span>
          </div>
          <span className={styles.target}>{fmtPrice(item.priceTarget)}</span>
          <span className={`${styles.move} ${item.percentMove >= 0 ? styles.pos : styles.neg}`}>
            {item.percentMove >= 0 ? '+' : ''}{item.percentMove?.toFixed(1)}%
          </span>
          <span />
          <div className={styles.probCell}>
            <span className={styles.probVal}>{item.probability}%</span>
            <div className={styles.probBar}>
              <div className={`${styles.probFill} ${item.colorClass}`} style={{ width: `${item.probability}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
