import styles from './Input.module.scss';

/**
 * Field — label + control wrapper + hint/error line.
 * Use directly to wrap a custom control (select, textarea, toggle); Input uses it internally.
 */
export function Field({ label, hint, error, htmlFor, descId, className = '', children }) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={htmlFor} className={styles.label}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span id={descId} className={styles.error} role="alert">{error}</span>
      ) : hint ? (
        <span id={descId} className={styles.hint}>{hint}</span>
      ) : null}
    </div>
  );
}
