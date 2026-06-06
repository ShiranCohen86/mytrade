
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import styles from './RiskGauge.module.scss';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';

const BREAKDOWN_TIPS = {
  volatility: 'Annualised volatility over 60 days. >80% → 25 pts, >50% → 18, >30% → 12, else 5. Max 25.',
  sector: 'Sector-based structural risk. Healthcare/Biotech → 20, Tech → 10, Utilities/Staples → 0, other → 8. Max 20.',
  earningsProximity: 'Days until next earnings. 0–7 days → 25, 8–14 → 20, 15–30 → 12, 31–60 → 5, >60 or unknown → 0. Max 25.',
  momentum: 'Pre-earnings drift direction combined with expectation level. RISING + high expectations → 15 pts (sell-the-news setup). Max 15.',
  market: 'Current market regime risk. BEARISH → 15, VOLATILE → 12, NEUTRAL → 7, BULLISH → 3. Max 15.',
};

function gaugeColor(score) {
  if (score >= 70) return 'var(--neg)';
  if (score >= 40) return 'var(--warn)';
  return 'var(--pos)';
}

const BREAKDOWN_LABELS = {
  volatility: 'Volatility',
  sector: 'Sector',
  earningsProximity: 'Earnings Proximity',
  momentum: 'Momentum',
  market: 'Market Regime',
};

const BREAKDOWN_MAX = {
  volatility: 25,
  sector: 20,
  earningsProximity: 25,
  momentum: 15,
  market: 15,
};

export function RiskGauge({ riskScore, riskLabel, breakdown }) {
  const clamped = Math.max(0, Math.min(100, riskScore));
  const color = gaugeColor(clamped);

  const data = [
    { value: clamped },
    { value: 100 - clamped },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.gaugeWrap}>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="80%"
              startAngle={180}
              endAngle={0}
              innerRadius={55}
              outerRadius={75}
              dataKey="value"
              isAnimationActive={false}
              strokeWidth={0}
            >
              <Cell style={{ fill: color }} />
              <Cell style={{ fill: 'var(--chrome-dim)' }} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.overlay}>
          <span className={styles.score} style={{ color }}>{clamped}</span>
          <span className={`${styles.label} ${styles[riskLabel.toLowerCase()]}`}>{riskLabel}</span>
        </div>
        {/* Scale endpoints — LOW left, HIGH right */}
        <span className={styles.scaleLeft}>0 LOW</span>
        <span className={styles.scaleRight}>HIGH 100</span>
      </div>

      <div className={styles.breakdown}>
        {Object.keys(breakdown).map((key) => {
          const val = breakdown[key];
          const max = BREAKDOWN_MAX[key];
          const pct = Math.min(100, (val / max) * 100);
          return (
            <div key={key} className={styles.row}>
              <span className={styles.rowLabel}>
                {BREAKDOWN_LABELS[key]}
                <InfoTooltip content={BREAKDOWN_TIPS[key]} position="right" />
              </span>
              <div className={styles.bar}>
                <div
                  className={styles.barFill}
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <span className={styles.rowValue}>{val}/{max}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
