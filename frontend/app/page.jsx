
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStocks } from '@/hooks/useStocks';
import { WatchlistTable } from '@/components/WatchlistTable/WatchlistTable';
import { WatchlistSummary } from '@/components/WatchlistSummary/WatchlistSummary';
import { AddTickerForm } from '@/components/AddTickerForm/AddTickerForm';
import { EarningsCalendar } from '@/components/EarningsCalendar/EarningsCalendar';
import { MarketOverview } from '@/components/MarketOverview/MarketOverview';
import { TopMovers } from '@/components/TopMovers/TopMovers';
import { BottomSheet } from '@/components/BottomSheet/BottomSheet';
import { WelcomeCard } from '@/components/Onboarding/WelcomeCard';
import { useToast } from '@/components/Toast/ToastProvider';
import { useAppShell } from '@/components/AppShell/AppShell';
import { track, EV } from '@/lib/analytics';
import styles from './page.module.scss';

// Skip the auto-analyze on dashboard entry when every stock was analyzed within
// this window — avoids re-running a full watchlist analysis on every navigation.
const AUTO_ANALYZE_STALE_MS = 4 * 60 * 60 * 1000;

// Prevent CSV/Excel formula injection: prefix cells that begin with a formula
// trigger (= + - @) so spreadsheets treat them as plain text.
const csvSafe = (v) => {
  const s = String(v ?? '');
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
};

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
          const price = s.cachedData?.price;
          if (price == null) return -Infinity;
          const entry = portfolio?.find((p) => p.ticker === s.ticker);
          if (entry) return ((price - entry.entryPrice) / entry.entryPrice) * 100;
          return s.stockPriceAtAdd != null ? ((price - s.stockPriceAtAdd) / s.stockPriceAtAdd) * 100 : -Infinity;
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
  const { t } = useTranslation();
  const { setRefreshHandler } = useAppShell();

  // Drive pull-to-refresh from the app shell.
  useEffect(() => {
    setRefreshHandler(reload);
    return () => setRefreshHandler(null);
  }, [setRefreshHandler, reload]);

  // Web Share Target: if the app was opened via a share, try to add the ticker.
  const sharedRef = useRef(false);
  useEffect(() => {
    if (sharedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const shared = `${params.get('text') || ''} ${params.get('title') || ''} ${params.get('url') || ''}`.trim();
    if (!shared) return;
    sharedRef.current = true;
    const m = shared.match(/\$?\b([A-Za-z]{1,5})\b/);
    const ticker = m ? m[1].toUpperCase() : null;
    track(EV.SHARE_TARGET_RECEIVED, { ticker });
    // Strip the share params from the URL.
    window.history.replaceState({}, '', '/dashboard');
    if (ticker) {
      add(ticker)
        .then(() => toast.success(`${ticker} added to your watchlist`))
        .catch((e) => toast.error(e.message || `Couldn't add ${ticker}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const alertsTriggeredRef = useRef(null);

  const [sortKey, setSortKey] = useState(() => {
    try { return localStorage.getItem('watchlist-sort') || 'default'; } catch { return 'default'; }
  });
  const [dismissedError, setDismissedError] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moversOpen, setMoversOpen] = useState(false);
  const moreRef = useRef(null);
  const hasAutoAnalyzed = useRef(false);
  const [sectorFilter, setSectorFilter] = useState(null);
  const [riskFilter, setRiskFilter] = useState(null);
  const [earningsFilter, setEarningsFilter] = useState(null);
  const [staleFilter, setStaleFilter] = useState(false);
  const [expectFilter, setExpectFilter] = useState(null);
  const [regimeFilter, setRegimeFilter] = useState(null);
  const [groupBySector, setGroupBySector] = useState(false);
  const importRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onOutside = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => { document.removeEventListener('mousedown', onOutside); document.removeEventListener('touchstart', onOutside); };
  }, [moreOpen]);

  useEffect(() => {
    if (isLoading || stocks.length === 0 || hasAutoAnalyzed.current) return;
    hasAutoAnalyzed.current = true;
    // Only auto-analyze when something is actually stale, so returning to the
    // dashboard doesn't re-run a full analysis of an already-fresh watchlist.
    const hasStale = stocks.some((s) => {
      const at = s.analysis?.analyzedAt;
      return !at || (Date.now() - new Date(at).getTime()) > AUTO_ANALYZE_STALE_MS;
    });
    if (hasStale) analyzeAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, stocks.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      if (e.key === 'r' && !isLoading && !isAnalyzing) reload();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [reload, isLoading, isAnalyzing]);

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
    if (staleFilter) result = result.filter((s) => {
      if (!s.analysis?.analyzedAt) return true;
      const ageDays = Math.floor((Date.now() - new Date(s.analysis.analyzedAt).getTime()) / 86_400_000);
      return ageDays >= 7;
    });
    if (expectFilter) result = result.filter((s) => {
      const sc = s.analysis?.expectationScore;
      if (sc == null) return false;
      if (expectFilter === 'high') return sc >= 56;
      return sc < 34;
    });
    if (regimeFilter) result = result.filter((s) => s.analysis?.marketRegime === regimeFilter);
    return result;
  }, [sortedStocks, sectorFilter, riskFilter, earningsFilter, staleFilter, expectFilter, regimeFilter]);

  const hasActiveFilters = sectorFilter !== null || riskFilter !== null || earningsFilter !== null || staleFilter || expectFilter !== null || regimeFilter !== null;
  const clearFilters = useCallback(() => { setSectorFilter(null); setRiskFilter(null); setEarningsFilter(null); setStaleFilter(false); setExpectFilter(null); setRegimeFilter(null); }, []);

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
            t('dashboard.priceAlert', {
              ticker,
              dir: alert.direction === 'above' ? '▲' : '▼',
              price: alert.targetPrice.toFixed(2),
              current: price?.toFixed(2),
            }),
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
    toast.success(t('dashboard.addedToWatchlist', { ticker: ticker.toUpperCase() }));
    setTimeout(() => {
      document.querySelector(`[data-ticker="${ticker.toUpperCase()}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, [add, toast, t]);

  const exportCSV = useCallback(() => {
    const target = hasActiveFilters ? filteredStocks : stocks;
    const headers = ['Ticker', 'Name', 'Sector', 'Price', 'Change%', 'Risk Score', 'Risk Label', 'Expectation Score', 'Expectation Label', 'Market Regime', 'Earnings Date', 'Analyzed At'];
    const rows = target.map((s) => [
      s.ticker,
      `"${csvSafe(s.name).replace(/"/g, '""')}"`,
      `"${csvSafe(s.sector).replace(/"/g, '""')}"`,
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
    toast.success(t('dashboard.exported', { count: target.length }));
  }, [stocks, filteredStocks, hasActiveFilters, toast, t]);

  const handleImportFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!importRef.current) return;
    importRef.current.value = '';
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) { toast.error(t('dashboard.csvEmpty')); return; }
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
    if (!tickers.length) { toast.warning(t('dashboard.noNewTickers')); return; }
    toast.info(t('dashboard.importing', { count: tickers.length }));
    let added = 0;
    for (const ticker of tickers) {
      try { await add(ticker); added++; } catch { /* skip invalid */ }
    }
    if (added > 0) toast.success(t('dashboard.addedFromCsv', { count: added }));
    else toast.error(t('dashboard.noTickersAdded'));
  }, [stocks, add, toast, t]);

  return (
    <div className={styles.page}>
      <MarketOverview />

      {/* Workspace toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarRow}>
          <div className={styles.toolbarLeft}>
            <span className={styles.pageTitle}>{t('dashboard.watchlist')}</span>
            {stocks.length > 0 && (
              <span className={styles.stockCount}>
                {hasActiveFilters ? `${filteredStocks.length} / ${stocks.length}` : stocks.length}
              </span>
            )}
          </div>
          <div className={styles.toolbarRight}>
            {stocks.length > 0 && (
              <div className={styles.desktopActions}>
                <button
                  className={`${styles.toolBtn} ${groupBySector ? styles.toolBtnActive : ''}`}
                  onClick={() => setGroupBySector((v) => !v)}
                  title={t('dashboard.groupTitle')}
                >
                  ⊞ {t('dashboard.groupBySector')}
                </button>
                <button className={styles.toolBtn} onClick={() => setMoversOpen(true)} title={t('dashboard.movers')}>
                  {t('dashboard.movers')}
                </button>
                <EarningsCalendar stocks={stocks} />
                <button className={styles.toolBtn} onClick={exportCSV} title={t('dashboard.exportCsv')}>
                  {t('dashboard.exportCsv')}
                </button>
                <button className={styles.toolBtn} onClick={() => importRef.current?.click()} title={t('dashboard.importCsv')}>
                  {t('dashboard.importCsv')}
                </button>
                <button
                  className={styles.toolBtn}
                  onClick={reload}
                  disabled={isLoading || isAnalyzing}
                  title={t('dashboard.reloadTitle')}
                >
                  {t('dashboard.reload')}
                </button>
              </div>
            )}
            <AddTickerForm onAdd={handleAdd} />
            {stocks.length > 0 && (
              <div ref={moreRef} className={`${styles.moreWrap} ${styles.mobileOnly}`}>
                <button
                  className={styles.toolBtn}
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-label={t('dashboard.more')}
                  aria-expanded={moreOpen}
                >
                  {t('dashboard.moreActions')}
                </button>
                {moreOpen && (
                  <div className={styles.moreDropdown} role="menu">
                    <button
                      className={styles.moreItem}
                      onClick={() => { setMoversOpen(true); setMoreOpen(false); }}
                      role="menuitem"
                    >
                      {t('dashboard.marketMovers')}
                    </button>
                    <EarningsCalendar stocks={stocks} onTriggerClick={() => setMoreOpen(false)} />
                    <button
                      className={styles.moreItem}
                      onClick={() => { exportCSV(); setMoreOpen(false); }}
                      role="menuitem"
                    >
                      {t('dashboard.exportCsvMenu')}
                    </button>
                    <button
                      className={styles.moreItem}
                      onClick={() => { importRef.current?.click(); setMoreOpen(false); }}
                      role="menuitem"
                    >
                      {t('dashboard.importCsvMenu')}
                    </button>
                    <button
                      className={styles.moreItem}
                      onClick={() => { reload(); setMoreOpen(false); }}
                      disabled={isLoading || isAnalyzing}
                      role="menuitem"
                    >
                      {t('dashboard.reload')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showError && (
        <div className={styles.errorBanner} role="alert">
          <span>⚠ {error}</span>
          <button
            className={styles.dismissBtn}
            onClick={() => setDismissedError(error)}
            aria-label={t('dashboard.dismissError')}
          >
            ✕
          </button>
        </div>
      )}

      {isConnected === false && !showError && (
        <div className={styles.offlinePill} role="status" aria-live="polite">
          <span className={styles.offlineDot} />
          {t('dashboard.offlinePill')}
        </div>
      )}

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
        <>
        <WelcomeCard />
        <TopMovers onAdd={handleAdd} />
        <div className={styles.empty}>
          <svg className={styles.emptyIcon} viewBox="0 0 64 48" width="64" height="48" fill="none" aria-hidden="true">
            <polyline points="4,40 18,24 28,32 40,14 52,20 60,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.25"/>
            <circle cx="60" cy="10" r="3" fill="currentColor" opacity="0.25"/>
          </svg>
          <p className={styles.emptyTitle}>{t('dashboard.emptyTitle')}</p>
          <p className={styles.emptySubtitle}>{t('dashboard.emptySubtitle')}</p>
          <p className={styles.emptyHint}>{t('dashboard.emptyHint')}</p>
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
                {t('dashboard.highRisk')}
              </button>
              <button
                className={`${styles.filterPill} ${styles.filterPillMedRisk} ${riskFilter === 'medium' ? styles.filterPillActive : ''}`}
                onClick={() => setRiskFilter(riskFilter === 'medium' ? null : 'medium')}
              >
                {t('dashboard.medRisk')}
              </button>
              <button
                className={`${styles.filterPill} ${styles.filterPillLowRisk} ${riskFilter === 'low' ? styles.filterPillActive : ''}`}
                onClick={() => setRiskFilter(riskFilter === 'low' ? null : 'low')}
              >
                {t('dashboard.lowRisk')}
              </button>
              <span className={styles.filterDivider} aria-hidden="true" />
              <button
                className={`${styles.filterPill} ${earningsFilter === 'soon' ? styles.filterPillActive : ''}`}
                onClick={() => setEarningsFilter(earningsFilter === 'soon' ? null : 'soon')}
              >
                {t('dashboard.earningsSoon')}
              </button>
              <button
                className={`${styles.filterPill} ${staleFilter ? styles.filterPillStale : ''}`}
                onClick={() => setStaleFilter((v) => !v)}
                title={t('dashboard.needsUpdate')}
              >
                {t('dashboard.needsUpdate')}
              </button>
              <span className={styles.filterDivider} aria-hidden="true" />
              <button
                className={`${styles.filterPill} ${styles.filterPillHighExpect} ${expectFilter === 'high' ? styles.filterPillActive : ''}`}
                onClick={() => setExpectFilter(expectFilter === 'high' ? null : 'high')}
              >
                {t('dashboard.highExpect')}
              </button>
              <button
                className={`${styles.filterPill} ${styles.filterPillLowExpect} ${expectFilter === 'low' ? styles.filterPillActive : ''}`}
                onClick={() => setExpectFilter(expectFilter === 'low' ? null : 'low')}
              >
                {t('dashboard.lowExpect')}
              </button>
              <span className={styles.filterDivider} aria-hidden="true" />
              <button
                className={`${styles.filterPill} ${styles.filterPillBull} ${regimeFilter === 'BULLISH' ? styles.filterPillActive : ''}`}
                onClick={() => setRegimeFilter(regimeFilter === 'BULLISH' ? null : 'BULLISH')}
              >
                {t('dashboard.bullish')}
              </button>
              <button
                className={`${styles.filterPill} ${styles.filterPillVol} ${regimeFilter === 'VOLATILE' ? styles.filterPillActive : ''}`}
                onClick={() => setRegimeFilter(regimeFilter === 'VOLATILE' ? null : 'VOLATILE')}
              >
                {t('dashboard.volatile')}
              </button>
              <button
                className={`${styles.filterPill} ${styles.filterPillBear} ${regimeFilter === 'BEARISH' ? styles.filterPillActive : ''}`}
                onClick={() => setRegimeFilter(regimeFilter === 'BEARISH' ? null : 'BEARISH')}
              >
                {t('dashboard.bearish')}
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
              <button className={styles.filterClear} onClick={clearFilters} aria-label={t('dashboard.clearAllFilters')}>
                {t('dashboard.clearFilters')}
              </button>
            )}
          </div>

          {filteredStocks.length === 0 ? (
            <div className={styles.filterEmpty}>
              {t('dashboard.noMatchFilters')}{' '}
              <button className={styles.filterEmptyLink} onClick={clearFilters}>{t('dashboard.clearFiltersLink')}</button>
            </div>
          ) : (
            <>
              <WatchlistTable
                stocks={filteredStocks}
                analyzingTickers={analyzingTickers}
                analysisErrors={analysisErrors}
                groupBySector={groupBySector && !hasActiveFilters}
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
              <WatchlistSummary stocks={stocks} portfolio={portfolio} />
            </>
          )}
        </>
      )}

      {moversOpen && (
        <BottomSheet title={t('dashboard.marketMoversTitle')} onClose={() => setMoversOpen(false)}>
          <div style={{ padding: '16px' }}>
            <TopMovers onAdd={(ticker) => { handleAdd(ticker); setMoversOpen(false); }} />
          </div>
        </BottomSheet>
      )}

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
