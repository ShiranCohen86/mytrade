# Bug Report — MyTrade (Phase 3 QA)

**Date:** 2026-06-06
**Scope reviewed:** Source code — Phase 3 changes in `frontend/`
**Changes reviewed:**
1. Sort persistence via `localStorage` (`app/page.jsx`)
2. `aria-sort` accuracy fix (`components/WatchlistTable/WatchlistTable.jsx`)
3. SMA200 guard verification (`backend/src/engines/marketRegimeEngine.js`)
4. `percentMove` cap verification (`backend/src/engines/earningsScenariosEngine.js`)

---

## Summary

| Severity | Count | Auto-fixed | Needs your decision |
|----------|-------|------------|---------------------|
| Critical | 0     | —          | —                   |
| High     | 0     | —          | —                   |
| Medium   | 0     | —          | —                   |
| Low      | 1     | ✅ 1       | 0                   |
| **Total**| **1** | **1**      | **0**               |

Phase 3 is clean. The sort persistence is guarded correctly, `aria-sort` values are accurate for all three sortable columns, and the two engine verifications confirm no bugs. One dead code path removed.

---

## Findings

### [LOW] Dead sort branch `'risk-asc'` in `sortStocks()`

- **ID:** BUG-005
- **Category:** Loose ends / Code quality
- **Location:** `frontend/app/page.jsx:16`
- **Platforms affected:** N/A (unreachable code)
- **Description:** `sortStocks()` has a `case 'risk-asc':` branch that sorts by risk score ascending. No column in the `COLUMNS` array maps to this key — the Risk column uses `'risk-desc'`, and clicking it again resets to `'default'`. The `'risk-asc'` branch can never be reached through the UI.
- **Why it's a bug:** Dead code creates confusion about which sort states are reachable. It also risks becoming load-bearing if someone later adds a `'risk-asc'` column key without noticing the branch already exists (accidental behaviour divergence).
- **Fix:** Removed the `case 'risk-asc':` branch from `sortStocks()`.

---

## Verification: aria-sort correctness

All three sortable columns verified correct:

| Column  | `col.key`          | `endsWith('-asc')` | `aria-sort` when active | Arrow |
|---------|--------------------|--------------------|-------------------------|-------|
| Ticker  | `'name-asc'`       | ✅ yes             | `'ascending'`           | `↑`   |
| Risk    | `'risk-desc'`      | ❌ no              | `'descending'`          | `↓`   |
| Expect  | `'expectation-desc'`| ❌ no             | `'descending'`          | `↓`   |

No issues found.

---

## Verification: localStorage safety

- Lazy `useState` initializer wraps `localStorage.getItem` in `try/catch` — ✅ safe in private browsing / storage-full conditions
- `useEffect` write wraps `localStorage.setItem` in `try/catch` — ✅ silent failure when storage unavailable
- Vite SPA (no SSR) — ✅ no hydration mismatch risk
- All keys that can be persisted (`'name-asc'`, `'risk-desc'`, `'expectation-desc'`, `'default'`) are handled by `sortStocks()` — ✅ no silent no-op

---

## Notes & suggestions

- The `⇅` inactive-column sort indicator was removed by this phase. This reduces visual noise but also removes the affordance that a column is sortable. Consider re-adding a very faint `⇅` on hover (CSS `:hover` on `.sortable`) rather than always-visible, to keep the UI clean while preserving discoverability.
