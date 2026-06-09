import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/context/NotificationContext';
import { NotificationItem } from '@/components/NotificationItem/NotificationItem';
import styles from './NotificationBell.module.scss';

const DROPDOWN_LIMIT = 8;

export function NotificationBell() {
  const { items, unread, markAllRead, dismiss, activate, markSeen } = useNotifications();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [open]);

  const onActivate = (n) => {
    activate(n.id);
    setOpen(false);
    if (n.deepLink) navigate(n.deepLink);
  };

  const recent = items.slice(0, DROPDOWN_LIMIT);

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        className={styles.bell}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('notifications.title')}
        aria-expanded={open}
        title={t('notifications.title')}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown} role="menu">
          <div className={styles.header}>
            <span className={styles.headerTitle}>{t('notifications.title')}</span>
            {unread > 0 && (
              <button className={styles.markAll} onClick={markAllRead}>
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className={styles.list}>
            {recent.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon} aria-hidden="true">🔔</span>
                <span>{t('notifications.empty')}</span>
              </div>
            ) : (
              recent.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onActivate={onActivate}
                  onDismiss={(x) => dismiss(x.id)}
                  onSeen={(id) => markSeen([id])}
                />
              ))
            )}
          </div>

          <button
            className={styles.footer}
            onClick={() => { setOpen(false); navigate('/notifications'); }}
          >
            {t('notifications.viewAll')}
          </button>
        </div>
      )}
    </div>
  );
}
