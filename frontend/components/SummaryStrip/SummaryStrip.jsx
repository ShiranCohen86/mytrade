
import { useMemo } from 'react';
import styles from './SummaryStrip.module.scss';

export function SummaryStrip({ stocks, portfolio = [], priceAlerts = [] }) {
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

    // Today's avg change
    const priced = stocks.filter((s) => s.cachedData?.changePercent != null);
    const avgToday = priced.length
      ? priced.reduce((sum, s) => sum + s.cachedData.changePercent, 0) / priced.length
      : null;

    // Portfolio avg return
    let avgPnl = null;
    if (portfolio.length) {
      const positions = portfolio
        .map((p) => {
          const stock = stocks.find((s) => s.ticker === p.ticker);
          const cur = stock?.cachedData?.price;
          if (!cur || !p.entryPrice) return null;
          return (cur - p.entryPrice) / p.entryPrice * 100;
        })
        .filter((x) => x != null);
      if (positions.length) avgPnl = positions.reduce((s, x) => s + x, 0) / positions.length;
    }

    // Triggered price alerts
    const triggeredAlerts = priceAlerts.filter((alert) => {
      const stock = stocks.find((s) => s.ticker === alert.ticker);
      const price = stock?.cachedData?.price;
      if (price == null) return false;
      return alert.direction === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice;
    }).length;

    return { avgRisk, avgExp, highRisk, earningsSoon, stnRisk, avgToday, avgPnl, triggeredAlerts };
  }, [stocks, portfolio, priceAlerts]);

  if (!stats || !stocks.length) return null;

  return (
    <div className={styles.strip} role="status" aria-label="Watchlist summary">
      <div className={styles.inner}>
        {stats.avgToday != null && (
          <>
            <StatCell
              label="Today"
              value={`${stats.avgToday >= 0 ? '+' : ''}${stats.avgToday.toFixed(2)}%`}
              pos={stats.avgToday > 0}
              neg={stats.avgToday < 0}
              tooltip="Avg price change % across all watchlist stocks today"
            />
            <div className={styles.sep} />
          </>
        )}
        {stats.avgPnl != null && (
          <>
            <StatCell
              label="P&L"
              value={`${stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(1)}%`}
              pos={stats.avgPnl > 0}
              neg={stats.avgPnl < 0}
              tooltip="Avg return across tracked portfolio positions"
            />
            <div className={styles.sep} />
          </>
        )}
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
        {stats.triggeredAlerts > 0 && (
          <>
            <div className={styles.sep} />
            <StatCell label="🔔 Alerts" value={stats.triggeredAlerts} alert tooltip="Price alerts currently triggered" />
          </>
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value, alert, pos, neg, tooltip }) {
  return (
    <div className={styles.cell} title={tooltip}>
      <span className={styles.cellLabel}>{label}</span>
      <span className={`${styles.cellValue} ${alert ? styles.alert : ''} ${pos ? styles.pos : ''} ${neg ? styles.neg : ''}`}>{value}</span>
    </div>
  );
}
