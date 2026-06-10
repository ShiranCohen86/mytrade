
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { searchStocks } from '@/lib/apiClient';
import styles from './AddTickerForm.module.scss';

// Match what the backend's sanitizeTicker accepts ([A-Z0-9.]): letter-led, so
// tickers with a class suffix or digits (BRK.B, RDS.A, BF.B) aren't rejected here.
const TICKER_RE = /^[A-Z][A-Z0-9.]{0,9}$/;

function parseTickers(raw) {
  return raw
    .toUpperCase()
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function AddTickerForm({ onAdd }) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== '/') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const isBulk = value.includes(',') || value.includes(';');

  useEffect(() => {
    const q = value.trim().toUpperCase();
    if (isBulk || q.length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchStocks(q);
        if (Array.isArray(data) && data.length > 0) {
          setResults(data);
          setShowDropdown(true);
          setHighlighted(-1);
        } else {
          setResults([]);
          setShowDropdown(false);
        }
      } catch {
        setResults([]);
        setShowDropdown(false);
      }
    }, 280);

    return () => clearTimeout(debounceRef.current);
  }, [value, isBulk]);

  useEffect(() => {
    if (!showDropdown) return;
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    // pointerdown (not mousedown) so an outside *tap* closes the dropdown on
    // touch devices — mousedown doesn't fire for touch in some mobile browsers.
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [showDropdown]);

  const selectResult = useCallback((ticker) => {
    setValue(ticker);
    setShowDropdown(false);
    setResults([]);
    setHighlighted(-1);
  }, []);

  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      selectResult(results[highlighted].ticker);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowDropdown(false);
    const tickers = parseTickers(value);

    if (tickers.length === 0) {
      setError(t('addTicker.invalidTicker'));
      return;
    }

    const invalid = tickers.find((ticker) => !TICKER_RE.test(ticker));
    if (invalid) {
      setError(t('addTicker.invalidTickerValue', { ticker: invalid }));
      return;
    }

    setError(null);
    setLoading(true);

    if (tickers.length === 1) {
      try {
        await onAdd(tickers[0]);
        setValue('');
      } catch (err) {
        setError(err instanceof Error ? err.message : t('addTicker.failedToAdd'));
      } finally {
        setLoading(false);
        setProgress(null);
      }
      return;
    }

    const errors = [];
    for (let i = 0; i < tickers.length; i++) {
      setProgress(t('addTicker.adding', { current: i + 1, total: tickers.length, ticker: tickers[i] }));
      try {
        await onAdd(tickers[i]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('addTicker.failedToAdd');
        errors.push(`${tickers[i]}: ${msg}`);
      }
    }

    setLoading(false);
    setProgress(null);
    setValue('');
    if (errors.length > 0) {
      setError(errors.join(' · '));
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} ref={wrapRef}>
      <div className={styles.inputRow}>
        <div className={styles.inputWrap}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder={isBulk ? t('addTicker.placeholderBulk') : t('addTicker.placeholder')}
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 50))}
            onBlur={(e) => {
              if (!e.target.value.includes(',') && !e.target.value.includes(';')) {
                setValue(e.target.value.toUpperCase().slice(0, 10));
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
            disabled={loading}
            maxLength={50}
            spellCheck={false}
            autoComplete="off"
            aria-label={t('addTicker.ariaLabel')}
            aria-autocomplete="list"
            aria-expanded={showDropdown}
          />
          {showDropdown && results.length > 0 && (
            <ul className={styles.dropdown} role="listbox">
              {results.map((r, i) => (
                <li
                  key={r.ticker}
                  role="option"
                  aria-selected={i === highlighted}
                  className={`${styles.dropItem} ${i === highlighted ? styles.dropItemActive : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); selectResult(r.ticker); }}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  <span className={styles.dropTicker}>{r.ticker}</span>
                  <span className={styles.dropName}>{r.name}</span>
                  {r.exchange && <span className={styles.dropExchange}>{r.exchange}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? (
            progress
              ? <span className={styles.progressText}>{progress.split('(')[0].trim()}</span>
              : <span className={styles.spinner} />
          ) : (
            isBulk ? t('addTicker.addAllButton') : t('addTicker.addButton')
          )}
        </button>
      </div>
      {progress && <p className={styles.progress}>{progress}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
