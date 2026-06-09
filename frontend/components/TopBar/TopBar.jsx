
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MarketHoursIndicator } from '@/components/MarketHoursIndicator/MarketHoursIndicator';
import { NotificationBell } from '@/components/NotificationBell/NotificationBell';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
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
  const { t } = useTranslation();
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
        alt={user.displayName || t('userMenu.account')}
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

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'support_agent', 'analyst']);

function UserMenu({ user, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isAdmin = ADMIN_ROLES.has(user?.role);

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
          <span className={styles.userDropdownName}>{user.displayName || t('userMenu.account')}</span>
          <span className={styles.userDropdownEmail}>{user.email}</span>
        </div>
      </div>
      <div className={styles.userDropdownDivider} />
      {isAdmin && (
        <button
          className={styles.userDropdownItem}
          onClick={() => { navigate('/admin'); onClose(); }}
          role="menuitem"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
          </svg>
          {t('userMenu.adminPanel')}
        </button>
      )}
      <button
        className={styles.userDropdownItem}
        onClick={() => { navigate('/settings'); onClose(); }}
        role="menuitem"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        {t('userMenu.settings')}
      </button>
      <button className={styles.userDropdownItem} onClick={handleLogout} role="menuitem">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        {t('userMenu.signOut')}
      </button>
    </div>
  );
}

export function TopBar({ onToggleSidebar }) {
  const { theme, pref, toggle } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { currency, toggle: toggleCurrency } = useCurrency();
  const { t } = useTranslation();
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

  const themeTitle = pref === 'system' ? t('topbar.themeSystem') : pref === 'light' ? t('topbar.switchToDark') : t('topbar.switchToLight');
  const themeAriaLabel = pref === 'system' ? t('topbar.themeSystemAria') : pref === 'light' ? t('topbar.switchToDarkAria') : t('topbar.switchToLightAria');

  return (
    <header className={styles.topBar}>
      <div className={styles.left}>
        <button
          className={styles.hamburger}
          onClick={onToggleSidebar}
          aria-label={t('topbar.toggleSidebar')}
          title={t('topbar.toggleSidebar')}
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
        <button
          className={styles.paletteBtn}
          onClick={() => document.dispatchEvent(new CustomEvent('palette:open'))}
          title={t('topbar.openCommandPalette')}
          aria-label={t('topbar.openCommandPalette')}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span className={styles.paletteBtnLabel}>{t('topbar.search')}</span>
          <kbd className={styles.paletteBtnKbd}>⌘K</kbd>
        </button>

        <LiveClock />
        <button
          className={styles.currencyToggle}
          onClick={toggleCurrency}
          title={currency === 'USD' ? 'Switch to ILS (₪)' : 'Switch to USD ($)'}
          aria-label={currency === 'USD' ? 'Switch to ILS' : 'Switch to USD'}
        >
          {currency === 'USD' ? '$' : '₪'}
        </button>
        <button
          className={styles.themeToggle}
          onClick={toggle}
          title={themeTitle}
          aria-label={themeAriaLabel}
        >
          {pref === 'system' ? '◑' : theme === 'light' ? '☽' : '☀'}
        </button>

        {isAuthenticated && <NotificationBell />}

        {isAuthenticated && user && (
          <div ref={menuRef} className={styles.userWrap}>
            <button
              className={styles.userBtn}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={t('topbar.accountMenu')}
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
