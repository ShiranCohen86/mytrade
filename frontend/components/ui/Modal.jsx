import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.scss';

/**
 * Shared centered Modal — portal, scroll-lock, Esc + backdrop close, focus-trap,
 * Android back-button close, and landscape-safe safe-area padding.
 * For mobile sheet-style detail views keep using <BottomSheet>.
 *
 * Props: title, onClose, size ('sm'|'md'|'lg'), footer, children.
 */
export function Modal({ title, onClose, size = 'md', footer, children, className = '' }) {
  const dialogRef = useRef(null);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Esc to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Android hardware/gesture back closes the modal instead of leaving the page
  useEffect(() => {
    window.history.pushState({ mtModal: true }, '');
    const onPop = () => onClose?.();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (window.history.state && window.history.state.mtModal) window.history.back();
    };
  }, [onClose]);

  // Focus-trap + restore
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(dialog?.querySelectorAll(FOCUSABLE) || []).filter((el) => el.offsetParent !== null);
    (focusables()[0] || dialog)?.focus?.();

    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    dialog?.addEventListener('keydown', onKey);
    return () => {
      dialog?.removeEventListener('keydown', onKey);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, []);

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={[styles.dialog, styles[size], className].filter(Boolean).join(' ')}
      >
        {title && (
          <div className={styles.header}>
            <span className={styles.title}>{title}</span>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">✕</button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
