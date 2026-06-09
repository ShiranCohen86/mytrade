
import { createContext, useContext, useCallback, useMemo, useState } from 'react';
import { tapSuccess, tapError, tapWarning, tapLight } from '@/lib/haptics';
import styles from './Toast.module.scss';

const HAPTIC_BY_TYPE = { success: tapSuccess, error: tapError, warning: tapWarning, info: tapLight };

const ToastCtx = createContext(null);
let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((type, message, duration = 4000) => {
    const id = ++_id;
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    (HAPTIC_BY_TYPE[type] || tapLight)();
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  // Memoized so the context value keeps a stable identity across renders.
  // (`add`/`dismiss` are stable useCallbacks.) An unstable value here re-runs
  // every consumer effect that depends on a toast-derived callback — which
  // otherwise causes an infinite toast→re-render→effect loop.
  const toast = useMemo(() => ({
    success: (msg, dur) => add('success', msg, dur),
    error:   (msg, dur) => add('error',   msg, dur),
    warning: (msg, dur) => add('warning', msg, dur),
    info:    (msg, dur) => add('info',    msg, dur),
    dismiss,
  }), [add, dismiss]);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className={styles.stack} role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

function ToastItem({ toast, onDismiss }) {
  const { id, type, message } = toast;
  return (
    <div className={`${styles.toast} ${styles[type]}`} role="alert">
      <span className={styles.icon}>{ICONS[type]}</span>
      <span className={styles.msg}>{message}</span>
      <button className={styles.close} onClick={() => onDismiss(id)} aria-label="Dismiss">✕</button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
