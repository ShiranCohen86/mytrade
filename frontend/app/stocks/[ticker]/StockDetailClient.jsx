
import { Link } from 'react-router-dom';
import { useStockAnalysis } from '@/hooks/useStockAnalysis';
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
import styles from './page.module.scss';

function fmtPrice(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function fmtBig(n) {
  if (n == null || n === 0) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
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
        <Link to="/" className={styles.backLink}>← Back to Watchlist</Link>
      </div>
    );
  }

  const { cachedData, analysis, name, sector } = stock;
  const hist = cachedData?.historical || [];

  const p7  = pctChange(hist, 7);
  const p30 = pctChange(hist, 30);
  const p60 = pctChange(hist, 60);

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
        {/* Left column: Chart + News */}
        <div className={styles.leftCol}>
          <PanelCard title="Price Chart">
            <PriceChart historical={hist} ticker={ticker} />
          </PanelCard>
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

        {/* Right column: Scenarios */}
        <div className={styles.rightCol}>
          <PanelCard title="Earnings Scenarios">
            <ScenarioPanel scenarios={analysis.scenarios} currentPrice={cachedData.price} />
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
