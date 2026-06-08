import { useMemo, useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, ReferenceLine, Area, AreaChart } from 'recharts';
import { useStocks } from '@/hooks/useStocks';
import { fmtPrice } from '@/lib/format';
import { getMarketOverview } from '@/lib/apiClient';
import { ExtPriceBadge } from '@/components/ExtPriceBadge/ExtPriceBadge';
import styles from './PortfolioPage.module.scss';

const SECTOR_COLORS = [
  '#3D7EFF', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
  '#14b8a6', '#a855f7',
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--chrome-mid)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
      <span style={{ color: 'var(--text-tertiary)', display: 'block', marginBottom: 2, fontSize: 11 }}>{label}</span>
      <strong style={{ color: val >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
        {val >= 0 ? '+' : ''}{val?.toFixed(2)}%
      </strong>
    </div>
  );
}

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
        const shares = entry.shares ?? null;
        const pnlAbsPerShare = price != null ? price - entry.entryPrice : null;
        const pnlPct = pnlAbsPerShare != null ? (pnlAbsPerShare / entry.entryPrice) * 100 : null;
        const pnlAbs = pnlAbsPerShare != null && shares != null ? pnlAbsPerShare * shares : pnlAbsPerShare;
        return {
          ticker: stock.ticker,
          name: stock.name,
          sector: stock.sector,
          entryPrice: entry.entryPrice,
          shares,
          currentPrice: price,
          cachedData: stock.cachedData,
          pnlAbsPerShare,
          pnlAbs,
          pnlPct,
          todayPct: stock.cachedData?.changePercent ?? null,
          riskScore: stock.analysis?.riskScore ?? null,
          expectationScore: stock.analysis?.expectationScore ?? null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.pnlPct ?? -Infinity) - (a.pnlPct ?? -Infinity));
  }, [stocks, portfolio]);

  const totals = useMemo(() => {
    const withPrice = rows.filter((r) => r.pnlAbsPerShare != null);
    if (!withPrice.length) return null;
    // Use share-weighted totals when available, otherwise fall back to per-position (1 share)
    const withShares = withPrice.filter((r) => r.shares != null);
    const useShares = withShares.length > 0;
    const totalCost  = useShares
      ? withShares.reduce((s, r) => s + r.entryPrice * r.shares, 0)
      : withPrice.reduce((s, r) => s + r.entryPrice, 0);
    const totalValue = useShares
      ? withShares.reduce((s, r) => s + r.currentPrice * r.shares, 0)
      : withPrice.reduce((s, r) => s + r.currentPrice, 0);
    const totalPnlAbs = totalValue - totalCost;
    const totalPnlPct = (totalPnlAbs / totalCost) * 100;
    return { totalCost, totalValue, totalPnlAbs, totalPnlPct, count: withPrice.length, useShares };
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

  const winLoss = useMemo(() => {
    const priced = rows.filter((r) => r.pnlAbs != null);
    if (!priced.length) return null;
    const wins = priced.filter((r) => r.pnlAbs >= 0).length;
    const losses = priced.length - wins;
    return { wins, losses, total: priced.length };
  }, [rows]);

  const portfolioChartData = useMemo(() => {
    if (!portfolio.length || !stocks.length) return [];
    const series = portfolio
      .map((entry) => {
        const stock = stocks.find((s) => s.ticker === entry.ticker);
        if (!stock?.cachedData?.historical?.length || !entry.entryPrice) return null;
        return { entryPrice: entry.entryPrice, history: stock.cachedData.historical };
      })
      .filter(Boolean);
    if (!series.length) return [];

    const dateMap = new Map();
    for (const { entryPrice, history } of series) {
      for (const { date, close } of history) {
        if (close == null || entryPrice <= 0) continue;
        const d = new Date(date).toISOString().split('T')[0];
        if (!dateMap.has(d)) dateMap.set(d, []);
        dateMap.get(d).push(((close / entryPrice) - 1) * 100);
      }
    }
    const minCoverage = Math.max(1, Math.floor(series.length * 0.5));
    return Array.from(dateMap.entries())
      .filter(([, rs]) => rs.length >= minCoverage)
      .map(([date, rs]) => ({ date, ret: +(rs.reduce((s, r) => s + r, 0) / rs.length).toFixed(2) }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-60);
  }, [stocks, portfolio]);

  const [sortCol, setSortCol] = useState('pnlPct');
  const [sortDir, setSortDir] = useState('desc');
  const [spyChange, setSpyChange] = useState(null);

  // Fetch SPY change% for daily comparison
  useEffect(() => {
    getMarketOverview().then((quotes) => {
      const spy = Array.isArray(quotes) ? quotes.find((q) => q.ticker === 'SPY') : null;
      if (spy?.changePercent != null) setSpyChange(spy.changePercent);
    }).catch(() => {});
  }, []);

  // Average today's change across portfolio positions that have current price data
  const portfolioTodayChange = useMemo(() => {
    const priced = rows.filter((r) => r.cachedData?.changePercent != null);
    if (!priced.length) return null;
    return priced.reduce((s, r) => s + r.cachedData.changePercent, 0) / priced.length;
  }, [rows]);

  const handleSort = useCallback((col) => {
    setSortCol((prev) => {
      if (prev === col) { setSortDir((d) => d === 'desc' ? 'asc' : 'desc'); return col; }
      setSortDir('desc');
      return col;
    });
  }, []);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case 'ticker':    av = a.ticker;           bv = b.ticker;           break;
        case 'sector':    av = a.sector || '';      bv = b.sector || '';     break;
        case 'entry':     av = a.entryPrice ?? 0;   bv = b.entryPrice ?? 0;  break;
        case 'current':   av = a.currentPrice ?? 0; bv = b.currentPrice ?? 0; break;
        case 'pnlAbs':    av = a.pnlAbs ?? -Infinity; bv = b.pnlAbs ?? -Infinity; break;
        case 'todayPct':  av = a.todayPct ?? -Infinity; bv = b.todayPct ?? -Infinity; break;
        case 'risk':      av = a.riskScore ?? 0;    bv = b.riskScore ?? 0;   break;
        case 'expect':    av = a.expectationScore ?? 0; bv = b.expectationScore ?? 0; break;
        default:          av = a.pnlPct ?? -Infinity; bv = b.pnlPct ?? -Infinity;
      }
      if (typeof av === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  const exportCSV = useCallback(() => {
    const headers = ['Ticker', 'Name', 'Sector', 'Entry Price', 'Shares', 'Current Price', 'Today %', 'P&L $', 'Return %', 'Risk Score', 'Expectation Score'];
    const csvRows = rows.map((r) => [
      r.ticker,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${(r.sector || '').replace(/"/g, '""')}"`,
      r.entryPrice?.toFixed(2) ?? '',
      r.shares ?? '',
      r.currentPrice?.toFixed(2) ?? '',
      r.todayPct?.toFixed(2) ?? '',
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
          {portfolioTodayChange != null && (
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Today (avg)</span>
              <span className={`${styles.summaryValue} ${portfolioTodayChange >= 0 ? styles.pos : styles.neg}`}>
                {portfolioTodayChange >= 0 ? '+' : ''}{portfolioTodayChange.toFixed(2)}%
              </span>
            </div>
          )}
          {portfolioTodayChange != null && spyChange != null && (
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>vs S&amp;P 500</span>
              <span className={`${styles.summaryValue} ${(portfolioTodayChange - spyChange) >= 0 ? styles.pos : styles.neg}`}>
                {(portfolioTodayChange - spyChange) >= 0 ? '+' : ''}{(portfolioTodayChange - spyChange).toFixed(2)}%
              </span>
            </div>
          )}
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

          {/* Win / loss count */}
          {winLoss && (
            <div className={styles.insightCard}>
              <span className={styles.insightTitle}>Positions</span>
              <div className={styles.winLossRow}>
                <span className={`${styles.winLossNum} ${styles.pos}`}>+{winLoss.wins}</span>
                <span className={styles.winLossSep}>/</span>
                <span className={`${styles.winLossNum} ${winLoss.losses > 0 ? styles.neg : styles.winLossZero}`}>−{winLoss.losses}</span>
              </div>
              <span className={styles.insightSubLabel} style={{ color: 'var(--text-disabled)' }}>
                {winLoss.wins} profitable · {winLoss.losses} at loss
              </span>
            </div>
          )}
        </div>
      )}

      {portfolioChartData.length >= 5 && (
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>Portfolio Performance</span>
            <span className={styles.chartSubtitle}>Equal-weighted return vs. entry price · last {portfolioChartData.length}d</span>
          </div>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolioChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={portfolioChartData[portfolioChartData.length - 1]?.ret >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={portfolioChartData[portfolioChartData.length - 1]?.ret >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`} tick={{ fontSize: 10, fill: 'var(--text-disabled)' }} tickLine={false} axisLine={false} />
                <ReferenceLine y={0} stroke="var(--chrome-mid)" strokeDasharray="3 3" />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="ret"
                  stroke={portfolioChartData[portfolioChartData.length - 1]?.ret >= 0 ? '#22c55e' : '#ef4444'}
                  strokeWidth={2}
                  fill="url(#portfolioGrad)"
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
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
                {[
                  { col: 'ticker',   label: 'Ticker',  left: true },
                  { col: 'sector',   label: 'Sector' },
                  { col: 'entry',    label: 'Entry' },
                  { col: 'current',  label: 'Current' },
                  { col: 'todayPct', label: 'Today' },
                  { col: 'pnlAbs',   label: 'P&L' },
                  { col: 'pnlPct',   label: 'Return' },
                  { col: 'risk',     label: 'Risk' },
                  { col: 'expect',   label: 'Expect' },
                ].map(({ col, label, left }) => (
                  <th
                    key={col}
                    className={`${styles.th} ${styles.thSortable} ${sortCol === col ? styles.thActive : ''} ${left ? styles.thLeft : ''}`}
                    onClick={() => handleSort(col)}
                    title={`Sort by ${label}`}
                  >
                    {label}
                    {sortCol === col && <span className={styles.sortArrow}>{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
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
                  <td className={styles.td}>
                    <span>{fmtPrice(r.entryPrice)}</span>
                    {r.shares != null && <span className={styles.sharesHint}>× {r.shares}</span>}
                  </td>
                  <td className={styles.td}>
                    {fmtPrice(r.currentPrice)}
                    <ExtPriceBadge cachedData={r.cachedData} />
                  </td>
                  <td className={`${styles.td} ${r.todayPct != null ? (r.todayPct >= 0 ? styles.pos : styles.neg) : ''}`}>
                    {r.todayPct != null ? `${r.todayPct >= 0 ? '+' : ''}${r.todayPct.toFixed(2)}%` : '—'}
                  </td>
                  <td className={`${styles.td} ${r.pnlAbs != null ? (r.pnlAbs >= 0 ? styles.pos : styles.neg) : ''}`}>
                    {r.pnlAbs != null ? (r.pnlAbs >= 0 ? '+' : '') + fmtPrice(Math.abs(r.pnlAbs)) : '—'}
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
