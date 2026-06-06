import styles from './ExpectationMeter.module.scss';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';

const TIP = 'How much good news the market already prices in. Score from 3 factors: 10/30-day momentum (0–40 pts), P/E vs sector avg (0–30), price vs analyst target (0–30). HIGH or VERY HIGH = the stock needs to beat estimates just to hold its price.';

const GUIDANCE = {
  VERY_HIGH: 'High bar to beat — consider waiting until after earnings.',
  HIGH: 'Market expects strong results. A miss could hurt more than usual.',
};

const LABEL_COLORS = {
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
  VERY_HIGH: 'very_high',
};

const LABEL_TEXT = {
  LOW: 'Low Expectations',
  MODERATE: 'Moderate Expectations',
  HIGH: 'High Expectations',
  VERY_HIGH: 'Very High Expectations',
};

export function ExpectationMeter({ score, label }) {
  const clampedScore = Math.max(0, Math.min(100, score));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>
          Market Expectations <InfoTooltip content={TIP} position="bottom" />
        </span>
        <span className={`${styles.label} ${styles[LABEL_COLORS[label]]}`}>
          {LABEL_TEXT[label]}
        </span>
      </div>

      <div className={styles.trackWrapper}>
        <div className={styles.track}>
          <div
            className={`${styles.fill} ${styles[`fill_${LABEL_COLORS[label]}`]}`}
            style={{ width: `${clampedScore}%` }}
          />
        </div>
        <span className={styles.score}>{clampedScore}</span>
      </div>

      <div className={styles.scale}>
        <span>Low</span>
        <span>Moderate</span>
        <span>High</span>
        <span>Very High</span>
      </div>
      {GUIDANCE[label] && (
        <p className={styles.guidance}>{GUIDANCE[label]}</p>
      )}
    </div>
  );
}
