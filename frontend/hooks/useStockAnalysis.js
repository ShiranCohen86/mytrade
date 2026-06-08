
import { useState, useEffect, useCallback } from 'react';
import { getAnalysis, refreshStock, getQuote } from '@/lib/apiClient';
import { isMarketActive } from '@/lib/marketHours';

export function useStockAnalysis(ticker) {
  const [stock, setStock] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // B7, B8: AbortController aborts on ticker change; clear stale data immediately
  useEffect(() => {
    if (!ticker) return;
    const controller = new AbortController();
    setStock(null);
    setError(null);
    setIsLoading(true);

    getAnalysis(ticker, controller.signal)
      .then((data) => { setStock(data); setError(null); })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Failed to load analysis');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [ticker]);

  // B4: Live price polling — updates price/change only, every 10 seconds during market hours
  useEffect(() => {
    if (!ticker) return;
    const interval = setInterval(async () => {
      if (document.visibilityState === 'hidden') return;
      if (!isMarketActive()) return;
      try {
        const q = await getQuote(ticker);
        setStock((prev) =>
          prev
            ? { ...prev, cachedData: { ...prev.cachedData, price: q.price, change: q.change, changePercent: q.changePercent } }
            : prev
        );
      } catch { /* silent — polling failures don't need to surface */ }
    }, 10_000);
    return () => clearInterval(interval);
  }, [ticker]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const updated = await refreshStock(ticker);
      setStock(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  }, [ticker]);

  return { stock, isLoading, isRefreshing, error, refresh };
}
