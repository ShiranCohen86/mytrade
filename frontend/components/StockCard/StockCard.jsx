// LEGACY — replaced by StockRow. Kept for reference only; not rendered anywhere.

import { useState, useEffect, useRef, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './StockCard.module.scss';
import { InfoTooltip } from '@/components/InfoTooltip/InfoTooltip';
import { fmtPrice, fmtVolume, scoreClass, fmtRelativeTime } from '@/lib/format';

function ScoreSparkline({ history }) {
  const pts = history.slice(-10);
  const W = 80, H = 22, PAD = 2;
  const values = pts.map((p) => p.riskScore);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const toX = (i) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
  const toY = (v) => H - PAD - ((v - minV) / range) * (H - PAD * 2);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.riskScore).toFixed(1)}`).join(' ');
  const last = values[values.length - 1];
  const color = last >= 70 ? '#f87171' : last >= 40 ? '#fbbf24' : '#4ade80';
  return (
    <div className={styles.sparklineRow} title={`Risk score trend (last ${pts.length} analyses)`}>
      <span className={styles.sparklineLabel}>Risk trend</span>
      <svg width={W} height={H} aria-hidden="true">
        <polyline points={pts.map((p, i) => `${toX(i).toFixed(1)},${toY(p.riskScore).toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={toX(pts.length - 1)} cy={toY(last)} r="2.5" fill={color} />
      </svg>
      <span className={styles.sparklineLast} style={{ color }}>{last}</span>
    </div>
  );
}

const RISK_SHAPES = { HIGH: '▲', MEDIUM: '●', LOW: '▼', VERY_HIGH: '▲▲' };

const TIPS = {
  risk: 'Risk Score (0–100): higher = more dangerous. Built from 5 factors: volatility, sector, earnings proximity, momentum, and market regime. ≥70 HIGH · 40–69 MEDIUM · <40 LOW.',
  expectation: 'Expectation Score (0–100): how much good news the market already prices in. Very high scores mean the stock needs to beat estimates just to stay flat.',
  regime: 'Market Regime based on SPY & QQQ moving averages. BULLISH: both trending up. BEARISH: both down. VOLATILE: SPY near its 200-day average. NEUTRAL: mixed.',
  stn: 'Sell-the-News Risk: the stock rose >10% in the 10 days before earnings. Good results may already be priced in — even a beat can trigger a sell-off.',
};

function StockCardInner({
  stock, onRemove, isConnected = null, isAnalyzing = false, analysisError = null,
  portfolioEntry = null, priceAlert = null, note = null,
  onUpdateEntryPrice, onUpdateAlert, onUpdateNote,
  isDragging = false, onDragStart, onDragOver, onDragEnd,
}) {
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(null);
  const [flash, setFlash] = useState(null);
  const prevPriceRef = useRef(null);
  const navigate = useNavigate();

  // P&L inline form state
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryInput, setEntryInput] = useState('');
  const [entryLoading, setEntryLoading] = useState(false);

  // Alert inline form state
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertInput, setAlertInput] = useState('');
  const [alertDir, setAlertDir] = useState('above');
  const [alertLoading, setAlertLoading] = useState(false);

  // Notes state
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState(note?.text ?? '');
  const [noteSaving, setNoteSaving] = useState(false);

  // Sync noteText when note prop changes (e.g. after load)
  useEffect(() => { setNoteText(note?.text ?? ''); }, [note?.text]);

  const { ticker, name, cachedData, analysis } = stock;

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
    ? Math.ceil((new Date(cachedData.earningsDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const earningsLabel =
    daysToEarnings === null ? null :
    daysToEarnings < 0 ? null :
    daysToEarnings === 0 ? 'Today' :
    `${daysToEarnings}d`;

  // P&L calculation
  const currentPrice = cachedData?.price ?? null;
  const entryPrice = portfolioEntry?.entryPrice ?? null;
  const pnlPct = entryPrice && currentPrice ? ((currentPrice - entryPrice) / entryPrice) * 100 : null;

  // Relative performance vs SPY since stock was added
  const spyPrice = cachedData?.spyPrice ?? null;
  const { stockPriceAtAdd, spyPriceAtAdd } = stock;
  const relativePerf =
    currentPrice && spyPrice && stockPriceAtAdd && spyPriceAtAdd
      ? ((currentPrice / stockPriceAtAdd - 1) - (spyPrice / spyPriceAtAdd - 1)) * 100
      : null;

  // Alert triggered?
  const alertTriggered = priceAlert && currentPrice !== null && (
    priceAlert.direction === 'above'
      ? currentPrice >= priceAlert.targetPrice
      : currentPrice <= priceAlert.targetPrice
  );

  const handleRemove = async () => {
    if (!window.confirm(`Remove ${ticker} from your watchlist?`)) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await onRemove(ticker);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove');
      setRemoving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter') navigate(`/stocks/${ticker}`);
    if (e.key === 'Delete') handleRemove();
  };

  const handleEntrySubmit = async (e) => {
    e.preventDefault();
    const price = parseFloat(entryInput);
    if (!isFinite(price) || price <= 0) return;
    setEntryLoading(true);
    try {
      await onUpdateEntryPrice?.(ticker, price);
      setShowEntryForm(false);
      setEntryInput('');
    } finally {
      setEntryLoading(false);
    }
  };

  const handleClearEntry = async () => {
    setEntryLoading(true);
    try {
      await onUpdateEntryPrice?.(ticker, null);
    } finally {
      setEntryLoading(false);
    }
  };

  const handleAlertSubmit = async (e) => {
    e.preventDefault();
    const price = parseFloat(alertInput);
    if (!isFinite(price) || price <= 0) return;
    setAlertLoading(true);
    try {
      await onUpdateAlert?.(ticker, price, alertDir);
      setShowAlertForm(false);
      setAlertInput('');
    } finally {
      setAlertLoading(false);
    }
  };

  const handleClearAlert = async () => {
    setAlertLoading(true);
    try {
      await onUpdateAlert?.(ticker, null);
      setShowAlertForm(false);
    } finally {
      setAlertLoading(false);
    }
  };

  const handleNoteSave = async () => {
    setNoteSaving(true);
    try {
      await onUpdateNote?.(ticker, noteText.trim() || null);
      setShowNotes(false);
    } finally {
      setNoteSaving(false);
    }
  };

  return (
    <div
      className={`${styles.card} ${isPositive ? styles.cardUp : styles.cardDown} ${removing ? styles.removing : ''} ${isAnalyzing ? styles.analyzing : ''} ${isDragging ? styles.dragging : ''} ${alertTriggered ? styles.alertRing : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="article"
      aria-label={`${name || ticker} stock card`}
      draggable={!!onDragStart}
      onDragStart={() => onDragStart?.(ticker)}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(ticker); }}
      onDragEnd={onDragEnd}
    >
      <div className={styles.topRow}>
        <div className={styles.tickerGroup}>
          <Link to={`/stocks/${ticker}`} className={styles.ticker}>{ticker}</Link>
          <span className={styles.name}>{name || ticker}</span>
        </div>
        <div className={styles.actions}>
          {onUpdateNote && (
            <button
              className={`${styles.actionBtn} ${note?.text ? styles.actionBtnActive : ''}`}
              onClick={() => setShowNotes((v) => !v)}
              title={note?.text ? 'Edit note' : 'Add note'}
              aria-label="Notes"
            >
              📝
            </button>
          )}
          {onUpdateAlert && (
            <button
              className={`${styles.actionBtn} ${priceAlert ? styles.actionBtnActive : ''} ${alertTriggered ? styles.actionBtnTriggered : ''}`}
              onClick={() => { setShowAlertForm((v) => !v); setShowEntryForm(false); setShowNotes(false); }}
              title={priceAlert ? `Alert: ${priceAlert.direction} $${priceAlert.targetPrice}` : 'Set price alert'}
              aria-label="Set price alert"
            >
              🔔
            </button>
          )}
          {onUpdateEntryPrice && (
            <button
              className={`${styles.actionBtn} ${entryPrice !== null ? styles.actionBtnActive : ''}`}
              onClick={() => { setShowEntryForm((v) => !v); setShowAlertForm(false); setShowNotes(false); }}
              title={entryPrice !== null ? `Entry: $${entryPrice.toFixed(2)}` : 'Set entry price'}
              aria-label="Set entry price for P&L tracking"
            >
              $
            </button>
          )}
          <button
            className={styles.removeBtn}
            onClick={handleRemove}
            disabled={removing}
            title={`Remove ${ticker} from watchlist`}
            aria-label={`Remove ${ticker} from watchlist`}
          >
            {removing ? <span className={styles.dotSpinner} /> : '✕'}
          </button>
        </div>
      </div>

      <div className={styles.priceRow}>
        <span className={`${styles.price} ${flash === 'up' ? styles.flashUp : flash === 'down' ? styles.flashDown : ''}`}>
          {fmtPrice(cachedData?.price)}
        </span>
        {isConnected !== null && (
          <span
            className={`${styles.connDot} ${isConnected ? styles.connOnline : styles.connOffline}`}
            aria-label={isConnected ? 'Connection status: online' : 'Connection status: offline — prices may be stale'}
            title={isConnected ? 'Live' : 'Backend unreachable — prices may be stale'}
            role="status"
          />
        )}
        <span className={`${styles.change} ${isPositive ? styles.positive : styles.negative}`}>
          {isPositive ? '+' : ''}{change.toFixed(2)}%
        </span>
        {pnlPct !== null && (
          <span className={`${styles.pnlBadge} ${pnlPct >= 0 ? styles.positive : styles.negative}`}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}% P&L
          </span>
        )}
      </div>

      {/* Inline entry price form */}
      {showEntryForm && (
        <form className={styles.inlineForm} onSubmit={handleEntrySubmit}>
          <span className={styles.inlineLabel}>Entry $</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className={styles.inlineInput}
            placeholder={entryPrice?.toFixed(2) ?? '0.00'}
            value={entryInput}
            onChange={(e) => setEntryInput(e.target.value)}
            autoFocus
            disabled={entryLoading}
          />
          <button type="submit" className={styles.inlineBtn} disabled={entryLoading || !entryInput}>
            Set
          </button>
          {entryPrice !== null && (
            <button type="button" className={styles.inlineClearBtn} onClick={handleClearEntry} disabled={entryLoading}>
              Clear
            </button>
          )}
        </form>
      )}

      {/* Inline alert form */}
      {showAlertForm && (
        <form className={styles.inlineForm} onSubmit={handleAlertSubmit}>
          <select
            className={styles.inlineSelect}
            value={alertDir}
            onChange={(e) => setAlertDir(e.target.value)}
            disabled={alertLoading}
          >
            <option value="above">Above $</option>
            <option value="below">Below $</option>
          </select>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className={styles.inlineInput}
            placeholder={priceAlert?.targetPrice?.toFixed(2) ?? '0.00'}
            value={alertInput}
            onChange={(e) => setAlertInput(e.target.value)}
            autoFocus
            disabled={alertLoading}
          />
          <button type="submit" className={styles.inlineBtn} disabled={alertLoading || !alertInput}>
            Set
          </button>
          {priceAlert && (
            <button type="button" className={styles.inlineClearBtn} onClick={handleClearAlert} disabled={alertLoading}>
              Clear
            </button>
          )}
        </form>
      )}

      {alertTriggered && priceAlert && (
        <div className={styles.alertBanner}>
          🔔 Price alert: {ticker} is {priceAlert.direction} ${priceAlert.targetPrice}
        </div>
      )}

      {/* Notes panel */}
      {showNotes && (
        <div className={styles.notesPanel}>
          <textarea
            className={styles.notesTextarea}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note about this stock…"
            maxLength={1000}
            rows={3}
            disabled={noteSaving}
            autoFocus
          />
          <div className={styles.notesActions}>
            <span className={styles.notesCount}>{noteText.length}/1000</span>
            <button className={styles.inlineBtn} onClick={handleNoteSave} disabled={noteSaving}>
              Save
            </button>
            {note?.text && (
              <button className={styles.inlineClearBtn} onClick={() => onUpdateNote?.(ticker, null)} disabled={noteSaving}>
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Vol</span>
          <span className={styles.statValue}>{fmtVolume(cachedData?.volume)}</span>
        </div>
        {earningsLabel && (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Earnings</span>
            <span className={`${styles.statValue} ${daysToEarnings !== null && daysToEarnings <= 7 ? styles.earningsClose : ''}`}>
              {earningsLabel}
            </span>
          </div>
        )}
        {relativePerf !== null && (
          <div className={styles.stat} title="Return since added vs S&P 500 (positive = outperforming)">
            <span className={styles.statLabel}>vs SPY</span>
            <span className={`${styles.statValue} ${relativePerf >= 0 ? styles.relPerfPos : styles.relPerfNeg}`}>
              {relativePerf >= 0 ? '+' : ''}{relativePerf.toFixed(1)}%
            </span>
          </div>
        )}
        {analysis?.analyzedAt && (
          <div className={styles.stat} style={{ marginLeft: 'auto' }}>
            <span className={styles.statLabel}>Updated</span>
            <span className={styles.statValue}>{fmtRelativeTime(analysis.analyzedAt)}</span>
          </div>
        )}
      </div>

      <div className={styles.badgeRow}>
        <div className={styles.badge}>
          <span className={styles.badgeLabel}>
            Risk <InfoTooltip content={TIPS.risk} position="bottom" />
          </span>
          <span className={`${styles.badgeValue} ${styles[`risk_${scoreClass(analysis?.riskScore)}`]}`}>
            {analysis?.riskScore ?? '—'} {analysis?.riskLabel ? (RISK_SHAPES[analysis.riskLabel] ?? '') : ''}
          </span>
        </div>
        <div className={styles.badge}>
          <span className={styles.badgeLabel}>
            Expect. <InfoTooltip content={TIPS.expectation} position="bottom" />
          </span>
          <span className={`${styles.badgeValue} ${styles[`exp_${scoreClass(analysis?.expectationScore)}`]}`}>
            {analysis?.expectationLabel || '—'}
          </span>
        </div>
        <div className={styles.badge}>
          <span className={styles.badgeLabel}>
            Market <InfoTooltip content={TIPS.regime} position="bottom" />
          </span>
          <span className={`${styles.badgeValue} ${styles[`regime_${(analysis?.marketRegime || 'neutral').toLowerCase()}`]}`}>
            {analysis?.marketRegime || '—'}
          </span>
        </div>
      </div>

      {analysis?.isSellTheNewsRisk && (
        <div className={styles.stnWarning}>
          ⚠ Sell-the-News Risk — rally into earnings detected <InfoTooltip content={TIPS.stn} position="top" />
        </div>
      )}

      {/* Score history sparkline — shown when ≥ 3 snapshots are available */}
      {(stock.scoreHistory?.length ?? 0) >= 3 && (
        <ScoreSparkline history={stock.scoreHistory} />
      )}

      {(removeError || analysisError) && (
        <div className={styles.cardError}>{removeError || analysisError}</div>
      )}

      {isAnalyzing && (
        <div className={styles.analyzingOverlay} aria-label="Analyzing...">
          <span className={styles.dotSpinner} />
        </div>
      )}

      <Link to={`/stocks/${ticker}`} className={styles.detailLink}>
        View Full Analysis →
      </Link>
    </div>
  );
}

export const StockCard = memo(StockCardInner);
