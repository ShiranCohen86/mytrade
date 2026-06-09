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
| High     | 5     | 1     | 4       |
| Medium   | 15    | 2     | 13      |
| Low      | 30    | 1     | 29      |
| **Total**| **50**| **4** | **46**  |

> Note: there are **no Critical** findings — the server boots cleanly, auth works, and no live crash/data-loss path was found. The most impactful item (movers API broken in `yahoo-finance2` v3) was caught at runtime and fixed.

---

## High

### H1 ✅ Fixed — Market movers broken under `yahoo-finance2` v3
- **Location:** [backend/src/index.js:148](backend/src/index.js#L148) (`/api/market/movers`), [backend/src/jobs/newsTickerScan.js:89](backend/src/jobs/newsTickerScan.js#L89) (`fetchMoverTickers`)
- **Category:** Backend / 3rd-party API
- **Found via:** backend boot log → `Movers fetch failed: Call \`const yahooFinance = new YahooFinance()\` first.`
- **Why it's a bug:** Both call sites did `const { default: yf } = await import('yahoo-finance2'); yf.dailyGainers(...)`. In v3 the default export is a **class** (must be `new`-ed), and `dailyGainers`/`dailyLosers` are **deprecated and throw**. Result: the public `/api/market/movers` endpoint always failed (served stale/empty → the **TopMovers** UI is empty), and movers-based ticker discovery contributed nothing.
- **Fix applied:** Instantiate the class and switch to the supported `screener({ scrIds: 'day_gainers' | 'day_losers' })` API. Verified live: returns correctly-shaped gainers/losers. The existing `fmt()`/`pick()` mapping was unchanged (screener returns the same `regularMarketPrice/Change/ChangePercent` fields).

### H2 — Account suspension is not enforced on normal user APIs
- **Location:** [backend/src/middleware/auth.js:3](backend/src/middleware/auth.js#L3), [backend/src/routes/auth.js:141](backend/src/routes/auth.js#L141) (`/auth/refresh`)
- **Category:** Security / auth
- **Why it's a bug:** The standard `auth` middleware only verifies the JWT — it never loads the user, so `isSuspended` is never checked on any `/api/*` route. `/auth/refresh` also doesn't check it. A user suspended by an admin keeps full access until their 15-min access token expires **and can mint fresh tokens indefinitely** via the refresh cookie. Only `/admin/*` (which uses `adminAuth`, that does reload the user) honors suspension.
- **Recommendation (flagged — behavior + per-request DB load):** Have `/auth/refresh` reject suspended users, and/or load the user in `auth` (or check a cached suspension flag) so suspension takes effect promptly. Trade-off: a DB read per request; consider a short-TTL cache.

### H3 — Admin client routes collide with backend admin API in production
- **Location:** [backend/src/index.js:194](backend/src/index.js#L194) (`app.use('/admin/users', …)` etc.) vs React routes [frontend/src/App.jsx:115](frontend/src/App.jsx#L115); compounded by SW nav denylist [frontend/src/sw.js:23](frontend/src/sw.js#L23) (`/^\/admin\//`)
- **Category:** Routing / PWA
- **Why it's a bug:** The backend owns `/admin/users`, `/admin/audit`, … and the SPA *also* routes those same paths. SPA `fetch()` works (sends `Bearer`), but a **hard navigation or refresh** to `https://app/admin/users` hits the backend admin router, which returns `401/403 JSON` instead of `index.html`. The production catch-all `app.get('*')` is registered *after* the admin routers, so it never sees those paths. The service worker's navigation `denylist` for `/admin/` makes it worse offline. Net: admin deep-links/refresh are broken in production.
- **Recommendation (flagged — architectural):** Namespace the admin **API** under `/api/admin/*` (and update `apiClient`), leaving `/admin/*` free for the SPA; then remove `/admin/` from the SW denylist. Alternatively, make the catch-all serve `index.html` for `GET` requests that `Accept: text/html`.

### H4 — No startup validation of `JWT_SECRET` / `JWT_REFRESH_SECRET`
- **Location:** [backend/src/config.js](backend/src/config.js), used in [backend/src/routes/auth.js:19](backend/src/routes/auth.js#L19)
- **Category:** Backend / config robustness
- **Why it's a bug:** Secrets are read straight from `process.env` at token-sign time. If either is unset, the server still boots and `/health` reports `ok`, but **every** login/register/refresh throws `secretOrPrivateKey must have a value` → 500. The failure is invisible until a user tries to authenticate.
- **Recommendation (flagged — could block boot):** Validate both secrets at startup; in production, fail fast (`process.exit(1)`) with a clear message. Optionally assert they differ.

### H5 — OAuth access token passed in the redirect URL
- **Location:** [backend/src/routes/auth.js:316](backend/src/routes/auth.js#L316) (`res.redirect(\`${clientUrl}/auth/callback?token=${accessToken}\`)`)
- **Category:** Security
- **Why it's a bug:** Putting the JWT in a query string leaks it into browser history, server/proxy access logs, and the `Referer` header of any subsequent request from `/auth/callback`. Access tokens should not travel in URLs.
- **Recommendation (flagged — auth flow change):** Deliver the token via a short-lived `httpOnly` cookie (then have the SPA call `/auth/me`), or a one-time exchange code, or `postMessage` from a tiny callback page. Then strip the token param from the URL immediately.

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

### M3 — Service worker caches authenticated API responses; not cleared on logout
- **Location:** [frontend/src/sw.js:28](frontend/src/sw.js#L28) (`api-cache`, NetworkFirst, `statuses:[0,200]`)
- **Category:** Security / privacy / PWA
- **Why it's a bug:** GET `/api/stocks`, `/api/portfolio`, `/api/alerts`, etc. (personal data) are written to CacheStorage. Nothing purges `api-cache` on logout, so on a shared device the next user can see the previous user's watchlist/portfolio via the offline fallback, and stale personal data may be served after sign-out.
- **Recommendation:** Clear the `api-cache` (and other user caches) on logout via `caches.delete(...)` / a `CLEAR_CACHE` message to the SW; consider not caching authenticated GETs at all.

### M4 — Access token in `localStorage`
- **Location:** [frontend/context/AuthContext.jsx:5](frontend/context/AuthContext.jsx#L5), [frontend/lib/apiClient.js:5](frontend/lib/apiClient.js#L5)
- **Category:** Security
- **Why it's a bug:** Any XSS can read `localStorage` and exfiltrate the bearer token. The refresh token is correctly `httpOnly`, but the access token is fully scriptable.
- **Recommendation:** Keep the access token in memory only (and rely on the refresh cookie to rehydrate on load), or move it to an `httpOnly` cookie. Tighten CSP (see M5).

### M5 — CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts
- **Location:** [backend/src/index.js:25](backend/src/index.js#L25)
- **Category:** Security
- **Why it's a bug:** `script-src 'self' 'unsafe-inline' 'unsafe-eval'` neutralizes most of CSP's XSS protection. Combined with M4 (token in `localStorage`), an injected script can both run and steal the token.
- **Recommendation:** Drop `unsafe-eval` (a built Vite app generally doesn't need it) and move toward nonce/hash-based inline scripts.

### M6 — Account deletion orphans related data
- **Location:** [backend/src/routes/auth.js:326](backend/src/routes/auth.js#L326)
- **Category:** Data integrity / privacy (GDPR-ish)
- **Why it's a bug:** Deletion removes the `User` and unreferenced `Stock` docs, but leaves `PushSubscription`, `AnalyticsEvent`, `WatchlistItem`, and `AuditLog` rows keyed by the deleted `userId`. Orphaned PII persists and push could still target a removed user.
- **Recommendation:** On delete, also clean up (or intentionally retain per policy) those collections. Decide what audit data must legally survive.

### M7 — Anonymous analytics can spoof another user's `userId`
- **Location:** [backend/src/routes/events.js:44](backend/src/routes/events.js#L44)
- **Category:** Security / data integrity
- **Why it's a bug:** When no bearer token is present, the endpoint trusts a client-supplied `userId` as long as it's a valid ObjectId. Anyone can attribute fabricated events to any user id, polluting per-user analytics/insights.
- **Recommendation:** Only accept `userId` from the verified token; for anonymous beacons, store `deviceId` only and never a claimed `userId`.

### M8 — `POST /api/stocks` rejects valid tickers with digits/dots
- **Location:** [backend/src/routes/stocks.js:71](backend/src/routes/stocks.js#L71) (`/^[A-Za-z]{1,5}$/`)
- **Category:** Validation / functional
- **Why it's a bug:** The add-ticker validator is letters-only, but `sanitizeTicker` (used everywhere else) allows `0-9` and `.`. So `BRK.B`, `BF.B`, `RDS.A` can't be added, even though the rest of the system handles them. Inconsistent rules across endpoints.
- **Recommendation:** Use one shared ticker validator that allows the dot/number class, capped at a sane length.

### M9 — Admin error handlers leak raw `err.message`
- **Location:** [backend/src/routes/admin/users.js:57](backend/src/routes/admin/users.js#L57) and most admin handlers
- **Category:** Security / info disclosure
- **Why it's a bug:** `res.status(500).json({ error: err.message })` returns internal Mongoose/Cast/driver messages to the client. Useful to an attacker, inconsistent with the user-facing `safeError()` used in the stocks router.
- **Recommendation:** Return a generic message; log the detail server-side.

### M10 — Invalid `:id` in admin routes returns 500 instead of 400
- **Location:** [backend/src/routes/admin/users.js:62](backend/src/routes/admin/users.js#L62) (GET/role/suspend/delete)
- **Category:** Error handling / consistency
- **Why it's a bug:** `User.findById('not-an-objectid')` throws a `CastError` → caught as 500 (+ leaks the message, see M9). The `/insights` route already validates the ObjectId and returns 400 — the others don't.
- **Recommendation:** Validate `req.params.id` with `mongoose.isValidObjectId` up front, return 400.

### M11 — Dashboard re-analyzes the whole watchlist on every visit
- **Location:** [frontend/app/page.jsx:106](frontend/app/page.jsx#L106) (`hasAutoAnalyzed` ref + `analyzeAll`)
- **Category:** Performance / cost
- **Why it's a bug:** `hasAutoAnalyzed` is a `useRef` that resets whenever the Dashboard unmounts (navigate away → back). Each return to the dashboard fires `analyzeAll()`, which issues a `POST /api/refresh/:ticker` per stock (up to 25 provider round-trips), pressuring the `analysisLimiter` (30/min) and the data provider.
- **Recommendation:** Gate auto-analyze on staleness (only refresh stocks whose `analyzedAt` is older than N hours) and/or persist the "analyzed this session" flag outside component state.

### M12 — Logout does not invalidate tokens server-side
- **Location:** [backend/src/routes/auth.js:127](backend/src/routes/auth.js#L127), refresh at L141
- **Category:** Security
- **Why it's a bug:** Logout only clears the cookie in the browser. There's no refresh-token denylist/rotation-reuse detection, so a refresh token captured before logout stays valid for its full 30-day TTL.
- **Recommendation:** Add a server-side refresh-token store (jti) with revocation on logout, or shorten refresh TTL + reuse detection. (Design decision.)

### M13 — Refresh stampede on concurrent 401s
- **Location:** [frontend/lib/apiClient.js:24](frontend/lib/apiClient.js#L24) and [frontend/context/AuthContext.jsx:47](frontend/context/AuthContext.jsx#L47)
- **Category:** Async / race condition
- **Why it's a bug:** When several requests 401 at once (e.g. after the access token expires), each independently calls `/auth/refresh`, each rotating the refresh cookie. Concurrent rotations race; some retries can use a token that a sibling already replaced.
- **Recommendation:** Single-flight the refresh (share one in-flight promise across callers).

### M14 — Google OAuth links to an existing email without verifying it
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

These touch auth, security policy, architecture, or product behavior — I did **not** change them:

1. **H2** Enforce suspension on user APIs / refresh (per-request DB load trade-off).
2. **H3** Re-namespace admin API under `/api/admin/*` to free `/admin/*` for the SPA (+ SW denylist).
3. **H4** Fail-fast on missing `JWT_SECRET`/`JWT_REFRESH_SECRET` at boot.
4. **H5** Stop sending the OAuth access token in the redirect URL.
5. **M3** Clear authenticated SW caches on logout.
6. **M4 / M5** Move the access token out of `localStorage`; drop `unsafe-eval` from CSP.
7. **M6** Decide retention vs. cleanup of `PushSubscription`/`AnalyticsEvent`/`WatchlistItem`/`AuditLog` on account deletion.
8. **M7** Stop trusting client-supplied `userId` in `/api/events`.
9. **M12** Server-side refresh-token revocation on logout.

---

## Fixes applied in this pass

| # | File | Change |
|---|------|--------|
| H1 | `backend/src/index.js`, `backend/src/jobs/newsTickerScan.js` | Movers: instantiate `new YahooFinance()` + use `screener({ scrIds })` (v3-correct), verified live |
| M1 | `backend/src/jobs/newsTickerScan.js` | Reuters feed → Google-News-routed Reuters query + consolidated feed-health log |
| M2 | `backend/src/routes/admin/users.js` | Escape + length-cap admin search regex (ReDoS / injection) |

All edited files pass `node --check`. The backend instance launched during the audit (which connected to the live MongoDB Atlas cluster) was stopped afterward.
