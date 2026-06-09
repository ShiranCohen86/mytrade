import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './AdminNotifications.module.scss';

export function NotifSubnav() {
  const { t } = useTranslation();
  const cls = ({ isActive }) => `${styles.subnavLink} ${isActive ? styles.subnavActive : ''}`;
  return (
    <nav className={styles.subnav}>
      <NavLink to="/admin/notifications" end className={cls}>{t('adminNotif.tabCampaigns')}</NavLink>
      <NavLink to="/admin/notifications/templates" className={cls}>{t('adminNotif.tabTemplates')}</NavLink>
      <NavLink to="/admin/notifications/analytics" className={cls}>{t('adminNotif.tabAnalytics')}</NavLink>
    </nav>
  );
}
