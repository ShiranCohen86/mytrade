
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useStocks } from '@/hooks/useStocks';
import { WatchlistTable } from '@/components/WatchlistTable/WatchlistTable';
import { SummaryStrip } from '@/components/SummaryStrip/SummaryStrip';
import { AddTickerForm } from '@/components/AddTickerForm/AddTickerForm';
import { MarketRegimeBadge } from '@/components/MarketRegimeBadge/MarketRegimeBadge';
import { EarningsCalendar } from '@/components/EarningsCalendar/EarningsCalendar';
import styles from './page.module.scss';

function sortStocks(stocks, key) {
  if (key === 'default') return stocks;
  return [...stocks].sort((a, b) => {
    switch (key) {
      case 'risk-desc': return (b.analysis?.riskScore ?? 0) - (a.analysis?.riskScore ?? 0);
      case 'expectation-desc': return (b.analysis?.expectationScore ?? 0) - (a.analysis?.expectationScore ?? 0);
      case 'name-asc': return (a.name || a.ticker).localeCompare(b.name || b.ticker);
      default: return 0;
    }
  });
}

export default function DashboardPage() {
  const {
    stocks, isLoading, isAnalyzing, analyzingTickers, analysisErrors,
    isConnected, error, portfolio, priceAlerts, notes,
    add, remove, analyzeAll, reload, updateEntryPrice, updateAlert, updateNote, reorder,
  } = useStocks();

  const [sortKey, setSortKey] = useState(() => {
    try { return localStorage.getItem('watchlist-sort') || 'default'; } catch { return 'default'; }
  });
  const [dismissedError, setDismissedError] = useState(null);

  useEffect(() => {
    try { localStorage.setItem('watchlist-sort', sortKey); } catch { /* storage unavailable */ }
  }, [sortKey]);

  const globalRegime = useMemo(() => {
    const counts = {};
    for (const s of stocks) {
      const r = s.analysis?.marketRegime;
      if (r) counts[r] = (counts[r] ?? 0) + 1;
    }
    const entries = Object.entries(counts);
    if (!entries.length) return null;
    return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }, [stocks]);

  const sortedStocks = useMemo(() => sortStocks(stocks, sortKey), [stocks, sortKey]);

  const showError = error && error !== dismissedError;

  const handleAdd = useCallback(async (ticker) => {
    await add(ticker);
    setTimeout(() => {
      document.querySelector(`[data-ticker="${ticker.toUpperCase()}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, [add]);

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
  }, [stocks]);

  return (
    <div className={styles.page}>
      {/* Workspace toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.pageTitle}>Watchlist</span>
          {stocks.length > 0 && (
            <span className={styles.stockCount}>{stocks.length}</span>
          )}
          {globalRegime && <MarketRegimeBadge regime={globalRegime} size="sm" />}
        </div>
        <div className={styles.toolbarRight}>
          {stocks.length > 0 && (
            <>
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
            </>
          )}
          <AddTickerForm onAdd={handleAdd} />
        </div>
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
      ) : (
        <>
          <SummaryStrip stocks={stocks} />
          <WatchlistTable
            stocks={sortedStocks}
            isConnected={isConnected}
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
          />
        </>
      )}
    </div>
  );
}
