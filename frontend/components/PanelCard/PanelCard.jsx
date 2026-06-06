import styles from './PanelCard.module.scss';

export function PanelCard({ title, actions, className, children }) {
  return (
    <section className={`${styles.panel} ${className ?? ''}`}>
      {(title || actions) && (
        <div className={styles.header}>
          {title && <span className={styles.title}>{title}</span>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
