
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './BottomSheet.module.scss';

export function BottomSheet({ children, onClose, title }) {
  const sheetRef = useRef(null);
  const touchStartY = useRef(null);
  const touchStartTime = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Android hardware/gesture back closes the sheet instead of leaving the page.
  useEffect(() => {
    window.history.pushState({ mtSheet: true }, '');
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Closed via button/escape (not back) → pop the history entry we added.
      if (window.history.state && window.history.state.mtSheet) window.history.back();
    };
  }, [onClose]);

  // Focus trap + restore — keep keyboard focus inside the sheet while open.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const sheet = sheetRef.current;
    const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(sheet?.querySelectorAll(FOCUSABLE) || []).filter((el) => el.offsetParent !== null);
    const first = focusables()[0];
    (first || sheet)?.focus?.();

    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    sheet?.addEventListener('keydown', onKey);
    return () => {
      sheet?.removeEventListener('keydown', onKey);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, []);

  const handleTouchStart = useCallback((e) => {
    // Only initiate drag from handle or header area
    const target = e.target;
    const isHandle = target.closest(`.${styles.handle}`) || target.closest(`.${styles.header}`);
    const body = sheetRef.current?.querySelector(`.${styles.body}`);
    const isScrolled = body && body.scrollTop > 0;
    if (!isHandle && isScrolled) return;

    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy < 0) { setDragOffset(0); return; }
    setDragOffset(dy);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartY.current === null) return;
    const elapsed = Date.now() - touchStartTime.current;
    const sheetHeight = sheetRef.current?.offsetHeight || 400;
    const fastSwipe = elapsed < 200 && dragOffset > 50;
    const longDrag = dragOffset > sheetHeight * 0.35;

    touchStartY.current = null;
    touchStartTime.current = null;
    setIsDragging(false);

    if (fastSwipe || longDrag) {
      onClose();
    } else {
      setDragOffset(0);
    }
  }, [dragOffset, onClose]);

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Details'}
    >
      <div
        ref={sheetRef}
        className={styles.sheet}
        tabIndex={-1}
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? 'none' : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.handle} />
        <div className={styles.header}>
          <span className={styles.headerTitle}>{title}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
