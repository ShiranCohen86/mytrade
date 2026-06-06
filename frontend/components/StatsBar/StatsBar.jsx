import styles from './StatsBar.module.scss';

export function StatsBar({ items }) {
  const visible = items.filter((item) => item.value && item.value !== '—');
  if (!visible.length) return null;

  return (
    <div className={styles.bar} role="region" aria-label="Stock statistics">
      {visible.map((item, i) => (
        <div key={item.label} className={styles.item}>
          <span className={styles.label}>{item.label}</span>
          <span className={`${styles.value} ${item.highlight ? styles[item.highlight] : ''}`}>
            {item.value}
          </span>
          {i < visible.length - 1 && <span className={styles.sep} aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
