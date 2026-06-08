import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { adminSearch, adminImpersonate, adminFlagUser, adminGetUserActivity } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast/ToastProvider';
import styles from './AdminSupport.module.scss';

const fmtDate = (d) => d
  ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

function SeverityBadge({ s }) {
  return <span className={`${styles.sevBadge} ${styles[`sev_${s}`]}`}>{s}</span>;
}

export default function AdminSupport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: me } = useAuth();
  const toast = useToast();

  const [searchQ, setSearchQ] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const [inspectUserId, setInspectUserId] = useState('');
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [flagUserId, setFlagUserId] = useState('');
  const [flagReason, setFlagReason] = useState('');
  const [flagSeverity, setFlagSeverity] = useState('warning');
  const [flagWorking, setFlagWorking] = useState(false);

  const canImpersonate = me?.role === 'super_admin';

  // Auto-search if ?q= present on load
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) { setSearchQ(q); runSearch(q); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = async (q = searchQ) => {
    if (!q.trim()) return;
    setSearching(true);
    setResults(null);
    try {
      const data = await adminSearch(q.trim());
      setResults(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams(searchQ ? { q: searchQ } : {});
    runSearch();
  };

  const handleImpersonate = async (userId, email) => {
    if (!canImpersonate) return;
    try {
      const res = await adminImpersonate(userId);
      window.open(`/dashboard?impersonate_token=${res.token}`, '_blank');
      toast.warning(`Impersonating ${email} — 15 min session logged.`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleLoadActivity = async () => {
    if (!inspectUserId.trim()) return;
    setActivityLoading(true);
    try {
      const logs = await adminGetUserActivity(inspectUserId.trim());
      setActivityLogs(logs);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleFlag = async () => {
    if (!flagUserId.trim() || !flagReason.trim()) return;
    setFlagWorking(true);
    try {
      await adminFlagUser(flagUserId.trim(), flagReason, flagSeverity);
      toast.success('User flagged and audit event written.');
      setFlagUserId(''); setFlagReason(''); setFlagSeverity('warning');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setFlagWorking(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Support Tools</h1>
      </div>

      {/* ─── Cross-entity search ──────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Global Search</div>
        <p className={styles.sectionDesc}>Search by email, IP address, or correlation ID.</p>

        <form className={styles.searchRow} onSubmit={handleSearch}>
          <input
            className={styles.input}
            placeholder="Email, IP, or correlation ID…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          <button className={styles.btnPrimary} disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results && (
          <div className={styles.searchResults}>
            {results.users?.length > 0 && (
              <div className={styles.resultGroup}>
                <div className={styles.resultGroupTitle}>Users ({results.users.length})</div>
                {results.users.map((u) => (
                  <div key={u._id} className={styles.resultRow}>
                    <div>
                      <Link to={`/admin/users/${u._id}`} className={styles.resultLink}>{u.email}</Link>
                      <div className={styles.resultSub}>{u.displayName} · {u.role}</div>
                    </div>
                    {canImpersonate && (
                      <button className={styles.btnWarning} onClick={() => handleImpersonate(u._id, u.email)}>
                        Impersonate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {results.logs?.length > 0 && (
              <div className={styles.resultGroup}>
                <div className={styles.resultGroupTitle}>Audit Logs ({results.logs.length})</div>
                {results.logs.map((log) => (
                  <div key={log.eventId} className={styles.resultRow}>
                    <div>
                      <div className={styles.resultLink}>{log.actionType}</div>
                      <div className={styles.resultSub}>
                        {log.actor?.email} · {log.ip} · {fmtDate(log.timestamp)}
                      </div>
                    </div>
                    <SeverityBadge s={log.severity} />
                  </div>
                ))}
              </div>
            )}

            {!results.users?.length && !results.logs?.length && (
              <div className={styles.empty}>No results found for "{searchQ}".</div>
            )}
          </div>
        )}
      </div>

      <div className={styles.toolsGrid}>
        {/* ─── Activity replay ──────────────────────────────────── */}
        <div className={styles.toolCard}>
          <div className={styles.toolTitle}>User Activity Replay</div>
          <p className={styles.toolDesc}>Load the last 100 audit events for any user.</p>
          <div className={styles.toolRow}>
            <input
              className={styles.input}
              placeholder="User ID"
              value={inspectUserId}
              onChange={(e) => setInspectUserId(e.target.value)}
            />
            <button className={styles.btnPrimary} onClick={handleLoadActivity} disabled={activityLoading}>
              {activityLoading ? 'Loading…' : 'Load'}
            </button>
          </div>
          {activityLogs.length > 0 && (
            <div className={styles.miniTimeline}>
              {activityLogs.slice(0, 20).map((log) => (
                <div key={log.eventId} className={styles.miniItem}>
                  <span className={styles.monoText}>{log.actionType}</span>
                  <span className={styles.timeSmall}>{fmtDate(log.timestamp)}</span>
                  <SeverityBadge s={log.severity} />
                </div>
              ))}
              {activityLogs.length > 20 && (
                <div className={styles.moreHint}>{activityLogs.length - 20} more entries — view full timeline in User Detail</div>
              )}
            </div>
          )}
        </div>

        {/* ─── Flag user ────────────────────────────────────────── */}
        <div className={styles.toolCard}>
          <div className={styles.toolTitle}>Flag Suspicious User</div>
          <p className={styles.toolDesc}>Writes an audit event with the given severity — does not suspend the user.</p>
          <div className={styles.flagForm}>
            <input
              className={styles.input}
              placeholder="User ID"
              value={flagUserId}
              onChange={(e) => setFlagUserId(e.target.value)}
            />
            <input
              className={styles.input}
              placeholder="Reason (required)"
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
            />
            <select className={styles.select} value={flagSeverity} onChange={(e) => setFlagSeverity(e.target.value)}>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <button
              className={styles.btnDanger}
              onClick={handleFlag}
              disabled={flagWorking || !flagUserId.trim() || !flagReason.trim()}
            >
              {flagWorking ? 'Flagging…' : 'Flag User'}
            </button>
          </div>
        </div>

        {/* ─── Impersonation info ───────────────────────────────── */}
        {canImpersonate && (
          <div className={styles.toolCard}>
            <div className={styles.toolTitle}>Impersonation</div>
            <p className={styles.toolDesc}>
              Impersonation issues a <strong>15-minute</strong> short-lived JWT for the target user.
              All actions taken in that session are attributed to the target user but an
              <code>admin.support.impersonate</code> critical audit event is written with your admin ID.
            </p>
            <p className={styles.toolDesc} style={{ color: 'var(--neg)' }}>
              ⚠ Impersonation of admin-level accounts is restricted to <strong>super_admin</strong> only.
              Use the Global Search above or User Detail page to initiate impersonation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
