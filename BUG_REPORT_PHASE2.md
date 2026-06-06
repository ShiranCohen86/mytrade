# Bug Report — MyTrade (Phase 2 QA)

**Date:** 2026-06-06
**Scope reviewed:** Source code only — Phase 2 changes in `frontend/` and `backend/`
**Changes reviewed:**
1. Empty state redesign (`app/page.jsx`, `app/page.module.scss`)
2. Sidebar SOON tooltip (`components/Sidebar/Sidebar.jsx`)
3. Earnings date staleness fix (`backend/src/services/stockService.js`)
4. Global error handler (`backend/src/index.js`)
5. Promise timeout wrapper (`backend/src/services/stockService.js`)
6. Per-row analyzing spinner (`components/StockRow/StockRow.jsx`, `StockRow.module.scss`)

---

## Summary

| Severity | Count | Auto-fixed | Needs your decision |
|----------|-------|------------|---------------------|
| Critical | 1     | ✅ 1       | 0                   |
| High     | 1     | ✅ 1       | 0                   |
| Medium   | 1     | ✅ 1       | 0                   |
| Low      | 1     | 0          | ✅ 1                |
| **Total**| **4** | **3**      | **1**               |

The Phase 2 changes are solid overall. Three bugs were introduced — all fixed. The most severe was the error handler mis-ordering (Critical), which would have silently dropped errors from the `/health` route. All other Phase 2 changes are functionally correct.

---

## Findings

### [CRITICAL] Express error handler registered before `/health` route

- **ID:** BUG-001
- **Category:** Backend API / Express
- **Location:** `backend/src/index.js:75–80` (original)
- **Platforms affected:** All
- **Description:** The 4-arg error handler middleware was registered at line 75, before `app.get('/health', ...)` at line 82. Express processes middleware in registration order: an error thrown inside `/health` (or any route registered after the handler) would not be caught by this middleware and would fall through to Express's default error handler, producing an HTML error page instead of JSON.
- **Why it's a bug:** Breaks the invariant that the catch-all is "last". Any future route added after the handler would be unprotected.
- **Fix:** Moved the error handler block to after `app.get('/health', ...)`. Now ordering is: `/api` → `/health` → error handler (last).

---

### [HIGH] Duplicate `display` declaration in `.rowSpinner` breaks centering

- **ID:** BUG-002
- **Category:** UI / CSS Modules
- **Location:** `frontend/components/StockRow/StockRow.module.scss:271–280` (original)
- **Platforms affected:** All browsers
- **Description:** The `.rowSpinner` rule had both `display: flex` and, three lines later, `display: inline-block`. In CSS, the last declaration wins — `display: flex` was overridden by `display: inline-block`. This made `align-items: center` and `justify-content: center` inert (they only apply to flex/grid containers), so the ⟳ character would not be vertically or horizontally centred within its 20×20 box.
- **Fix:** Removed the duplicate `display: inline-block`. Rule now correctly uses `display: flex` with centering properties.

---

### [MEDIUM] Earnings date timezone edge case — same-day earnings nulled out

- **ID:** BUG-003
- **Category:** Backend / Async & Logic
- **Location:** `backend/src/services/stockService.js:47–49` (original)
- **Platforms affected:** All (server-side logic)
- **Description:** The staleness check was `new Date(earningsInfo.date) > new Date()`. When Yahoo Finance returns an earnings date as a date-only string (e.g. `"2025-06-06"`), `new Date("2025-06-06")` is parsed as UTC midnight (`2025-06-06T00:00:00.000Z`). At any point after midnight UTC on that date, `Date.now()` is greater, so the condition fails and `earningsDate` is set to `null` — even though the earnings event hasn't happened yet (e.g. it reports at 4pm EST = 21:00 UTC).
- **Fix:** Changed the threshold to `todayMidnight` (local `new Date()` with `setHours(0,0,0,0)`) and used `>=` instead of `>`. Same-day earnings are now correctly preserved.

---

### [LOW] `withTimeout` does not cancel the inner `Promise.all` on timeout

- **ID:** BUG-004
- **Category:** Async / Performance
- **Location:** `backend/src/services/stockService.js:17–24`
- **Platforms affected:** All (server-side)
- **Description:** When the 30-second timeout fires, `Promise.race` rejects and the caller receives a timeout error — correct. However, the six inner promises (`getCurrentQuote`, `getHistoricalData` × 4, `fetchAndStoreNews`) continue running to completion in the background. If they eventually resolve, the results are silently discarded. This wastes Yahoo Finance API quota and holds open HTTP connections after the caller has already moved on.
- **Why it matters:** At scale or under load, many timed-out analyses could accumulate open connections. For a single-user app the impact is minor.
- **Fix:** Not auto-fixed — requires threading an `AbortController` signal through all provider calls, which touches the provider interface. Flagged for future work in Phase 4.

---

## Needs your decision

**BUG-004 — Lingering promises after timeout**
The correct fix is to pass an `AbortController.signal` into `provider.getCurrentQuote`, `provider.getHistoricalData`, and `newsService.fetchAndStoreNews`, and abort them when the timeout fires. This requires:
- Adding an optional `signal` parameter to all three provider methods
- Passing `{ signal }` to the underlying `axios`/`yahoo-finance2` calls
- Aborting the controller in the timeout branch

Recommendation: defer to Phase 4 alongside the broader provider interface refactor.

---

## Notes & suggestions

- The empty state SVG icon (`page.jsx`) has no `width`/`height` HTML attributes — only CSS `width/height` on `.emptyIcon`. Add `width="64" height="48"` to the `<svg>` element itself so the browser reserves space before CSS loads, preventing layout shift.
- The SOON tooltip (`title="Coming soon"`) is sufficient for mouse users but invisible on touch. Consider a long-press tooltip or a `disabled`-style visual state for mobile.
- `earningsScenariosEngine.js` already correctly caps `bearTarget` before computing `bearPct` (existing code) — no bug found there.
