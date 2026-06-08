
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getStocks, addStock, removeStock, refreshStock, getQuotes, checkHealth,
  getPortfolio, setEntryPrice, clearEntryPrice,
  getAlerts, setAlert, clearAlert,
  getNotes, saveNote, deleteNote,
  reorderWatchlist,
} from '@/lib/apiClient';
import { isMarketActive } from '@/lib/marketHours';

export function useStocks() {
  const [stocks, setStocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConnected, setIsConnected] = useState(null);
  const [error, setError] = useState(null);
  const [analyzingTickers, setAnalyzingTickers] = useState(new Set());
  const [analysisErrors, setAnalysisErrors] = useState(new Map());
  const [portfolio, setPortfolio] = useState([]);
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [notes, setNotes] = useState([]);

  const pollRef = useRef(undefined);
  const stocksRef = useRef(stocks);
  const pollAbortRef = useRef(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [stocksResult, portResult, alertsResult, notesResult] = await Promise.allSettled([
        getStocks(), getPortfolio(), getAlerts(), getNotes(),
      ]);

      if (stocksResult.status === 'fulfilled') {
        setStocks(stocksResult.value);
        setIsConnected(true);
        setError(null);
      } else {
        setIsConnected(false);
        setError(stocksResult.reason instanceof Error ? stocksResult.reason.message : 'Failed to load stocks');
      }

      if (portResult.status === 'fulfilled') setPortfolio(portResult.value);
      if (alertsResult.status === 'fulfilled') setPriceAlerts(alertsResult.value);
      if (notesResult.status === 'fulfilled') setNotes(notesResult.value);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live price poll — updates price/change only; skips when tab is hidden or market is closed
  const pollPrices = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    if (!isMarketActive()) return;
    // Abort any previous in-flight poll
    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;
    try {
      const quotes = await getQuotes(controller.signal);
      if (!Array.isArray(quotes)) throw new Error('Invalid quotes response');
      setIsConnected(true);
      setStocks((prev) => {
        if (prev.length === 0) return prev;
        return prev.map((s) => {
          const q = quotes.find((q) => q.ticker === s.ticker);
          if (!q || q.price == null) return s;
          return {
            ...s,
            cachedData: {
              ...s.cachedData,
              price: q.price, change: q.change, changePercent: q.changePercent,
              marketState: q.marketState ?? s.cachedData?.marketState,
              preMarketPrice: q.preMarketPrice ?? null,
              preMarketChange: q.preMarketChange ?? null,
              preMarketChangePercent: q.preMarketChangePercent ?? null,
              postMarketPrice: q.postMarketPrice ?? null,
              postMarketChange: q.postMarketChange ?? null,
              postMarketChangePercent: q.postMarketChangePercent ?? null,
            },
          };
        });
      });
    } catch (err) {
      if (err.name !== 'AbortError') setIsConnected(false);
    }
  }, []);

  // Keep refs current
  useEffect(() => { pollRef.current = pollPrices; }, [pollPrices]);
  useEffect(() => { stocksRef.current = stocks; }, [stocks]);

  // 15-second polling interval; abort in-flight on unmount
  useEffect(() => {
    const interval = setInterval(() => pollRef.current?.(), 15_000);
    return () => {
      clearInterval(interval);
      pollAbortRef.current?.abort();
    };
  }, []);

  // Poll immediately when tab regains focus (prices may be stale after background)
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') pollRef.current?.();
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, []);

  // React to browser-level online/offline events immediately
  useEffect(() => {
    const handleOffline = () => setIsConnected(false);
    // B2: ping /health before going green (verify backend is up, not just browser online)
    const handleOnline = async () => {
      try {
        await checkHealth();
        setIsConnected(true);
        pollRef.current?.();
      } catch {
        setIsConnected(false);
      }
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const add = useCallback(async (ticker) => {
    const stock = await addStock(ticker);
    setStocks((prev) => [...prev, stock]);
    return stock;
  }, []);

  const remove = useCallback(async (ticker) => {
    try {
      await removeStock(ticker);
      setStocks((prev) => prev.filter((s) => s.ticker !== ticker));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to remove ${ticker}`);
    }
  }, []);

  // analyzeAll processes in batches of 5 to avoid overwhelming the backend.
  // Uses stocksRef so this callback is stable and not recreated on every price poll.
  const analyzeAll = useCallback(async () => {
    if (stocksRef.current.length === 0) return;
    setIsAnalyzing(true);
    setError(null);
    setAnalysisErrors(new Map());

    const tickersToRefresh = stocksRef.current.map((s) => s.ticker);
    setAnalyzingTickers(new Set(tickersToRefresh));

    const BATCH = 5;
    const allResults = [];

    try {
      for (let i = 0; i < tickersToRefresh.length; i += BATCH) {
        const batch = tickersToRefresh.slice(i, i + BATCH);
        const batchResults = await Promise.allSettled(
          batch.map(async (ticker) => {
            try {
              return await refreshStock(ticker);
            } finally {
              setAnalyzingTickers((prev) => {
                const next = new Set(prev);
                next.delete(ticker);
                return next;
              });
            }
          })
        );
        allResults.push(...batchResults.map((r, j) => ({ result: r, ticker: batch[j] })));
      }

      const updated = [];
      const newErrors = new Map();

      allResults.forEach(({ result: r, ticker }) => {
        if (r.status === 'fulfilled') {
          updated.push(r.value);
        } else {
          newErrors.set(ticker, r.reason?.message || 'Analysis failed');
        }
      });

      if (updated.length > 0) {
        setStocks((prev) =>
          prev.map((s) => {
            const fresh = updated.find((u) => u.ticker === s.ticker);
            return fresh ?? s;
          })
        );
      }

      if (newErrors.size > 0) {
        setAnalysisErrors(newErrors);
        setError(`Analysis failed for: ${Array.from(newErrors.keys()).join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
      setAnalyzingTickers(new Set());
    }
  }, []);

  const updateEntryPrice = useCallback(async (ticker, entryPrice, shares = null) => {
    if (entryPrice === null) {
      await clearEntryPrice(ticker);
      setPortfolio((prev) => prev.filter((p) => p.ticker !== ticker));
    } else {
      const entry = await setEntryPrice(ticker, entryPrice, shares);
      setPortfolio((prev) => {
        const idx = prev.findIndex((p) => p.ticker === ticker);
        if (idx >= 0) return prev.map((p) => (p.ticker === ticker ? entry : p));
        return [...prev, entry];
      });
    }
  }, []);

  const updateAlert = useCallback(async (ticker, targetPrice, direction = 'above') => {
    if (targetPrice === null) {
      await clearAlert(ticker);
      setPriceAlerts((prev) => prev.filter((a) => a.ticker !== ticker));
    } else {
      const alert = await setAlert(ticker, targetPrice, direction);
      setPriceAlerts((prev) => {
        const idx = prev.findIndex((a) => a.ticker === ticker);
        if (idx >= 0) return prev.map((a) => (a.ticker === ticker ? alert : a));
        return [...prev, alert];
      });
    }
  }, []);

  const updateNote = useCallback(async (ticker, text) => {
    if (text === null || text.trim() === '') {
      await deleteNote(ticker);
      setNotes((prev) => prev.filter((n) => n.ticker !== ticker));
    } else {
      const note = await saveNote(ticker, text);
      setNotes((prev) => {
        const idx = prev.findIndex((n) => n.ticker === ticker);
        if (idx >= 0) return prev.map((n) => (n.ticker === ticker ? note : n));
        return [...prev, note];
      });
    }
  }, []);

  const analyzeTicker = useCallback(async (ticker) => {
    setAnalyzingTickers((prev) => new Set([...prev, ticker]));
    setAnalysisErrors((prev) => {
      const next = new Map(prev);
      next.delete(ticker);
      return next;
    });
    try {
      const fresh = await refreshStock(ticker);
      setStocks((prev) => prev.map((s) => (s.ticker === ticker ? fresh : s)));
    } catch (err) {
      setAnalysisErrors((prev) =>
        new Map([...prev, [ticker, err instanceof Error ? err.message : 'Analysis failed']])
      );
    } finally {
      setAnalyzingTickers((prev) => {
        const next = new Set(prev);
        next.delete(ticker);
        return next;
      });
    }
  }, []);

  const reorder = useCallback(async (newOrder) => {
    setStocks((prev) => {
      const map = new Map(prev.map((s) => [s.ticker, s]));
      const reordered = newOrder.map((t) => map.get(t)).filter(Boolean);
      const rest = prev.filter((s) => !newOrder.includes(s.ticker));
      return [...reordered, ...rest];
    });
    await reorderWatchlist(newOrder);
  }, []);

  return {
    stocks, isLoading, isAnalyzing, analyzingTickers, analysisErrors, isConnected, error,
    portfolio, priceAlerts, notes,
    add, remove, analyzeAll, analyzeTicker, reload: load,
    updateEntryPrice, updateAlert, updateNote, reorder,
  };
}
