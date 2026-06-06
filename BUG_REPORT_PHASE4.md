# Bug Report — MyTrade (Phase 4 QA)

**Date:** 2026-06-06
**Scope reviewed:** Source code — Phase 4 changes in `backend/`
**Changes reviewed:**
1. `CACHE_TTL_MINUTES` / `NEWS_API_KEY` wiring (confirmed pre-existing, no code change)
2. `/health` expanded with provider status (`backend/src/index.js`)
3. `lastSuccessAt`/`lastErrorAt` tracking added to `YahooFinanceProvider.js`
4. `getStatus()` added to `ProviderFactory.js`

---

## Summary

| Severity | Count | Auto-fixed | Needs your decision |
|----------|-------|------------|---------------------|
| Critical | 0     | —          | —                   |
| High     | 0     | —          | —                   |
| Medium   | 0     | —          | —                   |
| Low      | 0     | —          | —                   |
| **Total**| **0** | **0**      | **0**               |

**Phase 4 is clean.** All four checklist items verified. No bugs found.

---

## Verification Checklist

### ✅ `super()` call is correct
`BaseProvider` has no explicit constructor (only method stubs). `YahooFinanceProvider`'s new `constructor()` calls `super()` — required in JavaScript when a subclass defines a constructor and extends another class. Because `BaseProvider`'s implicit constructor takes no arguments, `super()` with no arguments is correct.

### ✅ `_markSuccess` / `_markError` do not affect return values
Both helpers assign to `this.lastSuccessAt` / `this.lastErrorAt` and return `undefined`. In `getCurrentQuote`, `_markSuccess()` is called before the `return` statement. In `getHistoricalData`, `_markSuccess()` is called before `return data`. Neither modifies the value being returned. In both error paths, `_markError()` is called before `throw`, which is also correct.

### ✅ No circular dependency from `require('./providers/ProviderFactory')` inside `/health`
Node.js module resolution works via cache. `ProviderFactory` is first required by `routes/stocks.js` → `stockService.js` → `ProviderFactory`. By the time any HTTP request hits `/health`, the module is already in `require.cache`. The lazy `require()` inside the handler returns the cached singleton — identical to the instance already in use. No circular issue.

### ✅ `lastSuccessAt`/`lastErrorAt` are correctly scoped to the singleton
`ProviderFactory` exports `new ProviderFactory()` (a singleton). Its `constructor` creates `this.primary = new YahooFinanceProvider()`. `getStatus()` reads `this.primary.lastSuccessAt` and `this.primary.lastErrorAt` — properties on the same `YahooFinanceProvider` instance used for all live provider calls. State is consistent across requests.

### ✅ Stale-threshold logic is correct
```js
const recentOk = last && (Date.now() - last.getTime()) < staleThresholdMs;
status = last === null ? 'unknown' : recentOk ? 'ok' : 'stale'
```
When `last` is `null` (server just started, no analysis run yet): `recentOk = null && ... = null` (falsy), and `status = 'unknown'` via the first ternary branch. Correct.
When `last` is set and recent: `status = 'ok'`. When `last` is set but old: `status = 'stale'`. Both correct.
The 4-hour threshold exceeds the default 2-hour cron interval, meaning a healthy system will always report `'ok'` unless both the cron and any manual analysis have been silent for >4 hours.

### ✅ `getCompanyAndEarningsInfo` intentionally not tracked — by design
This method silently absorbs errors (returns a fallback object on exception). Adding `_markSuccess()`/`_markError()` to it would produce misleading health data (always marking success even when Yahoo is down). Tracking only via `getCurrentQuote` and `getHistoricalData` — which do properly throw on errors — gives an accurate signal.

---

## Notes

- The health check now exposes `lastSuccessAt` and `lastErrorAt` as ISO timestamps in the JSON response. If this API is ever exposed publicly (e.g. behind a reverse proxy without auth), these timestamps could hint at server activity patterns. Low risk for a single-user personal app, but worth noting.
- `StooqProvider` does not have `lastSuccessAt`/`lastErrorAt` tracking. Since Stooq is acknowledged as broken (CAPTCHA-blocked since 2020), this is intentional — tracking a broken fallback would add noise to the health status.
