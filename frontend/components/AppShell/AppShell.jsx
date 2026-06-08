
import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './AppShell.module.scss';
import { TopBar } from '@/components/TopBar/TopBar';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { BottomNav } from '@/components/BottomNav/BottomNav';
import { CommandPalette } from '@/components/CommandPalette/CommandPalette';

const AppShellContext = createContext({
  isSidebarCollapsed: false,
  toggleSidebar: () => {},
});

export function useAppShell() {
  return useContext(AppShellContext);
}

export function AppShell({ children }) {
  const [isSidebarCollapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setMobileOpen] = useState(false);
  const contentRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  const toggleSidebar = () => {
    setCollapsed((v) => !v);
    setMobileOpen((v) => !v);
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <AppShellContext.Provider value={{ isSidebarCollapsed, toggleSidebar }}>
      <div className={`${styles.shell} ${isSidebarCollapsed ? styles.collapsed : ''}`}>
        <TopBar onToggleSidebar={toggleSidebar} />
        <Sidebar isCollapsed={isSidebarCollapsed} isMobileOpen={isMobileOpen} onClose={closeMobile} />
        {isMobileOpen && (
          <div className={styles.backdrop} onClick={closeMobile} aria-hidden="true" />
        )}
        <main className={styles.content} ref={contentRef}>{children}</main>
        <BottomNav />
        <CommandPalette />
      </div>
    </AppShellContext.Provider>
  );
}
