import { useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useStocks } from '@/hooks/useStocks';
import { fmtPrice } from '@/lib/format';
import styles from './PortfolioPage.module.scss';

const SECTOR_COLORS = [
  '#3D7EFF', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
  '#14b8a6', '#a855f7',
];

function SectorTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--chrome-mid)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
      <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 2 }}>{name}</strong>
      <span style={{ color: 'var(--text-secondary)' }}>{value} position{value !== 1 ? 's' : ''}</span>
    </div>
  );
}

function fmtPct(n) {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function riskClass(score) {
  if (score >= 70) return styles.high;
  if (score >= 40) return styles.mid;
  return styles.low;
}

export default function PortfolioPage() {
  const { stocks, portfolio, isLoading } = useStocks();

  const rows = useMemo(() => {
    if (!portfolio.length || !stocks.length) return [];
    return portfolio
      .map((entry) => {
        const stock = stocks.find((s) => s.ticker === entry.ticker);
        if (!stock) return null;
        const price = stock.cachedData?.price ?? null;
        const pnlAbs = price != null ? price - entry.entryPrice : null;
        const pnlPct = pnlAbs != null ? (pnlAbs / entry.entryPrice) * 100 : null;
        return {
          ticker: stock.ticker,
          name: stock.name,
          sector: stock.sector,
          entryPrice: entry.entryPrice,
          currentPrice: price,
          pnlAbs,
          pnlPct,
          riskScore: stock.analysis?.riskScore ?? null,
          expectationScore: stock.analysis?.expectationScore ?? null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.pnlPct ?? -Infinity) - (a.pnlPct ?? -Infinity));
  }, [stocks, portfolio]);

  const totals = useMemo(() => {
    const withPrice = rows.filter((r) => r.pnlAbs != null);
    if (!withPrice.length) return null;
    const totalCost   = withPrice.reduce((s, r) => s + r.entryPrice, 0);
    const totalValue  = withPrice.reduce((s, r) => s + r.currentPrice, 0);
    const totalPnlAbs = totalValue - totalCost;
    const totalPnlPct = (totalPnlAbs / totalCost) * 100;
    return { totalCost, totalValue, totalPnlAbs, totalPnlPct, count: withPrice.length };
  }, [rows]);

  const sectorData = useMemo(() => {
    if (!rows.length) return [];
    const map = new Map();
    for (const r of rows) {
      const key = r.sector || 'Unknown';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const avgRisk = useMemo(() => {
    const analyzed = rows.filter((r) => r.riskScore != null);
    if (!analyzed.length) return null;
    return analyzed.reduce((s, r) => s + r.riskScore, 0) / analyzed.length;
  }, [rows]);

  const exportCSV = useCallback(() => {
    const headers = ['Ticker', 'Name', 'Sector', 'Entry Price', 'Current Price', 'P&L $', 'Return %', 'Risk Score', 'Expectation Score'];
    const csvRows = rows.map((r) => [
      r.ticker,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${(r.sector || '').replace(/"/g, '""')}"`,
      r.entryPrice?.toFixed(2) ?? '',
      r.currentPrice?.toFixed(2) ?? '',
      r.pnlAbs?.toFixed(2) ?? '',
      r.pnlPct?.toFixed(2) ?? '',
      r.riskScore?.toFixed(0) ?? '',
      r.expectationScore?.toFixed(0) ?? '',
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mytrade-portfolio-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <span className={styles.pageTitle}>Portfolio</span>
        {rows.length > 0 && (
          <>
            <span className={styles.count}>{rows.length} position{rows.length !== 1 ? 's' : ''}</span>
            <button className={styles.exportBtn} onClick={exportCSV} title="Export to CSV">↓ CSV</button>
          </>
        )}
      </div>

      {totals && (
        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total Cost</span>
            <span className={styles.summaryValue}>{fmtPrice(totals.totalCost)}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Market Value</span>
            <span className={styles.summaryValue}>{fmtPrice(totals.totalValue)}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total P&amp;L</span>
            <span className={`${styles.summaryValue} ${totals.totalPnlAbs >= 0 ? styles.pos : styles.neg}`}>
              {fmtPrice(totals.totalPnlAbs)}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Return</span>
            <span className={`${styles.summaryValue} ${totals.totalPnlPct >= 0 ? styles.pos : styles.neg}`}>
              {fmtPct(totals.totalPnlPct)}
            </span>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className={styles.insights}>
          {/* Sector allocation donut */}
          <div className={styles.insightCard}>
            <span className={styles.insightTitle}>Sector Allocation</span>
            <div className={styles.donutRow}>
              <div className={styles.donutChart}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorData}
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="80%"
                      paddingAngle={sectorData.length > 1 ? 2 : 0}
                      dataKey="value"
                      stroke="none"
                    >
                      {sectorData.map((_, i) => (
                        <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<SectorTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.donutLegend}>
                {sectorData.map((s, i) => (
                  <div key={s.name} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                    <span className={styles.legendName}>{s.name}</span>
                    <span className={styles.legendCount}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Avg portfolio risk */}
          {avgRisk != null && (
            <div className={styles.insightCard}>
              <span className={styles.insightTitle}>Avg Portfolio Risk</span>
              <span className={`${styles.insightBigNum} ${avgRisk >= 70 ? styles.neg : avgRisk >= 40 ? styles.warn : styles.pos}`}>
                {avgRisk.toFixed(0)}
              </span>
              <span className={`${styles.insightSubLabel} ${avgRisk >= 70 ? styles.neg : avgRisk >= 40 ? styles.warn : styles.pos}`}>
                {avgRisk >= 70 ? 'HIGH RISK' : avgRisk >= 40 ? 'MEDIUM RISK' : 'LOW RISK'}
              </span>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>Loading…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>No positions yet</span>
          <span className={styles.emptySubtitle}>
            Expand any stock row in your Watchlist and set an entry price under "Entry / P&amp;L" to track positions here.
          </span>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Ticker</th>
                <th className={styles.th}>Sector</th>
                <th className={styles.th}>Entry</th>
                <th className={styles.th}>Current</th>
                <th className={styles.th}>P&amp;L</th>
                <th className={styles.th}>Return</th>
                <th className={styles.th}>Risk</th>
                <th className={styles.th}>Expect</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ticker} className={styles.tr}>
                  <td className={`${styles.td} ${styles.tickerCell}`}>
                    <Link to={`/stocks/${r.ticker}`} className={styles.tickerLink}>
                      {r.ticker}
                    </Link>
                    {r.name && <span className={styles.name}>{r.name}</span>}
                  </td>
                  <td className={styles.td}>
                    {r.sector && <span className={styles.sector}>{r.sector}</span>}
                  </td>
                  <td className={styles.td}>{fmtPrice(r.entryPrice)}</td>
                  <td className={styles.td}>{fmtPrice(r.currentPrice)}</td>
                  <td className={`${styles.td} ${r.pnlAbs != null ? (r.pnlAbs >= 0 ? styles.pos : styles.neg) : ''}`}>
                    {fmtPrice(r.pnlAbs)}
                  </td>
                  <td className={`${styles.td} ${r.pnlPct != null ? (r.pnlPct >= 0 ? styles.pos : styles.neg) : ''}`}>
                    {fmtPct(r.pnlPct)}
                  </td>
                  <td className={styles.td}>
                    {r.riskScore != null ? (
                      <span className={`${styles.riskBadge} ${riskClass(r.riskScore)}`}>
                        {r.riskScore.toFixed(0)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className={styles.td}>
                    {r.expectationScore != null ? r.expectationScore.toFixed(0) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
