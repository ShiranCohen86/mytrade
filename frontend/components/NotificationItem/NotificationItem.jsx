import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './NotificationItem.module.scss';

const TYPE_FALLBACK_ICON = {
  info: 'ℹ️', success: '✅', warning: '⚠️', alert: '🚨',
};

function timeAgo(date, t) {
  const d = new Date(date).getTime();
  if (Number.isNaN(d)) return '';
  const sec = Math.round((Date.now() - d) / 1000);
  if (sec < 60) return t('notifications.justNow');
  const min = Math.round(sec / 60);
  if (min < 60) return t('notifications.minutesAgo', { count: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t('notifications.hoursAgo', { count: hr });
  const day = Math.round(hr / 24);
  if (day < 7) return t('notifications.daysAgo', { count: day });
  return new Date(date).toLocaleDateString();
}

/**
 * A single in-app notification row, used in both the dropdown and the center.
 * Reports a "seen" impression once on mount via onSeen.
 */
export function NotificationItem({ notification: n, onActivate, onDismiss, onSeen }) {
  const { t } = useTranslation();
  const ref = useRef(null);

  useEffect(() => {
    if (onSeen) onSeen(n.id);
  }, [n.id, onSeen]);

  return (
    <div
      ref={ref}
      className={`${styles.item} ${styles[n.type] || ''} ${n.read ? '' : styles.unread}`}
      role="button"
      tabIndex={0}
      onClick={() => onActivate(n)}
      onKeyDown={(e) => { if (e.key === 'Enter') onActivate(n); }}
    >
      {!n.read && <span className={styles.unreadDot} aria-hidden="true" />}

      <span className={styles.icon} aria-hidden="true">
        {n.icon || TYPE_FALLBACK_ICON[n.type] || TYPE_FALLBACK_ICON.info}
      </span>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{n.title}</span>
          <span className={styles.time}>{timeAgo(n.createdAt, t)}</span>
        </div>
        <p className={styles.message}>{n.message}</p>
        {n.actionText && n.deepLink && (
          <span className={styles.action}>{n.actionText} →</span>
        )}
      </div>

      {onDismiss && (
        <button
          className={styles.dismiss}
          onClick={(e) => { e.stopPropagation(); onDismiss(n); }}
          aria-label={t('notifications.dismiss')}
          title={t('notifications.dismiss')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
