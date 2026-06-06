
import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '@/lib/navItems';
import styles from './BottomNav.module.scss';

export function BottomNav() {
  const { pathname } = useLocation();

  const isActive = (href) => {
    if (href === '/') return pathname === '/' || pathname.startsWith('/stocks');
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
          <span className={styles.icon}>{item.icon}</span>
          <span className={styles.label}>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
