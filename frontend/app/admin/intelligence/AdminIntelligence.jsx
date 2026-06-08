import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  adminIntelligenceOverview,
  adminIntelligenceHotStocks,
  adminIntelligenceHotStockDetail,
  adminIntelligenceSectorHeatmap,
  adminIntelligenceRefresh,
} from '@/lib/apiClient';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Cell,
} from 'recharts';
import styles from './AdminIntelligence.module.scss';

const TOKEN_KEY = 'mytrade-token';
const EXPRESS = import.meta.env.VITE_EXPRESS_URL || '';

async function downloadExport(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  const url = `${EXPRESS}/admin/intelligence/export${qs ? `?${qs}` : ''}`;
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `expectation-scores-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

const ALLOWED_ROLES = new Set(['admin', 'super_admin']);

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const fmtPrice = (v) => (v != null ? `$${Number(v).toFixed(2)}` : '—');

const fmtPct = (v) => (v != null ? `${v > 0 ? '+' : ''}${v}%` : '—');

function scoreColor(score) {
  if (score >= 76) return 'var(--hot-red)';
  if (score >= 56) return 'var(--hot-orange)';
  if (score >= 34) return 'var(--accent)';
  return 'var(--text-tertiary)';
}

const TIER_LABELS = {
  very_high: 'Very High',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
};

const TIER_BADGE_CLASS = {
  very_high: styles.badge_trending,
  high: styles.badge_accelerating,
  moderate: styles.badge_emerging,
  low: styles.badgeDefault,
};

const REC_LABELS = {
  strong_buy: 'Strong Buy',
  buy: 'Buy',
  hold: 'Hold',
  underperform: 'Underperform',
  sell: 'Sell',
  strong_sell: 'Strong Sell',
};

function TierBadge({ tier }) {
  const label = TIER_LABELS[tier] || tier;
  const cls = TIER_BADGE_CLASS[tier] || styles.badgeDefault;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ value }) {
  const color = scoreColor(value);
  return (
    <div className={styles.scoreBarWrap}>
      <div className={styles.scoreBarTrack}>
        <div
          className={styles.scoreBarFill}
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className={styles.scoreBarValue} style={{ color }}>{value}</span>
    </div>
  );
}

function TopCard({ stock, onClick }) {
  if (!stock) return null;
  return (
    <button className={styles.topCard} onClick={() => onClick(stock.symbol)}>
      <div className={styles.topCardSymbol}>{stock.symbol}</div>
      <div className={styles.topCardName}>{stock.name}</div>
      <div className={styles.topCardMeta}>
        <span className={styles.topCardSector}>{stock.sector}</span>
        {stock.recommendationKey && (
          <span className={styles.recChip}>
            {REC_LABELS[stock.recommendationKey?.toLowerCase()] || stock.recommendationKey}
          </span>
        )}
      </div>
      <ScoreBar value={stock.score} />
    </button>
  );
}

function StatCard({ label, value, sub, colorClass }) {
  return (
    <div className={`${styles.statCard} ${colorClass || ''}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value ?? '—'}</span>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </div>
  );
}

function DetailPanel({ symbol, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError('');
    adminIntelligenceHotStockDetail(symbol)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [symbol]);

  if (!symbol) return null;

  return (
    <div className={styles.detailOverlay} onClick={onClose}>
      <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
        <button className={styles.detailClose} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {loading && <div className={styles.panelPlaceholder}>Loading…</div>}
        {error && <div className={styles.panelError}>{error}</div>}

        {data && !loading && (
          <>
            <div className={styles.detailHeader}>
              <div>
                <div className={styles.detailSymbol}>{data.symbol}</div>
                <div className={styles.detailName}>{data.name}</div>
                <div className={styles.detailSector}>{data.sector}</div>
              </div>
              <div className={styles.detailScoreBox}>
                <span className={styles.detailScoreNum} style={{ color: scoreColor(data.score) }}>
                  {data.score}
                </span>
                <span className={styles.detailScoreLabel}>Exp Score</span>
              </div>
            </div>

            <div className={styles.detailBadges}>
              <TierBadge tier={data.tier} />
              <span className={styles.detailDate}>Updated {fmtDate(data.analyzedAt)}</span>
            </div>

            {/* Analyst signals */}
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>Analyst Signals</div>
              <div className={styles.breakdownGrid}>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>Current Price</span>
                  <span className={styles.breakdownValue}>{fmtPrice(data.price)}</span>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>Analyst Target</span>
                  <span className={styles.breakdownValue}>{fmtPrice(data.analystTarget)}</span>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>Upside / Downside</span>
                  <span
                    className={styles.breakdownValue}
                    style={{ color: data.upside != null ? (data.upside >= 0 ? 'var(--pos)' : 'var(--neg)') : undefined }}
                  >
                    {fmtPct(data.upside)}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>Target Range</span>
                  <span className={styles.breakdownValue}>
                    {data.analystLow && data.analystHigh
                      ? `${fmtPrice(data.analystLow)} – ${fmtPrice(data.analystHigh)}`
                      : '—'}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>Recommendation</span>
                  <span className={styles.breakdownValue}>
                    {REC_LABELS[data.recommendationKey?.toLowerCase()] || data.recommendationKey || '—'}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>P/E Ratio</span>
                  <span className={styles.breakdownValue}>
                    {data.peRatio != null ? Number(data.peRatio).toFixed(1) : '—'}
                  </span>
                </div>
                {data.numberOfAnalysts != null && (
                  <div className={styles.breakdownItem}>
                    <span className={styles.breakdownLabel}>Analysts Covering</span>
                    <span className={styles.breakdownValue}>{data.numberOfAnalysts}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Score history mini-chart */}
            {data.scoreHistory?.length > 1 && (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Score History</div>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={data.scoreHistory} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chrome-dim)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="analyzedAt" hide />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--chrome-dim)', borderRadius: 6, fontSize: 11 }}
                      formatter={(v) => [v, 'Exp Score']}
                      labelFormatter={() => ''}
                    />
                    <Line type="monotone" dataKey="score" stroke={scoreColor(data.score)} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LABEL_FILTERS = ['', 'VERY_HIGH', 'HIGH', 'MODERATE', 'LOW'];
const LABEL_FILTER_NAMES = {
  '': 'All Levels',
  VERY_HIGH: 'Very High',
  HIGH: 'High',
  MODERATE: 'Moderate',
  LOW: 'Low',
};

export default function AdminIntelligence() {
  const { user } = useAuth();

  if (!ALLOWED_ROLES.has(user?.role)) {
    return <Navigate to="/admin" replace />;
  }

  const [overview, setOverview] = useState(null);
  const [heatmap, setHeatmap] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [labelFilter, setLabelFilter] = useState('');
  const [minScore, setMinScore] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [page, setPage] = useState(1);

  const loadOverview = useCallback(() =>
    Promise.all([
      adminIntelligenceOverview(),
      adminIntelligenceSectorHeatmap(),
    ]).then(([ov, hm]) => {
      setOverview(ov);
      setHeatmap(hm);
    }),
  []);

  const loadStocks = useCallback(async (pg = 1) => {
    setTableLoading(true);
    try {
      const params = { page: pg, limit: 25 };
      if (labelFilter) params.label = labelFilter;
      if (minScore) params.minScore = minScore;
      if (sectorFilter) params.sector = sectorFilter;

      const res = await adminIntelligenceHotStocks(params);
      setStocks(res.items || []);
      setPagination(res.pagination || { page: pg, total: 0, pages: 1 });
    } catch (e) {
      setError(e.message);
    } finally {
      setTableLoading(false);
    }
  }, [labelFilter, minScore, sectorFilter]);

  useEffect(() => {
    setLoading(true);
    setError('');
    loadOverview()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [loadOverview]);

  useEffect(() => {
    setPage(1);
    loadStocks(1);
  }, [labelFilter, minScore, sectorFilter]);

  const handlePageChange = (p) => {
    setPage(p);
    loadStocks(p);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await adminIntelligenceRefresh();
      await Promise.all([loadOverview(), loadStocks(page)]);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadExport({
        format: 'csv',
        ...(labelFilter ? { label: labelFilter } : {}),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  const veryHighCount = overview?.veryHigh?.length ?? 0;
  const highCount = overview?.high?.length ?? 0;
  const moderateCount = overview?.moderate?.length ?? 0;

  if (error && !loading) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <span className={styles.flameIcon}>📊</span>
            AI Market Intelligence
          </h1>
          <p className={styles.pageSub}>
            Admin-only · Analyst expectation scoring · Updated {fmtDate(overview?.lastComputed)}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={exporting}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7,10 12,15 17,10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnSpin : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="23,4 23,10 17,10" /><polyline points="1,20 1,14 7,14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {refreshing ? 'Computing…' : 'Recompute'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.placeholder}>Loading intelligence data…</div>
      ) : (
        <>
          {/* ── Stat strip ─────────────────────────────────────── */}
          <div className={styles.statGrid}>
            <StatCard label="Stocks Tracked" value={overview?.totalTracked ?? 0} colorClass={styles.statBlue} />
            <StatCard label="Very High" value={veryHighCount} sub="exp score ≥ 76" colorClass={styles.statRed} />
            <StatCard label="High" value={highCount} sub="exp score 56–75" colorClass={styles.statOrange} />
            <StatCard label="Moderate" value={moderateCount} sub="exp score 34–55" colorClass={styles.statGreen} />
            <StatCard label="Last Computed" value={fmtDate(overview?.lastComputed)} />
          </div>

          {/* ── Top picks ─────────────────────────────────────── */}
          {overview && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Top Picks by Expectation Level</div>
              <div className={styles.topPicksGrid}>
                <div className={styles.stageColumn}>
                  <div className={`${styles.stageHeader} ${styles.stageHeaderTrending}`}>
                    Very High
                  </div>
                  {overview.veryHigh.map((s) => (
                    <TopCard key={s.symbol} stock={s} onClick={setSelectedSymbol} />
                  ))}
                  {overview.veryHigh.length === 0 && (
                    <p className={styles.stageEmpty}>No very high stocks yet</p>
                  )}
                </div>
                <div className={styles.stageColumn}>
                  <div className={`${styles.stageHeader} ${styles.stageHeaderAccelerating}`}>
                    High
                  </div>
                  {overview.high.map((s) => (
                    <TopCard key={s.symbol} stock={s} onClick={setSelectedSymbol} />
                  ))}
                  {overview.high.length === 0 && (
                    <p className={styles.stageEmpty}>No high expectation stocks yet</p>
                  )}
                </div>
                <div className={styles.stageColumn}>
                  <div className={`${styles.stageHeader} ${styles.stageHeaderEmerging}`}>
                    Moderate
                  </div>
                  {overview.moderate.map((s) => (
                    <TopCard key={s.symbol} stock={s} onClick={setSelectedSymbol} />
                  ))}
                  {overview.moderate.length === 0 && (
                    <p className={styles.stageEmpty}>No moderate expectation stocks yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Sector heatmap ────────────────────────────────── */}
          {heatmap.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Sector Expectation Heatmap</div>
              <div className={styles.chartCard}>
                <ResponsiveContainer width="100%" height={Math.max(200, heatmap.length * 32)}>
                  <BarChart
                    data={heatmap}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--chrome-dim)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="sector"
                      width={110}
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface-elevated)',
                        border: '1px solid var(--chrome-dim)',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      formatter={(v, name) => [v, name === 'avgScore' ? 'Avg Exp Score' : name]}
                    />
                    <Bar dataKey="avgScore" name="Avg Exp Score" radius={[0, 4, 4, 0]}>
                      {heatmap.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.avgScore >= 60
                              ? 'var(--hot-red)'
                              : entry.avgScore >= 40
                              ? 'var(--hot-orange)'
                              : entry.avgScore >= 20
                              ? 'var(--accent)'
                              : 'var(--text-tertiary)'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Filter bar ────────────────────────────────────── */}
          <div className={styles.section}>
            <div className={styles.filterBar}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Level</label>
                <select
                  className={styles.filterSelect}
                  value={labelFilter}
                  onChange={(e) => setLabelFilter(e.target.value)}
                >
                  {LABEL_FILTERS.map((l) => (
                    <option key={l} value={l}>{LABEL_FILTER_NAMES[l]}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Min Score</label>
                <input
                  type="number"
                  className={styles.filterInput}
                  placeholder="0"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                />
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Sector</label>
                <input
                  type="text"
                  className={styles.filterInput}
                  placeholder="e.g. Technology"
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                />
              </div>
              {(labelFilter || minScore || sectorFilter) && (
                <button
                  className={styles.clearFilters}
                  onClick={() => {
                    setLabelFilter('');
                    setMinScore('');
                    setSectorFilter('');
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* ── Stock table ─────────────────────────────────── */}
            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <span className={styles.tableTitle}>
                  All Scored Stocks
                  <span className={styles.tableCount}>{pagination.total}</span>
                </span>
                {tableLoading && <span className={styles.tableLoading}>Updating…</span>}
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Symbol</th>
                      <th>Name</th>
                      <th>Sector</th>
                      <th>Exp Score</th>
                      <th>Level</th>
                      <th>Price</th>
                      <th>Target</th>
                      <th>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.map((s, i) => (
                      <tr
                        key={s.symbol}
                        className={styles.tableRow}
                        onClick={() => setSelectedSymbol(s.symbol)}
                      >
                        <td className={styles.rankCell}>
                          {(pagination.page - 1) * 25 + i + 1}
                        </td>
                        <td className={styles.symbolCell}>{s.symbol}</td>
                        <td className={styles.nameCell} title={s.name}>{s.name}</td>
                        <td className={styles.sectorCell}>{s.sector}</td>
                        <td className={styles.scoreCell}>
                          <ScoreBar value={s.score} />
                        </td>
                        <td><TierBadge tier={s.tier} /></td>
                        <td className={styles.numCell}>{fmtPrice(s.price)}</td>
                        <td className={styles.numCell}>{fmtPrice(s.analystTarget)}</td>
                        <td className={styles.numCell}>
                          {REC_LABELS[s.recommendationKey?.toLowerCase()] || s.recommendationKey || '—'}
                        </td>
                      </tr>
                    ))}
                    {stocks.length === 0 && !tableLoading && (
                      <tr>
                        <td colSpan={9} className={styles.tableEmpty}>
                          No stocks match the current filters. Run a recompute to populate data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    ←
                  </button>
                  <span className={styles.pageInfo}>
                    Page {page} of {pagination.pages}
                  </span>
                  <button
                    className={styles.pageBtn}
                    disabled={page >= pagination.pages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Detail panel ─────────────────────────────────────── */}
      {selectedSymbol && (
        <DetailPanel symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} />
      )}
    </div>
  );
}
