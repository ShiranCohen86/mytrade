import styles from './Badge.module.scss';

/**
 * Shared Badge / Pill — one implementation for all status chips.
 * tone: accent | pos | neg | warn | muted | solid
 * size: sm | md
 * dot:  show a leading status dot
 */
export function Badge({ tone = 'muted', size = 'md', dot = false, className = '', children, ...rest }) {
  const cls = [styles.badge, styles[tone], size === 'sm' && styles.sm, className].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}

// Alias for call sites that read better as "Pill"
export const Pill = Badge;
