import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'mytrade-currency';
const FALLBACK_RATE = 3.72; // approximate USD → ILS fallback

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'USD'; } catch { return 'USD'; }
  });
  const [rate, setRate] = useState(FALLBACK_RATE);

  useEffect(() => {
    let cancelled = false;
    async function fetchRate() {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        if (!cancelled && data?.rates?.ILS) setRate(data.rates.ILS);
      } catch {
        // keep fallback rate
      }
    }
    fetchRate();
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback(() => {
    setCurrency((prev) => {
      const next = prev === 'USD' ? 'ILS' : 'USD';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency, rate, toggle }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
