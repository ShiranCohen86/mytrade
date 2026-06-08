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
  link.download = `hot-stocks-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Only admin and super_admin may access this page
const ALLOWED_ROLES = new Set(['admin', 'super_admin']);

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function scoreColor(score) {
  if (score >= 70) return 'var(--hot-red)';
  if (score >= 45) return 'var(--hot-orange)';
  if (score >= 15) return 'var(--accent)';
  return 'var(--text-tertiary)';
}

function stageBadgeClass(stage) {
  return styles[`badge_${stage}`] || styles.badgeDefault;
}

function confidenceBadgeClass(confidence) {
  return styles[`conf_${confidence}`] || '';
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

function StageBadge({ stage }) {
  const labels = { emerging: 'Emerging', accelerating: 'Accelerating', trending: 'Trending', saturated: 'Saturated' };
  return (
    <span className={`${styles.badge} ${stageBadgeClass(stage)}`}>
      {labels[stage] || stage}
    </span>
  );
}

function ConfidenceBadge({ confidence }) {
  return (
    <span className={`${styles.confBadge} ${confidenceBadgeClass(confidence)}`}>
      {confidence}
    </span>
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
        <ConfidenceBadge confidence={stock.confidence} />
      </div>
      <ScoreBar value={stock.hotScore} />
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
                <span className={styles.detailScoreNum} style={{ color: scoreColor(data.hotScore) }}>
                  {data.hotScore}
                </span>
                <span className={styles.detailScoreLabel}>Hot Score</span>
              </div>
            </div>

            <div className={styles.detailBadges}>
              <StageBadge stage={data.trendStage} />
              <ConfidenceBadge confidence={data.confidence} />
              <span className={styles.detailDate}>Updated {fmtDate(data.computedAt)}</span>
            </div>

            {/* Score breakdown */}
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>Score Breakdown</div>
              <div className={styles.breakdownGrid}>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>Momentum</span>
                  <span className={styles.breakdownValue}>{data.momentumScore}</span>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>Saturation Penalty</span>
                  <span className={styles.breakdownValue} style={{ color: 'var(--neg)' }}>
                    -{data.saturationIndex}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>Net Hot Score</span>
                  <span className={styles.breakdownValue} style={{ color: scoreColor(data.hotScore), fontWeight: 700 }}>
                    {data.hotScore}
                  </span>
                </div>
              </div>
            </div>

            {/* Contributing signals */}
            {data.topContributors?.length > 0 && (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Contributing Signals</div>
                {data.topContributors.map((c) => (
                  <div key={c.name} className={styles.contributorRow}>
                    <div className={styles.contributorName}>{c.name}</div>
                    <div className={styles.contributorBar}>
                      <div
                        className={styles.contributorFill}
                        style={{ width: `${(c.contribution / 40) * 100}%` }}
                      />
                    </div>
                    <div className={styles.contributorMeta}>
                      <span className={styles.contributorValue}>{c.value}</span>
                      <span className={styles.contributorPts}>{c.contribution} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Raw signals */}
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>Raw Signals (48h windows)</div>
              <div className={styles.signalsGrid}>
                <div className={styles.signalItem}>
                  <span className={styles.signalLabel}>Recent Adds</span>
                  <span className={styles.signalVal}>{data.signals?.recentAdds_48h ?? 0}</span>
                </div>
                <div className={styles.signalItem}>
                  <span className={styles.signalLabel}>Prev Adds</span>
                  <span className={styles.signalVal}>{data.signals?.prevAdds_48h ?? 0}</span>
                </div>
                <div className={styles.signalItem}>
                  <span className={styles.signalLabel}>Add Growth</span>
                  <span className={styles.signalVal}>
                    {((data.signals?.addGrowthRate ?? 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className={styles.signalItem}>
                  <span className={styles.signalLabel}>Total Watchers</span>
                  <span className={styles.signalVal}>{data.signals?.totalActiveWatchers ?? 0}</span>
                </div>
                <div className={styles.signalItem}>
                  <span className={styles.signalLabel}>Recent Interactions</span>
                  <span className={styles.signalVal}>{data.signals?.recentInteractions_48h ?? 0}</span>
                </div>
                <div className={styles.signalItem}>
                  <span className={styles.signalLabel}>Unique Users (48h)</span>
                  <span className={styles.signalVal}>{data.signals?.uniqueUsers_48h ?? 0}</span>
                </div>
              </div>
            </div>

            {/* AI Explanation */}
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>AI Explanation</div>
              <div className={styles.explanationBox}>
                {(data.explanation || '').split('\n').map((line, i) => (
                  <p key={i} className={line.startsWith('•') ? styles.explanationBullet : styles.explanationLine}>
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* Score history mini-chart */}
            {data.scoreHistory?.length > 1 && (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Score History</div>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={data.scoreHistory} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chrome-dim)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="computedAt" hide />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--chrome-dim)', borderRadius: 6, fontSize: 11 }}
                      formatter={(v) => [v, 'Hot Score']}
                      labelFormatter={() => ''}
                    />
                    <Line type="monotone" dataKey="hotScore" stroke={scoreColor(data.hotScore)} strokeWidth={2} dot={false} />
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

const STAGE_FILTERS = ['', 'emerging', 'accelerating', 'trending', 'saturated'];
const CONFIDENCE_FILTERS = ['', 'low', 'medium', 'high'];
const STAGE_LABELS = { '': 'All Stages', emerging: 'Emerging', accelerating: 'Accelerating', trending: 'Trending', saturated: 'Saturated' };
const CONF_LABELS = { '': 'Any Confidence', low: 'Low', medium: 'Medium', high: 'High' };

export default function AdminIntelligence() {
  const { user } = useAuth();

  // Role guard — redirect non-admin/super_admin away silently
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

  // Filters
  const [stageFilter, setStageFilter] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState('');
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
      if (stageFilter) params.trendStage = stageFilter;
      if (confidenceFilter) params.confidence = confidenceFilter;
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
  }, [stageFilter, confidenceFilter, minScore, sectorFilter]);

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
  }, [stageFilter, confidenceFilter, minScore, sectorFilter]);

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
        ...(stageFilter ? { trendStage: stageFilter } : {}),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  // Counts from overview
  const trendingCount = overview?.trending?.length ?? 0;
  const acceleratingCount = overview?.accelerating?.length ?? 0;
  const emergingCount = overview?.emerging?.length ?? 0;

  if (error && !loading) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <span className={styles.flameIcon}>🔥</span>
            AI Market Intelligence
          </h1>
          <p className={styles.pageSub}>
            Admin-only · Early hot stock detection · Updated {fmtDate(overview?.lastComputed)}
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
        <div className={styles.placeholder}>Loading AI intelligence data…</div>
      ) : (
        <>
          {/* ── Stat strip ─────────────────────────────────────── */}
          <div className={styles.statGrid}>
            <StatCard label="Stocks Tracked" value={overview?.totalTracked ?? 0} colorClass={styles.statBlue} />
            <StatCard label="Trending" value={trendingCount} sub="hot score ≥ 70" colorClass={styles.statRed} />
            <StatCard label="Accelerating" value={acceleratingCount} sub="hot score 45–69" colorClass={styles.statOrange} />
            <StatCard label="Emerging" value={emergingCount} sub="hot score 15–44" colorClass={styles.statGreen} />
            <StatCard label="Last Computed" value={fmtDate(overview?.lastComputed)} />
          </div>

          {/* ── Top picks ─────────────────────────────────────── */}
          {overview && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Top Picks by Stage</div>
              <div className={styles.topPicksGrid}>
                <div className={styles.stageColumn}>
                  <div className={`${styles.stageHeader} ${styles.stageHeaderTrending}`}>
                    Trending
                  </div>
                  {overview.trending.map((s) => (
                    <TopCard key={s.symbol} stock={s} onClick={setSelectedSymbol} />
                  ))}
                  {overview.trending.length === 0 && (
                    <p className={styles.stageEmpty}>No trending stocks yet</p>
                  )}
                </div>
                <div className={styles.stageColumn}>
                  <div className={`${styles.stageHeader} ${styles.stageHeaderAccelerating}`}>
                    Accelerating
                  </div>
                  {overview.accelerating.map((s) => (
                    <TopCard key={s.symbol} stock={s} onClick={setSelectedSymbol} />
                  ))}
                  {overview.accelerating.length === 0 && (
                    <p className={styles.stageEmpty}>No accelerating stocks yet</p>
                  )}
                </div>
                <div className={styles.stageColumn}>
                  <div className={`${styles.stageHeader} ${styles.stageHeaderEmerging}`}>
                    Emerging
                  </div>
                  {overview.emerging.map((s) => (
                    <TopCard key={s.symbol} stock={s} onClick={setSelectedSymbol} />
                  ))}
                  {overview.emerging.length === 0 && (
                    <p className={styles.stageEmpty}>No emerging stocks yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Sector heatmap ────────────────────────────────── */}
          {heatmap.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Sector Momentum Heatmap</div>
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
                      formatter={(v, name) => [v, name === 'avgHotScore' ? 'Avg Hot Score' : name]}
                    />
                    <Bar dataKey="avgHotScore" name="Avg Hot Score" radius={[0, 4, 4, 0]}>
                      {heatmap.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.avgHotScore >= 60
                              ? 'var(--hot-red)'
                              : entry.avgHotScore >= 40
                              ? 'var(--hot-orange)'
                              : entry.avgHotScore >= 20
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
                <label className={styles.filterLabel}>Stage</label>
                <select
                  className={styles.filterSelect}
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                >
                  {STAGE_FILTERS.map((s) => (
                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Confidence</label>
                <select
                  className={styles.filterSelect}
                  value={confidenceFilter}
                  onChange={(e) => setConfidenceFilter(e.target.value)}
                >
                  {CONFIDENCE_FILTERS.map((c) => (
                    <option key={c} value={c}>{CONF_LABELS[c]}</option>
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
              {(stageFilter || confidenceFilter || minScore || sectorFilter) && (
                <button
                  className={styles.clearFilters}
                  onClick={() => {
                    setStageFilter('');
                    setConfidenceFilter('');
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
                      <th>Hot Score</th>
                      <th>Stage</th>
                      <th>Confidence</th>
                      <th>Watchers</th>
                      <th>Adds 48h</th>
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
                          <ScoreBar value={s.hotScore} />
                        </td>
                        <td><StageBadge stage={s.trendStage} /></td>
                        <td><ConfidenceBadge confidence={s.confidence} /></td>
                        <td className={styles.numCell}>{s.signals?.totalActiveWatchers ?? 0}</td>
                        <td className={styles.numCell}>{s.signals?.recentAdds_48h ?? 0}</td>
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
