import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminGetAuditLogs, adminGetAuditStats, adminExportAudit } from '@/lib/apiClient';
import styles from './AdminAuditLogs.module.scss';

const ACTION_TYPES = [
  '', 'auth.login', 'auth.login_failed', 'auth.register', 'auth.logout',
  'watchlist.add', 'watchlist.remove',
  'admin.user.suspend', 'admin.user.unsuspend', 'admin.user.role_change',
  'admin.watchlist.restore', 'admin.watchlist.force_disable',
  'admin.support.impersonate', 'admin.support.flag_user',
  'admin.audit.export',
];

const fmtDate = (d) => d
  ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

function SeverityBadge({ s }) {
  return <span className={`${styles.sevBadge} ${styles[`sev_${s}`]}`}>{s}</span>;
}

function ActorBadge({ type }) {
  return <span className={`${styles.actorBadge} ${styles[`actor_${type}`]}`}>{type}</span>;
}

export default function AdminAuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  const userId = searchParams.get('userId') || '';
  const actionType = searchParams.get('actionType') || '';
  const severity = searchParams.get('severity') || '';
  const actorType = searchParams.get('actorType') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const setParam = (key, val) => {
    setSearchParams((p) => {
      const next = new URLSearchParams(p);
      if (val) next.set(key, val); else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminGetAuditLogs({ userId, actionType, severity, actorType, from, to, page, limit: 50 }),
      adminGetAuditStats(),
    ])
      .then(([data, s]) => {
        setLogs(data.logs);
        setPagination(data.pagination);
        setStats(s);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId, actionType, severity, actorType, from, to, page]);

  useEffect(() => { load(); }, [load]);

  const exportUrl = adminExportAudit({ userId, actionType, severity, from, to, format: 'csv' });

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Audit Logs</h1>
        <div className={styles.headerActions}>
          <a href={exportUrl} download="audit-export.csv" className={styles.exportBtn}>
            ↓ Export CSV
          </a>
        </div>
      </div>

      {/* ─── Stats strip ─────────────────────────────────────────── */}
      {stats && (
        <div className={styles.statsRow}>
          {stats.bySeverity?.map((s) => (
            <div key={s._id} className={`${styles.statPill} ${styles[`sev_${s._id}`]}`}>
              <span className={styles.statPillCount}>{s.count}</span>
              <span className={styles.statPillLabel}>{s._id}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Filters ─────────────────────────────────────────────── */}
      <div className={styles.filters}>
        <input
          className={styles.input}
          placeholder="Filter by userId"
          value={userId}
          onChange={(e) => setParam('userId', e.target.value)}
        />

        <select className={styles.select} value={actionType} onChange={(e) => setParam('actionType', e.target.value)}>
          <option value="">All actions</option>
          {ACTION_TYPES.filter(Boolean).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select className={styles.select} value={severity} onChange={(e) => setParam('severity', e.target.value)}>
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>

        <select className={styles.select} value={actorType} onChange={(e) => setParam('actorType', e.target.value)}>
          <option value="">All actors</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="system">System</option>
        </select>

        <input type="date" className={styles.dateInput} value={from} onChange={(e) => setParam('from', e.target.value)} title="From date" />
        <input type="date" className={styles.dateInput} value={to} onChange={(e) => setParam('to', e.target.value)} title="To date" />

        <button className={styles.clearBtn} onClick={() => setSearchParams({})}>Clear</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ─── Log table ───────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        {loading && <div className={styles.loadingOverlay}>Loading…</div>}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Action</th>
              <th>Actor</th>
              <th>IP</th>
              <th>Timestamp</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <>
                <tr key={log.eventId} className={styles.logRow} onClick={() => setExpanded(expanded === log.eventId ? null : log.eventId)}>
                  <td><SeverityBadge s={log.severity} /></td>
                  <td className={styles.monoCell}>{log.actionType}</td>
                  <td>
                    <div className={styles.actorCell}>
                      <ActorBadge type={log.actor?.type} />
                      <span className={styles.actorEmail}>{log.actor?.email || '—'}</span>
                    </div>
                  </td>
                  <td className={styles.ipCell}>{log.ip || '—'}</td>
                  <td className={styles.timeCell}>{fmtDate(log.timestamp)}</td>
                  <td className={styles.expandCell}>{expanded === log.eventId ? '▲' : '▼'}</td>
                </tr>
                {expanded === log.eventId && (
                  <tr key={`${log.eventId}_detail`} className={styles.detailRow}>
                    <td colSpan={6}>
                      <div className={styles.detailGrid}>
                        <div className={styles.detailItem}><span>Event ID</span><code>{log.eventId}</code></div>
                        <div className={styles.detailItem}><span>User ID</span><code>{log.userId || '—'}</code></div>
                        <div className={styles.detailItem}><span>Correlation</span><code>{log.correlationId || '—'}</code></div>
                        <div className={styles.detailItem}><span>User Agent</span><code className={styles.ua}>{log.userAgent || '—'}</code></div>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className={`${styles.detailItem} ${styles.full}`}>
                            <span>Metadata</span>
                            <pre className={styles.metaPre}>{JSON.stringify(log.metadata, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>No log entries match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Pagination ──────────────────────────────────────────── */}
      {pagination && pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>← Prev</button>
          <span className={styles.pageInfo}>Page {page} of {pagination.pages} ({pagination.total.toLocaleString()} entries)</span>
          <button className={styles.pageBtn} disabled={page >= pagination.pages} onClick={() => setParam('page', String(page + 1))}>Next →</button>
        </div>
      )}
    </div>
  );
}
