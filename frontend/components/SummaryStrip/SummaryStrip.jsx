
import { useMemo } from 'react';
import styles from './SummaryStrip.module.scss';

export function SummaryStrip({ stocks }) {
  const stats = useMemo(() => {
    if (!stocks.length) return null;
    const analyzed = stocks.filter((s) => s.analysis);
    const avgRisk = analyzed.length
      ? Math.round(analyzed.reduce((sum, s) => sum + (s.analysis?.riskScore ?? 0), 0) / analyzed.length)
      : null;
    const avgExp = analyzed.length
      ? Math.round(analyzed.reduce((sum, s) => sum + (s.analysis?.expectationScore ?? 0), 0) / analyzed.length)
      : null;
    const highRisk = analyzed.filter((s) => (s.analysis?.riskScore ?? 0) >= 70).length;
    const earningsSoon = stocks.filter((s) => {
      const d = s.cachedData?.earningsDate;
      if (!d) return false;
      const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
      return days >= 0 && days <= 7;
    }).length;
    const stnRisk = analyzed.filter((s) => s.analysis?.isSellTheNewsRisk).length;
    return { avgRisk, avgExp, highRisk, earningsSoon, stnRisk };
  }, [stocks]);

  if (!stats || !stocks.length) return null;

  return (
    <div className={styles.strip} role="status" aria-label="Watchlist summary">
      <div className={styles.inner}>
        <StatCell label="Risk" value={stats.avgRisk ?? '—'} alert={stats.avgRisk !== null && stats.avgRisk >= 70} tooltip="Avg risk score (0–100). ≥70 = High." />
        <div className={styles.sep} />
        <StatCell label="Expect" value={stats.avgExp ?? '—'} tooltip="Avg expectation score: how much upside is priced in. Higher = more cautious." />
        <div className={styles.sep} />
        <StatCell label="High" value={stats.highRisk} alert={stats.highRisk > 0} tooltip="Stocks with risk ≥ 70" />
        <div className={styles.sep} />
        <StatCell label="Earn ≤7d" value={stats.earningsSoon} alert={stats.earningsSoon > 0} tooltip="Stocks with earnings in the next 7 days" />
        {stats.stnRisk > 0 && (
          <>
            <div className={styles.sep} />
            <StatCell label="STN" value={stats.stnRisk} alert tooltip="Sell-the-News Risk: stocks up >10% heading into earnings." />
          </>
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value, alert, tooltip }) {
  return (
    <div className={styles.cell} title={tooltip}>
      <span className={styles.cellLabel}>{label}</span>
      <span className={`${styles.cellValue} ${alert ? styles.alert : ''}`}>{value}</span>
    </div>
  );
}
