
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MarketHoursIndicator } from '@/components/MarketHoursIndicator/MarketHoursIndicator';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import styles from './TopBar.module.scss';

function LiveClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const fmt = () => {
      const t = new Date().toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setTime(`${t} ET`);
    };
    fmt();
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className={styles.clock}>{time}</span>;
}

function UserAvatar({ user, size = 32 }) {
  const initials = (user.displayName || user.email || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.displayName || 'User'}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
      />
    );
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--accent-faint)',
        color: 'var(--accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 700,
        fontFamily: 'var(--font-ui)',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials}
    </span>
  );
}

function UserMenu({ user, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.userDropdown} role="menu">
      <div className={styles.userDropdownHeader}>
        <UserAvatar user={user} size={36} />
        <div className={styles.userDropdownInfo}>
          <span className={styles.userDropdownName}>{user.displayName || 'Account'}</span>
          <span className={styles.userDropdownEmail}>{user.email}</span>
        </div>
      </div>
      <div className={styles.userDropdownDivider} />
      <button
        className={styles.userDropdownItem}
        onClick={() => { navigate('/settings'); onClose(); }}
        role="menuitem"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Settings
      </button>
      <button className={styles.userDropdownItem} onClick={handleLogout} role="menuitem">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sign out
      </button>
    </div>
  );
}

export function TopBar({ onToggleSidebar }) {
  const { theme, toggle } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [menuOpen]);

  return (
    <header className={styles.topBar}>
      <div className={styles.left}>
        <button
          className={styles.hamburger}
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
        >
          <span /><span /><span />
        </button>
        <Link to={isAuthenticated ? '/dashboard' : '/'} className={styles.brand}>
          <img src="/favicon.svg" alt="MyTrade" className={styles.brandMark} />
          <span className={styles.brandName}>MyTrade</span>
        </Link>
      </div>

      <div className={styles.center}>
        <MarketHoursIndicator />
      </div>

      <div className={styles.right}>
        <LiveClock />
        <button
          className={styles.themeToggle}
          onClick={toggle}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? '☽' : '☀'}
        </button>

        {isAuthenticated && user && (
          <div ref={menuRef} className={styles.userWrap}>
            <button
              className={styles.userBtn}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              <UserAvatar user={user} size={30} />
            </button>
            {menuOpen && <UserMenu user={user} onClose={() => setMenuOpen(false)} />}
          </div>
        )}
      </div>
    </header>
  );
}
