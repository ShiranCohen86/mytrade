
import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './AppShell.module.scss';
import { TopBar } from '@/components/TopBar/TopBar';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { BottomNav } from '@/components/BottomNav/BottomNav';
import { CommandPalette } from '@/components/CommandPalette/CommandPalette';
import { InstallPrompt } from '@/components/InstallPrompt/InstallPrompt';
import { NotificationOptIn } from '@/components/NotificationOptIn/NotificationOptIn';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { clearAppBadge } from '@/lib/push';
import { tapLight } from '@/lib/haptics';

const AppShellContext = createContext({
  isSidebarCollapsed: false,
  toggleSidebar: () => {},
  setRefreshHandler: () => {},
});

export function useAppShell() {
  return useContext(AppShellContext);
}

export function AppShell({ children }) {
  const [isSidebarCollapsed, setCollapsed] = useState(false);
  const [isMobileOpen, setMobileOpen] = useState(false);
  const contentRef = useRef(null);
  const refreshHandlerRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  // Lock the document to the viewport while the shell is mounted so ONLY the
  // inner content scrolls. Otherwise body's min-height leaves a sliver of
  // document-level scroll on mobile (100vh > visual viewport) that drags the
  // whole grid — including the sticky TopBar — out of view. Restored on unmount
  // so public pages (landing/login) keep their natural document scroll.
  useEffect(() => {
    const { documentElement: html, body } = document;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  // Clear the app icon badge whenever the app is focused/visible.
  useEffect(() => {
    clearAppBadge();
    const onVisible = () => { if (document.visibilityState === 'visible') clearAppBadge(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Pages register their reload fn so pull-to-refresh can drive the active page.
  const setRefreshHandler = useCallback((fn) => { refreshHandlerRef.current = fn; }, []);
  const handlePull = useCallback(async () => {
    if (refreshHandlerRef.current) { tapLight(); await refreshHandlerRef.current(); }
  }, []);
  const { distance, refreshing, threshold } = usePullToRefresh(contentRef, handlePull);
  const pulled = distance > 0 || refreshing;

  const toggleSidebar = () => {
    setCollapsed((v) => !v);
    setMobileOpen((v) => !v);
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <AppShellContext.Provider value={{ isSidebarCollapsed, toggleSidebar, setRefreshHandler }}>
      <div className={`${styles.shell} ${isSidebarCollapsed ? styles.collapsed : ''}`}>
        <TopBar onToggleSidebar={toggleSidebar} />
        <Sidebar isCollapsed={isSidebarCollapsed} isMobileOpen={isMobileOpen} onClose={closeMobile} />
        {isMobileOpen && (
          <div className={styles.backdrop} onClick={closeMobile} aria-hidden="true" />
        )}
        <main className={styles.content} ref={contentRef}>
          {pulled && (
            <div
              className={styles.ptr}
              style={{ transform: `translateY(${Math.min(distance, threshold)}px)` }}
              aria-hidden="true"
            >
              <span className={`${styles.ptrSpinner} ${refreshing ? styles.ptrSpin : ''}`} style={{ opacity: Math.min(1, distance / threshold) }} />
            </div>
          )}
          <div key={pathname} className={styles.routeFade}>{children}</div>
        </main>
        <BottomNav />
        <CommandPalette />
        <InstallPrompt />
        <NotificationOptIn />
      </div>
    </AppShellContext.Provider>
  );
}
