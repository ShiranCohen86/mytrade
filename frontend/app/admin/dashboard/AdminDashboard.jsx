import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminAnalyticsOverview,
  adminAnalyticsSignups,
  adminAnalyticsActivity,
  adminGetAuditLogs,
} from '@/lib/apiClient';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import styles from './AdminDashboard.module.scss';

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`${styles.statCard} ${accent ? styles[`accent_${accent}`] : ''}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value ?? '—'}</span>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </div>
  );
}

function SeverityDot({ severity }) {
  return <span className={`${styles.dot} ${styles[`dot_${severity}`]}`} />;
}

const fmt = (n) => (n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [signups, setSignups] = useState([]);
  const [activity, setActivity] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminAnalyticsOverview(),
      adminAnalyticsSignups(30),
      adminAnalyticsActivity(30),
      adminGetAuditLogs({ limit: 8, severity: 'warning' }),
    ])
      .then(([ov, sg, ac, logs]) => {
        setOverview(ov);
        setSignups(sg);
        setActivity(ac);
        setRecentLogs(logs?.logs || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.placeholder}>Loading overview…</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Overview</h1>
        <span className={styles.pageSubtitle}>System health at a glance</span>
      </div>

      {/* ─── Stat grid ───────────────────────────────────────────── */}
      <div className={styles.statGrid}>
        <StatCard label="Total users" value={fmt(overview?.users?.total)} accent="blue" />
        <StatCard label="DAU" value={fmt(overview?.activity?.dau)} sub="last 24 h" accent="green" />
        <StatCard label="WAU" value={fmt(overview?.activity?.wau)} sub="last 7 d" />
        <StatCard label="MAU" value={fmt(overview?.activity?.mau)} sub="last 30 d" />
        <StatCard label="New (7 d)" value={fmt(overview?.signups?.week)} />
        <StatCard label="Suspended" value={fmt(overview?.users?.suspended)} accent={overview?.users?.suspended > 0 ? 'red' : undefined} />
        <StatCard label="Watchlist items" value={fmt(overview?.watchlists?.active)} sub={`${fmt(overview?.watchlists?.total)} total`} />
        <StatCard label="Critical events (7d)" value={fmt(overview?.system?.criticalLogs7d)} accent={overview?.system?.criticalLogs7d > 0 ? 'red' : undefined} />
        <StatCard label="Failed logins (7d)" value={fmt(overview?.system?.failedLogins7d)} accent={overview?.system?.failedLogins7d > 5 ? 'orange' : undefined} />
      </div>

      {/* ─── Charts ──────────────────────────────────────────────── */}
      <div className={styles.chartRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>Daily Signups (30 d)</span>
            <Link to="/admin/analytics" className={styles.chartLink}>Full analytics →</Link>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={signups} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--chrome-dim)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => d?.slice(5)} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--chrome-dim)', borderRadius: 6, fontSize: 12 }}
                labelFormatter={(d) => d}
              />
              <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} dot={false} name="Signups" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <span className={styles.chartTitle}>Daily Active Users (30 d)</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={activity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--chrome-dim)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => d?.slice(5)} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--chrome-dim)', borderRadius: 6, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="count" stroke="#34d399" strokeWidth={2} dot={false} name="DAU" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Recent alerts ───────────────────────────────────────── */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>Recent Warnings & Alerts</span>
          <Link to="/admin/audit?severity=warning" className={styles.chartLink}>View all →</Link>
        </div>
        {recentLogs.length === 0
          ? <p className={styles.empty}>No warnings in the current window.</p>
          : (
            <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.eventId}>
                    <td><SeverityDot severity={log.severity} /></td>
                    <td className={styles.monoCell}>{log.actionType}</td>
                    <td>{log.actor?.email || log.actor?.type}</td>
                    <td className={styles.timeCell}>{fmtDate(log.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
      </div>
    </div>
  );
}
