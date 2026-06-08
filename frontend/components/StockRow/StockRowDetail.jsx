
import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './StockRowDetail.module.scss';
import { fmtPrice } from '@/lib/format';

export function StockRowDetail({
  stock, portfolioEntry, priceAlert, note, pnlPct, pnlAbs = null, shares = null,
  onUpdateEntryPrice, onUpdateAlert, onUpdateNote, onRemove, onAnalyzeTicker, analysisError,
  inSheet = false, isAnalyzing = false,
}) {
  const { ticker, analysis } = stock;

  // Entry price form state
  const [entryInput, setEntryInput] = useState('');
  const [sharesInput, setSharesInput] = useState('');
  const [entryLoading, setEntryLoading] = useState(false);

  // Alert form state
  const [alertInput, setAlertInput] = useState('');
  const [alertDir, setAlertDir] = useState('above');
  const [alertLoading, setAlertLoading] = useState(false);

  // Notes state
  const [noteText, setNoteText] = useState(note?.text ?? '');
  const [noteSaving, setNoteSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleEntrySubmit = async (e) => {
    e.preventDefault();
    const price = parseFloat(entryInput);
    if (!isFinite(price) || price <= 0) return;
    const s = parseFloat(sharesInput);
    const sharesVal = isFinite(s) && s > 0 ? s : null;
    setEntryLoading(true);
    try {
      await onUpdateEntryPrice?.(ticker, price, sharesVal);
      setEntryInput('');
      setSharesInput('');
    } finally { setEntryLoading(false); }
  };

  const handleAlertSubmit = async (e) => {
    e.preventDefault();
    const price = parseFloat(alertInput);
    if (!isFinite(price) || price <= 0) return;
    setAlertLoading(true);
    try { await onUpdateAlert?.(ticker, price, alertDir); setAlertInput(''); } finally { setAlertLoading(false); }
  };

  const handleNoteSave = async () => {
    setNoteSaving(true);
    try { await onUpdateNote?.(ticker, noteText.trim() || null); } finally { setNoteSaving(false); }
  };

  const handleRemove = () => {
    if (confirmRemove) {
      onRemove(ticker);
    } else {
      setConfirmRemove(true);
      setTimeout(() => setConfirmRemove(false), 4000);
    }
  };

  return (
    <div className={`${styles.detail} ${inSheet ? styles.detailInSheet : ''}`}>
      {/* Risk breakdown */}
      {analysis?.riskBreakdown && (
        <div className={styles.breakdown}>
          <span className={styles.sectionLabel}>Risk Breakdown</span>
          {[
            { label: 'Volatility', val: analysis.riskBreakdown.volatility, max: 25 },
            { label: 'Sector', val: analysis.riskBreakdown.sector, max: 20 },
            { label: 'Earnings', val: analysis.riskBreakdown.earningsProximity, max: 25 },
            { label: 'Momentum', val: analysis.riskBreakdown.momentum, max: 15 },
            { label: 'Market', val: analysis.riskBreakdown.market, max: 15 },
          ].map(({ label, val, max }) => (
            <div key={label} className={styles.breakdownRow}>
              <span className={styles.bLabel}>{label}</span>
              <div className={styles.bBar}>
                <div className={styles.bFill} style={{ width: `${Math.min(100, (val / max) * 100)}%` }} />
              </div>
              <span className={styles.bVal}>{val}/{max}</span>
            </div>
          ))}
          {analysis.isSellTheNewsRisk && (
            <div className={styles.stnTag}>⚡ +20 Sell-the-News</div>
          )}
        </div>
      )}

      {/* Earnings scenarios */}
      {analysis?.scenarios && (analysis.scenarios.bullish || analysis.scenarios.neutral || analysis.scenarios.bearish) && (
        <div className={styles.scenarios}>
          <span className={styles.sectionLabel}>Earnings Scenarios</span>
          {[
            { key: 'bullish', label: 'Bull', data: analysis.scenarios.bullish, colorCls: styles.scenarioBull },
            { key: 'neutral', label: 'Base', data: analysis.scenarios.neutral, colorCls: styles.scenarioBase },
            { key: 'bearish', label: 'Bear', data: analysis.scenarios.bearish, colorCls: styles.scenarioBear },
          ].map(({ key, label, data, colorCls }) => data && (
            <div key={key} className={`${styles.scenarioRow} ${colorCls}`}>
              <span className={styles.scenarioLabel}>{label}</span>
              <span className={styles.scenarioTarget}>{fmtPrice(data.priceTarget)}</span>
              <span className={styles.scenarioPct}>
                {data.percentMove > 0 ? '+' : ''}{data.percentMove?.toFixed(1)}%
              </span>
              {data.probability != null && (
                <span className={styles.scenarioProb}>{data.probability}%</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inline forms */}
      <div className={styles.forms}>
        {/* Entry price */}
        <div className={styles.formGroup}>
          <span className={styles.sectionLabel}>Entry / P&L</span>
          {portfolioEntry ? (
            <div className={styles.formInfo}>
              <span className={styles.formInfoVal}>@ {fmtPrice(portfolioEntry.entryPrice)}</span>
              {shares != null && (
                <span className={styles.sharesHint}>× {shares}</span>
              )}
              {pnlPct !== null && (
                <span className={`${styles.pnlVal} ${pnlPct >= 0 ? styles.pos : styles.neg}`}>
                  {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                  {pnlAbs != null && ` (${pnlAbs >= 0 ? '+' : ''}${fmtPrice(pnlAbs)})`}
                </span>
              )}
              <button
                className={styles.clearBtn}
                onClick={() => onUpdateEntryPrice?.(ticker, null)}
                disabled={entryLoading}
              >
                clear
              </button>
            </div>
          ) : (
            <form className={styles.inlineForm} onSubmit={handleEntrySubmit}>
              <input
                type="number" step="0.01" min="0.01"
                className={styles.input}
                placeholder="Entry price"
                value={entryInput}
                onChange={(e) => setEntryInput(e.target.value)}
                disabled={entryLoading}
              />
              <input
                type="number" step="0.01" min="0.01"
                className={`${styles.input} ${styles.inputShares}`}
                placeholder="Shares"
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                disabled={entryLoading}
              />
              <button type="submit" className={styles.submitBtn} disabled={entryLoading || !entryInput}>SET</button>
            </form>
          )}
        </div>

        {/* Alert */}
        <div className={styles.formGroup}>
          <span className={styles.sectionLabel}>Price Alert</span>
          {priceAlert ? (
            <div className={styles.formInfo}>
              <span className={styles.formInfoVal}>{priceAlert.direction} {fmtPrice(priceAlert.targetPrice)}</span>
              <button
                className={styles.clearBtn}
                onClick={() => onUpdateAlert?.(ticker, null)}
                disabled={alertLoading}
              >
                clear
              </button>
            </div>
          ) : (
            <form className={styles.inlineForm} onSubmit={handleAlertSubmit}>
              <select
                className={styles.select}
                value={alertDir}
                onChange={(e) => setAlertDir(e.target.value)}
                disabled={alertLoading}
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
              <input
                type="number" step="0.01" min="0.01"
                className={styles.input}
                placeholder="Target price"
                value={alertInput}
                onChange={(e) => setAlertInput(e.target.value)}
                disabled={alertLoading}
              />
              <button type="submit" className={styles.submitBtn} disabled={alertLoading || !alertInput}>SET</button>
            </form>
          )}
        </div>

        {/* Notes */}
        <div className={styles.formGroup}>
          <span className={styles.sectionLabel}>Note</span>
          <div className={styles.notesWrap}>
            <textarea
              className={styles.textarea}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note…"
              maxLength={1000}
              rows={2}
              disabled={noteSaving}
            />
            <div className={styles.notesActions}>
              <span className={styles.noteCount}>{noteText.length}/1000</span>
              <button className={styles.submitBtn} onClick={handleNoteSave} disabled={noteSaving}>SAVE</button>
              {note?.text && (
                <button className={styles.clearBtn} onClick={() => onUpdateNote?.(ticker, null)} disabled={noteSaving}>DELETE</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <Link to={`/stocks/${ticker}`} className={styles.detailLink}>View Full Analysis →</Link>
        {onAnalyzeTicker && (
          <button
            className={styles.analyzeBtn}
            onClick={() => onAnalyzeTicker(ticker)}
            disabled={isAnalyzing}
            title="Re-run analysis for this stock"
          >
            {isAnalyzing ? '⟳ Analyzing…' : '⟳ Re-analyze'}
          </button>
        )}
        <button
          className={`${styles.removeBtn} ${confirmRemove ? styles.removeBtnConfirm : ''}`}
          onClick={handleRemove}
          onBlur={() => setTimeout(() => setConfirmRemove(false), 150)}
        >
          {confirmRemove ? 'Confirm?' : 'Remove'}
        </button>
        {confirmRemove && (
          <button
            className={styles.cancelBtn}
            onClick={() => setConfirmRemove(false)}
          >
            Cancel
          </button>
        )}
        {analysisError && <span className={styles.error}>{analysisError}</span>}
      </div>
    </div>
  );
}
