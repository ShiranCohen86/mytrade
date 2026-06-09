import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  adminGetCampaign, adminCampaignDeliveries, adminSendCampaign, adminCancelCampaign,
} from '@/lib/apiClient';
import styles from './AdminNotifications.module.scss';

const STATUS_CLASS = {
  draft: 'statusDraft', scheduled: 'statusScheduled', sending: 'statusSending',
  sent: 'statusSent', failed: 'statusFailed', canceled: 'statusCanceled',
};

function Stat({ value, label, sub }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub != null && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}

export default function AdminNotificationDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [campaign, setCampaign] = useState(null);
  const [channel, setChannel] = useState('in_app');
  const [statusF, setStatusF] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [log, setLog] = useState({ deliveries: [], pagination: { page: 1, pages: 1, total: 0 } });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminGetCampaign(id).then(({ campaign: c }) => setCampaign(c)).catch(() => toast.error(t('adminNotif.loadFailed')));
  }, [id, toast, t]);

  useEffect(() => { load(); }, [load]);

  const loadLog = useCallback(() => {
    adminCampaignDeliveries(id, { channel, status: statusF, search, page, limit: 25 })
      .then(setLog).catch(() => {});
  }, [id, channel, statusF, search, page]);

  useEffect(() => { loadLog(); }, [loadLog]);
  useEffect(() => { setPage(1); }, [channel, statusF, search]);

  const doSend = async () => {
    setBusy(true);
    try { await adminSendCampaign(id); toast.success(t('adminNotif.sendStarted')); setTimeout(load, 800); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const doCancel = async () => {
    setBusy(true);
    try { await adminCancelCampaign(id); toast.success(t('adminNotif.canceled')); load(); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  if (!campaign) return <div className={styles.loading}>{t('adminNotif.loading')}</div>;

  const s = campaign.stats || { push: {}, inApp: {} };
  const ctr = s.push?.sent ? Math.round((s.push.clicked / s.push.sent) * 1000) / 10 : 0;
  const readRate = s.inApp?.created ? Math.round((s.inApp.read / s.inApp.created) * 1000) / 10 : 0;

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.headTitle}>{campaign.icon} {campaign.title}</h1>
          <p className={styles.headSub}>
            <span className={`${styles.badge} ${styles[STATUS_CLASS[campaign.status]]}`}>{t(`adminNotif.status.${campaign.status}`)}</span>
            {' · '}{t('adminNotif.createdBy', { who: campaign.createdByEmail || '—' })}
          </p>
        </div>
        <div className={styles.headActions}>
          <button className="btn btn-ghost" onClick={() => navigate('/admin/notifications')}>← {t('adminNotif.back')}</button>
          {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
            <button className="btn btn-secondary" onClick={() => navigate(`/admin/notifications/${id}/edit`)}>{t('adminNotif.edit')}</button>
          )}
          {campaign.status === 'scheduled' && (
            <button className="btn btn-danger" disabled={busy} onClick={doCancel}>{t('adminNotif.cancelSend')}</button>
          )}
          {campaign.status === 'draft' && (
            <button className="btn btn-primary" disabled={busy} onClick={doSend}>{t('adminNotif.sendNow')}</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statGrid}>
        <Stat value={(campaign.recipientCount || 0).toLocaleString()} label={t('adminNotif.recipientsWord')} />
        {campaign.channels?.inApp && <>
          <Stat value={s.inApp?.created || 0} label={t('adminNotif.statInAppDelivered')} sub={t('adminNotif.statSeen', { count: s.inApp?.seen || 0 })} />
          <Stat value={`${readRate}%`} label={t('adminNotif.statReadRate')} sub={t('adminNotif.statRead', { count: s.inApp?.read || 0 })} />
          <Stat value={s.inApp?.clicked || 0} label={t('adminNotif.statInAppClicks')} />
        </>}
        {campaign.channels?.push && <>
          <Stat value={s.push?.sent || 0} label={t('adminNotif.statPushSent')} sub={t('adminNotif.statFailed', { count: s.push?.failed || 0 })} />
          <Stat value={s.push?.opened || 0} label={t('adminNotif.statPushOpened')} />
          <Stat value={`${ctr}%`} label={t('adminNotif.statCtr')} sub={t('adminNotif.statClicked', { count: s.push?.clicked || 0 })} />
        </>}
      </div>

      {/* Content + meta */}
      <div className={styles.detailGrid}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('adminNotif.content')}</div>
          <div className={styles.inAppPreview}>
            <span className={styles.inAppIcon}>{campaign.icon || '🔔'}</span>
            <div>
              <div className={styles.inAppTitle}>{campaign.title}</div>
              <div className={styles.inAppMsg}>{campaign.message}</div>
              {campaign.actionText && campaign.deepLink && <span className={styles.inAppAction}>{campaign.actionText} →</span>}
            </div>
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('adminNotif.details')}</div>
          <div className={styles.metaRow}><span className={styles.metaKey}>{t('adminNotif.colChannels')}</span>
            <span className={styles.metaVal}>{[campaign.channels?.inApp && 'In-app', campaign.channels?.push && 'Push'].filter(Boolean).join(' + ')}</span></div>
          <div className={styles.metaRow}><span className={styles.metaKey}>{t('adminNotif.colAudience')}</span>
            <span className={styles.metaVal}>{campaign.audience?.mode === 'segment' ? t(`adminNotif.segment.${campaign.audience.segment}`) : t(`adminNotif.mode.${campaign.audience?.mode === 'all' ? 'all' : 'specific'}`)}</span></div>
          {campaign.deepLink && <div className={styles.metaRow}><span className={styles.metaKey}>{t('adminNotif.fieldDeepLink')}</span><span className={styles.metaVal}>{campaign.deepLink}</span></div>}
          {campaign.scheduledAt && <div className={styles.metaRow}><span className={styles.metaKey}>{t('adminNotif.scheduledFor')}</span><span className={styles.metaVal}>{new Date(campaign.scheduledAt).toLocaleString()}</span></div>}
          {campaign.sentAt && <div className={styles.metaRow}><span className={styles.metaKey}>{t('adminNotif.sentAt')}</span><span className={styles.metaVal}>{new Date(campaign.sentAt).toLocaleString()}</span></div>}
          {campaign.error && <div className={styles.metaRow}><span className={styles.metaKey}>{t('adminNotif.errorLabel')}</span><span className={styles.metaVal} style={{ color: 'var(--neg)' }}>{campaign.error}</span></div>}
        </div>
      </div>

      {/* Delivery log */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('adminNotif.deliveryLog')}</div>
        <div className={styles.filters}>
          <div className={styles.modeTabs}>
            <button className={`${styles.modeTab} ${channel === 'in_app' ? styles.modeTabActive : ''}`} onClick={() => setChannel('in_app')}>{t('adminNotif.channelInApp')}</button>
            <button className={`${styles.modeTab} ${channel === 'push' ? styles.modeTabActive : ''}`} onClick={() => setChannel('push')}>{t('adminNotif.channelPush')}</button>
          </div>
          <input className={`${styles.textInput} ${styles.searchBox}`} placeholder={t('adminNotif.searchEmail')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('adminNotif.colUser')}</th>
                <th>{t('adminNotif.colStatus')}</th>
                <th>{t('adminNotif.colWhen')}</th>
              </tr>
            </thead>
            <tbody>
              {log.deliveries.length === 0 ? (
                <tr><td colSpan={3} className={styles.cellMuted}>{t('adminNotif.noDeliveries')}</td></tr>
              ) : log.deliveries.map((d, i) => (
                <tr key={i} style={{ cursor: 'default' }}>
                  <td className={styles.cellTitle}>{d.email || d.userId || '—'}</td>
                  <td><span className={`${styles.badge} ${styles.statusDraft}`}>{d.status}{d.error ? ` · ${d.error}` : ''}</span></td>
                  <td className={styles.cellMuted}>{new Date(d.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.pagination}>
          <span>{t('adminNotif.totalCount', { count: log.pagination.total })}</span>
          <div className={styles.pageBtns}>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('adminNotif.prev')}</button>
            <span>{page} / {log.pagination.pages || 1}</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= log.pagination.pages} onClick={() => setPage((p) => p + 1)}>{t('adminNotif.next')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
