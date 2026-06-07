
import { useState } from 'react';
import styles from './AddTickerForm.module.scss';

const TICKER_RE = /^[A-Z]{1,5}$/;

function parseTickers(raw) {
  return raw
    .toUpperCase()
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function AddTickerForm({ onAdd }) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const isBulk = value.includes(',') || value.includes(';');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tickers = parseTickers(value);

    if (tickers.length === 0) {
      setError('Enter a valid ticker (e.g. AAPL) or comma-separated list (AAPL, MSFT)');
      return;
    }

    const invalid = tickers.find((t) => !TICKER_RE.test(t));
    if (invalid) {
      setError(`"${invalid}" is not a valid ticker (1–5 letters)`);
      return;
    }

    setError(null);
    setLoading(true);

    if (tickers.length === 1) {
      try {
        await onAdd(tickers[0]);
        setValue('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add ticker');
      } finally {
        setLoading(false);
        setProgress(null);
      }
      return;
    }

    // Bulk mode: add sequentially, collect errors
    const errors = [];
    for (let i = 0; i < tickers.length; i++) {
      setProgress(`Adding ${i + 1}/${tickers.length} (${tickers[i]})…`);
      try {
        await onAdd(tickers[i]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to add ${tickers[i]}`;
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
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.inputRow}>
        <input
          type="text"
          className={styles.input}
          placeholder={isBulk ? 'AAPL, MSFT, TSLA' : 'Add ticker (e.g. AAPL)'}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 50))}
          onBlur={(e) => {
            if (!e.target.value.includes(',') && !e.target.value.includes(';')) {
              setValue(e.target.value.toUpperCase().slice(0, 5));
            }
          }}
          disabled={loading}
          maxLength={50}
          spellCheck={false}
          autoComplete="off"
          aria-label="Add stock ticker or comma-separated list"
        />
        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? (
            progress ? <span className={styles.progressText}>{progress.split('(')[0].trim()}</span> : <span className={styles.spinner} />
          ) : (
            isBulk ? '+ Add All' : '+ Add'
          )}
        </button>
      </div>
      {progress && <p className={styles.progress}>{progress}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
