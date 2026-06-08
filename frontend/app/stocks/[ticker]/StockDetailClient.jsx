
import { useMemo } from 'react';
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
import styles from './page.module.scss';

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

export default function StockDetailClient({ ticker }) {
  const { stock, isLoading, isRefreshing, error, refresh } = useStockAnalysis(ticker);
  const { stocks: allStocks } = useStocks();

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

  const { cachedData, analysis, name, sector, scoreHistory } = stock;
  const hist = cachedData?.historical || [];

  const sectorPeers = allStocks
    .filter((s) => s.ticker !== ticker && s.sector === sector && s.sector && s.sector !== 'Unknown')
    .slice(0, 6);

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

      {/* Market regime inline label */}
      <div className={styles.regimeRow}>
        <MarketRegimeBadge regime={analysis.marketRegime} size="sm" />
        {analysis.analyzedAt && (
          <span className={styles.analyzedAt}>
            Analyzed {new Date(analysis.analyzedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      <div className={styles.detailGrid}>
        {/* Left column: Chart + Score Trend + News */}
        <div className={styles.leftCol}>
          <PanelCard title="Price Chart">
            <PriceChart historical={hist} ticker={ticker} />
          </PanelCard>
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
            <ScenarioPanel scenarios={analysis.scenarios} currentPrice={cachedData.price} />
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
                          <span className={styles.peerPrice}>{fmtPrice(peer.cachedData.price)}</span>
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
        </div>
      </div>
    </div>
  );
}
