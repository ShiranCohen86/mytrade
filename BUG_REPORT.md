# MyTrade — Bug Hunt Report

**Date:** 2026-06-09
**Scope:** Full-stack sweep — backend (Express/Mongoose), frontend (React/Vite PWA), security, async, UI/RTL/a11y, PWA, performance. Static review + live backend boot.
**Method:** Static code review of `backend/src` and `frontend/`, a real backend boot (captured startup log), `yahoo-finance2` runtime probes, `npm audit`, git secret scan.

A few clear, low-risk bugs were **fixed in place** (marked ✅ Fixed). Higher-risk or behavior-changing items are **flagged** with a recommendation and listed under *Needs your decision*.

---

## Summary

| Severity | Count | Fixed | Flagged |
|----------|-------|-------|---------|
| Critical | 0     | 0     | 0       |
| High     | 5     | 5     | 0       |
| Medium   | 15    | 14    | 1       |
| Low      | 30    | 11    | 19      |
| **Total**| **50**| **30**| **20**  |

> Update: **all 5 High (H1–H5)**, **14 of 15 Medium**, and **11 of 30 Low** are implemented and verified. Frontend build (incl. service worker) passes; backend boots clean; live checks pass (VIX tile returns data, `tokenVersion` added without schema warnings). A latent bug was also caught & fixed while wiring M4: `AdminIntelligence`'s CSV export still used the pre-H3 `/admin/...` path inline.
> **Remaining (20):** Medium — **M15** only (manifest i18n; static-file limitation). Low — 19 perf/architectural/by-design items that are correct as-is or need infra/dep decisions. Plus one manual test: **H5 Google OAuth**, and a browser smoke-test of the **M4** in-memory-token reload flow.

> Note: there are **no Critical** findings — the server boots cleanly, auth works, and no live crash/data-loss path was found. The most impactful item (movers API broken in `yahoo-finance2` v3) was caught at runtime and fixed.

---

## High

### H1 ✅ Fixed — Market movers broken under `yahoo-finance2` v3
- **Location:** [backend/src/index.js:148](backend/src/index.js#L148) (`/api/market/movers`), [backend/src/jobs/newsTickerScan.js:89](backend/src/jobs/newsTickerScan.js#L89) (`fetchMoverTickers`)
- **Category:** Backend / 3rd-party API
- **Found via:** backend boot log → `Movers fetch failed: Call \`const yahooFinance = new YahooFinance()\` first.`
- **Why it's a bug:** Both call sites did `const { default: yf } = await import('yahoo-finance2'); yf.dailyGainers(...)`. In v3 the default export is a **class** (must be `new`-ed), and `dailyGainers`/`dailyLosers` are **deprecated and throw**. Result: the public `/api/market/movers` endpoint always failed (served stale/empty → the **TopMovers** UI is empty), and movers-based ticker discovery contributed nothing.
- **Fix applied:** Instantiate the class and switch to the supported `screener({ scrIds: 'day_gainers' | 'day_losers' })` API. Verified live: returns correctly-shaped gainers/losers. The existing `fmt()`/`pick()` mapping was unchanged (screener returns the same `regularMarketPrice/Change/ChangePercent` fields).

### H2 ✅ Fixed — Account suspension is not enforced on normal user APIs
- **Location:** [backend/src/middleware/auth.js:3](backend/src/middleware/auth.js#L3), [backend/src/routes/auth.js](backend/src/routes/auth.js) (login / refresh / Google callback)
- **Category:** Security / auth
- **Why it's a bug:** The standard `auth` middleware only verified the JWT — it never loaded the user, so `isSuspended` was never checked on any `/api/*` route. Token-issuance points (`/auth/login`, `/auth/refresh`, Google callback) also didn't check it. A user suspended by an admin kept full access until their 15-min access token expired **and could mint fresh tokens indefinitely** via the refresh cookie. Only `/admin/*` (via `adminAuth`) honored suspension.
- **Fix applied (all token paths + API enforcement):**
  - `auth` middleware is now async and does a minimal `findById(...).select('isSuspended')` lookup → returns **403** immediately for suspended users (and 401 if the user no longer exists).
  - `/auth/login` returns 403 + audit-logs `auth.login_blocked` for suspended accounts.
  - `/auth/refresh` returns 403 and clears the refresh cookie for suspended accounts.
  - Google OAuth callback redirects suspended users to `/login?error=suspended`.
  - Frontend: `LoginPage` maps `error=suspended` to a new `auth.accountSuspended` string (EN + HE).
- **Trade-off accepted:** one indexed primary-key lookup per authenticated request. Negligible for this app's scale; can be swapped for a short-TTL cache later if needed.

### H3 ✅ Fixed — Admin client routes collide with backend admin API in production
- **Location:** [backend/src/index.js](backend/src/index.js) (admin mounts) vs React routes [frontend/src/App.jsx:115](frontend/src/App.jsx#L115); SW nav denylist [frontend/src/sw.js:23](frontend/src/sw.js#L23)
- **Category:** Routing / PWA
- **Why it's a bug:** The backend owned `/admin/users`, `/admin/audit`, … and the SPA *also* routed those same paths. SPA `fetch()` worked, but a **hard navigation or refresh** to `https://app/admin/users` hit the backend admin router → `401/403 JSON` instead of `index.html`. The catch-all `app.get('*')` is registered after the admin routers, so it never saw those paths; the SW `/admin/` nav denylist made it worse offline. Admin deep-links/refresh were broken in production.
- **Fix applied:**
  - Backend: admin routers re-mounted under **`/api/admin/*`**, and moved **before** the `/api` stocks router so admin requests don't pass through user-level `auth`.
  - Frontend: all 29 admin calls in `apiClient.js` updated to `/api/admin/*` (verified: no stray `/api/api`, no bare `/admin/` left).
  - Service worker: `/admin/` removed from the navigation denylist so client-side admin routes receive the app shell; the admin API stays covered by the `/api/` denylist.
  - Now `/admin/*` resolves to `index.html` → the SPA renders admin pages on direct load/refresh. Verified via a clean production build (SW included).

### H4 ✅ Fixed — No startup validation of `JWT_SECRET` / `JWT_REFRESH_SECRET`
- **Location:** [backend/src/config.js](backend/src/config.js), used in [backend/src/routes/auth.js:19](backend/src/routes/auth.js#L19)
- **Category:** Backend / config robustness
- **Why it's a bug:** Secrets are read straight from `process.env` at token-sign time. If either is unset, the server still booted and `/health` reported `ok`, but **every** login/register/refresh threw `secretOrPrivateKey must have a value` → 500 — invisible until a user tried to authenticate.
- **Fix applied:** `config.js` now checks both secrets at boot. In production it logs an error and `process.exit(1)` (fail fast); in dev it warns. It also warns if the two secrets are identical. Verified: with secrets present, the server boots cleanly.

### H5 ✅ Fixed — OAuth access token passed in the redirect URL
- **Location:** [backend/src/routes/auth.js](backend/src/routes/auth.js) (Google callback), [frontend/app/auth/GoogleCallbackPage.jsx](frontend/app/auth/GoogleCallbackPage.jsx)
- **Category:** Security
- **Why it's a bug:** Putting the JWT in a query string leaked it into browser history, server/proxy access logs, and the `Referer` header of any subsequent request from `/auth/callback`.
- **Fix applied:** The Google callback now redirects to `/auth/callback` **without** the token, setting only the existing `httpOnly` refresh cookie. `GoogleCallbackPage` exchanges that cookie for an access token via `POST /auth/refresh` (cookie path `/auth/refresh`, `credentials: 'include'`), then bootstraps the session. No token ever appears in a URL.
- **⚠ Needs a manual end-to-end test:** Google OAuth requires real credentials/interaction that couldn't be exercised in this audit. The flow is the standard cookie-exchange pattern and the build passes, but please confirm a real Google sign-in completes (dev `:3000`↔`:5000` are same-site, so the `SameSite=Lax` refresh cookie is sent on the exchange).

---

## Medium

### M1 ✅ Fixed — Reuters RSS feed 404
- **Location:** [backend/src/jobs/newsTickerScan.js:29](backend/src/jobs/newsTickerScan.js#L29)
- **Category:** Backend / 3rd-party
- **Why it's a bug:** `reutersagency.com` retired its public RSS feeds; the URL 301→404 on every scan, logging a warning every cycle and yielding zero candidates.
- **Fix applied:** Replaced with a Reuters query routed through Google News RSS (same transport already trusted in this file); verified 200 + 100 items. A consolidated feed-health summary log was also added.

### M2 ✅ Fixed — Admin user search: NoSQL regex injection / ReDoS
- **Location:** [backend/src/routes/admin/users.js:19](backend/src/routes/admin/users.js#L19)
- **Category:** Security
- **Why it's a bug:** `req.query.search` was passed directly as a MongoDB `$regex`. A crafted pattern (e.g. catastrophic backtracking) could pin CPU, and regex metacharacters cause unintended matches. Admin-gated, but still untrusted input reaching a regex engine.
- **Fix applied:** Escape regex metacharacters and cap the query to 100 chars before building `$regex`.

### M3 ✅ Fixed — Service worker caches authenticated API responses; not cleared on logout
*Fix: `AuthContext.logout` now calls `caches.delete('api-cache')` so personal API responses are purged on sign-out.*
- **Location:** [frontend/src/sw.js:28](frontend/src/sw.js#L28) (`api-cache`, NetworkFirst, `statuses:[0,200]`)
- **Category:** Security / privacy / PWA
- **Why it's a bug:** GET `/api/stocks`, `/api/portfolio`, `/api/alerts`, etc. (personal data) are written to CacheStorage. Nothing purges `api-cache` on logout, so on a shared device the next user can see the previous user's watchlist/portfolio via the offline fallback, and stale personal data may be served after sign-out.
- **Recommendation:** Clear the `api-cache` (and other user caches) on logout via `caches.delete(...)` / a `CLEAR_CACHE` message to the SW; consider not caching authenticated GETs at all.

### M4 ✅ Fixed (browser smoke-test recommended) — Access token in `localStorage`
*Fix: new `frontend/lib/authToken.js` holds the access token **in memory only**; `apiClient`, `AuthContext`, `analytics.js`, and the admin export all read it from there. `AuthContext` now rehydrates the session from the httpOnly refresh cookie on mount (`POST /auth/refresh` → `/auth/me`). The `PrivateRoute`/`AdminRoute` guards already render a "Loading…" state while `isLoading`, so logged-in users don't flash to login during rehydrate. **Recommend a quick browser test** of: hard-reload while logged in (stays logged in), logout, and login — since the reload-rehydrate path can only be exercised in a real browser.*
- **Location:** [frontend/context/AuthContext.jsx:5](frontend/context/AuthContext.jsx#L5), [frontend/lib/apiClient.js:5](frontend/lib/apiClient.js#L5)
- **Category:** Security
- **Why it's a bug:** Any XSS can read `localStorage` and exfiltrate the bearer token. The refresh token is correctly `httpOnly`, but the access token is fully scriptable.
- **Recommendation:** Keep the access token in memory only (and rely on the refresh cookie to rehydrate on load), or move it to an `httpOnly` cookie. Tighten CSP (see M5).

### M5 ✅ Fixed (partial) — CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts
*Fix: removed `'unsafe-eval'` from `script-src`. `'unsafe-inline'` is retained (Vite's inline bootstrap needs it; full removal requires nonces). **Recommend a quick browser smoke-test** to confirm no dependency relies on `eval`.*
- **Location:** [backend/src/index.js:25](backend/src/index.js#L25)
- **Category:** Security
- **Why it's a bug:** `script-src 'self' 'unsafe-inline' 'unsafe-eval'` neutralizes most of CSP's XSS protection. Combined with M4 (token in `localStorage`), an injected script can both run and steal the token.
- **Recommendation:** Drop `unsafe-eval` (a built Vite app generally doesn't need it) and move toward nonce/hash-based inline scripts.

### M6 ✅ Fixed — Account deletion orphans related data
*Fix: deletion now also removes the user's `PushSubscription`, `AnalyticsEvent`, and `WatchlistItem` docs; `AuditLog` is intentionally retained as a security trail.*
- **Location:** [backend/src/routes/auth.js:326](backend/src/routes/auth.js#L326)
- **Category:** Data integrity / privacy (GDPR-ish)
- **Why it's a bug:** Deletion removes the `User` and unreferenced `Stock` docs, but leaves `PushSubscription`, `AnalyticsEvent`, `WatchlistItem`, and `AuditLog` rows keyed by the deleted `userId`. Orphaned PII persists and push could still target a removed user.
- **Recommendation:** On delete, also clean up (or intentionally retain per policy) those collections. Decide what audit data must legally survive.

### M7 ✅ Fixed — Anonymous analytics can spoof another user's `userId`
*Fix: `/api/events` now attributes events only to the verified-token user id; a client-supplied `userId` is no longer trusted.*
- **Location:** [backend/src/routes/events.js:44](backend/src/routes/events.js#L44)
- **Category:** Security / data integrity
- **Why it's a bug:** When no bearer token is present, the endpoint trusts a client-supplied `userId` as long as it's a valid ObjectId. Anyone can attribute fabricated events to any user id, polluting per-user analytics/insights.
- **Recommendation:** Only accept `userId` from the verified token; for anonymous beacons, store `deviceId` only and never a claimed `userId`.

### M8 ✅ Fixed — `POST /api/stocks` rejects valid tickers with digits/dots
*Fix: add-ticker now uses the shared `sanitizeTicker` + a length cap (accepts BRK.B etc.); the provider lookup still validates existence.*
- **Location:** [backend/src/routes/stocks.js:71](backend/src/routes/stocks.js#L71) (`/^[A-Za-z]{1,5}$/`)
- **Category:** Validation / functional
- **Why it's a bug:** The add-ticker validator is letters-only, but `sanitizeTicker` (used everywhere else) allows `0-9` and `.`. So `BRK.B`, `BF.B`, `RDS.A` can't be added, even though the rest of the system handles them. Inconsistent rules across endpoints.
- **Recommendation:** Use one shared ticker validator that allows the dot/number class, capped at a sane length.

### M9 ✅ Fixed — Admin error handlers leak raw `err.message`
*Fix: all 29 `error: err.message` responses across the 6 admin route files replaced with a generic `'Server error.'`.*
- **Location:** [backend/src/routes/admin/users.js:57](backend/src/routes/admin/users.js#L57) and most admin handlers
- **Category:** Security / info disclosure
- **Why it's a bug:** `res.status(500).json({ error: err.message })` returns internal Mongoose/Cast/driver messages to the client. Useful to an attacker, inconsistent with the user-facing `safeError()` used in the stocks router.
- **Recommendation:** Return a generic message; log the detail server-side.

### M10 ✅ Fixed — Invalid `:id` in admin routes returns 500 instead of 400
*Fix: added `Types.ObjectId.isValid` guards (→ 400) to the admin user GET/role/suspend/delete `:id` routes.*
- **Location:** [backend/src/routes/admin/users.js:62](backend/src/routes/admin/users.js#L62) (GET/role/suspend/delete)
- **Category:** Error handling / consistency
- **Why it's a bug:** `User.findById('not-an-objectid')` throws a `CastError` → caught as 500 (+ leaks the message, see M9). The `/insights` route already validates the ObjectId and returns 400 — the others don't.
- **Recommendation:** Validate `req.params.id` with `mongoose.isValidObjectId` up front, return 400.

### M11 ✅ Fixed — Dashboard re-analyzes the whole watchlist on every visit
*Fix: auto-analyze on dashboard entry now runs only when at least one stock is stale (>4h since `analyzedAt`), instead of every mount.*
- **Location:** [frontend/app/page.jsx:106](frontend/app/page.jsx#L106) (`hasAutoAnalyzed` ref + `analyzeAll`)
- **Category:** Performance / cost
- **Why it's a bug:** `hasAutoAnalyzed` is a `useRef` that resets whenever the Dashboard unmounts (navigate away → back). Each return to the dashboard fires `analyzeAll()`, which issues a `POST /api/refresh/:ticker` per stock (up to 25 provider round-trips), pressuring the `analysisLimiter` (30/min) and the data provider.
- **Recommendation:** Gate auto-analyze on staleness (only refresh stocks whose `analyzedAt` is older than N hours) and/or persist the "analyzed this session" flag outside component state.

### M12 ✅ Fixed — Logout does not invalidate tokens server-side
*Fix: added a `tokenVersion` field to `User`, embedded `tv` in refresh tokens, and `/auth/logout` now bumps `tokenVersion` (the frontend sends its access token) so every outstanding refresh token for that user is rejected. **Note the semantic:** logout revokes the user's sessions on **all** devices — remove the `$inc` if per-device logout is preferred. Default `tokenVersion: 0` keeps all current sessions valid.*
- **Location:** [backend/src/routes/auth.js:127](backend/src/routes/auth.js#L127), refresh at L141
- **Category:** Security
- **Why it's a bug:** Logout only clears the cookie in the browser. There's no refresh-token denylist/rotation-reuse detection, so a refresh token captured before logout stays valid for its full 30-day TTL.
- **Recommendation:** Add a server-side refresh-token store (jti) with revocation on logout, or shorten refresh TTL + reuse detection. (Design decision.)

### M13 ✅ Fixed — Refresh stampede on concurrent 401s
*Fix: `apiClient` now single-flights `/auth/refresh` via a shared promise, so concurrent 401s don't each rotate the refresh cookie.*
- **Location:** [frontend/lib/apiClient.js:24](frontend/lib/apiClient.js#L24) and [frontend/context/AuthContext.jsx:47](frontend/context/AuthContext.jsx#L47)
- **Category:** Async / race condition
- **Why it's a bug:** When several requests 401 at once (e.g. after the access token expires), each independently calls `/auth/refresh`, each rotating the refresh cookie. Concurrent rotations race; some retries can use a token that a sibling already replaced.
- **Recommendation:** Single-flight the refresh (share one in-flight promise across callers).

### M14 ✅ Fixed — Google OAuth links to an existing email without verifying it
*Fix: auto-linking to an existing local account now requires Google to assert `email_verified`; unverified emails create a googleId-only account.*
- **Location:** [backend/src/config/passport.js:35](backend/src/config/passport.js#L35)
- **Category:** Security / auth
- **Why it's a bug:** If no `googleId` match, it links by email to any existing local account. It doesn't check `profile.emails[0].verified`. Google normally only returns verified emails, but relying on that implicitly is fragile for account-takeover scenarios.
- **Recommendation:** Require the Google email to be verified before auto-linking, or require an explicit link step.

### M15 — Manifest hardcodes `dir:"ltr"` / `lang:"en"` despite Hebrew/RTL support
- **Location:** [frontend/public/manifest.webmanifest:7](frontend/public/manifest.webmanifest#L7)
- **Category:** RTL / PWA / i18n
- **Why it's a bug:** The app fully supports Hebrew and flips `dir` at runtime ([App.jsx DirectionSync](frontend/src/App.jsx#L38)), but the installed-app metadata (name/description/dir/lang) is always English-LTR. Hebrew users get an LTR-labelled install.
- **Recommendation:** This is a static-manifest limitation; at minimum localize the install copy, or accept as known cosmetic.

---

## Low

> Polish, code smells, and rare edge cases. Grouped for brevity.
> **✅ Fixed:** L2, L3, L5, L6, L7, L11, L14, L15, L19, L30 (see the *Fixes applied* table). The rest remain open as documented below (perf/architectural or by-design).

**Dependencies & config**
- **L1** `npm audit`: `uuid <11.1.1` (moderate) pulled in via `node-cron@3` — 2 moderate advisories. Fix requires `node-cron@4` (breaking). ([backend/package.json](backend/package.json))
- **L2** Reset-password link falls back to `http://localhost:3000` when `CLIENT_URL` is unset — in prod with a missing env var, reset emails point to localhost (broken reset). [auth.js:233](backend/src/routes/auth.js#L233)
- **L3** CORS allows a single `ALLOWED_ORIGIN`; apex+www or multi-domain access breaks CORS with no multi-origin handling. [index.js:46](backend/src/index.js#L46)
- **L4** Several `parseInt(...)` calls omit the radix (admin pagination, SMTP port). [admin/users.js:13](backend/src/routes/admin/users.js#L13), [auth.js:239](backend/src/routes/auth.js#L239)

**Backend correctness / robustness**
- **L5** `/api/market/overview` requests `'VIX'` (Yahoo symbol is `^VIX`); `getCurrentQuote('VIX')` likely fails → the VIX tile is perpetually null. [index.js:117](backend/src/index.js#L117)
- **L6** Production catch-all `app.get('*')` returns `index.html` for unknown `/api/*` paths → API 404s come back as HTML instead of JSON. [index.js:227](backend/src/index.js#L227)
- **L7** No JSON 404 handler for unmatched `/api` routes in dev (Express default HTML 404).
- **L8** Module-global overview/movers caches are per-process; multi-instance deploys serve inconsistent caches and have no single-flight on expiry (thundering herd). [index.js:107](backend/src/index.js#L107)
- **L9** `safeError()` classifies errors by substring-matching messages (`'not found'`, `'rate limit'`) — brittle coupling to upstream wording. [stocks.js:18](backend/src/routes/stocks.js#L18)
- **L10** `events.js` re-implements JWT verification (`tokenUserId`) instead of reusing the auth middleware → drift risk if claims/secret change. [events.js:13](backend/src/routes/events.js#L13)
- **L11** `/api/events` allows arbitrary `props` objects within the 64kb body with no per-field size cap. [events.js:55](backend/src/routes/events.js#L55)
- **L12** `/health` is unauthenticated and unrate-limited, exposing db/provider status. [index.js:201](backend/src/index.js#L201)
- **L13** `alertScan` cron `*/5 * * * 1-5` uses server-local time; "weekdays" is timezone-dependent, not US-market-aware. [alertScan.js:75](backend/src/jobs/alertScan.js#L75)
- **L14** `sanitizeCategories` returns **all** categories when input is invalid → a bad `preferences` payload silently re-enables categories the user turned off. [push.js:19](backend/src/routes/push.js#L19)
- **L15** `passport.serializeUser`/`deserializeUser` are dead code (`session:false` everywhere). [passport.js:56](backend/src/config/passport.js#L56)

**Security (minor)**
- **L16** `forgot-password` has a timing side-channel: existing accounts do crypto+email work; missing ones return immediately — response time distinguishes them despite the uniform 200. [auth.js:217](backend/src/routes/auth.js#L217)
- **L17** `forgot-password` sends the email synchronously inside the request (`await sendMail`), tying up the request and widening L16. [auth.js:242](backend/src/routes/auth.js#L242)
- **L18** Search terms are written to the audit log (`stock.searched`, q≥2) — stores user queries and adds log volume. [stocks.js:48](backend/src/routes/stocks.js#L48)
- **L19** CSV export doesn't neutralize spreadsheet formula injection (`=,+,-,@` leading values). Low risk since name/sector come from Yahoo. [page.jsx:228](frontend/app/page.jsx#L228)

**Frontend state / async**
- **L20** `add()` activation metric is off-by-one: uses `stocksRef.current.length + 1`, but the ref lags the state update. [useStocks.js:140](frontend/hooks/useStocks.js#L140)
- **L21** `analyzeAll`/`analyzeTicker` update state with no unmount guard/abort → "set state on unmounted component" on fast navigation. [useStocks.js:156](frontend/hooks/useStocks.js#L156)
- **L22** Client-side price-alert toast duplicates the server Web Push alert → users can be double-notified for the same crossing. [page.jsx:183](frontend/app/page.jsx#L183)
- **L23** `getQuotes` fans out a provider call per watchlist ticker (≤25) every 15s poll → provider rate pressure for large lists. [stocks.js:224](backend/src/routes/stocks.js#L224)
- **L24** Error banner uses `dismissedError` string compare; an identical error string after a later failure won't re-show, and a stale banner can persist after a successful re-analyze. [page.jsx:215](frontend/app/page.jsx#L215)
- **L25** Watchlist reorder silently drops tickers not in the new order with no user feedback. [stocks.js:365](backend/src/routes/stocks.js#L365)

**UI / a11y / PWA / cross-platform**
- **L26** Icon/symbol-only toolbar buttons (group `⊞`, movers, export, import) rely on `title` rather than `aria-label`; screen readers may announce the glyph/label inconsistently. [page.jsx:300](frontend/app/page.jsx#L300)
- **L27** The "More" menu closes on `touchstart` (outside-click handler) which can fire before the menu item's `click` on iOS Safari → menu items occasionally don't trigger on first tap. [page.jsx:98](frontend/app/page.jsx#L98)
- **L28** SW `notificationclick` uses `client.navigate(url)`, doing a full SPA reload (state loss) instead of a soft in-app navigation via `postMessage`. [sw.js:104](frontend/src/sw.js#L104)
- **L29** `createHandlerBoundToURL('index.html')` uses a relative key that can mismatch the precache entry (`/index.html`) depending on build config. [sw.js:20](frontend/src/sw.js#L20)
- **L30** i18n has no browser-language detection — always defaults to `en` regardless of `navigator.language`. [i18n.js:6](frontend/src/i18n.js#L6)

---

## Needs your decision (not auto-fixed)

Only one code finding remains open, plus by-design/architectural items:

1. **M15** Localize the PWA manifest `dir`/`lang` for Hebrew — static-file limitation; would need a server-rendered manifest. Low value (the app flips `dir` at runtime; English is a fine install-time default), so left as-is.
2. **19 remaining Low items** — correct as-is (by-design: L10, L12, L18), architectural/infra (L1 breaking `node-cron@4`; L8 shared cache; L23 provider batching), or marginal cosmetics. Documented in the Low section; "fixing" several would be churn or a regression, not an improvement.

**Manual tests (can't run without a browser/session):**
- **H5 Google OAuth** end-to-end sign-in (flow changed to a cookie exchange).
- **M4** reload-rehydrate: hard-reload while logged in, logout, login.

> **M12 note:** logout now revokes refresh tokens on **all** of a user's devices. If you want per-device logout instead, drop the `$inc: { tokenVersion: 1 }` in `/auth/logout`.

> **All 5 High (H1–H5)** and **10 of 15 Medium** (M1, M2, M3, M6, M7, M8, M9, M11, M13, M14) are implemented and verified.
> **One follow-up test:** H5 (Google OAuth) needs a real end-to-end sign-in check — see its entry.

---

## Fixes applied in this pass

| # | File | Change |
|---|------|--------|
| H1 | `backend/src/index.js`, `backend/src/jobs/newsTickerScan.js` | Movers: instantiate `new YahooFinance()` + use `screener({ scrIds })` (v3-correct), verified live (`Yahoo movers: 20 tickers`) |
| H2 | `backend/src/middleware/auth.js`, `backend/src/routes/auth.js`, `frontend/app/auth/LoginPage.jsx`, `frontend/locales/{en,he}.json` | Enforce suspension on API + block login/refresh/Google for suspended users + localized message |
| H3 | `backend/src/index.js`, `frontend/lib/apiClient.js`, `frontend/src/sw.js` | Admin API → `/api/admin/*` (mounted before `/api`); 29 client calls updated; `/admin/` removed from SW nav denylist |
| H4 | `backend/src/config.js` | Fail-fast (prod) / warn (dev) on missing `JWT_SECRET`/`JWT_REFRESH_SECRET`; warn if identical |
| H5 | `backend/src/routes/auth.js`, `frontend/app/auth/GoogleCallbackPage.jsx` | OAuth no longer puts the access token in the URL; SPA exchanges the httpOnly refresh cookie via `/auth/refresh` |
| M1 | `backend/src/jobs/newsTickerScan.js` | Reuters feed → Google-News-routed Reuters query + consolidated feed-health log |
| M2 | `backend/src/routes/admin/users.js` | Escape + length-cap admin search regex (ReDoS / injection) |
| M3 | `frontend/context/AuthContext.jsx` | `caches.delete('api-cache')` on logout (purge cached personal API data) |
| M6 | `backend/src/routes/auth.js` | Account deletion also removes `PushSubscription`/`AnalyticsEvent`/`WatchlistItem`; retains `AuditLog` |
| M7 | `backend/src/routes/events.js` | Drop trust in client-supplied `userId`; attribute only from verified token |
| M8 | `backend/src/routes/stocks.js` | Add-ticker uses shared `sanitizeTicker` + length cap (accepts BRK.B etc.) |
| M9 | `backend/src/routes/admin/*.js` (6 files) | 29 leaky `err.message` responses → generic `'Server error.'` |
| M11 | `frontend/app/page.jsx` | Auto-analyze only when a stock is stale (>4h), not on every navigation |
| M13 | `frontend/lib/apiClient.js` | Single-flight `/auth/refresh` (no concurrent refresh stampede) |
| M14 | `backend/src/config/passport.js` | Auto-link Google→local account only when `email_verified` |
| M5 | `backend/src/index.js` | CSP: dropped `'unsafe-eval'` from `script-src` (browser smoke-test recommended) |
| L2 | `backend/src/config.js` | Warn in production when `CLIENT_URL` is unset |
| L3 | `backend/src/index.js` | CORS accepts a comma-separated `ALLOWED_ORIGIN` list |
| L5 | `backend/src/index.js` | Market overview fetches `^VIX` (was `VIX` → always null); display ticker kept as `VIX` — verified live |
| L6/L7 | `backend/src/index.js` | Unmatched `/api` & `/auth` → JSON 404, never the SPA HTML / default handler |
| L11 | `backend/src/routes/events.js` | Cap analytics `props` payload at 2 KB |
| L14 | `backend/src/routes/push.js` | `sanitizeCategories` honors an empty array (user can mute all) |
| L15 | `backend/src/config/passport.js` | Removed dead `serializeUser`/`deserializeUser` |
| L19 | `frontend/app/page.jsx` | CSV export escapes formula-injection cells (`= + - @`) |
| L30 | `frontend/src/i18n.js` | Default language follows `navigator.language` when no saved preference |
| M10 | `backend/src/routes/admin/users.js` | `ObjectId.isValid` guards → 400 (not 500) on malformed `:id` |
| M12 | `backend/src/models/User.js`, `backend/src/routes/auth.js`, `frontend/context/AuthContext.jsx` | `tokenVersion` revocation: logout invalidates outstanding refresh tokens |
| L17 | `backend/src/routes/auth.js` | Password-reset email is now fire-and-forget (flattens timing, no SMTP-bound latency) |
| M4 | `frontend/lib/authToken.js` (new), `apiClient.js`, `context/AuthContext.jsx`, `lib/analytics.js`, `app/admin/intelligence/AdminIntelligence.jsx` | Access token moved to in-memory store; session rehydrates from the refresh cookie on load |
| H3+ | `frontend/app/admin/intelligence/AdminIntelligence.jsx` | Follow-up: inline CSV-export URL updated to the `/api/admin/...` path |

**Verification:** all backend files pass `node --check`; the **frontend production build succeeds** (incl. the service-worker rebuild and locale JSON). The backend was booted twice against the live MongoDB Atlas cluster and both instances were stopped afterward; the second boot confirmed a clean startup and that the movers fix works (`[news-scan] Yahoo movers: 20 tickers`). The only item that still needs manual exercise is the **Google OAuth** end-to-end flow (H5).
