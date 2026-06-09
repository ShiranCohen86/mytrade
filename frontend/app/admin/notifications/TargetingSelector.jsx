import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { adminGetUsers, adminGetUser } from '@/lib/apiClient';
import styles from './AdminNotifications.module.scss';

const SEGMENTS = ['active', 'inactive', 'new', 'returning', 'pwa_installed', 'notif_enabled'];

function uiModeOf(mode) {
  if (mode === 'all') return 'all';
  if (mode === 'segment') return 'segment';
  if (mode === 'watchlist_holders') return 'watchlist';
  return 'specific';
}

export function TargetingSelector({ value, onChange, showWatchlistHolders = false }) {
  const { t } = useTranslation();
  const uiMode = uiModeOf(value.mode);
  const modes = showWatchlistHolders ? ['all', 'watchlist', 'segment', 'specific'] : ['all', 'segment', 'specific'];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]); // {id, email}
  const debounceRef = useRef(null);
  const selectedRef = useRef([]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // Hydrate the chips from incoming userIds (e.g. when editing a saved rule). The rule
  // only carries ids, so fetch each user's email/name for display. Stable string key
  // avoids re-fetching on every render (value.userIds is a fresh array each time).
  const idsKey = (value.userIds || []).map(String).join(',');
  useEffect(() => {
    const ids = (value.userIds || []).map(String);
    setSelected((prev) => prev.filter((s) => ids.includes(String(s.id)))); // drop de-targeted chips
    if (!ids.length) return undefined;
    const known = new Set(selectedRef.current.map((s) => String(s.id)));
    const missing = ids.filter((uid) => !known.has(uid));
    if (!missing.length) return undefined;
    let cancelled = false;
    Promise.all(missing.map((uid) => adminGetUser(uid).then((r) => r.user).catch(() => null)))
      .then((users) => {
        if (cancelled) return;
        const add = users.filter(Boolean).map((u) => ({ id: String(u._id), email: u.email || u.displayName || String(u._id) }));
        if (add.length) setSelected((cur) => {
          const seen = new Set(cur.map((s) => String(s.id)));
          return [...cur, ...add.filter((a) => !seen.has(a.id))];
        });
      });
    return () => { cancelled = true; };
  }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMode = (m) => {
    if (m === 'all') onChange({ mode: 'all', userIds: [], segment: null });
    else if (m === 'watchlist') onChange({ mode: 'watchlist_holders', userIds: [], segment: null });
    else if (m === 'segment') onChange({ mode: 'segment', userIds: [], segment: value.segment || null });
    else onChange({ mode: 'multiple', userIds: selected.map((u) => u.id), segment: null });
  };

  useEffect(() => {
    if (uiMode !== 'specific' || query.trim().length < 2) { setResults([]); return undefined; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      adminGetUsers({ search: query.trim(), limit: 8 })
        .then((r) => setResults(r.users || []))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, uiMode]);

  const addUser = (u) => {
    if (selected.some((s) => s.id === u._id)) return;
    const next = [...selected, { id: u._id, email: u.email }];
    setSelected(next);
    setQuery('');
    setResults([]);
    onChange({ mode: 'multiple', userIds: next.map((x) => x.id), segment: null });
  };

  const removeUser = (id) => {
    const next = selected.filter((s) => s.id !== id);
    setSelected(next);
    onChange({ mode: 'multiple', userIds: next.map((x) => x.id), segment: null });
  };

  return (
    <div>
      <div className={styles.modeTabs}>
        {modes.map((mode) => (
          <button key={mode} type="button"
            className={`${styles.modeTab} ${uiMode === mode ? styles.modeTabActive : ''}`}
            onClick={() => setMode(mode)}>
            {t(`adminNotif.mode.${mode}`)}
          </button>
        ))}
      </div>

      {uiMode === 'all' && (
        <p className={styles.headSub}>{t('adminNotif.allUsersHint')}</p>
      )}
      {uiMode === 'watchlist' && (
        <p className={styles.headSub}>{t('adminNotif.watchlistHoldersHint')}</p>
      )}

      {uiMode === 'segment' && (
        <div className={styles.segmentGrid}>
          {SEGMENTS.map((seg) => (
            <div key={seg}
              className={`${styles.segmentCard} ${value.segment === seg ? styles.segmentCardActive : ''}`}
              onClick={() => onChange({ mode: 'segment', userIds: [], segment: seg })}>
              <div className={styles.segmentName}>{t(`adminNotif.segment.${seg}`)}</div>
              <div className={styles.segmentDesc}>{t(`adminNotif.segmentDesc.${seg}`)}</div>
            </div>
          ))}
        </div>
      )}

      {uiMode === 'specific' && (
        <div className={styles.userSearch}>
          <input className={styles.textInput} value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('adminNotif.userSearchPh')} />
          {results.length > 0 && (
            <div className={styles.userResults}>
              {results.map((u) => (
                <div key={u._id} className={styles.userResult} onClick={() => addUser(u)}>
                  <span className={styles.userEmail}>{u.email || u.displayName || u._id}</span>
                  <span>+</span>
                </div>
              ))}
            </div>
          )}
          {selected.length > 0 && (
            <div className={styles.chips}>
              {selected.map((u) => (
                <span key={u.id} className={styles.userChip}>
                  {u.email}
                  <button type="button" className={styles.userChipX} onClick={() => removeUser(u.id)} aria-label="remove">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
