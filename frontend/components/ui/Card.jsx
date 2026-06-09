import { forwardRef } from 'react';
import styles from './Card.module.scss';

/**
 * Shared Card surface — consistent panel look across user + admin screens.
 * variant: default | elevated | subtle
 * padding: none | sm | md | lg
 * interactive: hover-lift affordance (for clickable cards)
 */
export const Card = forwardRef(function Card(
  { variant = 'default', padding = 'md', interactive = false, as: Comp = 'div', className = '', children, ...rest },
  ref,
) {
  const cls = [
    styles.card,
    variant !== 'default' && styles[variant],
    styles[`pad-${padding}`],
    interactive && styles.interactive,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Comp ref={ref} className={cls} {...rest}>
      {children}
    </Comp>
  );
});
