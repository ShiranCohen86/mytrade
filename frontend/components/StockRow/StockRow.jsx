
import { useState, useEffect, useRef, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './StockRow.module.scss';
import { StockRowDetail } from './StockRowDetail';
import { BottomSheet } from '@/components/BottomSheet/BottomSheet';
import { fmtVolume, scoreClass } from '@/lib/format';
import { useFmtPrice } from '@/hooks/useFmtPrice';
import { getMarketStatus } from '@/lib/marketHours';
import { useEmphasis } from '@/hooks/useEmphasis';

const REGIME_ICONS = { BULLISH: '▲', BEARISH: '▼', VOLATILE: '⚡', NEUTRAL: '→' };
const EXP_SHORT = { VERY_HIGH: 'VH', HIGH: 'H', MODERATE: 'M', LOW: 'L' };

function StockRowInner({
  stock, onRemove, isAnalyzing = false, analysisError = null,
  portfolioEntry = null, priceAlert = null, note = null,
  onUpdateEntryPrice, onUpdateAlert, onUpdateNote, onAnalyzeTicker,
  isDragging = false, onDragStart, onDragOver, onDragEnd, isDropTarget = false,
}) {
  const { fmtPrice } = useFmtPrice();
  const [expanded, setExpanded] = useState(false);
  const [flash, setFlash] = useState(null);
  const prevPriceRef = useRef(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  );
  const navigate = useNavigate();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const { ticker, name, cachedData, analysis, stockPriceAtAdd } = stock;

  // Price flash on live update
  useEffect(() => {
    const current = cachedData?.price;
    const prev = prevPriceRef.current;
    // Require finite numbers — a NaN price would make `current !== prev` always
    // true and flash on every render.
    if (prev !== null && Number.isFinite(current) && Number.isFinite(prev) && current !== prev) {
      setFlash(current > prev ? 'up' : 'down');
      const t = setTimeout(() => setFlash(null), 300);
      prevPriceRef.current = current;
      return () => clearTimeout(t);
    }
    if (Number.isFinite(current)) prevPriceRef.current = current;
  }, [cachedData?.price]);

  const change = cachedData?.changePercent ?? 0;
  const isPositive = change >= 0;

  const currentPrice = cachedData?.price ?? null;
  const entryPrice = portfolioEntry?.entryPrice ?? null;
  const shares = portfolioEntry?.shares ?? null;

  const marketStatus = getMarketStatus();
  const extPrice = marketStatus === 'pre' && cachedData?.preMarketPrice != null
    ? cachedData.preMarketPrice
    : marketStatus === 'after' && cachedData?.postMarketPrice != null
    ? cachedData.postMarketPrice
    : null;
  const extPct = marketStatus === 'pre'
    ? cachedData?.preMarketChangePercent ?? null
    : marketStatus === 'after'
    ? cachedData?.postMarketChangePercent ?? null
    : null;
  const extLabel = marketStatus === 'pre' ? 'PRE' : 'AH';
  const extIsPos  = (extPct ?? 0) >= 0;
  const pnlPct = entryPrice && currentPrice ? ((currentPrice - entryPrice) / entryPrice) * 100 : null;
  const pnlAbs = pnlPct != null && shares != null ? (currentPrice - entryPrice) * shares : null;
  // Fallback: show return since added when no portfolio entry is set
  const sinceAddPct = pnlPct === null && stockPriceAtAdd != null && currentPrice != null
    ? ((currentPrice - stockPriceAtAdd) / stockPriceAtAdd) * 100
    : null;

  const alertTriggered = priceAlert && currentPrice !== null && (
    priceAlert.direction === 'above'
      ? currentPrice >= priceAlert.targetPrice
      : currentPrice <= priceAlert.targetPrice
  );

  const riskCls = scoreClass(analysis?.riskScore);

  // Context emphasis — highlight what matters now (big move, near alert, earnings, etc.), mute the quiet.
  const emphasis = useEmphasis({ stock, priceAlert, portfolioEntry });

  const analysisAgeDays = analysis?.analyzedAt
    ? Math.floor((Date.now() - new Date(analysis.analyzedAt).getTime()) / 86_400_000)
    : null;
  const isStale = analysisAgeDays != null && analysisAgeDays >= 7;

  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter') navigate(`/stocks/${ticker}`);
    if (e.key === ' ') { e.preventDefault(); setExpanded((v) => !v); }
  };

  return (
    <div
      className={`${styles.rowWrapper} ${isDragging ? styles.dragging : ''} ${isDropTarget ? styles.dropTarget : ''} ${isAnalyzing ? styles.analyzing : ''} ${alertTriggered ? styles.alertRing : ''}`}
      data-ticker={ticker}
      data-emph={emphasis.level}
      data-emph-tone={emphasis.tone || undefined}
      title={emphasis.signals.length ? emphasis.signals.map((s) => s.label).join(' · ') : undefined}
    >
      <div
        className={styles.row}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="row"
        aria-label={`${name || ticker}`}
        aria-expanded={expanded}
        draggable={!!onDragStart}
        onDragStart={() => onDragStart?.(ticker)}
        onDragOver={(e) => { e.preventDefault(); onDragOver?.(ticker); }}
        onDragEnd={onDragEnd}
      >
        {/* Drag handle */}
        <span className={styles.dragHandle} aria-hidden="true" title="Drag to reorder">⠿</span>

        {/* Ticker */}
        <Link to={`/stocks/${ticker}`} className={styles.ticker} onClick={(e) => e.stopPropagation()}>
          {ticker}
        </Link>

        {/* Name */}
        <span className={styles.name}>{name || ticker}</span>

        {/* Price + Change % */}
        <span className={styles.priceCell}>
          <span className={styles.priceRow}>
            <span className={`${styles.price} ${flash === 'up' ? styles.flashUp : flash === 'down' ? styles.flashDown : ''}`}>
              {fmtPrice(cachedData?.price)}
            </span>
            <span className={`${styles.change} ${isPositive ? styles.pos : styles.neg}`}>
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </span>
          </span>
          {extPrice != null && (
            <span className={styles.extPriceLine}>
              <span className={styles.extBadge}>{extLabel}</span>
              <span className={`${styles.extPrice} ${extIsPos ? styles.pos : styles.neg}`}>
                {fmtPrice(extPrice)}
                {extPct != null && ` ${extIsPos ? '+' : ''}${extPct.toFixed(2)}%`}
              </span>
            </span>
          )}
        </span>

        {/* Expectation Score — primary analytical signal */}
        <span
          className={`${styles.expect} ${analysis?.expectationScore != null ? styles[`exp_${scoreClass(analysis.expectationScore)}`] : ''}`}
          title="Expectation score: how much upside is already priced in. HIGH = market expects a lot → cautionary. LOW = little priced in → more room to run."
        >
          {analysis?.expectationScore != null ? (
            <>
              {analysis.expectationScore}
              <span className={styles.expLabel}>{EXP_SHORT[analysis.expectationLabel] || ''}</span>
            </>
          ) : '—'}
        </span>

        {/* P&L from entry price; fallback to return since added */}
        {pnlPct !== null ? (
          <span className={`${styles.pnl} ${pnlPct >= 0 ? styles.pos : styles.neg}`} title="Return from entry price">
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
          </span>
        ) : sinceAddPct !== null ? (
          <span className={`${styles.pnl} ${styles.sinceAdd} ${sinceAddPct >= 0 ? styles.pos : styles.neg}`} title="Return since added to watchlist">
            {sinceAddPct >= 0 ? '+' : ''}{sinceAddPct.toFixed(1)}%
          </span>
        ) : <span className={styles.pnl} />}

        {/* Risk score */}
        <span className={`${styles.risk} ${styles[`risk_${riskCls}`]}`}>
          {analysis?.riskScore ?? '—'}
        </span>

        {/* Market regime */}
        <span className={`${styles.regime} ${styles[`regime_${(analysis?.marketRegime || 'neutral').toLowerCase()}`]}`}>
          {analysis?.marketRegime ? `${REGIME_ICONS[analysis.marketRegime] ?? ''} ${analysis.marketRegime}` : '—'}
        </span>

        {/* Actions */}
        <span className={styles.actionsCell}>
          {isAnalyzing ? (
            <span className={styles.rowSpinner} aria-label="Analyzing…" title="Analyzing…">⟳</span>
          ) : (
            <button
              className={`${styles.expandBtn} ${expanded ? styles.expandBtnOpen : ''}`}
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              title={
                isStale && !expanded
                  ? `Analysis is ${analysisAgeDays}d old — expand to re-analyze`
                  : expanded ? 'Collapse' : 'Expand details'
              }
              aria-label={expanded ? 'Collapse row' : 'Expand row'}
            >
              ›
              {(note?.text || priceAlert) && !expanded && (
                <span
                  className={styles.activityDot}
                  title={[note?.text && 'Has note', priceAlert && 'Has price alert'].filter(Boolean).join(' · ')}
                  aria-hidden="true"
                />
              )}
              {isStale && !expanded && !(note?.text || priceAlert) && (
                <span className={styles.staleDot} title={`Analysis ${analysisAgeDays}d old`} aria-hidden="true" />
              )}
            </button>
          )}
        </span>
      </div>

      {expanded && isMobile ? (
        <BottomSheet title={ticker} onClose={() => setExpanded(false)}>
          <StockRowDetail
            stock={stock}
            portfolioEntry={portfolioEntry}
            priceAlert={priceAlert}
            note={note}
            pnlPct={pnlPct}
            pnlAbs={pnlAbs}
            shares={shares}
            onUpdateEntryPrice={onUpdateEntryPrice}
            onUpdateAlert={onUpdateAlert}
            onUpdateNote={onUpdateNote}
            onAnalyzeTicker={onAnalyzeTicker}
            onRemove={(t) => { onRemove(t); setExpanded(false); }}
            analysisError={analysisError}
            isAnalyzing={isAnalyzing}
            inSheet
          />
        </BottomSheet>
      ) : expanded ? (
        <StockRowDetail
          stock={stock}
          portfolioEntry={portfolioEntry}
          priceAlert={priceAlert}
          note={note}
          pnlPct={pnlPct}
          pnlAbs={pnlAbs}
          shares={shares}
          onUpdateEntryPrice={onUpdateEntryPrice}
          onUpdateAlert={onUpdateAlert}
          onUpdateNote={onUpdateNote}
          onAnalyzeTicker={onAnalyzeTicker}
          onRemove={onRemove}
          analysisError={analysisError}
          isAnalyzing={isAnalyzing}
        />
      ) : null}
    </div>
  );
}

export const StockRow = memo(StockRowInner);
