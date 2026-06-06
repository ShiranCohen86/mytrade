import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStocks } from '@/hooks/useStocks';
import styles from './PortfolioPage.module.scss';

function fmtPrice(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function fmtPct(n) {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function riskClass(score) {
  if (score >= 70) return styles.high;
  if (score >= 40) return styles.mid;
  return styles.low;
}

export default function PortfolioPage() {
  const { stocks, portfolio, isLoading } = useStocks();

  const rows = useMemo(() => {
    if (!portfolio.length || !stocks.length) return [];
    return portfolio
      .map((entry) => {
        const stock = stocks.find((s) => s.ticker === entry.ticker);
        if (!stock) return null;
        const price = stock.cachedData?.price ?? null;
        const pnlAbs = price != null ? price - entry.entryPrice : null;
        const pnlPct = pnlAbs != null ? (pnlAbs / entry.entryPrice) * 100 : null;
        return {
          ticker: stock.ticker,
          name: stock.name,
          sector: stock.sector,
          entryPrice: entry.entryPrice,
          currentPrice: price,
          pnlAbs,
          pnlPct,
          riskScore: stock.analysis?.riskScore ?? null,
          expectationScore: stock.analysis?.expectationScore ?? null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.pnlPct ?? -Infinity) - (a.pnlPct ?? -Infinity));
  }, [stocks, portfolio]);

  const totals = useMemo(() => {
    const withPrice = rows.filter((r) => r.pnlAbs != null);
    if (!withPrice.length) return null;
    const totalCost   = withPrice.reduce((s, r) => s + r.entryPrice, 0);
    const totalValue  = withPrice.reduce((s, r) => s + r.currentPrice, 0);
    const totalPnlAbs = totalValue - totalCost;
    const totalPnlPct = (totalPnlAbs / totalCost) * 100;
    return { totalCost, totalValue, totalPnlAbs, totalPnlPct, count: withPrice.length };
  }, [rows]);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <span className={styles.pageTitle}>Portfolio</span>
        {rows.length > 0 && (
          <span className={styles.count}>{rows.length} position{rows.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {totals && (
        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total Cost</span>
            <span className={styles.summaryValue}>{fmtPrice(totals.totalCost)}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Market Value</span>
            <span className={styles.summaryValue}>{fmtPrice(totals.totalValue)}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total P&amp;L</span>
            <span className={`${styles.summaryValue} ${totals.totalPnlAbs >= 0 ? styles.pos : styles.neg}`}>
              {fmtPrice(totals.totalPnlAbs)}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Return</span>
            <span className={`${styles.summaryValue} ${totals.totalPnlPct >= 0 ? styles.pos : styles.neg}`}>
              {fmtPct(totals.totalPnlPct)}
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>Loading…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>No positions yet</span>
          <span className={styles.emptySubtitle}>
            Set an entry price on any stock in your watchlist using the&nbsp;$ button to track it here.
          </span>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Ticker</th>
                <th className={styles.th}>Sector</th>
                <th className={styles.th}>Entry</th>
                <th className={styles.th}>Current</th>
                <th className={styles.th}>P&amp;L</th>
                <th className={styles.th}>Return</th>
                <th className={styles.th}>Risk</th>
                <th className={styles.th}>Expect</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ticker} className={styles.tr}>
                  <td className={`${styles.td} ${styles.tickerCell}`}>
                    <Link to={`/stocks/${r.ticker}`} className={styles.tickerLink}>
                      {r.ticker}
                    </Link>
                    {r.name && <span className={styles.name}>{r.name}</span>}
                  </td>
                  <td className={styles.td}>
                    {r.sector && <span className={styles.sector}>{r.sector}</span>}
                  </td>
                  <td className={styles.td}>{fmtPrice(r.entryPrice)}</td>
                  <td className={styles.td}>{fmtPrice(r.currentPrice)}</td>
                  <td className={`${styles.td} ${r.pnlAbs != null ? (r.pnlAbs >= 0 ? styles.pos : styles.neg) : ''}`}>
                    {fmtPrice(r.pnlAbs)}
                  </td>
                  <td className={`${styles.td} ${r.pnlPct != null ? (r.pnlPct >= 0 ? styles.pos : styles.neg) : ''}`}>
                    {fmtPct(r.pnlPct)}
                  </td>
                  <td className={styles.td}>
                    {r.riskScore != null ? (
                      <span className={`${styles.riskBadge} ${riskClass(r.riskScore)}`}>
                        {r.riskScore.toFixed(0)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className={styles.td}>
                    {r.expectationScore != null ? r.expectationScore.toFixed(0) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
