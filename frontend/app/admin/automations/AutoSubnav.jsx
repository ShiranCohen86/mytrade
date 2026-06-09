import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../notifications/AdminNotifications.module.scss';

export function AutoSubnav() {
  const { t } = useTranslation();
  const cls = ({ isActive }) => `${styles.subnavLink} ${isActive ? styles.subnavActive : ''}`;
  return (
    <nav className={styles.subnav}>
      <NavLink to="/admin/automations" end className={cls}>{t('autom.tabRules')}</NavLink>
      <NavLink to="/admin/automations/analytics" className={cls}>{t('autom.tabAnalytics')}</NavLink>
    </nav>
  );
}
