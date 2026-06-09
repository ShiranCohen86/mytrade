import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  SOCKET_URL,
  getNotifications,
  getNotificationUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  markNotificationsSeen,
  clickNotification,
} from '@/lib/apiClient';

const NotificationContext = createContext(null);

const RECONCILE_MS = 45_000; // safety re-sync even if the socket misses an event

export function NotificationProvider({ children }) {
  const { isAuthenticated, getToken } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const seenQueue = useRef(new Set());

  // `toast` and `getToken` are re-created every render by their providers; hold
  // them in refs so the socket effect can depend only on auth state (no reconnect
  // storm on every parent re-render).
  const toastRef = useRef(toast);
  const getTokenRef = useRef(getToken);
  useEffect(() => { toastRef.current = toast; getTokenRef.current = getToken; });

  // ── REST sync ──────────────────────────────────────────────────────────────
  const refreshUnread = useCallback(async () => {
    try {
      const { count } = await getNotificationUnreadCount();
      setUnread(count);
    } catch { /* offline / transient */ }
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const { notifications, nextCursor: nc } = await getNotifications({ limit: 20 });
      setItems(notifications);
      setNextCursor(nc);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    try {
      const { notifications, nextCursor: nc } = await getNotifications({ limit: 20, cursor: nextCursor });
      setItems((prev) => [...prev, ...notifications]);
      setNextCursor(nc);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [nextCursor, loading]);

  // ── Mutations (optimistic) ───────────────────────────────────────────────────
  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try { await markNotificationRead(id); } catch { refreshUnread(); }
  }, [refreshUnread]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await markAllNotificationsRead(); } catch { refreshUnread(); }
  }, [refreshUnread]);

  const dismiss = useCallback(async (id) => {
    setItems((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target && !target.read) setUnread((u) => Math.max(0, u - 1));
      return prev.filter((n) => n.id !== id);
    });
    try { await deleteNotification(id); } catch { refreshUnread(); }
  }, [refreshUnread]);

  // Activate (click): optimistic read + record a click (server marks read too).
  const activate = useCallback((id) => {
    setItems((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target && !target.read) setUnread((u) => Math.max(0, u - 1));
      return prev.map((n) => (n.id === id ? { ...n, read: true } : n));
    });
    clickNotification(id).catch(() => refreshUnread());
  }, [refreshUnread]);

  // Batch "seen" impressions (flushed shortly after items surface).
  const markSeen = useCallback((ids) => {
    ids.forEach((id) => seenQueue.current.add(id));
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (seenQueue.current.size === 0) return;
      const ids = [...seenQueue.current];
      seenQueue.current.clear();
      markNotificationsSeen(ids).catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, []);

  // ── Socket lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]); setUnread(0); setNextCursor(null); setConnected(false);
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      return undefined;
    }

    loadInitial();
    refreshUnread();

    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      auth: { token: getTokenRef.current() },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => { setConnected(true); refreshUnread(); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    // Refresh the auth token on every reconnection attempt (it may have rotated).
    socket.io.on('reconnect_attempt', () => { socket.auth = { token: getTokenRef.current() }; });

    socket.on('notification:new', (n) => {
      setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
      setUnread((u) => u + 1);
      toastRef.current.info(n.title, 5000);
    });

    socket.on('notification:badge', ({ count }) => {
      if (typeof count === 'number') setUnread(count);
    });

    socket.on('notification:update', (u) => {
      if (u.all && u.read) { setItems((prev) => prev.map((n) => ({ ...n, read: true }))); setUnread(0); return; }
      if (u.removed) { setItems((prev) => prev.filter((n) => n.id !== u.id)); refreshUnread(); return; }
      if (u.read) { setItems((prev) => prev.map((n) => (n.id === u.id ? { ...n, read: true } : n))); refreshUnread(); }
    });

    // Safety net: periodically reconcile the unread badge in case an event was missed.
    const reconcile = setInterval(refreshUnread, RECONCILE_MS);
    const onFocus = () => refreshUnread();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(reconcile);
      window.removeEventListener('focus', onFocus);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, loadInitial, refreshUnread]);

  const value = {
    items, unread, loading, connected, hasMore: !!nextCursor,
    markRead, markAllRead, dismiss, activate, loadMore, markSeen, refreshUnread,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
