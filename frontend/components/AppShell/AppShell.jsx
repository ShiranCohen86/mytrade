
import { createContext, useContext, useState } from 'react';
import styles from './AppShell.module.scss';
import { TopBar } from '@/components/TopBar/TopBar';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { BottomNav } from '@/components/BottomNav/BottomNav';

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
        <main className={styles.content}>{children}</main>
        <BottomNav />
      </div>
    </AppShellContext.Provider>
  );
}
