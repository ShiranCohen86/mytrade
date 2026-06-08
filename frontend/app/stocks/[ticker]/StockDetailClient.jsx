
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStockAnalysis } from '@/hooks/useStockAnalysis';
import { useStocks } from '@/hooks/useStocks';
import { PriceChart } from '@/components/PriceChart/PriceChart';
import { RiskGauge } from '@/components/RiskGauge/RiskGauge';
import { ExpectationMeter } from '@/components/ExpectationMeter/ExpectationMeter';
import { ScenarioPanel } from '@/components/ScenarioPanel/ScenarioPanel';
import { DriftIndicator } from '@/components/DriftIndicator/DriftIndicator';
import { MarketRegimeBadge } from '@/components/MarketRegimeBadge/MarketRegimeBadge';
import { NewsPanel } from '@/components/NewsPanel/NewsPanel';
import { HeroBar } from '@/components/HeroBar/HeroBar';
import { StatsBar } from '@/components/StatsBar/StatsBar';
import { PanelCard } from '@/components/PanelCard/PanelCard';
import { fmtPrice, fmtBig } from '@/lib/format';
import { ExtPriceBadge } from '@/components/ExtPriceBadge/ExtPriceBadge';
import styles from './page.module.scss';

function RangeBar({ label, low, high, current }) {
  if (low == null || high == null || current == null) return null;
  const pct = high > low ? Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100)) : 50;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--text-disabled)' }}>
        <span style={{ fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ minWidth: 52, textAlign: 'right' }}>${low.toFixed(2)}</span>
        <div style={{ flex: 1, height: 6, background: 'var(--chrome-dim)', borderRadius: 3, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-secondary))', borderRadius: 3 }} />
          <div style={{ position: 'absolute', top: -3, left: `calc(${pct}% - 5px)`, width: 10, height: 10, background: 'var(--text-primary)', border: '2px solid var(--surface-elevated)', borderRadius: '50%', boxShadow: 'var(--shadow-xs)' }} />
        </div>
        <span style={{ minWidth: 52 }}>${high.toFixed(2)}</span>
      </div>
    </div>
  );
}

function ScoreTrendChart({ scoreHistory }) {
  const pts = (scoreHistory || []).slice(-20);
  if (pts.length < 3) return null;
  const W = 280, H = 60;
  const risks = pts.map((p) => p.riskScore ?? 0);
  const exps = pts.map((p) => p.expectationScore ?? 0);
  const minV = 0, maxV = 100;
  const toX = (i) => (i / (pts.length - 1)) * W;
  const toY = (v) => H - ((v - minV) / (maxV - minV)) * H;
  const riskPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.riskScore ?? 0).toFixed(1)}`).join(' ');
  const expPath  = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.expectationScore ?? 0).toFixed(1)}`).join(' ');
  const lastRisk = risks[risks.length - 1];
  const riskColor = lastRisk >= 70 ? 'var(--neg)' : lastRisk >= 40 ? 'var(--warn)' : 'var(--pos)';
  return (
    <div style={{ padding: '12px 16px' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
        <line x1="0" y1={toY(70)} x2={W} y2={toY(70)} stroke="var(--neg)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.35" />
        <line x1="0" y1={toY(40)} x2={W} y2={toY(40)} stroke="var(--warn)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.35" />
        <path d={expPath} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        <path d={riskPath} fill="none" stroke={riskColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={toX(pts.length - 1)} cy={toY(lastRisk)} r="3" fill={riskColor} />
        <circle cx={toX(pts.length - 1)} cy={toY(exps[exps.length - 1])} r="2.5" fill="var(--accent)" />
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontFamily: 'Inter, sans-serif', fontSize: 10 }}>
        <span style={{ color: riskColor, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 2, background: riskColor, display: 'inline-block' }} />
          Risk (now {lastRisk.toFixed(0)})
        </span>
        <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 2, background: 'var(--accent)', display: 'inline-block', opacity: 0.6 }} />
          Expectation (now {exps[exps.length - 1].toFixed(0)})
        </span>
      </div>
    </div>
  );
}

function pctChange(historical, days) {
  if (!historical || historical.length < days + 1) return null;
  const now = historical[historical.length - 1].close;
  const past = historical[historical.length - 1 - days]?.close;
  if (!past) return null;
  return ((now - past) / past) * 100;
}

// ─── Quick Actions inline panel ───────────────────────────────────────────────

function QuickActionsPanel({ ticker, portfolioEntry, priceAlert, note, currentPrice, onUpdateEntryPrice, onUpdateAlert, onUpdateNote }) {
  const [entryInput, setEntryInput] = useState('');
  const [sharesInput, setSharesInput] = useState('');
  const [alertInput, setAlertInput] = useState('');
  const [alertDir, setAlertDir] = useState('above');
  const [noteText, setNoteText] = useState(note?.text ?? '');
  const [entryLoading, setEntryLoading] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  const shares = portfolioEntry?.shares ?? null;
  const pnlPct = portfolioEntry && currentPrice
    ? ((currentPrice - portfolioEntry.entryPrice) / portfolioEntry.entryPrice) * 100
    : null;
  const pnlAbs = portfolioEntry && currentPrice && shares
    ? (currentPrice - portfolioEntry.entryPrice) * shares
    : null;

  return (
    <div className={styles.quickActions}>
      {/* Entry / P&L */}
      <div className={styles.qaGroup}>
        <span className={styles.qaLabel}>Entry / P&amp;L</span>
        {portfolioEntry ? (
          <div className={styles.qaInfo}>
            <span className={styles.qaInfoVal}>@ {fmtPrice(portfolioEntry.entryPrice)}</span>
            {shares != null && <span className={styles.qaInfoVal} style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>× {shares} shares</span>}
            {pnlPct != null && (
              <span className={`${styles.qaPnl} ${pnlPct >= 0 ? styles.qaPos : styles.qaNeg}`}>
                {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                {pnlAbs != null && ` (${pnlAbs >= 0 ? '+' : ''}${fmtPrice(pnlAbs)})`}
              </span>
            )}
            <button className={styles.qaClear} onClick={() => onUpdateEntryPrice?.(ticker, null)} disabled={entryLoading}>clear</button>
          </div>
        ) : (
          <form className={styles.qaForm} onSubmit={async (e) => {
            e.preventDefault();
            const p = parseFloat(entryInput);
            if (!isFinite(p) || p <= 0) return;
            const s = sharesInput ? parseFloat(sharesInput) : null;
            setEntryLoading(true);
            try { await onUpdateEntryPrice?.(ticker, p, s && isFinite(s) && s > 0 ? s : null); setEntryInput(''); setSharesInput(''); } finally { setEntryLoading(false); }
          }}>
            <input type="number" step="0.01" min="0.01" className={styles.qaInput} placeholder="Entry price" value={entryInput} onChange={(e) => setEntryInput(e.target.value)} disabled={entryLoading} />
            <input type="number" step="0.01" min="0.01" className={styles.qaInput} style={{ maxWidth: '72px' }} placeholder="Shares" value={sharesInput} onChange={(e) => setSharesInput(e.target.value)} disabled={entryLoading} />
            <button type="submit" className={styles.qaBtn} disabled={entryLoading || !entryInput}>Set</button>
          </form>
        )}
      </div>

      {/* Price Alert */}
      <div className={styles.qaGroup}>
        <span className={styles.qaLabel}>Price Alert</span>
        {priceAlert ? (
          <div className={styles.qaInfo}>
            <span className={styles.qaInfoVal}>{priceAlert.direction} {fmtPrice(priceAlert.targetPrice)}</span>
            <button className={styles.qaClear} onClick={() => onUpdateAlert?.(ticker, null)} disabled={alertLoading}>clear</button>
          </div>
        ) : (
          <form className={styles.qaForm} onSubmit={async (e) => {
            e.preventDefault();
            const p = parseFloat(alertInput);
            if (!isFinite(p) || p <= 0) return;
            setAlertLoading(true);
            try { await onUpdateAlert?.(ticker, p, alertDir); setAlertInput(''); } finally { setAlertLoading(false); }
          }}>
            <select className={styles.qaSelect} value={alertDir} onChange={(e) => setAlertDir(e.target.value)} disabled={alertLoading}>
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
            <input type="number" step="0.01" min="0.01" className={styles.qaInput} placeholder="Target" value={alertInput} onChange={(e) => setAlertInput(e.target.value)} disabled={alertLoading} />
            <button type="submit" className={styles.qaBtn} disabled={alertLoading || !alertInput}>Set</button>
          </form>
        )}
      </div>

      {/* Notes */}
      <div className={styles.qaGroup}>
        <span className={styles.qaLabel}>Note</span>
        <div className={styles.qaNoteWrap}>
          <textarea
            className={styles.qaTextarea}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a personal note…"
            maxLength={1000}
            rows={2}
            disabled={noteSaving}
          />
          <div className={styles.qaNoteActions}>
            <span className={styles.qaCount}>{noteText.length}/1000</span>
            <button className={styles.qaBtn} onClick={async () => {
              setNoteSaving(true);
              try { await onUpdateNote?.(ticker, noteText.trim() || null); } finally { setNoteSaving(false); }
            }} disabled={noteSaving}>Save</button>
            {note?.text && (
              <button className={styles.qaClear} onClick={() => { setNoteText(''); onUpdateNote?.(ticker, null); }} disabled={noteSaving}>Delete</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function StockDetailClient({ ticker }) {
  const { stock, isLoading, isRefreshing, error, refresh } = useStockAnalysis(ticker);
  const { stocks: allStocks, portfolio, priceAlerts, notes, updateEntryPrice, updateAlert, updateNote } = useStocks();

  if (isLoading && !stock) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading {ticker}…</span>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className={styles.errorState}>
        <p>{error || 'Stock not found'}</p>
        <Link to="/dashboard" className={styles.backLink}>← Back to Watchlist</Link>
      </div>
    );
  }

  const { cachedData, analysis, name, sector, scoreHistory, description, industry, employees, website, stockPriceAtAdd, spyPriceAtAdd } = stock;
  const hist = cachedData?.historical || [];

  const sinceAddPct = stockPriceAtAdd != null && cachedData?.price != null
    ? ((cachedData.price - stockPriceAtAdd) / stockPriceAtAdd) * 100
    : null;
  const spySinceAddPct = spyPriceAtAdd != null && cachedData?.spyPrice != null
    ? ((cachedData.spyPrice - spyPriceAtAdd) / spyPriceAtAdd) * 100
    : null;
  const alphaSinceAdd = sinceAddPct != null && spySinceAddPct != null
    ? sinceAddPct - spySinceAddPct
    : null;

  const sectorPeers = allStocks
    .filter((s) => s.ticker !== ticker && s.sector === sector && s.sector && s.sector !== 'Unknown')
    .slice(0, 6);

  const portfolioEntry = portfolio.find((p) => p.ticker === ticker) ?? null;
  const priceAlert = priceAlerts.find((a) => a.ticker === ticker) ?? null;
  const note = notes.find((n) => n.ticker === ticker) ?? null;

  const p7  = pctChange(hist, 7);
  const p30 = pctChange(hist, 30);
  const p60 = pctChange(hist, 60);

  const volumeRatio = (() => {
    if (!cachedData?.volume || hist.length < 10) return null;
    const vols = hist.slice(-30).map((d) => d.volume).filter(Boolean);
    if (!vols.length) return null;
    const avg = vols.reduce((s, v) => s + v, 0) / vols.length;
    return avg > 0 ? cachedData.volume / avg : null;
  })();

  const earningsDateStr = cachedData?.earningsDate
    ? new Date(cachedData.earningsDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const daysToEarnings = cachedData?.earningsDate
    ? Math.ceil((new Date(cachedData.earningsDate).getTime() - Date.now()) / 86_400_000)
    : null;

  const statItems = [
    ...(sinceAddPct != null ? [{
      label: 'Since Added',
      value: `${sinceAddPct >= 0 ? '+' : ''}${sinceAddPct.toFixed(1)}%`,
      highlight: sinceAddPct >= 0 ? 'pos' : 'neg',
    }] : []),
    ...(alphaSinceAdd != null ? [{
      label: 'vs SPY',
      value: `${alphaSinceAdd >= 0 ? '+' : ''}${alphaSinceAdd.toFixed(1)}%`,
      highlight: alphaSinceAdd >= 0 ? 'pos' : 'neg',
    }] : []),
    ...(p7 !== null  ? [{ label: '7d',  value: `${p7  >= 0 ? '+' : ''}${p7.toFixed(1)}%`,  highlight: p7  >= 0 ? 'pos' : 'neg' }] : []),
    ...(p30 !== null ? [{ label: '30d', value: `${p30 >= 0 ? '+' : ''}${p30.toFixed(1)}%`, highlight: p30 >= 0 ? 'pos' : 'neg' }] : []),
    ...(p60 !== null ? [{ label: '60d', value: `${p60 >= 0 ? '+' : ''}${p60.toFixed(1)}%`, highlight: p60 >= 0 ? 'pos' : 'neg' }] : []),
    { label: 'Vol', value: cachedData?.volume ? `${(cachedData.volume / 1e6).toFixed(1)}M` : '—' },
    ...(volumeRatio != null
      ? [{
          label: 'Vol vs Avg',
          value: `${volumeRatio.toFixed(1)}×`,
          highlight: volumeRatio >= 2 ? (cachedData?.changePercent >= 0 ? 'pos' : 'neg') : volumeRatio >= 1.5 ? 'warn' : undefined,
        }]
      : []
    ),
    { label: 'Mkt Cap', value: fmtBig(cachedData?.marketCap) },
    ...(cachedData?.peRatio ? [{ label: 'P/E', value: cachedData.peRatio.toFixed(1) }] : []),
    ...(cachedData?.beta ? [{ label: 'Beta', value: cachedData.beta.toFixed(2) }] : []),
    ...(cachedData?.dayHigh != null ? [{ label: 'High', value: fmtPrice(cachedData.dayHigh) }] : []),
    ...(cachedData?.dayLow != null  ? [{ label: 'Low',  value: fmtPrice(cachedData.dayLow)  }] : []),
    ...(cachedData?.fiftyTwoWeekHigh != null && cachedData?.fiftyTwoWeekLow != null
      ? [{ label: '52w', value: `${fmtPrice(cachedData.fiftyTwoWeekLow)} – ${fmtPrice(cachedData.fiftyTwoWeekHigh)}` }]
      : []
    ),
    ...(earningsDateStr && daysToEarnings !== null && daysToEarnings >= 0
      ? [{ label: 'Earnings', value: `${earningsDateStr} (${daysToEarnings === 0 ? 'Today' : `${daysToEarnings}d`})`, highlight: daysToEarnings <= 7 ? 'warn' : undefined }]
      : []
    ),
    ...(cachedData?.dividendYield ? [{ label: 'Div Yield', value: `${(cachedData.dividendYield * 100).toFixed(2)}%` }] : []),
    ...(cachedData?.analystTargetPrice && cachedData?.price
      ? (() => {
          const target = cachedData.analystTargetPrice;
          const upside = ((target - cachedData.price) / cachedData.price) * 100;
          const low = cachedData.analystLowPrice;
          const high = cachedData.analystHighPrice;
          const rangeStr = low && high ? ` (${fmtPrice(low)} – ${fmtPrice(high)})` : '';
          return [{ label: 'Analyst Target', value: `${fmtPrice(target)}${rangeStr} · ${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`, highlight: upside >= 5 ? 'pos' : upside <= -5 ? 'neg' : undefined }];
        })()
      : []
    ),
    ...(cachedData?.recommendationKey && cachedData?.numberOfAnalysts
      ? (() => {
          const key = cachedData.recommendationKey;
          const label = key === 'strong_buy' ? 'Strong Buy' : key === 'buy' ? 'Buy' : key === 'hold' ? 'Hold' : key === 'sell' ? 'Sell' : key === 'strong_sell' ? 'Strong Sell' : key;
          const highlight = key === 'strong_buy' || key === 'buy' ? 'pos' : key === 'strong_sell' || key === 'sell' ? 'neg' : undefined;
          return [{ label: `Analysts (${cachedData.numberOfAnalysts})`, value: label, highlight }];
        })()
      : []
    ),
  ];

  return (
    <div className={styles.page}>
      <HeroBar
        ticker={ticker}
        name={name}
        sector={sector}
        price={cachedData?.price}
        change={cachedData?.change}
        changePercent={cachedData?.changePercent}
        preMarketPrice={cachedData?.preMarketPrice}
        preMarketChange={cachedData?.preMarketChange}
        preMarketChangePercent={cachedData?.preMarketChangePercent}
        postMarketPrice={cachedData?.postMarketPrice}
        postMarketChange={cachedData?.postMarketChange}
        postMarketChangePercent={cachedData?.postMarketChangePercent}
        marketState={cachedData?.marketState}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
      />

      <StatsBar items={statItems} />

      {/* Day range + 52-week range */}
      {(cachedData?.dayLow != null || cachedData?.fiftyTwoWeekLow != null) && (
        <div className={styles.rangeSection}>
          <RangeBar label="Day Range" low={cachedData.dayLow} high={cachedData.dayHigh} current={cachedData.price} />
          <RangeBar label="52-Week Range" low={cachedData.fiftyTwoWeekLow} high={cachedData.fiftyTwoWeekHigh} current={cachedData.price} />
        </div>
      )}

      {/* Market regime inline label */}
      <div className={styles.regimeRow}>
        <MarketRegimeBadge regime={analysis.marketRegime} size="sm" />
        {analysis.analyzedAt && (() => {
          const ageDays = Math.floor((Date.now() - new Date(analysis.analyzedAt).getTime()) / 86_400_000);
          const isStale = ageDays >= 7;
          return (
            <span className={`${styles.analyzedAt} ${isStale ? styles.analyzedAtStale : ''}`} title={isStale ? `Analysis is ${ageDays} days old — click Refresh to update` : undefined}>
              {isStale && <span aria-hidden="true">⚠ </span>}
              Analyzed {new Date(analysis.analyzedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {isStale && ` (${ageDays}d ago)`}
            </span>
          );
        })()}
      </div>

      <div className={styles.detailGrid}>
        {/* Left column: Chart + Score Trend + News */}
        <div className={styles.leftCol}>
          <PanelCard title="Price Chart">
            <PriceChart
                historical={hist}
                ticker={ticker}
                entryPrice={portfolioEntry?.entryPrice ?? null}
                alertPrice={priceAlert?.targetPrice ?? null}
                alertDirection={priceAlert?.direction ?? null}
                fiftyTwoWeekHigh={cachedData?.fiftyTwoWeekHigh ?? null}
                fiftyTwoWeekLow={cachedData?.fiftyTwoWeekLow ?? null}
              />
          </PanelCard>
          {description && (
            <PanelCard title="About">
              <div className={styles.aboutSection}>
                <p className={styles.aboutText}>{description}</p>
                <div className={styles.aboutMeta}>
                  {industry && industry !== 'Unknown' && (
                    <span className={styles.aboutChip}>{industry}</span>
                  )}
                  {employees != null && (
                    <span className={styles.aboutChip}>
                      {employees >= 1000 ? `${(employees / 1000).toFixed(0)}k employees` : `${employees} employees`}
                    </span>
                  )}
                  {website && (
                    <a href={website} target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>
                      {new URL(website).hostname.replace('www.', '')} ↗
                    </a>
                  )}
                </div>
              </div>
            </PanelCard>
          )}
          {(scoreHistory?.length ?? 0) >= 3 && (
            <PanelCard title="Risk & Expectation Trend">
              <ScoreTrendChart scoreHistory={scoreHistory} />
            </PanelCard>
          )}
          <PanelCard title="News & Sentiment">
            <NewsPanel ticker={ticker} />
          </PanelCard>
        </div>

        {/* Mid column: Risk + Expectation + Drift */}
        <div className={styles.midCol}>
          <PanelCard title="Risk Score">
            <RiskGauge
              riskScore={analysis.riskScore}
              riskLabel={analysis.riskLabel}
              breakdown={analysis.riskBreakdown}
            />
          </PanelCard>
          <PanelCard title="Expectation Score">
            <ExpectationMeter score={analysis.expectationScore} label={analysis.expectationLabel} />
          </PanelCard>
          <PanelCard title="Pre-Earnings Drift">
            <DriftIndicator
              drift={analysis.preEarningsDrift}
              driftPercent={analysis.driftPercent}
              isSellTheNewsRisk={analysis.isSellTheNewsRisk}
            />
          </PanelCard>
          <PanelCard title="Sentiment">
            <div className={styles.sentimentRow}>
              <span className={`${styles.sentimentLabel} ${styles[`sent_${analysis.sentiment.label}`]}`}>
                {analysis.sentiment.label.toUpperCase()}
              </span>
              <span className={styles.sentimentMeta}>
                {analysis.sentiment.headlinesAnalyzed > 0
                  ? `${analysis.sentiment.headlinesAnalyzed} headlines`
                  : 'No news data'}
              </span>
            </div>
          </PanelCard>
        </div>

        {/* Right column: Scenarios + Peers */}
        <div className={styles.rightCol}>
          <PanelCard title="Earnings Scenarios">
            <ScenarioPanel scenarios={analysis.scenarios} currentPrice={cachedData.price} cachedData={cachedData} />
          </PanelCard>
          {sectorPeers.length > 0 && (
            <PanelCard title={`Sector Peers · ${sector}`}>
              <div className={styles.peerList}>
                {sectorPeers.map((peer) => {
                  const pct = peer.cachedData?.changePercent;
                  const isPos = pct != null && pct >= 0;
                  const risk = peer.analysis?.riskScore;
                  return (
                    <Link key={peer.ticker} to={`/stocks/${peer.ticker}`} className={styles.peerRow}>
                      <span className={styles.peerTicker}>{peer.ticker}</span>
                      <span className={styles.peerName}>{peer.name || ''}</span>
                      <span className={styles.peerMeta}>
                        {peer.cachedData?.price != null && (
                          <span className={styles.peerPrice}>
                            {fmtPrice(peer.cachedData.price)}
                            <ExtPriceBadge cachedData={peer.cachedData} />
                          </span>
                        )}
                        {pct != null && (
                          <span className={`${styles.peerChange} ${isPos ? styles.pos : styles.neg}`}>
                            {isPos ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        )}
                        {risk != null && (
                          <span className={`${styles.peerRisk} ${risk >= 70 ? styles.neg : risk >= 40 ? styles.warn : styles.pos}`}>
                            R{risk.toFixed(0)}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </PanelCard>
          )}
          <PanelCard title="Quick Actions">
            <QuickActionsPanel
              ticker={ticker}
              portfolioEntry={portfolioEntry}
              priceAlert={priceAlert}
              note={note}
              currentPrice={cachedData?.price}
              onUpdateEntryPrice={updateEntryPrice}
              onUpdateAlert={updateAlert}
              onUpdateNote={updateNote}
            />
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
