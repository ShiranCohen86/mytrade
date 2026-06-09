import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminAutomationAnalytics } from '@/lib/apiClient';
import { AutoSubnav } from './AutoSubnav';
import styles from '../notifications/AdminNotifications.module.scss';

const tooltipStyle = { background: 'var(--surface-elevated)', border: '1px solid var(--chrome-mid)', borderRadius: 10, fontSize: 12, color: 'var(--text-primary)' };
const Stat = ({ value, label, sub }) => <div className={styles.statCard}><div className={styles.statValue}>{value}</div><div className={styles.statLabel}>{label}</div>{sub != null && <div className={styles.statSub}>{sub}</div>}</div>;

export default function AdminAutomationAnalytics() {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);

  useEffect(() => { adminAutomationAnalytics(days).then(setData).catch(() => setData(null)); }, [days]);

  const totals = data?.totals || {};
  const outcomes = data?.outcomes || {};
  const suppressedTotal = Object.entries(outcomes).filter(([k]) => k.startsWith('suppressed')).reduce((a, [, v]) => a + v, 0);

  const RuleTable = ({ title, rows }) => (
    <div className={styles.chartCard}>
      <div className={styles.chartTitle}>{title}</div>
      <table className={styles.table}>
        <thead><tr><th>{t('autom.colName')}</th><th>{t('autom.sent')}</th><th>CTR</th></tr></thead>
        <tbody>
          {(rows || []).length === 0 ? <tr><td colSpan={3} className={styles.cellMuted}>{t('autom.noData')}</td></tr>
            : rows.map((r) => <tr key={r.ruleId} style={{ cursor: 'default' }}><td className={styles.cellTitle}>{r.name}</td><td className={styles.cellMuted}>{r.created}</td><td className={styles.cellMuted}>{r.ctr}%</td></tr>)}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.headTitle}>{t('autom.analyticsTitle')}</h1>
          <p className={styles.headSub}>{t('autom.analyticsSub')}</p>
        </div>
        <div className={styles.headActions}>
          <select className={styles.select} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>{t('adminNotif.last7')}</option>
            <option value={30}>{t('adminNotif.last30')}</option>
            <option value={90}>{t('adminNotif.last90')}</option>
          </select>
        </div>
      </div>

      <AutoSubnav />

      <div className={styles.statGrid}>
        <Stat value={(totals.executions || 0).toLocaleString()} label={t('autom.statExecutions')} />
        <Stat value={(totals.recipients || 0).toLocaleString()} label={t('autom.statRecipients')} />
        <Stat value={(outcomes.sent || 0).toLocaleString()} label={t('autom.sent')} />
        <Stat value={suppressedTotal.toLocaleString()} label={t('autom.suppressed')} sub={t('autom.fatiguePrevented')} />
      </div>

      <div className={styles.chartCard} style={{ marginBottom: 16 }}>
        <div className={styles.chartTitle}>{t('autom.executionsTrend')}</div>
        <div className={styles.chartBox}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.trend || []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--chrome-dim)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => (d ? d.slice(5) : '')} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <RuleTable title={t('autom.bestRules')} rows={data?.best} />
        <RuleTable title={t('autom.worstRules')} rows={data?.worst} />
      </div>
    </div>
  );
}
