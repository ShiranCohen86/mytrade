
import { useRef, useState, useCallback, useMemo } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { StockRow } from '@/components/StockRow/StockRow';
import styles from './WatchlistTable.module.scss';

const COLUMNS = [
  { key: null, label: '', className: styles.colDrag },
  { key: 'name-asc', label: 'Ticker', className: styles.colTicker, sortable: true },
  { key: null, label: 'Name', className: styles.colName },
  { key: null, label: 'Price', className: styles.colPrice },
  { key: 'change-desc', label: 'Chg%', className: styles.colChange, sortable: true },
  { key: 'pnl-desc', label: 'P&L / Since Add', className: styles.colPnl, sortable: true },
  { key: 'risk-desc', label: 'Risk', className: styles.colRisk, sortable: true },
  { key: 'expectation-desc', label: 'Expect', className: styles.colExpect, sortable: true },
  { key: null, label: 'Regime', className: styles.colRegime },
  { key: null, label: 'Earnings', className: styles.colEarnings },
  { key: null, label: 'Trend', className: styles.colSpark },
  { key: null, label: '', className: styles.colActions },
];

export function WatchlistTable({
  stocks, analyzingTickers, analysisErrors,
  portfolio, priceAlerts, notes,
  sortKey, onSortChange,
  onRemove, onUpdateEntryPrice, onUpdateAlert, onUpdateNote, onReorder, onAnalyzeTicker,
  groupBySector = false,
}) {
  const dragFrom = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const [collapsedSectors, setCollapsedSectors] = useState(new Set());

  const toggleSector = useCallback((sector) => {
    setCollapsedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }, []);

  const grouped = useMemo(() => {
    if (!groupBySector) return null;
    const map = new Map();
    for (const s of stocks) {
      const key = s.sector || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [stocks, groupBySector]);

  const handleDragEnd = useCallback(() => {
    const from = dragFrom.current;
    const to = dragOver;
    dragFrom.current = null;
    setDragOver(null);
    if (!from || !to || from === to) return;
    const order = stocks.map((s) => s.ticker);
    const fromIdx = order.indexOf(from);
    const toIdx = order.indexOf(to);
    if (fromIdx < 0 || toIdx < 0) return;
    const newOrder = [...order];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, from);
    onReorder(newOrder);
  }, [dragOver, stocks, onReorder]);

  const handleSortClick = (col) => {
    if (!col.sortable || !col.key) return;
    if (sortKey === col.key) {
      onSortChange('default');
    } else {
      onSortChange(col.key);
    }
  };

  return (
    <div className={styles.table} role="table" aria-label="Watchlist">
      {/* Column headers */}
      <div className={styles.thead} role="row">
        {COLUMNS.map((col, i) => (
          <div
            key={i}
            className={`${styles.th} ${col.className} ${col.sortable ? styles.sortable : ''} ${sortKey === col.key ? styles.sortActive : ''}`}
            role="columnheader"
            onClick={() => handleSortClick(col)}
            aria-sort={
              sortKey === col.key
                ? col.key?.endsWith('-asc') ? 'ascending' : 'descending'
                : undefined
            }
          >
            {col.label}
            {col.sortable && (
              <span className={styles.sortArrow}>
                {sortKey === col.key ? (col.key?.endsWith('-asc') ? '↑' : '↓') : ''}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className={styles.tbody} role="rowgroup">
        {grouped ? (
          grouped.map(([sector, sectorStocks]) => {
            const isCollapsed = collapsedSectors.has(sector);
            const avgRisk = sectorStocks.filter((s) => s.analysis?.riskScore != null).reduce((sum, s, _, arr) => sum + s.analysis.riskScore / arr.length, 0) || null;
            return (
              <div key={sector}>
                <div
                  className={styles.sectorHeader}
                  onClick={() => toggleSector(sector)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={!isCollapsed}
                  onKeyDown={(e) => e.key === 'Enter' && toggleSector(sector)}
                >
                  <span className={styles.sectorChevron}>{isCollapsed ? '▶' : '▼'}</span>
                  <span className={styles.sectorHeaderName}>{sector}</span>
                  <span className={styles.sectorHeaderCount}>{sectorStocks.length}</span>
                  {avgRisk != null && (
                    <span className={`${styles.sectorAvgRisk} ${avgRisk >= 70 ? styles.riskHigh : avgRisk >= 40 ? styles.riskMid : styles.riskLow}`}>
                      Risk {avgRisk.toFixed(0)}
                    </span>
                  )}
                </div>
                {!isCollapsed && sectorStocks.map((stock) => (
                  <ErrorBoundary key={stock.ticker}>
                    <StockRow
                      stock={stock}
                      onRemove={onRemove}
                      isAnalyzing={analyzingTickers.has(stock.ticker)}
                      analysisError={analysisErrors.get(stock.ticker) ?? null}
                      portfolioEntry={portfolio.find((p) => p.ticker === stock.ticker) ?? null}
                      priceAlert={priceAlerts.find((a) => a.ticker === stock.ticker) ?? null}
                      note={notes.find((n) => n.ticker === stock.ticker) ?? null}
                      onUpdateEntryPrice={onUpdateEntryPrice}
                      onUpdateAlert={onUpdateAlert}
                      onUpdateNote={onUpdateNote}
                      onAnalyzeTicker={onAnalyzeTicker}
                      isDragging={false}
                      isDropTarget={false}
                      onDragStart={() => {}}
                      onDragOver={() => {}}
                      onDragEnd={() => {}}
                    />
                  </ErrorBoundary>
                ))}
              </div>
            );
          })
        ) : (
          stocks.map((stock) => (
            <ErrorBoundary key={stock.ticker}>
              <StockRow
                stock={stock}
                onRemove={onRemove}
                isAnalyzing={analyzingTickers.has(stock.ticker)}
                analysisError={analysisErrors.get(stock.ticker) ?? null}
                portfolioEntry={portfolio.find((p) => p.ticker === stock.ticker) ?? null}
                priceAlert={priceAlerts.find((a) => a.ticker === stock.ticker) ?? null}
                note={notes.find((n) => n.ticker === stock.ticker) ?? null}
                onUpdateEntryPrice={onUpdateEntryPrice}
                onUpdateAlert={onUpdateAlert}
                onUpdateNote={onUpdateNote}
                onAnalyzeTicker={onAnalyzeTicker}
                isDragging={dragFrom.current === stock.ticker}
                isDropTarget={dragOver === stock.ticker}
                onDragStart={(t) => { dragFrom.current = t; }}
                onDragOver={setDragOver}
                onDragEnd={handleDragEnd}
              />
            </ErrorBoundary>
          ))
        )}
      </div>
    </div>
  );
}
