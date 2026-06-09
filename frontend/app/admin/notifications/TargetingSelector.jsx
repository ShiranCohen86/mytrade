import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { adminGetUsers } from '@/lib/apiClient';
import styles from './AdminNotifications.module.scss';

const SEGMENTS = ['active', 'inactive', 'new', 'returning', 'pwa_installed', 'notif_enabled'];

function uiModeOf(mode) {
  if (mode === 'all') return 'all';
  if (mode === 'segment') return 'segment';
  return 'specific';
}

export function TargetingSelector({ value, onChange }) {
  const { t } = useTranslation();
  const uiMode = uiModeOf(value.mode);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]); // {id, email}
  const debounceRef = useRef(null);

  const setMode = (m) => {
    if (m === 'all') onChange({ mode: 'all', userIds: [], segment: null });
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
        {['all', 'segment', 'specific'].map((m) => (
          <button key={m} type="button"
            className={`${styles.modeTab} ${uiMode === m ? styles.modeTabActive : ''}`}
            onClick={() => setMode(m)}>
            {t(`adminNotif.mode.${m}`)}
          </button>
        ))}
      </div>

      {uiMode === 'all' && (
        <p className={styles.headSub}>{t('adminNotif.allUsersHint')}</p>
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
