
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useStocks } from '@/hooks/useStocks';
import { WatchlistTable } from '@/components/WatchlistTable/WatchlistTable';
import { SummaryStrip } from '@/components/SummaryStrip/SummaryStrip';
import { WatchlistSummary } from '@/components/WatchlistSummary/WatchlistSummary';
import { AddTickerForm } from '@/components/AddTickerForm/AddTickerForm';
import { EarningsCalendar } from '@/components/EarningsCalendar/EarningsCalendar';
import { MarketOverview } from '@/components/MarketOverview/MarketOverview';
import { TopMovers } from '@/components/TopMovers/TopMovers';
import { BottomSheet } from '@/components/BottomSheet/BottomSheet';
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
  const [moversOpen, setMoversOpen] = useState(false);
  const moreRef = useRef(null);
  const [sectorFilter, setSectorFilter] = useState(null);
  const [riskFilter, setRiskFilter] = useState(null);
  const [earningsFilter, setEarningsFilter] = useState(null);
  const importRef = useRef(null);

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

  const sectors = useMemo(() => (
    [...new Set(stocks.map((s) => s.sector || 'Unknown'))].sort()
  ), [stocks]);

  const filteredStocks = useMemo(() => {
    let result = sortedStocks;
    if (sectorFilter) result = result.filter((s) => (s.sector || 'Unknown') === sectorFilter);
    if (riskFilter) result = result.filter((s) => {
      const sc = s.analysis?.riskScore;
      if (sc == null) return false;
      if (riskFilter === 'high') return sc >= 70;
      if (riskFilter === 'medium') return sc >= 40 && sc < 70;
      return sc < 40;
    });
    if (earningsFilter === 'soon') result = result.filter((s) => {
      const ed = s.cachedData?.earningsDate;
      if (!ed) return false;
      const days = Math.ceil((new Date(ed).getTime() - Date.now()) / 86_400_000);
      return days >= 0 && days <= 14;
    });
    return result;
  }, [sortedStocks, sectorFilter, riskFilter, earningsFilter]);

  const hasActiveFilters = sectorFilter !== null || riskFilter !== null || earningsFilter !== null;
  const clearFilters = useCallback(() => { setSectorFilter(null); setRiskFilter(null); setEarningsFilter(null); }, []);

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
    const target = hasActiveFilters ? filteredStocks : stocks;
    const headers = ['Ticker', 'Name', 'Sector', 'Price', 'Change%', 'Risk Score', 'Risk Label', 'Expectation Score', 'Expectation Label', 'Market Regime', 'Earnings Date', 'Analyzed At'];
    const rows = target.map((s) => [
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
    toast.success(`Exported ${target.length} stock${target.length !== 1 ? 's' : ''} to CSV.`);
  }, [stocks, filteredStocks, hasActiveFilters, toast]);

  const handleImportFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!importRef.current) return;
    importRef.current.value = '';
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) { toast.error('CSV file is empty.'); return; }
    // Auto-detect ticker column: look for header row with "ticker" (case-insensitive)
    const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const tickerIdx = header.indexOf('ticker');
    const dataLines = tickerIdx >= 0 ? lines.slice(1) : lines;
    const existing = new Set(stocks.map((s) => s.ticker));
    const tickers = [...new Set(
      dataLines
        .map((l) => {
          const col = tickerIdx >= 0 ? l.split(',')[tickerIdx] : l.split(',')[0];
          return (col || '').trim().replace(/^"|"$/g, '').toUpperCase();
        })
        .filter((t) => /^[A-Z]{1,5}$/.test(t) && !existing.has(t))
    )];
    if (!tickers.length) { toast.warning('No new valid tickers found in CSV.'); return; }
    toast.info(`Importing ${tickers.length} ticker${tickers.length !== 1 ? 's' : ''}…`);
    let added = 0;
    for (const t of tickers) {
      try { await add(t); added++; } catch { /* skip invalid */ }
    }
    if (added > 0) toast.success(`Added ${added} ticker${added !== 1 ? 's' : ''} from CSV.`);
    else toast.error('No tickers could be added.');
  }, [stocks, add, toast]);

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
              <span className={styles.stockCount}>
                {hasActiveFilters ? `${filteredStocks.length} / ${stocks.length}` : stocks.length}
              </span>
            )}
          </div>
          <div className={styles.toolbarRight}>
            {/* Desktop-only secondary actions */}
            {stocks.length > 0 && (
              <div className={styles.desktopActions}>
                <button className={styles.toolBtn} onClick={() => setMoversOpen(true)} title="Today's top movers">
                  ↑↓ Movers
                </button>
                <EarningsCalendar stocks={stocks} />
                <button className={styles.toolBtn} onClick={exportCSV} title="Export to CSV">
                  ↓ CSV
                </button>
                <button className={styles.toolBtn} onClick={() => importRef.current?.click()} title="Import tickers from CSV">
                  ↑ Import
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
                  <button
                    className={styles.moreItem}
                    onClick={() => { setMoversOpen(true); setMoreOpen(false); }}
                    role="menuitem"
                  >
                    ↑↓ Market Movers
                  </button>
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
                    onClick={() => { importRef.current?.click(); setMoreOpen(false); }}
                    role="menuitem"
                  >
                    ↑ Import CSV
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
        <TopMovers onAdd={handleAdd} />
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
          {/* Filter bar */}
          <div className={styles.filterBar}>
            <div className={styles.filterScroll}>
              <button
                className={`${styles.filterPill} ${styles.filterPillHighRisk} ${riskFilter === 'high' ? styles.filterPillActive : ''}`}
                onClick={() => setRiskFilter(riskFilter === 'high' ? null : 'high')}
              >
                High Risk
              </button>
              <button
                className={`${styles.filterPill} ${styles.filterPillMedRisk} ${riskFilter === 'medium' ? styles.filterPillActive : ''}`}
                onClick={() => setRiskFilter(riskFilter === 'medium' ? null : 'medium')}
              >
                Med Risk
              </button>
              <button
                className={`${styles.filterPill} ${styles.filterPillLowRisk} ${riskFilter === 'low' ? styles.filterPillActive : ''}`}
                onClick={() => setRiskFilter(riskFilter === 'low' ? null : 'low')}
              >
                Low Risk
              </button>
              <span className={styles.filterDivider} aria-hidden="true" />
              <button
                className={`${styles.filterPill} ${earningsFilter === 'soon' ? styles.filterPillActive : ''}`}
                onClick={() => setEarningsFilter(earningsFilter === 'soon' ? null : 'soon')}
              >
                Earnings ≤14d
              </button>
              {sectors.length > 1 && <span className={styles.filterDivider} aria-hidden="true" />}
              {sectors.length > 1 && sectors.map((s) => (
                <button
                  key={s}
                  className={`${styles.filterPill} ${sectorFilter === s ? styles.filterPillActive : ''}`}
                  onClick={() => setSectorFilter(sectorFilter === s ? null : s)}
                >
                  {s}
                </button>
              ))}
            </div>
            {hasActiveFilters && (
              <button className={styles.filterClear} onClick={clearFilters} aria-label="Clear all filters">
                Clear
              </button>
            )}
          </div>

          <SummaryStrip stocks={stocks} />

          {filteredStocks.length === 0 ? (
            <div className={styles.filterEmpty}>
              No stocks match the current filters.{' '}
              <button className={styles.filterEmptyLink} onClick={clearFilters}>Clear filters</button>
            </div>
          ) : (
            <>
              <WatchlistTable
                stocks={filteredStocks}
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
        </>
      )}

      {moversOpen && (
        <BottomSheet title="Market Movers" onClose={() => setMoversOpen(false)}>
          <div style={{ padding: '16px' }}>
            <TopMovers onAdd={(ticker) => { handleAdd(ticker); setMoversOpen(false); }} />
          </div>
        </BottomSheet>
      )}

      {/* Hidden file input for CSV import */}
      <input
        ref={importRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
    </div>
  );
}
