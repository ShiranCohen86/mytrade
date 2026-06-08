import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import { adminGetUserInsights } from '@/lib/apiClient';
import styles from './InsightsPanel.module.scss';

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTOR_COLOR = {
  Technology:   '#3b82f6',
  Finance:      '#10b981',
  Healthcare:   '#06b6d4',
  Energy:       '#f97316',
  Consumer:     '#8b5cf6',
  Industrials:  '#6b7280',
  'Real Estate':'#ec4899',
  Materials:    '#b45309',
  Utilities:    '#84cc16',
  Crypto:       '#eab308',
  ETF:          '#6366f1',
  Other:        '#9ca3af',
};

const EVENT_LABEL = {
  'stock.viewed':    'Views',
  'watchlist.add':   'Watchlist +',
  'watchlist.remove':'Watchlist −',
  'stock.searched':  'Searches',
  'portfolio.set':   'Portfolio',
  'alert.set':       'Alerts',
  'note.saved':      'Notes',
  'auth.login':      'Logins',
  'auth.logout':     'Logouts',
};

const PERIODS = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const RISK_COLOR = {
  'High Risk / Speculative': '#ef4444',
  'Growth-Oriented':         '#f59e0b',
  'Conservative':            '#10b981',
  'Balanced':                '#6366f1',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(n) {
  if (n >= 70) return '#10b981';
  if (n >= 40) return '#f59e0b';
  return '#ef4444';
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className={styles.tooltipRow}>
          <span style={{ color: p.color }}>{p.name ?? p.dataKey}</span>
          <span>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue} style={color ? { color } : {}}>
        {value ?? '—'}
      </div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}

function SectorBar({ sector, count, percentage, maxPct }) {
  const color = SECTOR_COLOR[sector] || SECTOR_COLOR.Other;
  const barWidth = maxPct > 0 ? (percentage / maxPct) * 100 : 0;
  return (
    <div className={styles.sectorRow}>
      <div className={styles.sectorName} style={{ color }}>{sector}</div>
      <div className={styles.sectorBarWrap}>
        <div
          className={styles.sectorBarFill}
          style={{ width: `${barWidth}%`, background: color }}
        />
      </div>
      <div className={styles.sectorPct}>{percentage}%</div>
      <div className={styles.sectorCount}>{count}</div>
    </div>
  );
}

function SymbolRow({ rank, symbol, sector, count, lastInteraction }) {
  const color = SECTOR_COLOR[sector] || SECTOR_COLOR.Other;
  return (
    <div className={styles.symbolRow}>
      <span className={styles.symbolRank}>{rank}</span>
      <span className={styles.symbolTicker}>{symbol}</span>
      <span className={styles.symbolSector} style={{ color }}>
        {sector || '—'}
      </span>
      <span className={styles.symbolCount}>×{count}</span>
      <span className={styles.symbolLast}>
        {lastInteraction
          ? new Date(lastInteraction).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '—'}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InsightsPanel({ userId }) {
  const [days,    setDays]    = useState(30);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    adminGetUserInsights(userId, days)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId, days]);

  if (loading) return <div className={styles.loading}>Computing insights…</div>;
  if (error)   return <div className={styles.error}>{error}</div>;
  if (!data)   return null;

  const {
    sectorBreakdown, topSymbols, engagementByDay,
    eventTypeSummary, riskProfile, totalEvents,
    activeDays, engagementScore, periodDays,
  } = data;

  const maxSectorPct = sectorBreakdown.length > 0
    ? Math.max(...sectorBreakdown.map((s) => s.percentage))
    : 1;

  // Prepare engagement chart data — last 30 points max
  const engagementChartData = engagementByDay.slice(-Math.min(engagementByDay.length, periodDays)).map((d) => ({
    date:  d._id,
    label: fmtDate(d._id),
    count: d.count,
  }));

  // Top-5 event types for quick bar
  const topEvents = (eventTypeSummary || []).slice(0, 6).map((e) => ({
    type:  EVENT_LABEL[e.type] || e.type.split('.').pop(),
    count: e.count,
  }));

  const hasActivity = totalEvents > 0;

  return (
    <div className={styles.panel}>
      {/* Period picker */}
      <div className={styles.periodRow}>
        {PERIODS.map((p) => (
          <button
            key={p.days}
            className={`${styles.periodBtn} ${days === p.days ? styles.periodBtnActive : ''}`}
            onClick={() => setDays(p.days)}
          >
            {p.label}
          </button>
        ))}
        <span className={styles.periodNote}>Last {periodDays} days</span>
      </div>

      {!hasActivity ? (
        <div className={styles.empty}>No activity in this period yet.</div>
      ) : (
        <>
          {/* Stat cards */}
          <div className={styles.statRow}>
            <StatCard
              label="Engagement"
              value={engagementScore}
              sub="out of 100"
              color={scoreColor(engagementScore)}
            />
            <StatCard
              label="Active Days"
              value={activeDays}
              sub={`of ${periodDays} days`}
            />
            <StatCard
              label="Total Events"
              value={totalEvents}
            />
            <div className={styles.statCard}>
              <div
                className={styles.riskBadge}
                style={{ '--risk-color': RISK_COLOR[riskProfile?.label] || '#9ca3af' }}
              >
                {riskProfile?.label || '—'}
              </div>
              <div className={styles.statLabel}>Risk Profile</div>
            </div>
          </div>

          {/* Two-column layout */}
          <div className={styles.grid}>
            {/* Left: Sector distribution */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Sector Distribution</div>
              {sectorBreakdown.length === 0 ? (
                <div className={styles.sectionEmpty}>No sector data yet.</div>
              ) : (
                <div className={styles.sectorList}>
                  {sectorBreakdown.map((s) => (
                    <SectorBar key={s.sector} {...s} maxPct={maxSectorPct} />
                  ))}
                </div>
              )}
            </div>

            {/* Right: Top symbols */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Top Symbols</div>
              {topSymbols.length === 0 ? (
                <div className={styles.sectionEmpty}>No symbol interactions yet.</div>
              ) : (
                <div className={styles.symbolList}>
                  <div className={styles.symbolHeader}>
                    <span>#</span>
                    <span>Ticker</span>
                    <span>Sector</span>
                    <span>Hits</span>
                    <span>Last</span>
                  </div>
                  {topSymbols.map((s, i) => (
                    <SymbolRow key={s.symbol} rank={i + 1} {...s} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Engagement over time */}
          {engagementChartData.length > 1 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Activity Over Time</div>
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={engagementChartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chrome-dim)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                      interval="preserveStartEnd"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Events"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'var(--accent)' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Event type breakdown */}
          {topEvents.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Event Breakdown</div>
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={topEvents} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                    <XAxis
                      dataKey="type"
                      tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={32}>
                      {topEvents.map((e, i) => (
                        <Cell key={i} fill={`hsl(${210 + i * 30}, 70%, 58%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
