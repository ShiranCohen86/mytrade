
import { Link, useLocation } from 'react-router-dom';
import { HelpModal } from '@/components/HelpModal/HelpModal';
import styles from './Sidebar.module.scss';

const NAV_ITEMS = [
  { label: 'Watchlist', href: '/', icon: '▤' },
  { label: 'Portfolio', href: '/portfolio', icon: '◈' },
  { label: 'Sectors', href: '/sectors', icon: '◧' },
];

export function Sidebar({ isCollapsed, isMobileOpen = false }) {
  const { pathname } = useLocation();

  const isActive = (href) => {
    if (href === '/') return pathname === '/' || pathname.startsWith('/stocks');
    return pathname === href;
  };

  return (
    <aside
      className={[
        styles.sidebar,
        isCollapsed ? styles.collapsed : '',
        isMobileOpen ? styles.mobileOpen : '',
      ].filter(Boolean).join(' ')}
      aria-label="Navigation"
    >
      <nav className={styles.nav}>
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{isCollapsed ? '' : 'Navigate'}</span>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`${styles.navItem} ${isActive(item.href) ? styles.navActive : ''}`}
              title={isCollapsed ? item.label : undefined}
              aria-label={item.label}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
            </Link>
          ))}
        </div>
      </nav>

      <div className={styles.bottom}>
        <HelpModal trigger={isCollapsed ? '?' : '[?] Help'} />
      </div>
    </aside>
  );
}
