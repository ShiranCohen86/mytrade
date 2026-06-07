
import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '@/lib/navItems';
import styles from './BottomNav.module.scss';

function NavSvgIcon({ label }) {
  if (label === 'Watchlist') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
  if (label === 'Portfolio') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
  if (label === 'Sectors') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
  return null;
}

export function BottomNav() {
  const { pathname } = useLocation();

  const isActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/stocks');
    return pathname === href;
  };

  return (
    <nav className={styles.nav} aria-label="Bottom navigation">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          className={`${styles.item} ${isActive(item.href) ? styles.itemActive : ''}`}
          aria-label={item.label}
        >
          <span className={styles.icon}><NavSvgIcon label={item.label} /></span>
          <span className={styles.label}>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
