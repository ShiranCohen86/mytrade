import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 72;
const MAX = 110;

/**
 * Native-style pull-to-refresh for a scrollable element. Only engages on touch
 * devices and only when the container is scrolled to the top. Calls `onRefresh`
 * (awaited) when pulled past the threshold.
 *
 * @param {{current: HTMLElement|null}} scrollRef  the scroll container
 * @param {() => Promise<void>|void} onRefresh
 */
export function usePullToRefresh(scrollRef, onRefresh) {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const st = useRef({ startY: null, active: false, dist: 0, refreshing: false });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof window === 'undefined' || !('ontouchstart' in window)) return undefined;
    const s = st.current;

    const onStart = (e) => {
      if (s.refreshing || el.scrollTop > 0) { s.active = false; s.startY = null; return; }
      s.startY = e.touches[0].clientY;
      s.active = true;
    };
    const onMove = (e) => {
      if (!s.active || s.startY == null) return;
      if (el.scrollTop > 0) { s.active = false; s.dist = 0; setDistance(0); return; }
      const dy = e.touches[0].clientY - s.startY;
      if (dy <= 0) { s.dist = 0; setDistance(0); return; }
      const d = Math.min(MAX, dy * 0.5); // elastic resistance
      s.dist = d;
      setDistance(d);
      if (d > 6 && e.cancelable) e.preventDefault();
    };
    const finish = async () => {
      if (!s.active) return;
      s.active = false;
      const reached = s.dist >= THRESHOLD;
      s.startY = null;
      if (reached && onRefreshRef.current) {
        s.refreshing = true;
        setRefreshing(true);
        setDistance(THRESHOLD);
        try { await onRefreshRef.current(); } catch { /* ignore */ }
        s.refreshing = false;
        setRefreshing(false);
      }
      s.dist = 0;
      setDistance(0);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', finish, { passive: true });
    el.addEventListener('touchcancel', finish, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', finish);
      el.removeEventListener('touchcancel', finish);
    };
  }, [scrollRef]);

  return { distance, refreshing, threshold: THRESHOLD };
}
