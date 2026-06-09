import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  adminListAutomations, adminPauseAutomation, adminResumeAutomation,
  adminDuplicateAutomation, adminDeleteAutomation,
} from '@/lib/apiClient';
import styles from '../notifications/AdminNotifications.module.scss';
import auto from '../automations/automations.module.scss';

const STATUS_CLASS = { active: auto.statusActive, paused: auto.statusPaused, inactive: auto.statusInactive };

/** Per-user automation triggers — embedded in the admin user-profile page. */
export default function TriggersPanel({ userId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminListAutomations({ userId, limit: 100 })
      .then((r) => setRules(r.rules || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn) => { try { await fn(); load(); } catch (e) { toast.error(e.message); } };
  const del = async (id) => { if (!window.confirm(t('autom.confirmDelete'))) return; act(() => adminDeleteAutomation(id)); };

  if (loading) return <div className={styles.loading}>{t('autom.loading')}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span className={styles.headSub}>{t('autom.userTriggersHint')}</span>
        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/admin/automations/new?userId=${userId}`)}>+ {t('autom.newRule')}</button>
      </div>

      {rules.length === 0 ? (
        <div className={styles.empty}><span className={styles.emptyIcon}>⚙️</span>{t('autom.noUserTriggers')}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>{t('autom.colName')}</th><th>{t('autom.colStatus')}</th><th /></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r._id} onClick={() => navigate(`/admin/automations/${r._id}`)}>
                  <td><div className={styles.cellTitle}>{r.name}</div><div className={styles.cellMuted}>{r.trigger?.type}</div></td>
                  <td><span className={`${styles.badge} ${STATUS_CLASS[r.status]}`}>{t(`autom.status.${r.status}`)}</span></td>
                  <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap', textAlign: 'end' }}>
                    {r.status === 'active'
                      ? <button className={auto.addCond} onClick={() => act(() => adminPauseAutomation(r._id))}>{t('autom.pause')}</button>
                      : <button className={auto.addCond} onClick={() => act(() => adminResumeAutomation(r._id))} disabled={!r.feasible}>{t('autom.activate')}</button>}
                    <button className={auto.addCond} onClick={() => act(() => adminDuplicateAutomation(r._id))}>{t('autom.duplicate')}</button>
                    <button className={auto.addCond} style={{ color: 'var(--neg)' }} onClick={() => del(r._id)}>{t('autom.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
