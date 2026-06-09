import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminListCampaigns } from '@/lib/apiClient';
import { NotifSubnav } from './NotifSubnav';
import styles from './AdminNotifications.module.scss';

const STATUS_CLASS = {
  draft: 'statusDraft', scheduled: 'statusScheduled', sending: 'statusSending',
  sent: 'statusSent', failed: 'statusFailed', canceled: 'statusCanceled',
};

function audienceLabel(a, t) {
  if (!a) return '—';
  if (a.mode === 'all') return t('adminNotif.audienceAll');
  if (a.mode === 'segment') return t(`adminNotif.segment.${a.segment}`, a.segment);
  return t('adminNotif.audienceUsers', { count: (a.userIds || []).length });
}

export default function AdminNotifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState({ campaigns: [], pagination: { page: 1, pages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListCampaigns({ status, channel, search, page, limit: 25 });
      setData(res);
    } catch { /* surfaced as empty */ } finally {
      setLoading(false);
    }
  }, [status, channel, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, channel, search]);

  const { campaigns, pagination } = data;

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.headTitle}>{t('adminNotif.title')}</h1>
          <p className={styles.headSub}>{t('adminNotif.subtitle')}</p>
        </div>
        <div className={styles.headActions}>
          <button className="btn btn-primary" onClick={() => navigate('/admin/notifications/new')}>
            + {t('adminNotif.newNotification')}
          </button>
        </div>
      </div>

      <NotifSubnav />

      <div className={styles.filters}>
        <input
          className={`${styles.textInput} ${styles.searchBox}`}
          placeholder={t('adminNotif.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('adminNotif.allStatuses')}</option>
          {['draft', 'scheduled', 'sending', 'sent', 'failed', 'canceled'].map((s) => (
            <option key={s} value={s}>{t(`adminNotif.status.${s}`)}</option>
          ))}
        </select>
        <select className={styles.select} value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">{t('adminNotif.allChannels')}</option>
          <option value="push">{t('adminNotif.channelPush')}</option>
          <option value="in_app">{t('adminNotif.channelInApp')}</option>
        </select>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.loading}>{t('adminNotif.loading')}</div>
        ) : campaigns.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">📢</span>
            <span>{t('adminNotif.noCampaigns')}</span>
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('adminNotif.colTitle')}</th>
                    <th>{t('adminNotif.colChannels')}</th>
                    <th>{t('adminNotif.colAudience')}</th>
                    <th>{t('adminNotif.colRecipients')}</th>
                    <th>{t('adminNotif.colStatus')}</th>
                    <th>{t('adminNotif.colCreated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c._id} onClick={() => navigate(`/admin/notifications/${c._id}`)}>
                      <td><div className={styles.cellTitle}>{c.icon} {c.title}</div></td>
                      <td>
                        <span className={styles.chanBadges}>
                          {c.channels?.push && <span className={`${styles.badge} ${styles.chPush}`}>Push</span>}
                          {c.channels?.inApp && <span className={`${styles.badge} ${styles.chInApp}`}>In-app</span>}
                        </span>
                      </td>
                      <td>{audienceLabel(c.audience, t)}</td>
                      <td className={styles.cellMuted}>{c.recipientCount || 0}</td>
                      <td>
                        <span className={`${styles.badge} ${styles[STATUS_CLASS[c.status]]}`}>
                          {t(`adminNotif.status.${c.status}`)}
                        </span>
                      </td>
                      <td className={styles.cellMuted}>{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.pagination}>
              <span>{t('adminNotif.totalCount', { count: pagination.total })}</span>
              <div className={styles.pageBtns}>
                <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t('adminNotif.prev')}
                </button>
                <span>{page} / {pagination.pages || 1}</span>
                <button className="btn btn-secondary btn-sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
                  {t('adminNotif.next')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
