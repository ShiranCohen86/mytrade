import { useState, useEffect } from 'react';
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

  useEffect(() => {
    adminPreviewRecipients(audience).then((r) => setCount(r.count)).catch(() => {});
  }, [audience]);

  const blocked = saving || (isAll && !acknowledged) || count === 0;

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
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
