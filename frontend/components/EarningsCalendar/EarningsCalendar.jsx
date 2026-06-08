
import { useState, useMemo, useEffect } from 'react';
import styles from './EarningsCalendar.module.scss';

export function EarningsCalendar({ stocks }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const entries = useMemo(() => {
    const now = Date.now();
    return stocks
      .flatMap((s) => {
        const d = s.cachedData?.earningsDate;
        if (!d) return [];
        const date = new Date(d);
        const daysUntil = Math.ceil((date.getTime() - now) / (1000 * 60 * 60 * 24));
        if (daysUntil < 0) return [];
        return [{
          ticker: s.ticker,
          name: s.name || s.ticker,
          earningsDate: date,
          daysUntil,
          confirmed: s.cachedData?.earningsConfirmed ?? false,
          riskScore: s.analysis?.riskScore ?? null,
        }];
      })
      .sort((a, b) => a.earningsDate.getTime() - b.earningsDate.getTime());
  }, [stocks]);

  const upcomingCount = entries.filter((e) => e.daysUntil <= 30).length;

  const handleClose = () => setOpen(false);

  return (
    <>
      <button
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label={`Open earnings calendar — ${entries.length} upcoming`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.icon}>
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Earnings
        {entries.length > 0 && (
          <span className={`${styles.badge} ${upcomingCount > 0 ? styles.badgeActive : ''}`}>
            {entries.length}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.overlay} onClick={handleClose} role="dialog" aria-modal="true" aria-label="Earnings calendar">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <h2 className={styles.title}>Upcoming Earnings</h2>
              <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">✕</button>
            </div>

            {entries.length === 0 ? (
              <p className={styles.empty}>No upcoming earnings dates found in your watchlist.</p>
            ) : (
              <ul className={styles.list}>
                {entries.map((e) => (
                  <li key={e.ticker} className={styles.row}>
                    <div className={styles.rowLeft}>
                      <span className={styles.ticker}>{e.ticker}</span>
                      <span className={styles.name}>{e.name !== e.ticker ? e.name : ''}</span>
                    </div>
                    <div className={styles.rowRight}>
                      <span className={styles.date}>
                        {e.earningsDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {!e.confirmed && <span className={styles.est}> est.</span>}
                      </span>
                      <span className={`${styles.days} ${dayClass(e.daysUntil)}`}>
                        {e.daysUntil === 0 ? 'Today' : `${e.daysUntil}d`}
                      </span>
                      {e.riskScore !== null && (
                        <span className={`${styles.risk} ${riskClass(e.riskScore)}`}>
                          Risk {e.riskScore}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function dayClass(days) {
  if (days <= 3) return styles.daysUrgent;
  if (days <= 7) return styles.daysWarn;
  return '';
}

function riskClass(score) {
  if (score >= 70) return styles.riskHigh;
  if (score >= 40) return styles.riskMed;
  return styles.riskLow;
}
