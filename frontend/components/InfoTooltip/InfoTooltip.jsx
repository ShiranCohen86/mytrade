
import { useState, useRef, useEffect, useId } from 'react';
import styles from './InfoTooltip.module.scss';

export function InfoTooltip({ content, position = 'top' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label="More info"
        aria-describedby={tooltipId}
      >
        ⓘ
      </button>
      <div
        id={tooltipId}
        className={[styles.tooltip, styles[position], open ? styles.open : ''].join(' ')}
        role="tooltip"
      >
        {content}
        <span className={styles.arrow} />
      </div>
    </div>
  );
}
