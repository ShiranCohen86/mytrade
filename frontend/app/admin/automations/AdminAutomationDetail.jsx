import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  adminGetAutomation, adminAutomationLogs, adminPauseAutomation, adminResumeAutomation,
  adminRunAutomation, adminTestAutomation, adminDeleteAutomation,
} from '@/lib/apiClient';
import styles from '../notifications/AdminNotifications.module.scss';
import auto from './automations.module.scss';

const STATUS_CLASS = { active: auto.statusActive, paused: auto.statusPaused, inactive: auto.statusInactive };

function Stat({ value, label, sub }) {
  return <div className={styles.statCard}><div className={styles.statValue}>{value}</div><div className={styles.statLabel}>{label}</div>{sub != null && <div className={styles.statSub}>{sub}</div>}</div>;
}

export default function AdminAutomationDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [rule, setRule] = useState(null);
  const [logs, setLogs] = useState({ logs: [], pagination: { page: 1, pages: 1, total: 0 } });
  const [outcome, setOutcome] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [confirmRun, setConfirmRun] = useState(false);
  const [sim, setSim] = useState(null);

  const load = useCallback(() => { adminGetAutomation(id).then(({ rule: r }) => setRule(r)).catch(() => toast.error(t('autom.loadFailed'))); }, [id, toast, t]);
  useEffect(() => { load(); }, [load]);

  const loadLogs = useCallback(() => { adminAutomationLogs(id, { outcome, page, limit: 25 }).then(setLogs).catch(() => {}); }, [id, outcome, page]);
  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { setPage(1); }, [outcome]);

  const act = async (fn, okMsg) => { setBusy(true); try { await fn(); if (okMsg) toast.success(okMsg); load(); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  const doTest = async () => { try { setSim(await adminTestAutomation(id)); } catch (e) { toast.error(e.message); } };
  const doRun = async () => {
    setBusy(true);
    try { const r = await adminRunAutomation(id); toast.success(t('autom.ranResult', { sent: r.sent, attempted: r.attempted })); setConfirmRun(false); setTimeout(load, 600); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const doDelete = async () => { if (!window.confirm(t('autom.confirmDelete'))) return; try { await adminDeleteAutomation(id); toast.success(t('autom.deleted')); navigate('/admin/automations'); } catch (e) { toast.error(e.message); } };

  if (!rule) return <div className={styles.loading}>{t('autom.loading')}</div>;
  const s = rule.stats || {};

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.headTitle}>{rule.name}</h1>
          <p className={styles.headSub}>
            <span className={`${styles.badge} ${STATUS_CLASS[rule.status]}`}>{t(`autom.status.${rule.status}`)}</span>
            {' · '}{rule.trigger?.type} · {t(`autom.category.${rule.category}`, rule.category)}
          </p>
        </div>
        <div className={styles.headActions}>
          <button className="btn btn-ghost" onClick={() => navigate('/admin/automations')}>← {t('autom.back')}</button>
          <button className="btn btn-secondary" onClick={() => navigate(`/admin/automations/${id}/edit`)}>{t('autom.edit')}</button>
          <button className="btn btn-secondary" onClick={doTest}>{t('autom.testDry')}</button>
          {rule.status === 'active'
            ? <button className="btn btn-secondary" disabled={busy} onClick={() => act(() => adminPauseAutomation(id), t('autom.paused'))}>{t('autom.pause')}</button>
            : <button className="btn btn-primary" disabled={busy || !rule.feasible} onClick={() => act(() => adminResumeAutomation(id), t('autom.activated'))}>{t('autom.activate')}</button>}
          <button className="btn btn-accent-ghost" disabled={busy || !rule.feasible} onClick={() => setConfirmRun(true)}>{t('autom.runNow')}</button>
          <button className="btn btn-danger" onClick={doDelete}>{t('autom.delete')}</button>
        </div>
      </div>

      <div className={styles.statGrid}>
        <Stat value={s.executions || 0} label={t('autom.statExecutions')} sub={t('autom.statSuppressed', { count: s.suppressed || 0 })} />
        <Stat value={s.recipients || 0} label={t('autom.statRecipients')} />
        <Stat value={s.delivered?.inApp || 0} label={t('autom.statInApp')} />
        <Stat value={s.delivered?.push || 0} label={t('autom.statPush')} />
        <Stat value={s.lastFiredAt ? new Date(s.lastFiredAt).toLocaleDateString() : '—'} label={t('autom.statLastFired')} />
      </div>

      {sim && (
        <div className={auto.simResult} style={{ marginBottom: 16 }}>
          <strong>{t('autom.simMatched', { count: sim.count })}</strong>
          {sim.matched.map((m, i) => (
            <div className={auto.matchRow} key={i}><span>{m.email}{m.ticker ? ` · ${m.ticker}` : ''}</span><span>{m.preview?.title}</span></div>
          ))}
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('autom.deliveryLog')}</div>
        <div className={styles.filters}>
          <select className={styles.select} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">{t('autom.allOutcomes')}</option>
            {['sent', 'digested', 'suppressed_cooldown', 'suppressed_cap', 'suppressed_quiet', 'suppressed_dedupe', 'suppressed_global_cap', 'error'].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>{t('autom.colUser')}</th><th>{t('autom.colTicker')}</th><th>{t('autom.colOutcome')}</th><th>{t('autom.colWhen')}</th></tr></thead>
            <tbody>
              {logs.logs.length === 0 ? <tr><td colSpan={4} className={styles.cellMuted}>{t('autom.noLogs')}</td></tr>
                : logs.logs.map((l, i) => (
                  <tr key={i} style={{ cursor: 'default' }}>
                    <td className={styles.cellTitle}>{l.email || '—'}</td>
                    <td className={styles.cellMuted}>{l.ticker || '—'}</td>
                    <td><span className={`${styles.badge} ${l.outcome === 'sent' ? styles.statusSent : styles.statusDraft}`}>{l.outcome}</span></td>
                    <td className={styles.cellMuted}>{new Date(l.firedAt).toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className={styles.pagination}>
          <span>{t('adminNotif.totalCount', { count: logs.pagination.total })}</span>
          <div className={styles.pageBtns}>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('adminNotif.prev')}</button>
            <span>{page} / {logs.pagination.pages || 1}</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= logs.pagination.pages} onClick={() => setPage((p) => p + 1)}>{t('adminNotif.next')}</button>
          </div>
        </div>
      </div>

      {confirmRun && (
        <div className={styles.modalOverlay} onClick={() => setConfirmRun(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{t('autom.runConfirmTitle')}</h2>
            <p className={styles.modalSub}>{t('autom.runConfirmSub')}</p>
            <div className={styles.modalActions}>
              <button className="btn btn-ghost" onClick={() => setConfirmRun(false)}>{t('autom.cancel')}</button>
              <button className="btn btn-primary" disabled={busy} onClick={doRun}>{t('autom.runNow')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
