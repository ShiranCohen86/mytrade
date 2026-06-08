
import { useState, useEffect, useRef, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './StockRow.module.scss';
import { StockRowDetail } from './StockRowDetail';
import { BottomSheet } from '@/components/BottomSheet/BottomSheet';
import { fmtPrice, fmtVolume, scoreClass } from '@/lib/format';
import { getMarketStatus } from '@/lib/marketHours';

// Inline sparkline for risk trend
function MiniSparkline({ history }) {
  const pts = history.slice(-10);
  if (pts.length < 2) return null;
  const W = 52, H = 16, PAD = 1;
  const values = pts.map((p) => p.riskScore);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const toX = (i) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
  const toY = (v) => H - PAD - ((v - minV) / range) * (H - PAD * 2);
  const last = values[values.length - 1];
  const color = last >= 70 ? 'var(--neg)' : last >= 40 ? 'var(--warn)' : 'var(--pos)';
  const pointsStr = pts.map((p, i) => `${toX(i).toFixed(1)},${toY(p.riskScore).toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} aria-hidden="true" className={styles.sparkline}>
      <polyline points={pointsStr} fill="none" style={{ stroke: color }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={toX(pts.length - 1)} cy={toY(last)} r="2" style={{ fill: color }} />
    </svg>
  );
}

const REGIME_ICONS = { BULLISH: '▲', BEARISH: '▼', VOLATILE: '⚡', NEUTRAL: '→' };

// Circular progress ring showing proximity to next earnings
function EarningsRing({ daysToEarnings }) {
  if (daysToEarnings === null || daysToEarnings < 0) return null;
  const CYCLE = 91;
  const progress = Math.max(0, Math.min(1, 1 - daysToEarnings / CYCLE));
  const size = 14;
  const r = 5;
  const circ = 2 * Math.PI * r;
  const dash = progress * circ;
  const color = daysToEarnings <= 14 ? 'var(--neg)' : daysToEarnings <= 30 ? 'var(--warn)' : 'var(--pos)';
  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={styles.earningsRing}
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.15" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="2"
        strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function StockRowInner({
  stock, onRemove, isAnalyzing = false, analysisError = null,
  portfolioEntry = null, priceAlert = null, note = null,
  onUpdateEntryPrice, onUpdateAlert, onUpdateNote, onAnalyzeTicker,
  isDragging = false, onDragStart, onDragOver, onDragEnd, isDropTarget = false,
}) {
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
    if (prev !== null && current != null && current !== prev) {
      setFlash(current > prev ? 'up' : 'down');
      const t = setTimeout(() => setFlash(null), 300);
      prevPriceRef.current = current;
      return () => clearTimeout(t);
    }
    if (current != null) prevPriceRef.current = current;
  }, [cachedData?.price]);

  const change = cachedData?.changePercent ?? 0;
  const isPositive = change >= 0;

  const daysToEarnings = cachedData?.earningsDate
    ? Math.ceil((new Date(cachedData.earningsDate).getTime() - Date.now()) / 86_400_000)
    : null;

  const earningsLabel =
    daysToEarnings === null ? '—' :
    daysToEarnings < 0 ? '—' :
    daysToEarnings === 0 ? 'Today' :
    `${daysToEarnings}d`;

  const earningsUrgent = daysToEarnings !== null && daysToEarnings >= 0 && daysToEarnings <= 7;

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

        {/* Price */}
        <span className={styles.priceCell}>
          <span className={`${styles.price} ${flash === 'up' ? styles.flashUp : flash === 'down' ? styles.flashDown : ''}`}>
            {fmtPrice(cachedData?.price)}
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

        {/* Change % */}
        <span className={`${styles.change} ${isPositive ? styles.pos : styles.neg}`}>
          {isPositive ? '+' : ''}{change.toFixed(2)}%
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

        {/* Expectation */}
        <span
          className={`${styles.expect} ${analysis?.expectationLabel ? styles[`exp_${scoreClass(analysis.expectationScore)}`] : ''}`}
          title="Expectation score: how much upside is already priced in. HIGH = market expects a lot → cautionary. LOW = little priced in → more room to run."
        >
          {analysis?.expectationLabel?.replace('_', ' ') ?? '—'}
        </span>

        {/* Market regime */}
        <span className={`${styles.regime} ${styles[`regime_${(analysis?.marketRegime || 'neutral').toLowerCase()}`]}`}>
          {analysis?.marketRegime ? `${REGIME_ICONS[analysis.marketRegime] ?? ''} ${analysis.marketRegime}` : '—'}
        </span>

        {/* Earnings */}
        <span
          className={`${styles.earnings} ${earningsUrgent ? styles.earningsUrgent : ''}`}
          title={daysToEarnings !== null && daysToEarnings >= 0 ? `${daysToEarnings} days to earnings` : undefined}
        >
          <EarningsRing daysToEarnings={daysToEarnings} />
          {earningsLabel}
          {earningsUrgent && analysis?.isSellTheNewsRisk && <span className={styles.stnDot} title="Sell-the-News Risk"> ⚡</span>}
        </span>

        {/* Sparkline */}
        <span className={styles.sparklineCell}>
          {(stock.scoreHistory?.length ?? 0) >= 3 && (
            <MiniSparkline history={stock.scoreHistory} />
          )}
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
