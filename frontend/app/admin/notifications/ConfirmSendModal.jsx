import { useState, useEffect, useRef, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { adminPreviewRecipients } from '@/lib/apiClient';
import { NotificationPreview } from './NotificationPreview';
import styles from './AdminNotifications.module.scss';

/**
 * Final review + safety gate before a send. Re-fetches the authoritative
 * recipient count and requires an explicit double-confirm checkbox when the
 * audience is "all users".
 */
export function ConfirmSendModal({ content, audience, sendMode, scheduledAt, recipientCount, saving, onCancel, onConfirm }) {
  const { t } = useTranslation();
  const [count, setCount] = useState(recipientCount);
  const [acknowledged, setAcknowledged] = useState(false);
  const isAll = audience.mode === 'all';
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    let cancelled = false;
    adminPreviewRecipients(audience).then((r) => { if (!cancelled) setCount(r.count); }).catch(() => {});
    return () => { cancelled = true; };
  }, [audience]);

  // Lock body scroll while the dialog is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Esc closes the dialog
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  // Focus-trap + restore — keep keyboard focus inside while open
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

  const blocked = saving || (isAll && !acknowledged) || count === 0;

  return (
    <div className={styles.modalOverlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className={styles.modalTitle}>
          {sendMode === 'schedule' ? t('adminNotif.confirmScheduleTitle') : t('adminNotif.confirmSendTitle')}
        </h2>
        <p className={styles.modalSub}>
          {sendMode === 'schedule' && scheduledAt
            ? t('adminNotif.confirmScheduleSub', { when: new Date(scheduledAt).toLocaleString() })
            : t('adminNotif.confirmSendSub')}
        </p>

        <div className={styles.recipientBig}>
          <span className={styles.recipientNum}>{count == null ? '…' : count.toLocaleString()}</span>
          <span className={styles.recipientWord}>{t('adminNotif.recipientsWord')}</span>
        </div>

        <NotificationPreview content={content} compact />

        {isAll && (
          <div className={styles.warnBox} style={{ marginTop: 16 }}>
            ⚠️ {t('adminNotif.confirmAllWarn')}
          </div>
        )}

        {isAll && (
          <label className={styles.confirmCheck}>
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
            <span>{t('adminNotif.confirmAllCheck')}</span>
          </label>
        )}

        <div className={styles.modalActions}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>{t('adminNotif.cancel')}</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={blocked}>
            {saving ? t('adminNotif.sending')
              : sendMode === 'schedule' ? t('adminNotif.confirmScheduleBtn')
              : t('adminNotif.confirmSendBtn', { count: count ?? 0 })}
          </button>
        </div>
      </div>
    </div>
  );
}
