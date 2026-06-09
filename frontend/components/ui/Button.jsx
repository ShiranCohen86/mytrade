import { forwardRef } from 'react';
import styles from './Button.module.scss';

/**
 * Shared Button primitive.
 * variant: primary | secondary | ghost | danger | pos | neg
 * size:    sm | md | lg   (md/lg guarantee a ≥44px touch target)
 * iconOnly: square icon button
 * loading:  shows a spinner and disables interaction
 * as:       render a different element/component (e.g. Link, 'a')
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    iconOnly = false,
    loading = false,
    as: Comp = 'button',
    type,
    className = '',
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const cls = [
    styles.btn,
    styles[variant],
    styles[`size-${size}`],
    iconOnly && styles.iconOnly,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const extra = Comp === 'button' ? { type: type || 'button' } : {};

  return (
    <Comp
      ref={ref}
      className={cls}
      disabled={Comp === 'button' ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      {...extra}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </Comp>
  );
});
