
import { useRef, useState, useCallback } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { StockRow } from '@/components/StockRow/StockRow';
import styles from './WatchlistTable.module.scss';

const COLUMNS = [
  { key: null, label: '', className: styles.colDrag },
  { key: 'name-asc', label: 'Ticker', className: styles.colTicker, sortable: true },
  { key: null, label: 'Name', className: styles.colName },
  { key: null, label: 'Price', className: styles.colPrice },
  { key: null, label: 'Chg%', className: styles.colChange },
  { key: null, label: 'P&L', className: styles.colPnl },
  { key: 'risk-desc', label: 'Risk', className: styles.colRisk, sortable: true },
  { key: 'expectation-desc', label: 'Expect', className: styles.colExpect, sortable: true },
  { key: null, label: 'Regime', className: styles.colRegime },
  { key: null, label: 'Earnings', className: styles.colEarnings },
  { key: null, label: 'Trend', className: styles.colSpark },
  { key: null, label: '', className: styles.colActions },
];

export function WatchlistTable({
  stocks, isConnected, analyzingTickers, analysisErrors,
  portfolio, priceAlerts, notes,
  sortKey, onSortChange,
  onRemove, onUpdateEntryPrice, onUpdateAlert, onUpdateNote, onReorder,
}) {
  const dragFrom = useRef(null);
  const [dragOver, setDragOver] = useState(null);

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
        {stocks.map((stock) => (
          <ErrorBoundary key={stock.ticker}>
            <StockRow
              stock={stock}
              onRemove={onRemove}
              isConnected={isConnected}
              isAnalyzing={analyzingTickers.has(stock.ticker)}
              analysisError={analysisErrors.get(stock.ticker) ?? null}
              portfolioEntry={portfolio.find((p) => p.ticker === stock.ticker) ?? null}
              priceAlert={priceAlerts.find((a) => a.ticker === stock.ticker) ?? null}
              note={notes.find((n) => n.ticker === stock.ticker) ?? null}
              onUpdateEntryPrice={onUpdateEntryPrice}
              onUpdateAlert={onUpdateAlert}
              onUpdateNote={onUpdateNote}
              isDragging={dragFrom.current === stock.ticker}
              isDropTarget={dragOver === stock.ticker}
              onDragStart={(t) => { dragFrom.current = t; }}
              onDragOver={setDragOver}
              onDragEnd={handleDragEnd}
            />
          </ErrorBoundary>
        ))}
      </div>
    </div>
  );
}
