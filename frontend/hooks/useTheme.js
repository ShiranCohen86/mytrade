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

  // Sync theme changes across all hook instances on the same page
  useEffect(() => {
    const handler = (e) => setPref(e.detail);
    window.addEventListener('mytrade:theme', handler);
    return () => window.removeEventListener('mytrade:theme', handler);
  }, []);

  const setTheme = (t) => {
    setPref(t);
    window.dispatchEvent(new CustomEvent('mytrade:theme', { detail: t }));
  };
  const toggle = () => {
    const next = pref === 'light' ? 'dark' : pref === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  return { theme, pref, setTheme, toggle };
}
