
import { useMemo } from 'react';
import styles from './WatchlistSummary.module.scss';

export function WatchlistSummary({ stocks }) {
  const stats = useMemo(() => {
    const analyzed = stocks.filter((s) => s.analysis?.riskScore != null);
    if (analyzed.length === 0) return null;

    const avgRisk = analyzed.reduce((s, x) => s + (x.analysis?.riskScore ?? 0), 0) / analyzed.length;
    const avgExp  = analyzed.reduce((s, x) => s + (x.analysis?.expectationScore ?? 0), 0) / analyzed.length;
    const sellNews = analyzed.filter((s) => s.analysis?.isSellTheNewsRisk).length;

    const sectorCounts = {};
    for (const s of stocks) {
      const sec = s.sector || 'Unknown';
      sectorCounts[sec] = (sectorCounts[sec] ?? 0) + 1;
    }
    const sectors = Object.entries(sectorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const highRisk    = analyzed.filter((s) => (s.analysis?.riskScore ?? 0) >= 70).length;
    const earningsIn7 = stocks.filter((s) => {
      const d = s.cachedData?.earningsDate;
      if (!d) return false;
      const days = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 7;
    }).length;

    return { avgRisk, avgExp, sellNews, sectors, highRisk, earningsIn7, total: analyzed.length };
  }, [stocks]);

  if (!stats) return null;

  return (
    <section className={styles.wrapper} aria-label="Watchlist summary">
      <h2 className={styles.heading}>Portfolio Overview</h2>
      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.label}>Avg Risk</span>
          <span className={`${styles.value} ${riskClass(stats.avgRisk)}`}>{stats.avgRisk.toFixed(0)}</span>
          <span className={styles.sub}>out of 100</span>
        </div>
        <div className={styles.card}>
          <span className={styles.label}>Avg Expectation</span>
          <span className={styles.value}>{stats.avgExp.toFixed(0)}</span>
          <span className={styles.sub}>out of 100</span>
        </div>
        <div className={styles.card}>
          <span className={styles.label}>High Risk Stocks</span>
          <span className={`${styles.value} ${stats.highRisk > 0 ? styles.danger : ''}`}>{stats.highRisk}</span>
          <span className={styles.sub}>risk ≥ 70</span>
        </div>
        <div className={styles.card}>
          <span className={styles.label}>Earnings ≤ 7d</span>
          <span className={`${styles.value} ${stats.earningsIn7 > 0 ? styles.warn : ''}`}>{stats.earningsIn7}</span>
          <span className={styles.sub}>stocks</span>
        </div>
        {stats.sellNews > 0 && (
          <div className={styles.card}>
            <span className={styles.label}>Sell-the-News</span>
            <span className={`${styles.value} ${styles.warn}`}>{stats.sellNews}</span>
            <span className={styles.sub}>at risk</span>
          </div>
        )}
      </div>

      {stats.sectors.length > 0 && (
        <div className={styles.sectors}>
          <span className={styles.sectLabel}>Sector Mix</span>
          <div className={styles.sectBars}>
            {stats.sectors.map(([name, count]) => (
              <div key={name} className={styles.sectRow}>
                <span className={styles.sectName}>{name}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(count / stocks.length) * 100}%` }}
                  />
                </div>
                <span className={styles.sectCount}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function riskClass(score) {
  if (score >= 70) return styles.danger;
  if (score >= 40) return styles.warn;
  return styles.safe;
}
