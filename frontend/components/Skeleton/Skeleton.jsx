import styles from './Skeleton.module.scss';

/**
 * Shimmer placeholder. Use while content loads instead of a spinner for a
 * calmer, more native-feeling load. `w`/`h` accept any CSS size; `radius`
 * overrides the corner. Respects prefers-reduced-motion (handled in SCSS).
 */
export function Skeleton({ w = '100%', h = 16, radius, className = '', style }) {
  return (
    <span
      className={`${styles.skeleton} ${className}`}
      style={{ width: w, height: h, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

/** A vertical stack of skeleton lines. */
export function SkeletonText({ lines = 3, gap = 8 }) {
  return (
    <span className={styles.stack} style={{ gap }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} w={i === lines - 1 ? '60%' : '100%'} h={12} />
      ))}
    </span>
  );
}

export default Skeleton;
