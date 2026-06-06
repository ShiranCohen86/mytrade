import styles from './MarketRegimeBadge.module.scss';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';

const ICONS = {
  BULLISH: '▲',
  BEARISH: '▼',
  VOLATILE: '⚡',
  NEUTRAL: '→',
};

const LABELS = {
  BULLISH: 'Bullish Market',
  BEARISH: 'Bearish Market',
  VOLATILE: 'Volatile Market',
  NEUTRAL: 'Neutral Market',
};

const LEGEND = 'BULLISH: SPY & QQQ both above their 50-day and 200-day averages. BEARISH: both trending below. VOLATILE: SPY is near its 200-day average. NEUTRAL: mixed or inconclusive signals.';

export function MarketRegimeBadge({ regime, size = 'md' }) {
  return (
    <span className={`${styles.badge} ${styles[regime.toLowerCase()]} ${size === 'sm' ? styles.sm : ''}`}>
      <span className={styles.icon}>{ICONS[regime]}</span>
      {LABELS[regime]}
      <InfoTooltip content={LEGEND} position="bottom" />
    </span>
  );
}
