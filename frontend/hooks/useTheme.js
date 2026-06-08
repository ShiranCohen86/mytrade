import { useState, useEffect } from 'react';

const STORAGE_KEY = 'mytrade-theme';
const DEFAULT_PREF = 'system';

function resolveTheme(pref) {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function useTheme() {
  const [pref, setPref] = useState(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_PREF
  );
  const [theme, setResolved] = useState(() => resolveTheme(localStorage.getItem(STORAGE_KEY) || DEFAULT_PREF));

  useEffect(() => {
    const apply = () => {
      const r = resolveTheme(pref);
      setResolved(r);
      document.documentElement.setAttribute('data-theme', r);
    };
    apply();
    localStorage.setItem(STORAGE_KEY, pref);

    if (pref === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [pref]);

  const setTheme = (t) => setPref(t);
  const toggle = () => setPref((t) => (t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light'));

  return { theme, pref, setTheme, toggle };
}
