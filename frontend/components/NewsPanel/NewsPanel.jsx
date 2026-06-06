
import { useState, useEffect } from 'react';
import { getNews } from '@/lib/apiClient';
import styles from './NewsPanel.module.scss';

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function sentDotClass(label) {
  if (label === 'positive') return styles.sent_positive;
  if (label === 'negative') return styles.sent_negative;
  return styles.sent_neutral;
}

export function NewsPanel({ ticker }) {
  const [news, setNews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getNews(ticker)
      .then((data) => {
        if (!cancelled) setNews(data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load news');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [ticker]);

  return (
    <div className={styles.container}>
      {isLoading && (
        <div className={styles.loading}>Loading news...</div>
      )}

      {error && !isLoading && (
        <div className={styles.error}>{error}</div>
      )}

      {!isLoading && !error && news.length === 0 && (
        <div className={styles.empty}>No recent news found for {ticker}.</div>
      )}

      {!isLoading && !error && news.length > 0 && (
        <ul className={styles.list}>
          {news.map((item, i) => (
            <li key={i} className={styles.item}>
              <span className={`${styles.sentDot} ${sentDotClass(item.sentiment.label)}`} />
              <div className={styles.itemContent}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.headline}
                >
                  {item.headline}
                </a>
                <div className={styles.meta}>
                  {item.isGuidanceRelated && (
                    <span className={styles.guidanceBadge}>Guidance</span>
                  )}
                  <span className={styles.time}>{timeAgo(item.publishedAt)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
