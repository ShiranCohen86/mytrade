import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { adminNotificationAnalytics } from '@/lib/apiClient';
import { NotifSubnav } from './NotifSubnav';
import styles from './AdminNotifications.module.scss';

const tooltipStyle = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--chrome-mid)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text-primary)',
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

function TrendChart({ data, color, title }) {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartTitle}>{title}</div>
      <div className={styles.chartBox}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--chrome-dim)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d) => (d ? d.slice(5) : '')} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function AdminNotificationAnalytics() {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);

  useEffect(() => {
    adminNotificationAnalytics(days).then(setData).catch(() => setData(null));
  }, [days]);

  const push = data?.push || {};
  const inApp = data?.inApp || {};
  const totals = data?.totals || {};

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.headTitle}>{t('adminNotif.analyticsTitle')}</h1>
          <p className={styles.headSub}>{t('adminNotif.analyticsSub')}</p>
        </div>
        <div className={styles.headActions}>
          <select className={styles.select} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>{t('adminNotif.last7')}</option>
            <option value={30}>{t('adminNotif.last30')}</option>
            <option value={90}>{t('adminNotif.last90')}</option>
          </select>
        </div>
      </div>

      <NotifSubnav />

      <div className={styles.previewLabel} style={{ marginTop: 0 }}>{t('adminNotif.pushMetrics')}</div>
      <div className={styles.statGrid}>
        <Stat value={(push.sent || 0).toLocaleString()} label={t('adminNotif.statPushSent')} />
        <Stat value={(push.opened || 0).toLocaleString()} label={t('adminNotif.statPushOpened')} />
        <Stat value={(push.clicked || 0).toLocaleString()} label={t('adminNotif.statClickedLabel')} />
        <Stat value={`${push.ctr || 0}%`} label={t('adminNotif.statCtr')} />
      </div>

      <div className={styles.previewLabel}>{t('adminNotif.inAppMetrics')}</div>
      <div className={styles.statGrid}>
        <Stat value={(inApp.created || 0).toLocaleString()} label={t('adminNotif.statInAppDelivered')} />
        <Stat value={(inApp.impressions || 0).toLocaleString()} label={t('adminNotif.statImpressions')} />
        <Stat value={`${inApp.readRate || 0}%`} label={t('adminNotif.statReadRate')} />
        <Stat value={`${inApp.dismissRate || 0}%`} label={t('adminNotif.statDismissRate')} />
      </div>

      <div className={styles.previewLabel}>{t('adminNotif.trends')} · {t('adminNotif.campaignsSent', { count: totals.campaigns || 0 })}</div>
      <div className={styles.chartGrid}>
        <TrendChart data={data?.trends?.inApp || []} color="var(--accent)" title={t('adminNotif.trendInApp')} />
        <TrendChart data={data?.trends?.push || []} color="var(--accent-secondary)" title={t('adminNotif.trendPush')} />
      </div>
    </div>
  );
}
