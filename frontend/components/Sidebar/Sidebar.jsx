
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelpModal } from '@/components/HelpModal/HelpModal';
import { NAV_ITEMS } from '@/lib/navItems';
import { useAuth } from '@/context/AuthContext';
import styles from './Sidebar.module.scss';

function NavSvgIcon({ labelKey }) {
  if (labelKey === 'nav.watchlist') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
  if (labelKey === 'nav.portfolio') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
  if (labelKey === 'nav.sectors') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
  return null;
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function Sidebar({ isCollapsed, isMobileOpen = false, onClose }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = async () => {
    if (onClose) onClose();
    await logout();
    navigate('/login', { replace: true });
  };

  const isActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/stocks');
    return pathname === href;
  };

  return (
    <aside
      className={[
        styles.sidebar,
        isCollapsed ? styles.collapsed : '',
        isMobileOpen ? styles.mobileOpen : '',
      ].filter(Boolean).join(' ')}
      aria-label={t('nav.navigate')}
    >
      <nav className={styles.nav}>
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{(!isCollapsed || isMobileOpen) ? t('nav.navigate') : ''}</span>
          {NAV_ITEMS.map((item) => {
            const label = t(item.labelKey);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.navActive : ''}`}
                title={isCollapsed ? label : undefined}
                aria-label={label}
                onClick={isMobileOpen ? onClose : undefined}
              >
                <span className={styles.navIcon}><NavSvgIcon labelKey={item.labelKey} /></span>
                {(!isCollapsed || isMobileOpen) && <span className={styles.navLabel}>{label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={styles.bottom}>
        {user && (!isCollapsed || isMobileOpen) && (
          <div className={styles.userBlock}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.displayName || user.email?.split('@')[0]}</span>
              <span className={styles.userEmail}>{user.email}</span>
            </div>
            <button
              className={styles.signOutBtn}
              onClick={handleLogout}
              title={t('sidebar.signOut')}
              aria-label={t('sidebar.signOut')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}
        <Link
          to="/settings"
          className={`${styles.settingsLink} ${pathname === '/settings' ? styles.settingsLinkActive : ''}`}
          title={isCollapsed && !isMobileOpen ? t('nav.settings') : undefined}
          onClick={isMobileOpen ? onClose : undefined}
        >
          <span className={styles.navIcon}><SettingsIcon /></span>
          {(!isCollapsed || isMobileOpen) && <span>{t('nav.settings')}</span>}
        </Link>
        <HelpModal trigger={(!isCollapsed || isMobileOpen) ? t('help.trigger') : t('help.triggerShort')} />
      </div>
    </aside>
  );
}
