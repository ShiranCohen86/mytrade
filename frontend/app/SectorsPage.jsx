import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStocks } from '@/hooks/useStocks';
import { fmtPrice } from '@/lib/format';
import { ExtPriceBadge } from '@/components/ExtPriceBadge/ExtPriceBadge';
import styles from './SectorsPage.module.scss';

const SORT_OPTIONS = [
  { key: 'size',   label: 'Size' },
  { key: 'change', label: 'Today' },
  { key: 'risk',   label: 'Risk' },
  { key: 'expect', label: 'Expect' },
];

function riskPipClass(score) {
  if (score == null) return '';
  if (score >= 70) return styles.high;
  if (score >= 40) return styles.mid;
  return styles.low;
}

export default function SectorsPage() {
  const { stocks, isLoading } = useStocks();
  const [sortBy, setSortBy] = useState('size');

  const sectors = useMemo(() => {
    if (!stocks.length) return [];

    const map = new Map();
    for (const s of stocks) {
      const key = s.sector || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }

    const list = Array.from(map.entries())
      .map(([name, items]) => {
        const analyzed = items.filter((s) => s.analysis?.riskScore != null);
        const avgRisk = analyzed.length
          ? analyzed.reduce((sum, s) => sum + s.analysis.riskScore, 0) / analyzed.length
          : null;
        const avgExp = analyzed.length
          ? analyzed.reduce((sum, s) => sum + (s.analysis?.expectationScore ?? 0), 0) / analyzed.length
          : null;
        const priced = items.filter((s) => s.cachedData?.changePercent != null);
        const avgChange = priced.length
          ? priced.reduce((sum, s) => sum + s.cachedData.changePercent, 0) / priced.length
          : null;
        return { name, items, avgRisk, avgExp, avgChange };
      });

    switch (sortBy) {
      case 'change': return list.sort((a, b) => (b.avgChange ?? -Infinity) - (a.avgChange ?? -Infinity));
      case 'risk':   return list.sort((a, b) => (b.avgRisk ?? -Infinity) - (a.avgRisk ?? -Infinity));
      case 'expect': return list.sort((a, b) => (b.avgExp ?? -Infinity) - (a.avgExp ?? -Infinity));
      default:       return list.sort((a, b) => b.items.length - a.items.length);
    }
  }, [stocks, sortBy]);

  const maxCount = useMemo(
    () => (sectors.length ? [...sectors].sort((a, b) => b.items.length - a.items.length)[0].items.length : 1),
    [sectors]
  );

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <span className={styles.pageTitle}>Sectors</span>
        {sectors.length > 0 && (
          <>
            <span className={styles.count}>{sectors.length} sector{sectors.length !== 1 ? 's' : ''}</span>
            <div className={styles.sortPills}>
              {SORT_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`${styles.sortPill} ${sortBy === key ? styles.sortPillActive : ''}`}
                  onClick={() => setSortBy(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>Loading…</span>
        </div>
      ) : sectors.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>No stocks yet</span>
          <span className={styles.emptySubtitle}>
            Add stocks to your watchlist to see sector breakdown here.
          </span>
        </div>
      ) : (
        <div className={styles.grid}>
          {sectors.map(({ name, items, avgRisk, avgExp, avgChange }) => (
            <div key={name} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.sectorName}>{name}</span>
                <div className={styles.headerStats}>
                  {avgChange != null && (
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Today</span>
                      <span className={`${styles.statValue} ${avgChange >= 0 ? styles.pos : styles.neg}`}>
                        {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {avgRisk != null && (
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Risk</span>
                      <span className={styles.statValue}>{avgRisk.toFixed(0)}</span>
                    </div>
                  )}
                  {avgExp != null && (
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Expect</span>
                      <span className={styles.statValue}>{avgExp.toFixed(0)}</span>
                    </div>
                  )}
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Stocks</span>
                    <span className={styles.statValue}>{items.length}</span>
                  </div>
                </div>
              </div>

              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ width: `${(items.length / maxCount) * 100}%` }}
                />
              </div>

              <div className={styles.stockList}>
                {items.map((s) => {
                  const pct = s.cachedData?.changePercent ?? null;
                  const isPos = pct != null && pct >= 0;
                  return (
                    <div key={s.ticker} className={styles.stockRow}>
                      <span
                        className={`${styles.riskPip} ${riskPipClass(s.analysis?.riskScore)}`}
                        title={s.analysis?.riskScore != null ? `Risk: ${s.analysis.riskScore.toFixed(0)}` : 'Not analyzed'}
                      />
                      <Link to={`/stocks/${s.ticker}`} className={styles.stockTicker}>
                        {s.ticker}
                      </Link>
                      <span className={styles.stockName}>{s.name || ''}</span>
                      <div className={styles.stockMeta}>
                        <span className={styles.price}>
                          {fmtPrice(s.cachedData?.price)}
                          <ExtPriceBadge cachedData={s.cachedData} />
                        </span>
                        {pct != null && (
                          <span className={`${styles.change} ${isPos ? styles.pos : styles.neg}`}>
                            {isPos ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
