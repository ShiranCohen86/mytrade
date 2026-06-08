import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminGetUsers } from '@/lib/apiClient';
import styles from './AdminUsers.module.scss';

const ROLES = ['', 'super_admin', 'admin', 'support_agent', 'analyst', 'user'];
const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', support_agent: 'Support', analyst: 'Analyst', user: 'User' };

function RoleBadge({ role }) {
  return <span className={`${styles.roleBadge} ${styles[`role_${role}`]}`}>{ROLE_LABEL[role] || role}</span>;
}

export default function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const search = searchParams.get('search') || '';
  const role = searchParams.get('role') || '';
  const suspended = searchParams.get('suspended') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const load = useCallback(() => {
    setLoading(true);
    adminGetUsers({ search, role, suspended, page, limit: 25 })
      .then((data) => {
        setUsers(data.users);
        setPagination(data.pagination);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, role, suspended, page]);

  useEffect(() => { load(); }, [load]);

  const setParam = (key, val) => {
    setSearchParams((p) => {
      const next = new URLSearchParams(p);
      if (val) next.set(key, val); else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Users</h1>
        {pagination && (
          <span className={styles.pageCount}>{pagination.total.toLocaleString()} total</span>
        )}
      </div>

      {/* ─── Filters ─────────────────────────────────────────────── */}
      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Search email or name…"
            value={search}
            onChange={(e) => setParam('search', e.target.value)}
          />
        </div>

        <select className={styles.select} value={role} onChange={(e) => setParam('role', e.target.value)}>
          <option value="">All roles</option>
          {ROLES.filter(Boolean).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>

        <select className={styles.select} value={suspended} onChange={(e) => setParam('suspended', e.target.value)}>
          <option value="">All status</option>
          <option value="false">Active</option>
          <option value="true">Suspended</option>
        </select>

        <button className={styles.refreshBtn} onClick={load} title="Refresh">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="23,4 23,10 17,10" /><polyline points="1,20 1,14 7,14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* ─── Table ───────────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        {loading && <div className={styles.loadingOverlay}>Loading…</div>}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Watchlist</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>
                  <div className={styles.userCell}>
                    <div className={styles.avatar}>
                      {u.avatar
                        ? <img src={u.avatar} alt="" />
                        : <span>{(u.displayName || u.email || '?')[0].toUpperCase()}</span>}
                    </div>
                    <div>
                      <div className={styles.userName}>{u.displayName || '—'}</div>
                      <div className={styles.userEmail}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td><RoleBadge role={u.role} /></td>
                <td>
                  {u.isSuspended
                    ? <span className={styles.statusSuspended}>Suspended</span>
                    : <span className={styles.statusActive}>Active</span>}
                </td>
                <td className={styles.monoCell}>{u.watchlist?.length ?? 0} / 25</td>
                <td className={styles.timeCell}>
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                </td>
                <td>
                  <Link to={`/admin/users/${u._id}`} className={styles.viewLink}>View →</Link>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>No users match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Pagination ──────────────────────────────────────────── */}
      {pagination && pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => setParam('page', String(page - 1))}
          >← Prev</button>
          <span className={styles.pageInfo}>Page {page} of {pagination.pages}</span>
          <button
            className={styles.pageBtn}
            disabled={page >= pagination.pages}
            onClick={() => setParam('page', String(page + 1))}
          >Next →</button>
        </div>
      )}
    </div>
  );
}
