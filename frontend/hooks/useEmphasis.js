import { useMemo } from 'react';
import { computeEmphasis } from '@/lib/emphasis';

// Memoized wrapper around computeEmphasis — recomputes only when an input that
// actually affects emphasis changes (price, change%, scores, alert, entry).
export function useEmphasis({ stock, priceAlert = null, portfolioEntry = null }) {
  const c = stock?.cachedData || {};
  const a = stock?.analysis || {};
  return useMemo(
    () => computeEmphasis({ stock, priceAlert, portfolioEntry }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      c.price, c.changePercent,
      a.expectationScore, a.expectationLabel, a.riskScore,
      priceAlert?.targetPrice, priceAlert?.direction,
      portfolioEntry?.targetPrice, portfolioEntry?.stopPrice,
      c.earningsDate,
    ],
  );
}
