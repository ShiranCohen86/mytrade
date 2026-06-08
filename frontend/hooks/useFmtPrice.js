import { useMemo } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { fmtPrice as _fmtPrice, fmtBig as _fmtBig } from '@/lib/format';

export function useFmtPrice() {
  const { currency, rate } = useCurrency();
  return useMemo(
    () => ({
      fmtPrice: (n) => _fmtPrice(n, currency, rate),
      fmtBig: (n) => _fmtBig(n, currency, rate),
      currency,
      rate,
    }),
    [currency, rate],
  );
}
