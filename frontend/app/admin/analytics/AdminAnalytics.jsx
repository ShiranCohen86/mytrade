import { useEffect, useState } from 'react';
import {
  adminAnalyticsSignups,
  adminAnalyticsActivity,
  adminAnalyticsWatchlists,
  adminAnalyticsSecurity,
  adminAnalyticsProduct,
} from '@/lib/apiClient';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import styles from './AdminAnalytics.module.scss';

const DAYS = [7, 14, 30, 60];

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [signups, setSignups] = useState([]);
  const [activity, setActivity] = useState([]);
  const [wlData, setWlData] = useState(null);
  const [security, setSecurity] = useState(null);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminAnalyticsSignups(days),
      adminAnalyticsActivity(days),
      adminAnalyticsWatchlists(),
      adminAnalyticsSecurity(),
      adminAnalyticsProduct(days).catch(() => null),
    ])
      .then(([sg, ac, wl, sec, prod]) => {
        setSignups(sg);
        setActivity(ac);
        setWlData(wl);
        setSecurity(sec);
        setProduct(prod);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Analytics</h1>
        <div className={styles.dayTabs}>
          {DAYS.map((d) => (
            <button
              key={d}
              className={`${styles.dayTab} ${days === d ? styles.dayTabActive : ''}`}
              onClick={() => setDays(d)}
            >{d}d</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={styles.placeholder}>Loading analytics…</div>
      ) : (
        <>
          {/* ─── Growth charts ───────────────────────────────────── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>User Growth</div>
            <div className={styles.chartRow}>
              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>Daily Signups</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={signups} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chrome-dim)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d) => d?.slice(5)} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--chrome-dim)', borderRadius: 6, fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} dot={false} name="Signups" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className={styles.chartCard}>
                <div className={styles.chartTitle}>Daily Active Users (DAU)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={activity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--chrome-dim)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d) => d?.slice(5)} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--chrome-dim)', borderRadius: 6, fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke="#34d399" strokeWidth={2} dot={false} name="DAU" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ─── PWA & Growth ────────────────────────────────────── */}
          {product && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>PWA &amp; Growth</div>
              <div className={styles.statGrid}>
                <div className={styles.statTile}>
                  <div className={styles.statValue}>{product.standaloneLaunches}</div>
                  <div className={styles.statLabel}>Standalone launches</div>
                  <div className={styles.statSub}>{product.standaloneDevices} devices</div>
                </div>
                <div className={styles.statTile}>
                  <div className={styles.statValue}>{product.install.installed}</div>
                  <div className={styles.statLabel}>App installs</div>
                  <div className={styles.statSub}>{product.install.conversionRate}% of prompts</div>
                </div>
                <div className={styles.statTile}>
                  <div className={styles.statValue}>{product.notifications.optInRate}%</div>
                  <div className={styles.statLabel}>Notif opt-in</div>
                  <div className={styles.statSub}>{product.notifications.granted}/{product.notifications.softShown} asked</div>
                </div>
                <div className={styles.statTile}>
                  <div className={styles.statValue}>{product.notifications.subscribed}</div>
                  <div className={styles.statLabel}>Push subscriptions</div>
                  <div className={styles.statSub}>{product.notifications.denied} denied</div>
                </div>
                <div className={styles.statTile}>
                  <div className={styles.statValue}>{product.returningUsers}</div>
                  <div className={styles.statLabel}>Returning users</div>
                  <div className={styles.statSub}>{product.sessions} sessions</div>
                </div>
                <div className={styles.statTile}>
                  <div className={styles.statValue}>{product.activation.ahaReached}</div>
                  <div className={styles.statLabel}>Aha reached</div>
                  <div className={styles.statSub}>{product.activation.firstStockAdded} 1st-stock · {product.activation.firstAlertSet} 1st-alert</div>
                </div>
              </div>

              <div className={styles.chartRow}>
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>Standalone Launches / Day</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={product.standaloneTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="var(--chrome-dim)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(d) => d?.slice(5)} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--chrome-dim)', borderRadius: 6, fontSize: 12 }} />
                      <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} dot={false} name="Launches" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>Sessions by Platform</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={product.platforms} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="var(--chrome-dim)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="platform" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--chrome-dim)', borderRadius: 6, fontSize: 12 }} />
                      <Bar dataKey="count" name="Sessions" radius={[3, 3, 0, 0]}>
                        {(product.platforms || []).map((_, i) => (
                          <Cell key={i} fill={`hsl(${210 + i * 26}, 70%, 56%)`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ─── Watchlist analytics ─────────────────────────────── */}
          {wlData && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Watchlist Behavior</div>
              <div className={styles.chartRow}>
                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>Most Tracked Symbols</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={wlData.symbolPopularity?.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 8, left: 20, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="_id" tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-data)' }} tickLine={false} axisLine={false} width={44} />
                      <Tooltip contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--chrome-dim)', borderRadius: 6, fontSize: 12 }} />
                      <Bar dataKey="active" name="Active" radius={[0, 3, 3, 0]}>
                        {wlData.symbolPopularity?.slice(0, 12).map((_, i) => (
                          <Cell key={i} fill={`hsl(${200 + i * 8}, 70%, 55%)`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={styles.chartCard}>
                  <div className={styles.chartTitle}>Most Removed Symbols</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={wlData.mostRemoved?.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 8, left: 20, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="_id" tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-data)' }} tickLine={false} axisLine={false} width={44} />
                      <Tooltip contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--chrome-dim)', borderRadius: 6, fontSize: 12 }} />
                      <Bar dataKey="removeCount" name="Removed" fill="var(--neg)" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ─── Security ────────────────────────────────────────── */}
          {security && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Security (7 days)</div>
              <div className={styles.tableRow}>
                <div className={styles.tableCard}>
                  <div className={styles.tableTitle}>Failed Logins by IP</div>
                  <table className={styles.miniTable}>
                    <thead>
                      <tr><th>IP Address</th><th>Count</th></tr>
                    </thead>
                    <tbody>
                      {(security.failedByIp || []).slice(0, 10).map((r) => (
                        <tr key={r._id}>
                          <td className={styles.monoCell}>{r._id || '—'}</td>
                          <td className={styles.countCell}>{r.count}</td>
                        </tr>
                      ))}
                      {!security.failedByIp?.length && <tr><td colSpan={2} className={styles.empty}>No data</td></tr>}
                    </tbody>
                  </table>
                </div>

                <div className={styles.tableCard}>
                  <div className={styles.tableTitle}>Failed Logins by Email</div>
                  <table className={styles.miniTable}>
                    <thead>
                      <tr><th>Email</th><th>Count</th></tr>
                    </thead>
                    <tbody>
                      {(security.failedByEmail || []).slice(0, 10).map((r) => (
                        <tr key={r._id}>
                          <td>{r._id || '—'}</td>
                          <td className={styles.countCell}>{r.count}</td>
                        </tr>
                      ))}
                      {!security.failedByEmail?.length && <tr><td colSpan={2} className={styles.empty}>No data</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
