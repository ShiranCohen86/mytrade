
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MarketHoursIndicator } from '@/components/MarketHoursIndicator/MarketHoursIndicator';
import { useTheme } from '@/hooks/useTheme';
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

export function TopBar({ onToggleSidebar }) {
  const { theme, toggle } = useTheme();

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
        <Link to="/" className={styles.brand}>
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
      </div>
    </header>
  );
}
