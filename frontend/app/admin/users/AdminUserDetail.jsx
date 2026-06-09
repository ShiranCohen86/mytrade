import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  adminGetUser,
  adminSetRole,
  adminSuspendUser,
  adminImpersonate,
  adminGetUserWatchlist,
} from '@/lib/apiClient';
import { useToast } from '@/components/Toast/ToastProvider';
import TimelinePanel from './TimelinePanel';
import InsightsPanel from './InsightsPanel';
import TriggersPanel from './TriggersPanel';
import styles from './AdminUserDetail.module.scss';

const ROLES = ['user', 'analyst', 'support_agent', 'admin', 'super_admin'];
const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', support_agent: 'Support', analyst: 'Analyst', user: 'User' };

const fmtDate = (d) => d
  ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleValue, setRoleValue] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [working, setWorking] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [rightTab, setRightTab] = useState('timeline'); // 'timeline' | 'insights'

  const canSetRole = me?.role === 'super_admin';
  const canSuspend = ['super_admin', 'admin'].includes(me?.role);
  const canImpersonate = me?.role === 'super_admin';

  useEffect(() => {
    setLoading(true);
    Promise.all([adminGetUser(id), adminGetUserWatchlist(id)])
      .then(([d, wl]) => {
        setData(d);
        setRoleValue(d.user.role);
        setWatchlist(wl);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRoleChange = async () => {
    if (!canSetRole) return;
    setWorking(true);
    try {
      const res = await adminSetRole(id, roleValue);
      setData((d) => ({ ...d, user: res.user }));
      toast.success(`Role updated to ${ROLE_LABEL[roleValue]}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  const handleSuspend = async (suspend) => {
    if (!canSuspend) return;
    setWorking(true);
    try {
      const res = await adminSuspendUser(id, suspend, suspendReason);
      setData((d) => ({ ...d, user: res.user }));
      toast.success(suspend ? 'User suspended' : 'User unsuspended');
      setSuspendReason('');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  const handleImpersonate = async () => {
    if (!canImpersonate) return;
    setWorking(true);
    try {
      const res = await adminImpersonate(id);
      window.open(`/dashboard?impersonate_token=${res.token}`, '_blank');
      toast.warning(`Impersonating ${res.targetUser.email} for 15 min — action logged.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className={styles.placeholder}>Loading user…</div>;
  if (error)   return <div className={styles.error}>{error}</div>;
  if (!data)   return null;

  const { user } = data;
  const isSelf = me?.role && id === me?.id;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <Link to="/admin/users" className={styles.back}>← Users</Link>
        <h1 className={styles.pageTitle}>User Detail</h1>
      </div>

      <div className={styles.layout}>
        {/* ─── Left: Profile ───────────────────────────────────── */}
        <div className={styles.left}>
          <div className={styles.profileCard}>
            <div className={styles.profileAvatar}>
              {user.avatar
                ? <img src={user.avatar} alt="" />
                : <span>{(user.displayName || user.email || '?')[0].toUpperCase()}</span>}
            </div>
            <div className={styles.profileName}>{user.displayName || '—'}</div>
            <div className={styles.profileEmail}>{user.email}</div>
            {user.isSuspended && (
              <div className={styles.suspendedBanner}>SUSPENDED</div>
            )}

            <div className={styles.profileMeta}>
              <div className={styles.metaRow}><span>Role</span><span className={styles.metaVal}>{ROLE_LABEL[user.role] || user.role}</span></div>
              <div className={styles.metaRow}><span>Auth</span><span className={styles.metaVal}>{user.isGoogleAccount ? 'Google' : 'Email/Password'}</span></div>
              <div className={styles.metaRow}><span>Joined</span><span className={styles.metaVal}>{fmtDate(user.createdAt)}</span></div>
              <div className={styles.metaRow}><span>Watchlist</span><span className={styles.metaVal}>{user.watchlist?.length ?? 0} stocks</span></div>
              <div className={styles.metaRow}><span>Onboarded</span><span className={styles.metaVal}>{user.onboardingDone ? 'Yes' : 'No'}</span></div>
              {user.isSuspended && user.suspendedAt && (
                <div className={styles.metaRow}><span>Suspended</span><span className={styles.metaVal}>{fmtDate(user.suspendedAt)}</span></div>
              )}
              {user.suspendReason && (
                <div className={styles.metaRow}><span>Reason</span><span className={styles.metaVal}>{user.suspendReason}</span></div>
              )}
            </div>
          </div>

          {/* ─── Admin actions ──────────────────────────────────── */}
          <div className={styles.actionCard}>
            <div className={styles.actionTitle}>Admin Actions</div>

            {canSetRole && !isSelf && (
              <div className={styles.actionRow}>
                <label className={styles.actionLabel}>Change Role</label>
                <div className={styles.actionGroup}>
                  <select
                    className={styles.select}
                    value={roleValue}
                    onChange={(e) => setRoleValue(e.target.value)}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleRoleChange}
                    disabled={working || roleValue === user.role}
                  >Save</button>
                </div>
              </div>
            )}

            {canSuspend && !isSelf && (
              <div className={styles.actionRow}>
                <label className={styles.actionLabel}>
                  {user.isSuspended ? 'Unsuspend User' : 'Suspend User'}
                </label>
                {!user.isSuspended && (
                  <input
                    className={styles.input}
                    placeholder="Reason (optional)"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                  />
                )}
                <button
                  className={user.isSuspended ? styles.btnSuccess : styles.btnDanger}
                  onClick={() => handleSuspend(!user.isSuspended)}
                  disabled={working}
                >
                  {user.isSuspended ? 'Unsuspend' : 'Suspend'}
                </button>
              </div>
            )}

            {canImpersonate && !isSelf && (
              <div className={styles.actionRow}>
                <label className={styles.actionLabel}>Impersonate (15 min)</label>
                <button
                  className={styles.btnWarning}
                  onClick={handleImpersonate}
                  disabled={working}
                >Impersonate →</button>
              </div>
            )}
          </div>

          {/* ─── Watchlist history ──────────────────────────────── */}
          <div className={styles.actionCard}>
            <div className={styles.actionTitle}>Watchlist History</div>
            {watchlist.length === 0
              ? <p className={styles.empty}>No watchlist items.</p>
              : (
                <div className={styles.wlList}>
                  {watchlist.map((item) => (
                    <div key={item._id} className={styles.wlRow}>
                      <span className={styles.wlSymbol}>{item.symbol}</span>
                      <span className={`${styles.wlStatus} ${item.isDisabled ? styles.wlDisabled : styles.wlActive}`}>
                        {item.isDisabled ? 'Removed' : 'Active'}
                      </span>
                      <span className={styles.wlDate}>
                        {fmtDate(item.updatedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* ─── Right: Intelligence Panel ────────────────────────── */}
        <div className={styles.right}>
          <div className={styles.intelligenceCard}>
            {/* Tab bar */}
            <div className={styles.tabBar}>
              <button
                className={`${styles.tab} ${rightTab === 'timeline' ? styles.tabActive : ''}`}
                onClick={() => setRightTab('timeline')}
              >
                Activity Timeline
              </button>
              <button
                className={`${styles.tab} ${rightTab === 'insights' ? styles.tabActive : ''}`}
                onClick={() => setRightTab('insights')}
              >
                Behavioral Insights
              </button>
              <button
                className={`${styles.tab} ${rightTab === 'triggers' ? styles.tabActive : ''}`}
                onClick={() => setRightTab('triggers')}
              >
                Triggers
              </button>
            </div>

            {/* Panel body */}
            <div className={styles.tabBody}>
              {rightTab === 'timeline' && <TimelinePanel userId={id} />}
              {rightTab === 'insights' && <InsightsPanel userId={id} />}
              {rightTab === 'triggers' && <TriggersPanel userId={id} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
