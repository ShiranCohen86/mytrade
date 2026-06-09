import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './AdminNotifications.module.scss';

const TYPE_FALLBACK = { info: 'ℹ️', success: '✅', warning: '⚠️', alert: '🚨' };

/**
 * Live, multi-surface preview of a notification: Android push, iOS push, and the
 * in-app card. Used in the compose wizard and the confirm modal.
 */
export function NotificationPreview({ content, compact = false }) {
  const { t } = useTranslation();
  const [device, setDevice] = useState('android');
  const icon = content.icon || TYPE_FALLBACK[content.type] || TYPE_FALLBACK.info;
  const title = content.title || t('adminNotif.previewTitle');
  const message = content.message || t('adminNotif.previewBody');

  return (
    <div>
      {!compact && (
        <div className={styles.deviceToggle}>
          {['android', 'ios', 'inapp'].map((d) => (
            <button
              key={d}
              className={`${styles.deviceBtn} ${device === d ? styles.deviceBtnActive : ''}`}
              onClick={() => setDevice(d)}
            >
              {t(`adminNotif.device.${d}`)}
            </button>
          ))}
        </div>
      )}

      {(compact || device === 'android') && content.push !== false && (device === 'android' || compact) && (
        <>
          {!compact && <div className={styles.previewLabel}>{t('adminNotif.device.android')} · Push</div>}
          <div className={styles.pushAndroid}>
            <span className={styles.pushAndroidIcon} aria-hidden="true">{icon}</span>
            <div className={styles.pushAndroidBody}>
              <div className={styles.pushAndroidApp}>MyTrade · now</div>
              <div className={styles.pushTitle}>{title}</div>
              <div className={styles.pushMsg}>{message}</div>
            </div>
          </div>
        </>
      )}

      {!compact && device === 'ios' && (
        <>
          <div className={styles.previewLabel}>iOS · Push</div>
          <div className={styles.pushIos}>
            <div className={styles.pushIosHead}>
              <span className={styles.pushAndroidIcon} aria-hidden="true">{icon}</span>
              <span className={styles.pushIosApp}>MYTRADE</span>
              <span className={styles.pushIosTime}>now</span>
            </div>
            <div className={styles.pushTitle}>{title}</div>
            <div className={styles.pushMsg}>{message}</div>
          </div>
        </>
      )}

      {(compact || device === 'inapp') && (
        <>
          {!compact && <div className={styles.previewLabel}>{t('adminNotif.device.inapp')}</div>}
          <div className={styles.inAppPreview}>
            <span className={styles.inAppIcon} aria-hidden="true">{icon}</span>
            <div>
              <div className={styles.inAppTitle}>{title}</div>
              <div className={styles.inAppMsg}>{message}</div>
              {content.actionText && content.deepLink && (
                <span className={styles.inAppAction}>{content.actionText} →</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
