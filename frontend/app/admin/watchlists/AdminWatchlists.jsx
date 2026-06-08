import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { adminGetWatchlists, adminRestoreWatchlistItem, adminDisableWatchlistItem } from '@/lib/apiClient';
import { useToast } from '@/components/Toast/ToastProvider';
import styles from './AdminWatchlists.module.scss';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—';

export default function AdminWatchlists() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [disableModal, setDisableModal] = useState(null);
  const [disableReason, setDisableReason] = useState('');
  const [working, setWorking] = useState(false);
  const toast = useToast();

  const symbol = searchParams.get('symbol') || '';
  const userId = searchParams.get('userId') || '';
  const isDisabled = searchParams.get('isDisabled') || '';
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
    adminGetWatchlists({ symbol, userId, isDisabled, page, limit: 50 })
      .then((data) => { setItems(data.items); setPagination(data.pagination); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [symbol, userId, isDisabled, page]);

  useEffect(() => { load(); }, [load]);

  const handleRestore = async (item) => {
    setWorking(true);
    try {
      await adminRestoreWatchlistItem(item.userId?._id || item.userId, item.symbol);
      toast.success(`${item.symbol} restored for ${item.userId?.email}`);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  const handleDisable = async () => {
    if (!disableModal) return;
    setWorking(true);
    try {
      await adminDisableWatchlistItem(
        disableModal.userId?._id || disableModal.userId,
        disableModal.symbol,
        disableReason
      );
      toast.success(`${disableModal.symbol} disabled`);
      setDisableModal(null);
      setDisableReason('');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Watchlists</h1>
        {pagination && <span className={styles.pageCount}>{pagination.total.toLocaleString()} items</span>}
      </div>

      <div className={styles.filters}>
        <input className={styles.input} placeholder="Filter symbol" value={symbol} onChange={(e) => setParam('symbol', e.target.value)} />
        <input className={styles.input} placeholder="Filter userId" value={userId} onChange={(e) => setParam('userId', e.target.value)} />
        <select className={styles.select} value={isDisabled} onChange={(e) => setParam('isDisabled', e.target.value)}>
          <option value="">All status</option>
          <option value="false">Active</option>
          <option value="true">Removed</option>
        </select>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.tableWrap}>
        {loading && <div className={styles.loadingOverlay}>Loading…</div>}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>User</th>
              <th>Status</th>
              <th>Added</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id}>
                <td className={styles.symbolCell}>{item.symbol}</td>
                <td>
                  <div>
                    <Link to={`/admin/users/${item.userId?._id}`} className={styles.userLink}>
                      {item.userId?.displayName || item.userId?.email || String(item.userId)}
                    </Link>
                    <div className={styles.emailSmall}>{item.userId?.email}</div>
                  </div>
                </td>
                <td>
                  {item.isDisabled
                    ? <span className={styles.statusRemoved}>Removed</span>
                    : <span className={styles.statusActive}>Active</span>}
                </td>
                <td className={styles.timeCell}>{fmtDate(item.createdAt)}</td>
                <td className={styles.timeCell}>{fmtDate(item.updatedAt)}</td>
                <td>
                  <div className={styles.actionBtns}>
                    {item.isDisabled
                      ? <button className={styles.btnRestore} disabled={working} onClick={() => handleRestore(item)}>Restore</button>
                      : <button className={styles.btnDisable} disabled={working} onClick={() => setDisableModal(item)}>Disable</button>}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className={styles.emptyCell}>No items found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>← Prev</button>
          <span className={styles.pageInfo}>Page {page} of {pagination.pages}</span>
          <button className={styles.pageBtn} disabled={page >= pagination.pages} onClick={() => setParam('page', String(page + 1))}>Next →</button>
        </div>
      )}

      {/* Disable modal */}
      {disableModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>Force Disable <strong>{disableModal.symbol}</strong>?</div>
            <p className={styles.modalSub}>This removes the stock from the user's watchlist and logs the admin action.</p>
            <input className={styles.input} placeholder="Reason (optional)" value={disableReason} onChange={(e) => setDisableReason(e.target.value)} />
            <div className={styles.modalActions}>
              <button className={styles.btnDisable} onClick={handleDisable} disabled={working}>Disable</button>
              <button className={styles.btnCancel} onClick={() => { setDisableModal(null); setDisableReason(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
