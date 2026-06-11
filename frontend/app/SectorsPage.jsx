import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStocks } from '@/hooks/useStocks';
import { useFmtPrice } from '@/hooks/useFmtPrice';
import { ExtPriceBadge } from '@/components/ExtPriceBadge/ExtPriceBadge';
import { Skeleton } from '@/components/Skeleton/Skeleton';
import styles from './SectorsPage.module.scss';

function riskPipClass(score) {
  if (score == null) return '';
  if (score >= 70) return styles.high;
  if (score >= 40) return styles.mid;
  return styles.low;
}

export default function SectorsPage() {
  const { stocks, isLoading, error, reload } = useStocks();
  const { t } = useTranslation();
  const { fmtPrice } = useFmtPrice();
  const [sortBy, setSortBy] = useState('size');

  const SORT_OPTIONS = [
    { key: 'size',   label: t('sectors.sortSize') },
    { key: 'change', label: t('sectors.sortToday') },
    { key: 'risk',   label: t('sectors.sortRisk') },
    { key: 'expect', label: t('sectors.sortExpect') },
  ];

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
        const withRegime = analyzed.filter((s) => s.analysis?.marketRegime);
        const bullish  = withRegime.filter((s) => s.analysis.marketRegime === 'BULLISH').length;
        const bearish  = withRegime.filter((s) => s.analysis.marketRegime === 'BEARISH').length;
        const volatile = withRegime.filter((s) => s.analysis.marketRegime === 'VOLATILE').length;
        const neutral  = withRegime.filter((s) => s.analysis.marketRegime === 'NEUTRAL').length;
        const regimeTotal = withRegime.length;
        return { name, items, avgRisk, avgExp, avgChange, bullish, bearish, volatile, neutral, regimeTotal };
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
        <h1 className={styles.pageTitle}>{t('sectors.title')}</h1>
        {sectors.length > 0 && (
          <>
            <span className={styles.count}>{t('sectors.sectors', { count: sectors.length })}</span>
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
        <div style={{ display: 'grid', gap: 12, padding: 4 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} h={64} radius={14} />
          ))}
        </div>
      ) : error && sectors.length === 0 ? (
        <div className={styles.empty} role="alert">
          <span className={styles.emptyTitle}>{t('common.loadErrorTitle')}</span>
          <span className={styles.emptySubtitle}>{error}</span>
          <button className="btn btn-secondary btn-sm" onClick={reload} style={{ marginTop: 12 }}>
            {t('common.retry')}
          </button>
        </div>
      ) : sectors.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>{t('sectors.empty')}</span>
          <span className={styles.emptySubtitle}>{t('sectors.emptySubtitle')}</span>
        </div>
      ) : (
        <div className={styles.grid}>
          {sectors.map(({ name, items, avgRisk, avgExp, avgChange, bullish, bearish, volatile, neutral, regimeTotal }) => (
            <div key={name} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.sectorName}>{name}</span>
                <div className={styles.headerStats}>
                  {avgChange != null && (
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>{t('sectors.statToday')}</span>
                      <span className={`${styles.statValue} ${avgChange >= 0 ? styles.pos : styles.neg}`}>
                        {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {avgRisk != null && (
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>{t('sectors.statRisk')}</span>
                      <span className={styles.statValue}>{avgRisk.toFixed(0)}</span>
                    </div>
                  )}
                  {avgExp != null && (
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>{t('sectors.statExpect')}</span>
                      <span className={styles.statValue}>{avgExp.toFixed(0)}</span>
                    </div>
                  )}
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>{t('sectors.statStocks')}</span>
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

              {regimeTotal > 0 && (bullish > 0 || bearish > 0 || volatile > 0 || neutral > 0) && (
                <div className={styles.regimeBar}>
                  {bullish > 0 && <div className={styles.regimeBull} style={{ width: `${(bullish / regimeTotal) * 100}%` }} title={`${bullish} Bullish`} />}
                  {volatile > 0 && <div className={styles.regimeVol} style={{ width: `${(volatile / regimeTotal) * 100}%` }} title={`${volatile} Volatile`} />}
                  {neutral > 0 && <div className={styles.regimeNeutral} style={{ width: `${(neutral / regimeTotal) * 100}%` }} title={`${neutral} Neutral`} />}
                  {bearish > 0 && <div className={styles.regimeBear} style={{ width: `${(bearish / regimeTotal) * 100}%` }} title={`${bearish} Bearish`} />}
                </div>
              )}

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
