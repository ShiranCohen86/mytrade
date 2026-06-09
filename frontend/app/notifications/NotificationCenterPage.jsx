import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/context/NotificationContext';
import { NotificationItem } from '@/components/NotificationItem/NotificationItem';
import styles from './NotificationCenterPage.module.scss';

const TYPE_FILTERS = ['info', 'success', 'warning', 'alert'];

export default function NotificationCenterPage() {
  const { items, unread, loading, hasMore, markAllRead, dismiss, activate, loadMore, markSeen } = useNotifications();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all'); // all | unread
  const [typeFilter, setTypeFilter] = useState(null);

  const filtered = useMemo(() => items.filter((n) => {
    if (tab === 'unread' && n.read) return false;
    if (typeFilter && n.type !== typeFilter) return false;
    return true;
  }), [items, tab, typeFilter]);

  const onActivate = (n) => {
    activate(n.id);
    if (n.deepLink) navigate(n.deepLink);
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{t('notifications.title')}</h1>
          <p className={styles.subtitle}>
            {unread > 0 ? t('notifications.unreadCount', { count: unread }) : t('notifications.allCaughtUp')}
          </p>
        </div>
        {unread > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
            {t('notifications.markAllRead')}
          </button>
        )}
      </header>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`} onClick={() => setTab('all')}>
            {t('notifications.all')}
          </button>
          <button className={`${styles.tab} ${tab === 'unread' ? styles.tabActive : ''}`} onClick={() => setTab('unread')}>
            {t('notifications.unread')}
          </button>
        </div>
        <div className={styles.chips}>
          {TYPE_FILTERS.map((tp) => (
            <button
              key={tp}
              className={`${styles.chip} ${typeFilter === tp ? styles.chipActive : ''}`}
              onClick={() => setTypeFilter((prev) => (prev === tp ? null : tp))}
            >
              {t(`notifications.type.${tp}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">🔔</span>
            <p>{t('notifications.empty')}</p>
          </div>
        ) : (
          filtered.map((n) => (
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

      {hasMore && tab === 'all' && !typeFilter && (
        <div className={styles.loadMore}>
          <button className="btn btn-secondary" onClick={loadMore} disabled={loading}>
            {loading ? t('notifications.loading') : t('notifications.loadMore')}
          </button>
        </div>
      )}
    </div>
  );
}
