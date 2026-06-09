import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getMarketOverview } from '@/lib/apiClient';
import { getMarketStatus } from '@/lib/marketHours';

const MarketContext = createContext({ regime: 'neutral', session: 'closed', indices: [] });

// Derive a market regime from the index/VIX overview — mirrors MarketOverview's
// mood logic so the badge and ambient tint always agree.
export function deriveRegime(data) {
  if (!Array.isArray(data) || !data.length) return 'neutral';
  const get = (t) => data.find((d) => d.ticker === t);
  const spy = get('SPY')?.changePercent ?? 0;
  const qqq = get('QQQ')?.changePercent ?? 0;
  const vix = get('VIX')?.price ?? 0;
  if (vix >= 25) return 'volatile';
  if (spy >= 0.5 && qqq >= 0.5) return 'bull';
  if (spy <= -0.5 && qqq <= -0.5) return 'bear';
  return 'neutral';
}

/**
 * Provides market regime + session app-wide and reflects them onto <html>
 * (data-regime / data-session) so globals.scss can apply the ambient tint.
 */
export function MarketProvider({ children }) {
  const [indices, setIndices] = useState([]);
  const [regime, setRegime] = useState('neutral');
  const [session, setSession] = useState(() => getMarketStatus());

  const load = useCallback(async () => {
    try {
      const quotes = await getMarketOverview();
      if (Array.isArray(quotes)) {
        setIndices(quotes);
        setRegime(deriveRegime(quotes));
      }
    } catch { /* keep last known / neutral — ambient is non-critical */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const tick = () => setSession(getMarketStatus());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Reflect onto the document root for ambient CSS hooks
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.regime = regime;
    el.dataset.session = session;
    return () => {
      delete el.dataset.regime;
      delete el.dataset.session;
    };
  }, [regime, session]);

  return (
    <MarketContext.Provider value={{ regime, session, indices }}>
      {children}
    </MarketContext.Provider>
  );
}

export const useMarket = () => useContext(MarketContext);
