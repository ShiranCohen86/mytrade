
import { useMemo } from 'react';
import styles from './WatchlistSummary.module.scss';

export function WatchlistSummary({ stocks, portfolio = [] }) {
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

    const bullish  = analyzed.filter((s) => s.analysis?.marketRegime === 'BULLISH').length;
    const bearish  = analyzed.filter((s) => s.analysis?.marketRegime === 'BEARISH').length;
    const volatile = analyzed.filter((s) => s.analysis?.marketRegime === 'VOLATILE').length;

    return { avgRisk, avgExp, sellNews, sectors, highRisk, earningsIn7, total: analyzed.length, bullish, bearish, volatile };
  }, [stocks]);

  const pnlStats = useMemo(() => {
    if (!portfolio.length) return null;
    const positions = portfolio
      .map((p) => {
        const stock = stocks.find((s) => s.ticker === p.ticker);
        const current = stock?.cachedData?.price;
        if (!current || !p.entryPrice) return null;
        return { ticker: p.ticker, pnlPct: ((current - p.entryPrice) / p.entryPrice) * 100 };
      })
      .filter(Boolean);
    if (positions.length === 0) return null;
    const avgReturn = positions.reduce((sum, p) => sum + p.pnlPct, 0) / positions.length;
    const winners = positions.filter((p) => p.pnlPct >= 0).length;
    const sorted = [...positions].sort((a, b) => b.pnlPct - a.pnlPct);
    return { avgReturn, winners, losers: positions.length - winners, total: positions.length, best: sorted[0], worst: sorted[sorted.length - 1] };
  }, [portfolio, stocks]);

  if (!stats) return null;

  return (
    <section className={styles.wrapper} aria-label="Watchlist summary">
      <h2 className={styles.heading}>Portfolio Overview</h2>
      <div className={styles.grid}>
        {pnlStats && (
          <>
            <div className={styles.card}>
              <span className={styles.label}>Avg Return</span>
              <span className={`${styles.value} ${pnlStats.avgReturn >= 0 ? styles.safe : styles.danger}`}>
                {pnlStats.avgReturn >= 0 ? '+' : ''}{pnlStats.avgReturn.toFixed(1)}%
              </span>
              <span className={styles.sub}>{pnlStats.total} tracked</span>
            </div>
            <div className={styles.card}>
              <span className={styles.label}>Win / Loss</span>
              <span className={styles.value}>
                <span className={styles.safe}>{pnlStats.winners}</span>
                <span className={styles.muted}> / </span>
                <span className={pnlStats.losers > 0 ? styles.danger : ''}>{pnlStats.losers}</span>
              </span>
              <span className={styles.sub}>positions</span>
            </div>
            {pnlStats.total >= 2 && (
              <div className={styles.card}>
                <span className={styles.label}>Best · Worst</span>
                <span className={styles.value}>
                  <span className={styles.safe}>{pnlStats.best.ticker}</span>
                  <span className={styles.muted}> / </span>
                  <span className={pnlStats.worst.pnlPct < 0 ? styles.danger : styles.safe}>{pnlStats.worst.ticker}</span>
                </span>
                <span className={styles.sub}>
                  {pnlStats.best.pnlPct >= 0 ? '+' : ''}{pnlStats.best.pnlPct.toFixed(1)}% / {pnlStats.worst.pnlPct >= 0 ? '+' : ''}{pnlStats.worst.pnlPct.toFixed(1)}%
                </span>
              </div>
            )}
          </>
        )}
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
        {stats.total > 0 && (stats.bullish > 0 || stats.bearish > 0) && (
          <div className={styles.card}>
            <span className={styles.label}>Regime Mix</span>
            <div className={styles.sentimentBar}>
              {stats.bullish > 0 && (
                <div
                  className={styles.sentimentBull}
                  style={{ width: `${(stats.bullish / stats.total) * 100}%` }}
                  title={`${stats.bullish} Bullish`}
                />
              )}
              {stats.volatile > 0 && (
                <div
                  className={styles.sentimentVol}
                  style={{ width: `${(stats.volatile / stats.total) * 100}%` }}
                  title={`${stats.volatile} Volatile`}
                />
              )}
              {stats.bearish > 0 && (
                <div
                  className={styles.sentimentBear}
                  style={{ width: `${(stats.bearish / stats.total) * 100}%` }}
                  title={`${stats.bearish} Bearish`}
                />
              )}
            </div>
            <span className={styles.sub}>
              {stats.bullish > 0 && <span className={styles.safe}>{stats.bullish} bull</span>}
              {stats.bullish > 0 && (stats.volatile > 0 || stats.bearish > 0) && <span className={styles.muted}> · </span>}
              {stats.volatile > 0 && <span className={styles.warn}>{stats.volatile} vol</span>}
              {stats.volatile > 0 && stats.bearish > 0 && <span className={styles.muted}> · </span>}
              {stats.bearish > 0 && <span className={styles.danger}>{stats.bearish} bear</span>}
            </span>
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
