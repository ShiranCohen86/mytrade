import { useEffect, useRef, useState } from 'react';

/**
 * Returns 'up' | 'down' | null briefly whenever `value` changes between renders.
 * Drives the live price-tick flash. Respects prefers-reduced-motion globally
 * (the flash animation is neutralized by the global reduced-motion rule).
 */
export function usePriceFlash(value, { duration = 900 } = {}) {
  const prev = useRef(null);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const p = prev.current;
    if (p != null && value != null && value !== p) {
      setFlash(value > p ? 'up' : 'down');
      prev.current = value;
      const t = setTimeout(() => setFlash(null), duration);
      return () => clearTimeout(t);
    }
    if (value != null) prev.current = value;
  }, [value, duration]);

  return flash;
}
