import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast/ToastProvider';
import { adminListAutomations, adminPauseAutomation, adminResumeAutomation } from '@/lib/apiClient';
import { AutoSubnav } from './AutoSubnav';
import styles from '../notifications/AdminNotifications.module.scss';
import auto from './automations.module.scss';

const STATUS_CLASS = { active: auto.statusActive, paused: auto.statusPaused, inactive: auto.statusInactive };
const CATEGORIES = ['watchlist_stock', 'user', 'ai_personalization', 'market', 'platform', 'engagement'];

function targetLabel(tg, t) {
  if (!tg) return '—';
  if (tg.mode === 'all') return t('adminNotif.audienceAll');
  if (tg.mode === 'watchlist_holders') return t('adminNotif.mode.watchlist');
  if (tg.mode === 'segment') return t(`adminNotif.segment.${tg.segment}`, tg.segment);
  return t('adminNotif.audienceUsers', { count: (tg.userIds || []).length });
}

export default function AdminAutomations() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState({ rules: [], pagination: { page: 1, pages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await adminListAutomations({ category, status, search, page, limit: 25 })); }
    catch { /* empty */ } finally { setLoading(false); }
  }, [category, status, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [category, status, search]);

  const toggle = async (rule, e) => {
    e.stopPropagation();
    try {
      if (rule.status === 'active') await adminPauseAutomation(rule._id);
      else await adminResumeAutomation(rule._id);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const { rules, pagination } = data;

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.headTitle}>{t('autom.title')}</h1>
          <p className={styles.headSub}>{t('autom.subtitle')}</p>
        </div>
        <div className={styles.headActions}>
          <button className="btn btn-primary" onClick={() => navigate('/admin/automations/new')}>+ {t('autom.newRule')}</button>
        </div>
      </div>

      <AutoSubnav />

      <div className={styles.filters}>
        <input className={`${styles.textInput} ${styles.searchBox}`} placeholder={t('autom.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={styles.select} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('autom.allCategories')}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{t(`autom.category.${c}`)}</option>)}
        </select>
        <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('autom.allStatuses')}</option>
          {['active', 'paused', 'inactive'].map((s) => <option key={s} value={s}>{t(`autom.status.${s}`)}</option>)}
        </select>
      </div>

      <div className={styles.card}>
        {loading ? <div className={styles.loading}>{t('autom.loading')}</div>
          : rules.length === 0 ? (
            <div className={styles.empty}><span className={styles.emptyIcon}>⚙️</span>{t('autom.noRules')}</div>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('autom.colName')}</th>
                      <th>{t('autom.colCategory')}</th>
                      <th>{t('autom.colTarget')}</th>
                      <th>{t('autom.colExecutions')}</th>
                      <th>{t('autom.colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => (
                      <tr key={r._id} onClick={() => navigate(`/admin/automations/${r._id}`)}>
                        <td>
                          <div className={styles.cellTitle}>{r.name}</div>
                          <div className={styles.cellMuted}>{r.trigger?.type}</div>
                        </td>
                        <td>{t(`autom.category.${r.category}`, r.category)}</td>
                        <td>{targetLabel(r.targeting, t)}</td>
                        <td className={styles.cellMuted}>{r.stats?.executions || 0}</td>
                        <td>
                          <button
                            className={`${styles.badge} ${STATUS_CLASS[r.status]}`}
                            onClick={(e) => toggle(r, e)}
                            disabled={r.status === 'inactive'}
                            title={r.status === 'inactive' ? t('autom.needsData') : t('autom.toggleHint')}
                          >
                            {t(`autom.status.${r.status}`)}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.pagination}>
                <span>{t('adminNotif.totalCount', { count: pagination.total })}</span>
                <div className={styles.pageBtns}>
                  <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('adminNotif.prev')}</button>
                  <span>{page} / {pagination.pages || 1}</span>
                  <button className="btn btn-secondary btn-sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>{t('adminNotif.next')}</button>
                </div>
              </div>
            </>
          )}
      </div>
    </div>
  );
}
