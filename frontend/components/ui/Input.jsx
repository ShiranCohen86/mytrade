import { forwardRef, useId } from 'react';
import { Field } from './Field';
import styles from './Input.module.scss';

/**
 * Shared Input primitive — label + control + hint/error, with leading/trailing affixes.
 * Renders at ≥16px on touch/small screens (via Input.module.scss) so iOS never zoom-focuses.
 * size: md (44px) | lg (50px).
 */
export const Input = forwardRef(function Input(
  { label, hint, error, id, size = 'md', leading, trailing, className = '', ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId}>
      <div
        className={[styles.control, styles[`size-${size}`], error && styles.invalid]
          .filter(Boolean)
          .join(' ')}
      >
        {leading && <span className={styles.affix}>{leading}</span>}
        <input
          id={inputId}
          ref={ref}
          className={[styles.input, className].filter(Boolean).join(' ')}
          aria-invalid={error ? 'true' : undefined}
          {...rest}
        />
        {trailing && <span className={styles.affix}>{trailing}</span>}
      </div>
    </Field>
  );
});
