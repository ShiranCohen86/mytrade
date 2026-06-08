
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useStocks } from '@/hooks/useStocks';
import { WatchlistTable } from '@/components/WatchlistTable/WatchlistTable';
import { SummaryStrip } from '@/components/SummaryStrip/SummaryStrip';
import { WatchlistSummary } from '@/components/WatchlistSummary/WatchlistSummary';
import { AddTickerForm } from '@/components/AddTickerForm/AddTickerForm';
import { EarningsCalendar } from '@/components/EarningsCalendar/EarningsCalendar';
import { MarketOverview } from '@/components/MarketOverview/MarketOverview';
import { TopMovers } from '@/components/TopMovers/TopMovers';
import { WelcomeCard } from '@/components/Onboarding/WelcomeCard';
import { useToast } from '@/components/Toast/ToastProvider';
import styles from './page.module.scss';

function sortStocks(stocks, key, portfolio) {
  if (key === 'default') return stocks;
  return [...stocks].sort((a, b) => {
    switch (key) {
      case 'risk-desc': return (b.analysis?.riskScore ?? 0) - (a.analysis?.riskScore ?? 0);
      case 'expectation-desc': return (b.analysis?.expectationScore ?? 0) - (a.analysis?.expectationScore ?? 0);
      case 'name-asc': return (a.name || a.ticker).localeCompare(b.name || b.ticker);
      case 'change-desc': return (b.cachedData?.changePercent ?? -Infinity) - (a.cachedData?.changePercent ?? -Infinity);
      case 'pnl-desc': {
        const getPnl = (s) => {
          const entry = portfolio?.find((p) => p.ticker === s.ticker);
          if (!entry || s.cachedData?.price == null) return -Infinity;
          return ((s.cachedData.price - entry.entryPrice) / entry.entryPrice) * 100;
        };
        return getPnl(b) - getPnl(a);
      }
      default: return 0;
    }
  });
}

export default function DashboardPage() {
  const {
    stocks, isLoading, isAnalyzing, analyzingTickers, analysisErrors,
    isConnected, error, portfolio, priceAlerts, notes,
    add, remove, analyzeAll, analyzeTicker, reload, updateEntryPrice, updateAlert, updateNote, reorder,
  } = useStocks();

  const toast = useToast();
  const prevAnalyzingRef = useRef(false);
  const alertsTriggeredRef = useRef(null);

  const [sortKey, setSortKey] = useState(() => {
    try { return localStorage.getItem('watchlist-sort') || 'default'; } catch { return 'default'; }
  });
  const [dismissedError, setDismissedError] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onOutside = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => { document.removeEventListener('mousedown', onOutside); document.removeEventListener('touchstart', onOutside); };
  }, [moreOpen]);

  // Press "r" to reload; "a" to analyze all — when not typing in a field
  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      if (e.key === 'r' && !isLoading && !isAnalyzing) reload();
      if (e.key === 'a' && !isAnalyzing && stocks.length > 0) analyzeAll();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [reload, analyzeAll, isLoading, isAnalyzing, stocks.length]);

  useEffect(() => {
    try { localStorage.setItem('watchlist-sort', sortKey); } catch { /* storage unavailable */ }
  }, [sortKey]);

  const sortedStocks = useMemo(() => sortStocks(stocks, sortKey, portfolio), [stocks, sortKey, portfolio]);

  // Toast when analysis finishes
  useEffect(() => {
    if (prevAnalyzingRef.current && !isAnalyzing && stocks.length > 0) {
      const n = stocks.length;
      const failed = analysisErrors.size;
      if (failed === 0) {
        toast.success(`Analysis complete — ${n} stock${n !== 1 ? 's' : ''} updated.`);
      } else {
        toast.warning(`Analysis complete — ${n - failed} updated, ${failed} failed.`);
      }
    }
    prevAnalyzingRef.current = isAnalyzing;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalyzing]);

  // Fire toast when a price alert triggers for the first time in this session
  useEffect(() => {
    if (!stocks.length || !priceAlerts.length) return;
    const nowTriggered = new Set();
    for (const alert of priceAlerts) {
      const stock = stocks.find((s) => s.ticker === alert.ticker);
      const price = stock?.cachedData?.price;
      if (price == null) continue;
      const hit = alert.direction === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice;
      if (hit) nowTriggered.add(alert.ticker);
    }
    if (alertsTriggeredRef.current !== null) {
      for (const ticker of nowTriggered) {
        if (!alertsTriggeredRef.current.has(ticker)) {
          const alert = priceAlerts.find((a) => a.ticker === ticker);
          const stock = stocks.find((s) => s.ticker === ticker);
          const price = stock?.cachedData?.price;
          toast.warning(
            `${ticker} alert: ${alert.direction === 'above' ? '▲' : '▼'} $${alert.targetPrice.toFixed(2)} — now $${price?.toFixed(2)}`,
            0
          );
        }
      }
    }
    alertsTriggeredRef.current = nowTriggered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks, priceAlerts]);

  const showError = error && error !== dismissedError;

  const handleAdd = useCallback(async (ticker) => {
    await add(ticker);
    toast.success(`${ticker.toUpperCase()} added to watchlist.`);
    setTimeout(() => {
      document.querySelector(`[data-ticker="${ticker.toUpperCase()}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, [add, toast]);

  const exportCSV = useCallback(() => {
    const headers = ['Ticker', 'Name', 'Sector', 'Price', 'Change%', 'Risk Score', 'Risk Label', 'Expectation Score', 'Expectation Label', 'Market Regime', 'Earnings Date', 'Analyzed At'];
    const rows = stocks.map((s) => [
      s.ticker,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.sector || '').replace(/"/g, '""')}"`,
      s.cachedData?.price?.toFixed(2) ?? '',
      s.cachedData?.changePercent?.toFixed(2) ?? '',
      s.analysis?.riskScore ?? '',
      s.analysis?.riskLabel ?? '',
      s.analysis?.expectationScore ?? '',
      s.analysis?.expectationLabel ?? '',
      s.analysis?.marketRegime ?? '',
      s.cachedData?.earningsDate ? new Date(s.cachedData.earningsDate).toISOString().split('T')[0] : '',
      s.analysis?.analyzedAt ? new Date(s.analysis.analyzedAt).toISOString().split('T')[0] : '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mytrade-watchlist-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${stocks.length} stock${stocks.length !== 1 ? 's' : ''} to CSV.`);
  }, [stocks, toast]);

  return (
    <div className={styles.page}>
      <MarketOverview />

      {/* Workspace toolbar */}
      <div className={styles.toolbar}>
        {/* Row 1: title + desktop actions */}
        <div className={styles.toolbarRow}>
          <div className={styles.toolbarLeft}>
            <span className={styles.pageTitle}>Watchlist</span>
            {stocks.length > 0 && (
              <span className={styles.stockCount}>{stocks.length}</span>
            )}
          </div>
          <div className={styles.toolbarRight}>
            {/* Desktop-only secondary actions */}
            {stocks.length > 0 && (
              <div className={styles.desktopActions}>
                <EarningsCalendar stocks={stocks} />
                <button className={styles.toolBtn} onClick={exportCSV} title="Export to CSV">
                  ↓ CSV
                </button>
                <button
                  className={styles.toolBtn}
                  onClick={reload}
                  disabled={isLoading || isAnalyzing}
                  title="Reload from server"
                >
                  ↺ Reload
                </button>
              </div>
            )}
            {stocks.length > 0 && (
              <button
                className={`${styles.toolBtn} ${styles.analyzeBtn} ${isAnalyzing ? styles.analyzeBtnActive : ''}`}
                onClick={analyzeAll}
                disabled={isAnalyzing}
                title="Run full analysis on all stocks"
              >
                {isAnalyzing ? (
                  <><span className={styles.spinning}>⟳</span> Analyzing…</>
                ) : (
                  '⟳ Analyze All'
                )}
              </button>
            )}
            <AddTickerForm onAdd={handleAdd} />
          </div>
        </div>

        {/* Mobile-only row 2: overflow more menu */}
        {stocks.length > 0 && (
          <div className={styles.mobileActionsRow}>
            <div ref={moreRef} className={styles.moreWrap}>
              <button
                className={styles.toolBtn}
                onClick={() => setMoreOpen((v) => !v)}
                aria-label="More actions"
                aria-expanded={moreOpen}
              >
                ⋯ More
              </button>
              {moreOpen && (
                <div className={styles.moreDropdown} role="menu">
                  <EarningsCalendar stocks={stocks} onClose={() => setMoreOpen(false)} />
                  <button
                    className={styles.moreItem}
                    onClick={() => { exportCSV(); setMoreOpen(false); }}
                    role="menuitem"
                  >
                    ↓ Export CSV
                  </button>
                  <button
                    className={styles.moreItem}
                    onClick={() => { reload(); setMoreOpen(false); }}
                    disabled={isLoading || isAnalyzing}
                    role="menuitem"
                  >
                    ↺ Reload
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showError && (
        <div className={styles.errorBanner} role="alert">
          <span>⚠ {error}</span>
          <button
            className={styles.dismissBtn}
            onClick={() => setDismissedError(error)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {isConnected === false && !showError && (
        <div className={styles.offlinePill} role="status" aria-live="polite">
          <span className={styles.offlineDot} />
          No connection — prices may be stale
        </div>
      )}

      {/* Loading state */}
      {isLoading && stocks.length === 0 ? (
        <div className={styles.loadingState}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={styles.skeletonRow} aria-hidden="true">
              <div className={styles.skeletonCell} style={{ width: '52px' }} />
              <div className={styles.skeletonCell} style={{ width: '20%' }} />
              <div className={styles.skeletonCell} style={{ width: '80px' }} />
              <div className={styles.skeletonCell} style={{ width: '60px' }} />
              <div className={styles.skeletonCell} style={{ width: '40px' }} />
            </div>
          ))}
        </div>
      ) : stocks.length === 0 ? (
        /* Empty state */
        <>
        <WelcomeCard />
        <TopMovers />
        <div className={styles.empty}>
          <svg className={styles.emptyIcon} viewBox="0 0 64 48" width="64" height="48" fill="none" aria-hidden="true">
            <polyline points="4,40 18,24 28,32 40,14 52,20 60,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.25"/>
            <circle cx="60" cy="10" r="3" fill="currentColor" opacity="0.25"/>
          </svg>
          <p className={styles.emptyTitle}>Your watchlist is empty</p>
          <p className={styles.emptySubtitle}>
            Add a ticker above to start tracking risk, expectation scores, and earnings events.
          </p>
          <p className={styles.emptyHint}>Try: AAPL · MSFT · NVDA · TSLA</p>
        </div>
        </>
      ) : (
        <>
          <SummaryStrip stocks={stocks} />
          <WatchlistTable
            stocks={sortedStocks}
            analyzingTickers={analyzingTickers}
            analysisErrors={analysisErrors}
            portfolio={portfolio}
            priceAlerts={priceAlerts}
            notes={notes}
            sortKey={sortKey}
            onSortChange={setSortKey}
            onRemove={remove}
            onUpdateEntryPrice={updateEntryPrice}
            onUpdateAlert={updateAlert}
            onUpdateNote={updateNote}
            onReorder={reorder}
            onAnalyzeTicker={analyzeTicker}
          />
          <WatchlistSummary stocks={stocks} />
        </>
      )}
    </div>
  );
}
