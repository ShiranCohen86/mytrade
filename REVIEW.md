# MyStack — סקירה מקיפה בכל הכובעות

> תאריך: 2026-06-05 | גרסה: ראשונה | מבוסס על: קריאת קוד מלאה + ניתוח ארכיטקטורה

---

## כובע 1: QA Engineer — בדיקות ואיכות פונקציונלית

| # | ממצא | סוג | חומרה | קובץ |
|---|------|-----|-------|------|
| 1 | **NewsPanel לא מחובר ל-API** — הקומפוננטה תמיד מציגה "Live news coming soon" אף שה-backend מממש `/api/news/:ticker` מלא ועובד | באג | גבוהה | `frontend/components/NewsPanel/NewsPanel.tsx` |
| 2 | **90d stat שקרי** — `pctChange(hist, 90)` מחשב שינוי על מקסימום 59 נקודות (רק 60 ימי היסטוריה נשמרים), הנתון מוצג כ-"90d" | באג | גבוהה | `frontend/app/stocks/[ticker]/StockDetailClient.tsx:64` |
| 3 | **analyzeAll מאבד תוצאות חלקיות בכישלון** — `Promise.all` זורק אם מניה אחת נכשלת; כל שאר התוצאות אובדות | באג | גבוהה | `frontend/hooks/useStocks.ts:102` |
| 4 | **remove ב-useStocks לא מטפל בשגיאות** — `await removeStock(ticker)` ללא try/catch; כישלון API משאיר state לא סינכרוני | באג | גבוהה | `frontend/hooks/useStocks.ts:82-85` |
| 5 | **DELETE לא מאמת קיום ticker** — מחזיר 204 גם אם ה-ticker לא היה ב-watchlist כלל | באג | בינונית | `backend/src/routes/stocks.js:46-55` |
| 6 | **race condition ב-analyzeAll** — סוגרת over `stocks` state שמתעדכן כל שנייה; מניות שהוסרו בזמן ניתוח עדיין מנותחות | באג | בינונית | `frontend/hooks/useStocks.ts:97-109` |
| 7 | **User.findOne() ללא session** — אם אין User doc (race condition אחרי restart), `user.watchlist.includes(t)` זורק TypeError | באג | גבוהה | `backend/src/routes/stocks.js:29` |
| 8 | **orphan stock data** — POST מנתח מניה לפני הוספה ל-watchlist; אם ה-updateOne נכשל, ה-Stock doc קיים ב-DB בלי watchlist entry | באג | בינונית | `backend/src/routes/stocks.js:33-35` |
| 9 | **isRefreshingAll state לא בשימוש** — `useStocks` מחזיר `isRefreshingAll` אך ה-dashboard לא משתמש בו כלל | באג | נמוכה | `frontend/hooks/useStocks.ts:111` |
| 10 | **refresh() בדף פרטים מציג full loading spinner** — `setIsLoading(true)` בזמן refresh מסתיר את הנתונים הקיימים במקום להציג spinner קטן | באג | בינונית | `frontend/hooks/useStockAnalysis.ts:31-42` |
| 11 | **earningsDate שעברה נשארת ב-cachedData** — לאחר earnings date עברה, הנתון ישן מוצג כאילו הוא עתידי; אין ניקוי | באג | גבוהה | `backend/src/engines/riskScoreEngine.js:55-63` |
| 12 | **SMA200 מחושב על נתונים חסרים** — `Math.min(200, spyCloses.length)` מחשב SMA קצר יותר אך מתייג אותו כ-SMA200 | באג | גבוהה | `backend/src/engines/marketRegimeEngine.js:21` |
| 13 | **bearTarget percentMove לא מתואם לאחר cap** — `Math.max(bearTarget, 0.01)` מגביל מחיר אך `bearPct` מחושב לפני כן ועלול להציג -100%+ | באג | בינונית | `backend/src/engines/earningsScenariosEngine.js:89-91` |
| 14 | **getWatchlist מוחק מניות בשקט** — מניה ב-watchlist שאין לה Stock doc מסוננת ב-filter(Boolean) ללא שגיאה | באג | נמוכה | `backend/src/services/stockService.js:107-113` |
| 15 | **ProviderFactory נטען בתוך route handler** — `require('../providers/ProviderFactory')` בתוך `async (req, res)` — נטען מחדש בכל בקשה (כנראה cached ע"י Node, אך לא אידיאלי) | באג | נמוכה | `backend/src/routes/stocks.js:87` |
| 16 | **cron runs יכול לחפוף לעצמו** — loop סדרתי על watchlist ללא mutex; אם הניתוח לוקח יותר מ-2 שעות, run חדש מתחיל | באג | בינונית | `backend/src/jobs/cacheRefresh.js` |
| 17 | **analyzeAll מחליף stocks array כולו** — `setStocks(updated)` מבטל updates של מחיר חיה שהתרחשו בזמן הניתוח | באג | בינונית | `frontend/hooks/useStocks.ts:104` |
| 18 | **fmtVolume מציג "undefined"** — אם `cachedData.volume` הוא null/undefined, `fmtVolume(undefined)` מחזיר "undefined" | באג | נמוכה | `frontend/components/StockCard/StockCard.tsx:33-36` |
| 19 | **חיבור ל-backend לא מאומת ב-"online" event** — `handleOnline` קורא ל-`pollPrices` אך אם הbackend עצמו down (וה-browser online), הisConnected נשאר false | באג | נמוכה | `frontend/hooks/useStocks.ts:67-68` |
| 20 | **double submission אפשרי** — לחיצה מהירה מאוד על "Add" לפני `setLoading(true)` יכולה לשלוח 2 בקשות | באג | נמוכה | `frontend/components/AddTickerForm/AddTickerForm.tsx:15-32` |
| 21 | **error banner ב-dashboard לא ניתן לסגירה** — `{error && <div className={styles.errorBanner}>...}` אין כפתור dismiss | באג | נמוכה | `frontend/app/page.tsx:41-45` |
| 22 | **sentiment score מחולק ב-totalWeight** — `score` מחושב כ-sum חלקי totalWeight (ממוצע משוקלל), אך שם השדה הוא `score` שמרמז על סכום גולמי | באג | נמוכה | `backend/src/engines/sentimentEngine.js:20` |
| 23 | **AutoRefreshControl component מת** — מוגדר ב-components/ אך לא מיובא בשום מקום | באג | נמוכה | `frontend/components/AutoRefreshControl/` |
| 24 | **ConnectionStatus component מת** — מוגדר ב-components/ אך לא מיובא בשום מקום | באג | נמוכה | `frontend/components/ConnectionStatus/` |
| 25 | **NEWS_API_KEY ו-NEWS_PROVIDER לא בשימוש** — מוגדרים ב-config.js ובdotenv, לא נקראים בשום מקום | באג | נמוכה | `backend/src/config.js:7-8` |
| 26 | **getAnalysis ב-detail page לא מבצע live polling** — המחיר בדף הפרטים קפוא על ערך ה-analysis ולא מתעדכן בזמן אמת | שיפור | גבוהה | `frontend/hooks/useStockAnalysis.ts` |
| 27 | **ניתוח אחרי שוק סגור** — `getCurrentQuote` מחזיר מחיר סגירה אחרון, אך אין אינדיקציה האם השוק פתוח | שיפור | בינונית | `backend/src/providers/YahooFinanceProvider.js:15-31` |
| 28 | **אין 404 page ל-/stocks/[ticker]** — ticker תקין שלא ב-DB מציג "Stock not found" כ-error state ללא ניווט ראוי | שיפור | בינונית | `frontend/app/stocks/[ticker]/StockDetailClient.tsx:50-56` |
| 29 | **News schema קיים אך לא בשימוש** — `models/News.js` מגדיר Mongoose schema מלא עם TTL אך newsService לעולם לא שומר ל-DB | שיפור | בינונית | `backend/src/models/News.js` |
| 30 | **lastUpdated מיותר** — `lastUpdated: Date` ב-Stock schema מיותר כי `timestamps: true` כבר מספק `updatedAt` | שיפור | נמוכה | `backend/src/models/Stock.js:36` |
| 31 | **אין timeout על בקשות Yahoo Finance** — בקשות ל-API חיצוני יכולות לתלות את השרת ללא הגבלה | שיפור | גבוהה | `backend/src/providers/YahooFinanceProvider.js` |
| 32 | **אין retry על RSS** — כישלון חולף ב-Google News מחזיר רשימה ריקה ללא ניסיון חוזר | שיפור | בינונית | `backend/src/services/newsService.js:18-43` |
| 33 | **אין indication מתי נותח אחרון** — `analyzedAt` timestamp קיים ב-DB אך לא מוצג ב-UI | שיפור | בינונית | `backend/src/models/Stock.js:88` |
| 34 | **getCompanyInfo מבצע 2 קריאות ל-Yahoo** — `yf.quote(ticker)` נקרא גם ב-getCurrentQuote וגם ב-getCompanyInfo — כפילות | שיפור | בינונית | `backend/src/providers/YahooFinanceProvider.js:71-91` |
| 35 | **CACHE_TTL_MINUTES לא בשימוש** — תיעוד מטעה; מוצג כ-feature אך לא ממומש | שיפור | נמוכה | `backend/src/config.js:8` |
| 36 | **beta נשלף אך לא מוצג** — beta נשמר ב-cachedData אך לא מוצג ב-UI ולא נכנס לחישובים | שיפור | נמוכה | `backend/src/providers/YahooFinanceProvider.js:88` |
| 37 | **analystTargetPrice מוסתר מהמשתמש** — נכנס לחישוב expectation אך לא מוצג בדף הפרטים | שיפור | נמוכה | `frontend/app/stocks/[ticker]/StockDetailClient.tsx` |
| 38 | **neutralProb קבוע ב-40%** — לא מושפע מ-drift, sentiment או market regime | שיפור | בינונית | `backend/src/engines/earningsScenariosEngine.js:51` |
| 39 | **weight הוא let אך לא מוקצה מחדש** — צריך להיות const | שיפור | נמוכה | `backend/src/engines/sentimentEngine.js:14` |
| 40 | **global regime לקוח מ-stocks[0]** — `stocks[0]?.analysis?.marketRegime` — שבריר; המחיר בראש העמוד תלוי בסדר הmatchlist | שיפור | נמוכה | `frontend/app/page.tsx:12` |
| 41 | **אין progress indication ל-analyzeAll** — הכפתור מציג "Analyzing…" אך אין ידיעה איזו מניה בתהליך | פיצ'ר | בינונית | `frontend/app/page.tsx:26-36` |
| 42 | **אין confirmation לפני מחיקה** — לחיצה על ✕ מוחקת מיד; אין "Are you sure?" | פיצ'ר | בינונית | `frontend/components/StockCard/StockCard.tsx:63-69` |
| 43 | **אין undo להסרת מניה** — לאחר מחיקה, אין אפשרות לשחזר | פיצ'ר | בינונית | `frontend/hooks/useStocks.ts:82-85` |
| 44 | **אין מצב offline מלא** — כשה-backend מנותק, מוצג dot אדום אך אין הסבר או פעולה אפשרית | פיצ'ר | נמוכה | `frontend/components/StockCard/StockCard.tsx:95-97` |
| 45 | **אין validation ל-CRON_SCHEDULE** — ערך cron לא תקין ב-.env יכול לשבש את node-cron בשקט | שיפור | בינונית | `backend/src/jobs/cacheRefresh.js` |
| 46 | **אין max watchlist size** — אפשר להוסיף אינסוף מניות; כל אחת דורשת ~7 API calls לניתוח | שיפור | גבוהה | `backend/src/routes/stocks.js:18-43` |
| 47 | **driftPercent רלוונטי רק לפני earnings** — מחושב תמיד על 10 ימים אחרונים; אחרי earnings, המספר חסר משמעות | שיפור | בינונית | `backend/src/engines/preEarningsDriftEngine.js` |
| 48 | **אין error state ייעודי לניתוח ספציפי** — אם TSLA נכשלת ב-analyzeAll, כל הbar מציג שגיאה גנרית | שיפור | נמוכה | `frontend/hooks/useStocks.ts:105` |
| 49 | **אין בדיקה שה-ticker קיים ב-Yahoo לפני שמירה** — ticker דמיוני (XYZAB) ייכנס לניתוח ויזרוק שגיאה רק ב-getCurrentQuote | שיפור | בינונית | `backend/src/services/stockService.js:14-28` |
| 50 | **אין integration tests** — לא קיים תיקיית tests; כל הloגיקה עסקית נבדקת רק ידנית | פיצ'ר | גבוהה | כל הפרויקט |

---

## כובע 2: Product Manager — פרודקט, פיצ'רים ואסטרטגיה

| # | ממצא | סוג | עדיפות | הערה |
|---|------|-----|--------|------|
| 1 | **אין authentication** — אפליקציה לא יכולה לתמוך במספר משתמשים; לא ניתן לשתף watchlist בצורה מאובטחת | פיצ'ר | קריטי | |
| 2 | **אין price alerts** — אין התרעה כשמניה מגיעה למחיר יעד או כש-risk score עולה מעל סף | פיצ'ר | גבוהה | |
| 3 | **אין earnings calendar** — אין תצוגה כלל-watchlist של תאריכי דוחות הקרובים | פיצ'ר | גבוהה | |
| 4 | **אין מעקב P&L** — אין אפשרות להזין מחיר קנייה ולראות ביצועים | פיצ'ר | גבוהה | |
| 5 | **אין השוואה בין מניות** — אין מצב comparison לצד המניות בdashboard | פיצ'ר | גבוהה | |
| 6 | **אין ריכוז סקטוריאלי** — אין אזהרה "80% מה-watchlist שלך הוא Tech" | פיצ'ר | גבוהה | |
| 7 | **אין export (PDF/CSV)** — לא ניתן לשמור ניתוח לדוח חיצוני | פיצ'ר | בינונית | |
| 8 | **אין PWA manifest** — האפליקציה לא ניתנת להתקנה על מכשיר נייד | פיצ'ר | בינונית | |
| 9 | **אין מעקב היסטורי של scores** — לא ניתן לראות כיצד risk/expectation השתנו לאורך זמן | פיצ'ר | גבוהה | |
| 10 | **אין short interest data** — פרמטר חשוב לסוחרים חסר לחלוטין | פיצ'ר | בינונית | |
| 11 | **אין implied volatility (IV)** — IV לפני earnings הוא מדד קריטי שחסר | פיצ'ר | גבוהה | |
| 12 | **אין insider trading / institutional data** — מידע על מכירות/קניות מנהלים | פיצ'ר | בינונית | |
| 13 | **אין dividend data** — תשואת דיבידנד ותאריכי XD חסרים | פיצ'ר | בינונית | |
| 14 | **אין position sizing recommendation** — כמה לשים בכל מניה על בסיס risk score? | פיצ'ר | בינונית | |
| 15 | **אין correlation matrix** — איזה מניות ב-watchlist מתנהגות אותו דבר? | פיצ'ר | גבוהה | |
| 16 | **אין custom alerts (custom rules)** — "התרע כש-risk > 80 AND earnings < 7 ימים" | פיצ'ר | גבוהה | |
| 17 | **אין notes/tags per stock** — לא ניתן להוסיף תזת השקעה לכל מניה | פיצ'ר | בינונית | |
| 18 | **אין סינון ומיון בwatchlist** — לא ניתן למיין לפי risk, expectation, שם | פיצ'ר | בינונית | |
| 19 | **אין watchlist templates** — "Growth", "Dividend", "Pre-earnings" — packages מוגדרים מראש | פיצ'ר | נמוכה | |
| 20 | **אין bulk add** — צריך להוסיף כל ticker בנפרד; אין upload CSV | פיצ'ר | נמוכה | |
| 21 | **אין drag-to-reorder בwatchlist** — הסדר קבוע ולא ניתן לשינוי | פיצ'ר | נמוכה | |
| 22 | **אין onboarding** — משתמש חדש לא מבין מה המדדים אומרים | פיצ'ר | גבוהה | |
| 23 | **אין שם מוצר עקבי** — `.env.local` אומר "MyTrade", ה-UI אומר "Watchlist", ה-repo הוא "mystack" | שיפור | בינונית | |
| 24 | **אין favicon/app icon** — הדפדפן מציג ריבוע ריק | שיפור | גבוהה | |
| 25 | **אין market hours indicator** — לא ברור האם השוק פתוח כשמסתכלים על הנתונים | פיצ'ר | בינונית | |
| 26 | **אין pre-market/after-hours prices** — Extended hours trading מוסתרת | פיצ'ר | בינונית | |
| 27 | **אין earnings surprise history** — כמה פעמים החברה הכתה/החמיצה הערכות? | פיצ'ר | גבוהה | |
| 28 | **אין macro indicators** — Fed rate, inflation, VIX לא חלק ממשוואת ה-market regime | פיצ'ר | בינונית | |
| 29 | **אין analyst rating changes** — upgrade/downgrade היסטוריה | פיצ'ר | בינונית | |
| 30 | **אין revenue/EPS trend** — fundamentals חסרים לחלוטין | פיצ'ר | גבוהה | |
| 31 | **2-hour refresh interval ארוך מדי** — סוחרים אקטיביים צריכים עדכון תכוף יותר | שיפור | בינונית | |
| 32 | **אין awareness לסוף שבוע** — ניתוח רץ ב-שבת/ראשון על נתונים ישנים ללא הסבר | שיפור | בינונית | |
| 33 | **אין sector ETF benchmark** — לא ניתן לראות כיצד המניה מדורגת מול ה-sector שלה | פיצ'ר | בינונית | |
| 34 | **custom scoring weights** — משתמש שמחזיק biotech רוצה לשקלל earnings proximity יותר | פיצ'ר | נמוכה | |
| 35 | **אין API ל-developers** — אין אפשרות לשלוף נתונים לכלי חיצוני | פיצ'ר | נמוכה | |
| 36 | **אין dark/light mode** — רק theme אחד | פיצ'ר | נמוכה | |
| 37 | **אין keyboard shortcuts** — power users לא יכולים לנווט מהמקלדת | פיצ'ר | נמוכה | |
| 38 | **אין share/bookmark** — לא ניתן לשתף לינק לניתוח ספציפי | פיצ'ר | נמוכה | |
| 39 | **אין news archive** — חדשות נשלפות מחדש בכל בקשה, לא שמורות | שיפור | בינונית | |
| 40 | **אין relative performance** — כמה המניה עשתה לעומת S&P500 מאז הוספתה? | פיצ'ר | גבוהה | |
| 41 | **אין beta-adjusted risk** — beta נשלף אך לא נכנס לשום חישוב | שיפור | גבוהה | |
| 42 | **אין sector rotation indicator** — handy for macro-aware investors | פיצ'ר | נמוכה | |
| 43 | **אין שעת ניתוח אחרון ב-card** — המשתמש לא יודע אם הנתונים בני שעה או שבוע | שיפור | גבוהה | |
| 44 | **אין volume spike detection** — נפח חריג הוא signal חשוב שחסר | פיצ'ר | בינונית | |
| 45 | **אין support ל-ETFs, ADRs** — האפליקציה מניחה US stocks בלבד | שיפור | נמוכה | |
| 46 | **אין "similar stocks" recommendation** — אחרי ניתוח AAPL, מה עוד רלוונטי? | פיצ'ר | נמוכה | |
| 47 | **אין summary statistics ב-dashboard** — average risk, average expectation across watchlist | פיצ'ר | בינונית | |
| 48 | **אין watchlist performance chart** — כיצד ה-watchlist כולו ביצע לאורך זמן? | פיצ'ר | נמוכה | |
| 49 | **backtesting מיני** — האם ה-risk score שלי ניבא בפועל תנועות מחיר? | פיצ'ר | גבוהה | |
| 50 | **אין help/FAQ** — אין תיעוד מה המדדים אומרים מחוץ לtooltips | שיפור | בינונית | |

---

## כובע 3: UX/UI Designer — חוויית משתמש ועיצוב

| # | ממצא | סוג | עדיפות | קובץ |
|---|------|-----|--------|------|
| 1 | **NewsPanel מציגה placeholder מטעה** — "Live news coming soon" כשה-API עובד; צריך להציג חדשות בפועל | באג | גבוהה | `frontend/components/NewsPanel/NewsPanel.tsx` |
| 2 | **אין loading progress bar** — ניתוח לוקח 10-15 שניות; spinner גנרי בלי indication כמה נשאר | שיפור | גבוהה | `frontend/app/page.tsx:26-36` |
| 3 | **מחיקה ללא אישור** — ✕ על הcard מוחק מיד ללא "Are you sure?" | שיפור | גבוהה | `frontend/components/StockCard/StockCard.tsx:63` |
| 4 | **90d label שקרי ויזואלית** — מציג "90d" על נתון של ~59 ימים | באג | גבוהה | `frontend/app/stocks/[ticker]/StockDetailClient.tsx:64` |
| 5 | **refresh גורם לdisappear של נתונים** — לחיצה על "↻ Refresh Analysis" מציגה spinner מלא ומסתירה את הנתונים הקיימים | שיפור | גבוהה | `frontend/hooks/useStockAnalysis.ts:31` |
| 6 | **אין timestamp "נותח לאחרונה"** — המשתמש לא יודע עדכניות הנתונים | שיפור | גבוהה | `frontend/app/stocks/[ticker]/StockDetailClient.tsx` |
| 7 | **sentiment card מינימלי מדי** — רק "POSITIVE" / "NEUTRAL" / "NEGATIVE" + מספר headlines; אין ויזואליזציה | שיפור | גבוהה | `frontend/app/stocks/[ticker]/StockDetailClient.tsx:175-187` |
| 8 | **tooltip trigger לא ברור** — סמל (?) קטן; משתמשים חדשים לא ידעו ללחוץ עליו | שיפור | בינונית | `frontend/components/InfoTooltip/InfoTooltip.tsx` |
| 9 | **אין favicon** — tab בדפדפן ריק | שיפור | גבוהה | `frontend/app/layout.tsx` |
| 10 | **error banner לא ניתן לסגירה** — ⚠ שגיאה נשארת לנצח עד לרפרוש הדף | שיפור | גבוהה | `frontend/app/page.tsx:41-45` |
| 11 | **connectionDot קטן מדי** — נקודה ירוקה/אדומה קטנה בין מחיר לאחוז; קל לפספס | שיפור | נמוכה | `frontend/components/StockCard/StockCard.tsx:95-97` |
| 12 | **"View Full Analysis →" לא meaty CTA** — link טקסטואלי בתחתית הcard; לא בולט מספיק | שיפור | בינונית | `frontend/components/StockCard/StockCard.tsx:151-153` |
| 13 | **VERY_HIGH label ארוך** — "VERY_HIGH" עשוי להיחתך על מסכים קטנים | שיפור | בינונית | `frontend/types/index.ts:54` |
| 14 | **אין volume context** — "15.2M" — האם זה גבוה/רגיל/נמוך עבור מניה זו? | שיפור | גבוהה | `frontend/components/StockCard/StockCard.tsx` |
| 15 | **beta לא מוצג** — נתון זמין שמתעלמים ממנו; בטא הוא מדד חשוב למשקיעים | שיפור | גבוהה | `frontend/app/stocks/[ticker]/StockDetailClient.tsx` |
| 16 | **analyst target price מוסתר** — משמש לחישובים אך לא מוצג למשתמש | שיפור | בינונית | `frontend/app/stocks/[ticker]/StockDetailClient.tsx` |
| 17 | **אין intraday high/low ב-hero** — רק מחיר נוכחי ואחוז שינוי; חסרים high/low יומיים | שיפור | בינונית | `frontend/app/stocks/[ticker]/StockDetailClient.tsx:83-95` |
| 18 | **אין skeleton ל-detail page** — רק spinner בודד; UX גרוע בטעינה | שיפור | בינונית | `frontend/hooks/useStockAnalysis.ts` |
| 19 | **"⚡ Analyze Stocks" emoji לא עקבי** — emoji בכפתור; שאר ה-UI נקי מemojiים | שיפור | נמוכה | `frontend/app/page.tsx:35` |
| 20 | **סדר cards ב-grid קבוע** — אין אפשרות למיין לפי risk/expectation/שם | שיפור | גבוהה | `frontend/app/page.tsx:62-70` |
| 21 | **flash animation אגרסיבית** — עם polling של 1 שנייה, הcard מהבהב כל שנייה אם המחיר זז | שיפור | בינונית | `frontend/components/StockCard/StockCard.tsx:45-55` |
| 22 | **price flash 600ms — קצר מדי** — קשה לרשום אם המחיר עלה או ירד לפני שהצבע נעלם | שיפור | נמוכה | `frontend/components/StockCard/StockCard.tsx:50` |
| 23 | **אין max-columns למשחקי ultra-wide** — בצג רחב מאוד, cards קטנים מאוד | שיפור | נמוכה | `frontend/app/page.module.scss` |
| 24 | **Scenario Panel — probabilites לא מצטרפות ל-100%** ויזואלית | שיפור | גבוהה | `frontend/components/ScenarioPanel/ScenarioPanel.tsx` |
| 25 | **market regime badge בלי legend** — VOLATILE בצהוב? BEARISH באדום? לא ברור | שיפור | בינונית | `frontend/components/MarketRegimeBadge/MarketRegimeBadge.tsx` |
| 26 | **DriftIndicator — לא ברור זמני-חלון** — "RISING 7.3%" — 7.3% ב-10 ימים? לא מוצג | שיפור | בינונית | `frontend/components/DriftIndicator/DriftIndicator.tsx` |
| 27 | **אין breakpoint ל-tablet** — layout קופץ ישר מmobile ל-desktop | שיפור | בינונית | |
| 28 | **אין dark mode** — עיני משתמשים בלילה | שיפור | נמוכה | |
| 29 | **אין keyboard navigation** — לא ניתן לנווט בין cards עם חצים; remove עם Backspace | שיפור | בינונית | |
| 30 | **אין aria-label על כפתור ✕** — רק `title="Remove from watchlist"`; לא accessible | שיפור | גבוהה | `frontend/components/StockCard/StockCard.tsx:84-87` |
| 31 | **Color-only coding** — risk HIGH=אדום, LOW=ירוק אך ללא text backup; עיוורי צבעים מפגרים | שיפור | גבוהה | `frontend/components/StockCard/StockCard.tsx` |
| 32 | **P/E ratio ללא context** — "32.5" — גבוה? נמוך? אין השוואה לסקטור בUI | שיפור | בינונית | `frontend/app/stocks/[ticker]/StockDetailClient.tsx:119-123` |
| 33 | **earnings "0d" vs "Today"** — StockCard מציג "Today" אך detail page מציג "0d" | באג | נמוכה | `frontend/app/stocks/[ticker]/StockDetailClient.tsx:128-130` |
| 34 | **אין scroll-to-new-card** — לאחר הוספת מניה, לא מגיעים אוטומטית לcard החדש | שיפור | נמוכה | |
| 35 | **RiskGauge — semi-circle** — לא ברור מה צד שמאל (0) ומה צד ימין (100) | שיפור | גבוהה | `frontend/components/RiskGauge/RiskGauge.tsx` |
| 36 | **ExpectationMeter — non-intuitive** — score 100 = bad (high expectations = hard to beat); לא אינטואיטיבי | שיפור | גבוהה | |
| 37 | **News panel ב-left column, Sentiment ב-right** — לא עקבי; news וsentiment קשורים ואמורים להיות יחד | שיפור | בינונית | `frontend/app/stocks/[ticker]/StockDetailClient.tsx:141-187` |
| 38 | **PriceChart — אין צירי X תויות ברורות** — ציר התאריכים בchart עלול להיות עמוס | שיפור | בינונית | `frontend/components/PriceChart/PriceChart.tsx` |
| 39 | **אין hover state ב-StockCard למשתמשי desktop** — לא ברור שהcard clickable | שיפור | נמוכה | |
| 40 | **"Sell-the-News Risk" warning — צבע לא בולט מספיק** — ⚠ קטן בתחתית הcard | שיפור | גבוהה | `frontend/components/StockCard/StockCard.tsx:145-149` |
| 41 | **אין status לanalysis in-progress per card** — בזמן analyzeAll, כל הcards נראים אותו דבר | שיפור | בינונית | |
| 42 | **Empty state — CTA גנרי** — "Add a stock ticker above to start tracking..." — לא מספיק inspiring | שיפור | נמוכה | `frontend/app/page.tsx:54-60` |
| 43 | **אין `<title>` דינמי** — ה-tab title לא משתנה לפי ticker בדף הפרטים | שיפור | בינונית | `frontend/app/stocks/[ticker]/page.tsx` |
| 44 | **Sell-the-news tooltip מוצג רק כשהflag מופעל** — אין הסבר בסיסי ל-DriftIndicator כשאין risk | שיפור | נמוכה | |
| 45 | **אין animation מעבר בין pages** — מעבר חד בין watchlist לdetail page | שיפור | נמוכה | |
| 46 | **loading skeleton מציג 3 cards בלבד** — אם יש 10 מניות, ה-skeleton לא מייצג | שיפור | נמוכה | `frontend/app/page.tsx:48-52` |
| 47 | **אין visual grouping לפי סקטור** — ניתן לקבץ cards לפי Technology/Healthcare/etc | פיצ'ר | נמוכה | |
| 48 | **chart tooltip** — עם hover על הgraph, אין tooltip עם מחיר מדויק + תאריך | שיפור | גבוהה | `frontend/components/PriceChart/PriceChart.tsx` |
| 49 | **ScenarioPanel — 3 תרחישים בשורה אחת** — על mobile, 3 עמודות צפופים מדי | שיפור | בינונית | |
| 50 | **אין כפתור "Back to Top"** — בdashboard עם 15+ מניות, גלילה חזרה למעלה מיגעת | פיצ'ר | נמוכה | |

---

## כובע 4: Frontend Developer — קוד, ביצועים ו-TypeScript

| # | ממצא | סוג | עדיפות | קובץ |
|---|------|-----|--------|------|
| 1 | **pollPrices רץ ב-background tab** — 1 request/sec גם כשה-tab מוסתר; צריך `document.visibilitychange` listener | באג | גבוהה | `frontend/hooks/useStocks.ts:59-62` |
| 2 | **analyzeAll עם Promise.all במקום Promise.allSettled** — כישלון אחד מבטל הכל | באג | גבוהה | `frontend/hooks/useStocks.ts:102` |
| 3 | **אין AbortController** — fetch in-flight ממשיך אחרי unmount; memory leak פוטנציאלי | שיפור | גבוהה | `frontend/lib/apiClient.ts` |
| 4 | **analyzeAll תלוי ב-stocks state** — `useCallback([stocks])` מחדש creates the callback כל שנייה עם כל price poll | שיפור | גבוהה | `frontend/hooks/useStocks.ts:97-109` |
| 5 | **StockCard לא wrapped ב-React.memo** — כל price update גורם rerender לכל הcards | שיפור | גבוהה | `frontend/components/StockCard/StockCard.tsx` |
| 6 | **fmtPrice מוגדרת פעמיים** — זהה ב-StockCard.tsx וב-StockDetailClient.tsx; דרושה קובץ utils משותף | שיפור | בינונית | שני קבצים |
| 7 | **scoreClass מוגדרת פעמיים** — כנ"ל; דרוש shared utils | שיפור | בינונית | שני קבצים |
| 8 | **styles[`risk_${scoreClass()}`] — dynamic class names** — CSS Modules לא יכולים לנתח statically; purging עשוי להסיר classים | שיפור | גבוהה | `frontend/components/StockCard/StockCard.tsx:123` |
| 9 | **pctChange מוגדרת ב-module scope ולא ב-shared utils** — function שימושית שנקרית בשום מקום אחר | שיפור | נמוכה | `frontend/app/stocks/[ticker]/StockDetailClient.tsx:26-32` |
| 10 | **Next.js API routes מוסיפות hop מיותר** — Next.js → Express → Yahoo Finance; ישיר מFrontend לExpress מהיר יותר | שיפור | גבוהה | `frontend/app/api/` |
| 11 | **אין Error Boundary** — crash בStockCard מפיל את כל הdashboard | שיפור | גבוהה | `frontend/app/page.tsx` |
| 12 | **`'use client'` בכל מקום** — מבטל SSR לחלוטין; initial page load איטי יותר ו-SEO חסר | שיפור | גבוהה | שני pages |
| 13 | **useRef type לא מדויק** — `useRef<() => Promise<void>>()` צריך `useRef<(() => Promise<void>) | undefined>(undefined)` | שיפור | נמוכה | `frontend/hooks/useStocks.ts:16` |
| 14 | **fmtBig בודק `if (!n)` — false עבור n=0** — market cap $0 מחזיר '—' במקום '$0' | באג | נמוכה | `frontend/app/stocks/[ticker]/StockDetailClient.tsx:19` |
| 15 | **reload (alias ל-load) לא בשימוש** — `useStocks` מחזיר `reload` שה-dashboard לא משתמש בו | שיפור | נמוכה | `frontend/hooks/useStocks.ts:111` |
| 16 | **אין Suspense/lazy loading** — כל components נטענים ב-bundle הראשי | שיפור | בינונית | `frontend/app/stocks/[ticker]/StockDetailClient.tsx` |
| 17 | **news panel link: `server/.env`** — placeholder מפנה לנתיב שגוי (`server/.env` לא קיים; זה `backend/.env`) | באג | נמוכה | `frontend/components/NewsPanel/NewsPanel.tsx:13` |
| 18 | **TypeScript — ממשק `Props` לא ייוצא** — interface Props מוגדר locally בכל component; שקול index.ts מרכזי | שיפור | נמוכה | |
| 19 | **handleRemove catch ריק ב-StockCard** — `catch { setRemoving(false) }` — המשתמש לא מקבל error | שיפור | גבוהה | `frontend/components/StockCard/StockCard.tsx:63-69` |
| 20 | **אין retry logic ב-apiClient** — בקשות נכשלות; אין exponential backoff | שיפור | בינונית | `frontend/lib/apiClient.ts` |
| 21 | **polling interval קשוע בקוד** — 1000ms hardcoded; צריך `NEXT_PUBLIC_POLL_INTERVAL` | שיפור | נמוכה | `frontend/hooks/useStocks.ts:60` |
| 22 | **אין `next/head` dynamic title** — ה-`<title>` לא משתנה; חשוב ל-tab management ולנגישות | שיפור | בינונית | |
| 23 | **אין `robots.txt` / `sitemap.xml`** — לא בהכרח נדרש לאפליקציה פרטית אך חסר | שיפור | נמוכה | |
| 24 | **setStocks(updated) מחליף state במקום merge** — `analyzeAll` מחליף הכל; יש לmere analysis data עם live price | שיפור | בינונית | `frontend/hooks/useStocks.ts:104` |
| 25 | **const TIPS בmodule scope** — object literal שנוצר פעם אחת; ניתן להגדיר כ-constant file נפרד | שיפור | נמוכה | `frontend/components/StockCard/StockCard.tsx:9-14` |
| 26 | **אין aria-live region לprice updates** — screen readers לא מקבלים notification על שינויי מחיר | שיפור | גבוהה | |
| 27 | **`change?.toFixed(2)` על number type** — Optional chaining מיותר אם TypeScript מסמן כ-number | שיפור | נמוכה | `frontend/components/StockCard/StockCard.tsx:99` |
| 28 | **Input onChange אונס uppercase בכל keystroke** — עלול לשבש cursor position בחלק מהדפדפנים | שיפור | בינונית | `frontend/components/AddTickerForm/AddTickerForm.tsx:43` |
| 29 | **אין type-safe routing** — `href={/stocks/${ticker}}` — string literal; בעיית refactoring | שיפור | נמוכה | |
| 30 | **scss variables לא typed** — שינוי ב-`_variables.scss` לא נתפס בcompile time | שיפור | נמוכה | `frontend/styles/_variables.scss` |
| 31 | **useStockAnalysis לא מנקה state בין navigations** — stock data מstock קודם עלול להראות ברגע קצר | שיפור | נמוכה | `frontend/hooks/useStockAnalysis.ts` |
| 32 | **אין `loading` state per card ב-analyzeAll** — cards לא מציגים "מתנתח..." כל אחד בנפרד | שיפור | נמוכה | |
| 33 | **`prevPriceRef.current` update בתוך useEffect עם side effect** — מעורבות state + ref עלולה לגרום לbehavior לא צפוי ב-Strict Mode | שיפור | נמוכה | `frontend/components/StockCard/StockCard.tsx:45-55` |
| 34 | **אין `Content-Type` validation בapiClient** — `res.json()` יכשל אם שרת מחזיר HTML (כמו בerror page של Render) | שיפור | בינונית | `frontend/lib/apiClient.ts:8-12` |
| 35 | **getQuotes returns array — לא נבדק אם Array** — אם backend שולח object בשגיאה, `.find()` ייזרוק | שיפור | נמוכה | `frontend/hooks/useStocks.ts:41` |
| 36 | **אין `getServerSideProps` לdynamic routes** — SEO וshare links נשברים | שיפור | בינונית | `frontend/app/stocks/[ticker]/page.tsx` |
| 37 | **news tab בלי state management** — אין caching של news; fetched מחדש בכל רינדור של NewsPanel | שיפור | בינונית | |
| 38 | **אין Virtualization לגדולות watchlists** — 50+ מניות = 50+ DOM nodes פעילים | שיפור | נמוכה | |
| 39 | **CSS modules — class name collisions** — styles בין components לא isolated מ-global styles | שיפור | נמוכה | |
| 40 | **אין `next.config.js` output: 'standalone'** — לא מוגדר לdocker friendly output | שיפור | נמוכה | `frontend/next.config.js` |
| 41 | **Link component לא prefetch** — `<Link href="/stocks/AAPL">` יכול prefetch hover לשיפור navigation | שיפור | נמוכה | |
| 42 | **import מסדר לא עקבי** — בחלק מהקבצים types לפני components, בחלק אחרי | שיפור | נמוכה | |
| 43 | **useCallback with empty deps ל-`load`** — `load` ב-useStocks עם `[]` — תקין אך לא מסתמן בdocs | שיפור | נמוכה | `frontend/hooks/useStocks.ts:18` |
| 44 | **אין `eslint-plugin-react-hooks`** — תצורת ESLint לא כוללת ה-plugin שמוצא בעיות hooks | שיפור | בינונית | `frontend/.eslintrc.json` |
| 45 | **אין pre-commit hook** — `npm run lint` לא נאכף לפני commit | שיפור | נמוכה | |
| 46 | **global SCSS variables בסגנון BEM** — אין naming convention עקבי לclasses | שיפור | נמוכה | |
| 47 | **Flash animation CSS גורמת לreflow** — `setFlash` מגדיר class שמשנה צבע; עדיף CSS transition על transform | שיפור | נמוכה | |
| 48 | **אין PWA service worker** — אין offline support בסיסי | פיצ'ר | בינונית | |
| 49 | **אין `<meta name="description">`** — SEO וshare preview חסרים | שיפור | נמוכה | `frontend/app/layout.tsx` |
| 50 | **window.addEventListener בuseEffect ללא deps** — תקין, אבל pattern לא documented; מסוכן אם מועתק | שיפור | נמוכה | `frontend/hooks/useStocks.ts:65-74` |

---

## כובע 5: Backend Developer — API, קוד וביצועים

| # | ממצא | סוג | עדיפות | קובץ |
|---|------|-----|--------|------|
| 1 | **אין rate limiting** — כל client יכול לקרוא ל-`/api/refresh/:ticker` ללא הגבלה; Yahoo Finance rate limit יפגע | באג | קריטי | `backend/src/routes/stocks.js` |
| 2 | **express.json() ללא body size limit** — DoS דרך payloads גדולים | באג | גבוהה | `backend/src/index.js:12` |
| 3 | **cors({ credentials: true, origin: '*' })** — קומבינציה לא חוקית לפי CORS spec; דפדפנים דוחים אותה | באג | גבוהה | `backend/src/index.js:8-11` |
| 4 | **אין helmet.js** — חסרים security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options | שיפור | גבוהה | `backend/src/index.js` |
| 5 | **DELETE לא מוחק Stock document** — רק מסיר מUser.watchlist; Stock docs מצטברים ב-DB ללא הגבלה | באג | גבוהה | `backend/src/routes/stocks.js:46-55` |
| 6 | **getCompanyInfo קורא `yf.quote()` כפול** — getCurrentQuote ו-getCompanyInfo שניהם קוראים ל-`yf.quote(ticker)` בנפרד | שיפור | גבוהה | `backend/src/providers/YahooFinanceProvider.js:71` |
| 7 | **cron job סדרתי — עלול לחרוג מInterval** — `for...of` ללא timeout; 10 מניות × 15 שנ' = 150 שנ' > 2 שעות בעיה? לא, אבל 50 מניות כן | שיפור | גבוהה | `backend/src/jobs/cacheRefresh.js` |
| 8 | **CACHE_TTL_MINUTES לא בשימוש** — config מתעתע; אין מימוש caching אמיתי | שיפור | בינונית | `backend/src/config.js:8` |
| 9 | **runValidators: false** — מדלג על Mongoose schema validation בכל update | שיפור | גבוהה | `backend/src/services/stockService.js:96` |
| 10 | **אין index ב-Stock collection מעבר ל-ticker** — לא בעיה כרגע אך יגרום לבעיות בscale | שיפור | נמוכה | `backend/src/models/Stock.js` |
| 11 | **News schema קיים אך לא בשימוש** — `models/News.js` מגדיר TTL index מלא שלא נקרא | שיפור | בינונית | `backend/src/models/News.js` |
| 12 | **User.findOne() ללא error handling אם null** — אם בupsert race condition אין User doc, `user.watchlist` זורק TypeError | באג | גבוהה | `backend/src/routes/stocks.js:29` |
| 13 | **POST /refresh/:ticker לא מאמת watchlist membership** — כל client יכול לנתח כל ticker | שיפור | בינונית | `backend/src/routes/stocks.js:73-82` |
| 14 | **GET /stocks/:ticker/analysis לא מאמת watchlist** — חשיפת ניתוחים לtickers שאינם ב-watchlist | שיפור | בינונית | `backend/src/routes/stocks.js:57-70` |
| 15 | **אין request logging** — אין morgan; בag tracing בlogs קשה | שיפור | גבוהה | `backend/src/index.js` |
| 16 | **אין request timeout middleware** — בקשות ל-Yahoo Finance תלויות; event loop נחסם | שיפור | גבוהה | `backend/src/index.js` |
| 17 | **newsService.getNewsForTicker = fetchAndStoreNews** — שתי פונקציות אחת; אחת מיותרת | שיפור | נמוכה | `backend/src/services/newsService.js:45-47` |
| 18 | **אין API versioning** — `/api/` ללא `/v1/`; שינויי breaking ישברו clients | שיפור | בינונית | `backend/src/routes/stocks.js` |
| 19 | **אין max watchlist size** — 100 מניות = 700 API calls לניתוח; Yahoo Finance תachoke | שיפור | גבוהה | `backend/src/routes/stocks.js:18-43` |
| 20 | **לa single user architecture** — `User.findOne()` ללא filter; לא ניתן לtarget user ספציפי | שיפור | קריטי | `backend/src/routes/stocks.js` |
| 21 | **אין SIGTERM handler** — MongoDB connection לא נסגר gracefully בdeploy | שיפור | בינונית | `backend/src/index.js` |
| 22 | **console.log/error ישירים** — צריך structured logging (pino/winston) לproduction | שיפור | בינונית | כל קבצי backend |
| 23 | **אין environment validation** — שרת עולה גם עם MONGO_URI שגוי; מגלה רק בchנות | שיפור | גבוהה | `backend/src/config.js` |
| 24 | **require('./jobs/cacheRefresh') ללא try/catch** — bug בcron כrequire-time מפיל שרת | שיפור | גבוהה | `backend/src/index.js:29` |
| 25 | **getYF singleton — fail-once** — אם import נכשל, `_yf` נשאר null ו-ALL requests נכשלות עד restart | באג | גבוהה | `backend/src/providers/YahooFinanceProvider.js:5-11` |
| 26 | **StooqProvider כfallback חלקי** — לא קיים fallback ל-getCurrentQuote; רק historical data | שיפור | בינונית | `backend/src/providers/ProviderFactory.js` |
| 27 | **אין compression middleware** — `analysis` עם 60 historical points שולח JSON גדול | שיפור | בינונית | `backend/src/index.js` |
| 28 | **RSS timeout 8 שנ' מאריך ניתוח** — אם Google News איטי, כל הניתוח מתעכב | שיפור | בינונית | `backend/src/services/newsService.js:4` |
| 29 | **getWatchlist O(n²) ב-JavaScript** — `user.watchlist.map(t => stocks.find(s => s.ticker === t))` — sort+zip עדיף | שיפור | נמוכה | `backend/src/services/stockService.js:107-112` |
| 30 | **אין DB connection pool config** — Mongoose defaults לpool size=5; לא מוגדר ל-use case | שיפור | נמוכה | `backend/src/db/index.js` |
| 31 | **stockDoc מfindOneAndUpdate לא נבדק אם null** — במקרה קיצוני, `return stockDoc` מחזיר null | באג | נמוכה | `backend/src/services/stockService.js:97-100` |
| 32 | **lastUpdated ו-updatedAt — כפילות** — timestamps:true + lastUpdated ידני; שני שדות לאותו תפקיד | שיפור | נמוכה | `backend/src/models/Stock.js:36` |
| 33 | **Error responses חושפות internal messages** — `res.status(500).json({ error: err.message })` עלול לחשוף paths ו-stack | שיפור | גבוהה | `backend/src/routes/stocks.js` |
| 34 | **אין pagination** — GET /api/stocks מחזיר הכל; scalable רק לwatchlists קטנות | שיפור | נמוכה | |
| 35 | **cron שגיאת ticker בודד לא מדווחת למשתמש** — `console.error` בלבד; אין alerting | שיפור | בינונית | `backend/src/jobs/cacheRefresh.js:13-16` |
| 36 | **beta נשלף ב-getCompanyInfo אך לא נכנס לniculation** — API call מיותר | שיפור | בינונית | `backend/src/providers/YahooFinanceProvider.js:88` |
| 37 | **אין caching בין runs** — כל ניתוח קורא Yahoo Finance מחדש; Redis cache על quote data יכול להפחית עומס | פיצ'ר | גבוהה | |
| 38 | **ProviderFactory נטען בתוך route handler** — `require(...)` בתוך async handler; לאחר warm require זה cached אבל pattern לא נכון | שיפור | נמוכה | `backend/src/routes/stocks.js:87` |
| 39 | **getEarningsDate שואל רק dates[0]** — Yahoo מחזיר לפעמים טווח; רק התאריך הראשון נבחר | שיפור | נמוכה | `backend/src/providers/YahooFinanceProvider.js:62-65` |
| 40 | **אין multi-user watchlist support** — User model קיים אך path לmulti-user עובר refactor גדול | שיפור | קריטי | `backend/src/models/User.js` |
| 41 | **ticker validation רק regex** — לא מוודאים שה-ticker קיים בפועל לפני שמירה ל-watchlist | שיפור | בינונית | `backend/src/routes/stocks.js:22-24` |
| 42 | **אין idempotency key ב-POST /refresh** — קריאות מרובות בו-זמנית מעצבנות Yahoo Finance | שיפור | נמוכה | |
| 43 | **ניתוח sequential בcron ב-for...of** — עדיף Promise.all עם concurrency control (p-limit) | שיפור | בינונית | `backend/src/jobs/cacheRefresh.js` |
| 44 | **אין health check לDB** — `/health` מחזיר storage mode סטטי, לא בודק חיבור DB פעיל | שיפור | גבוהה | `backend/src/index.js:16` |
| 45 | **getHistoricalData — calendar days vs trading days** — 60 days calendar → ~43 trading days; misleading labeling | שיפור | נמוכה | `backend/src/providers/YahooFinanceProvider.js:36-38` |
| 46 | **אין request ID לtracing** — impossible לcorrelate logs בין frontend ו-backend | שיפור | בינונית | |
| 47 | **אין dependency injection** — engines נקראים ישירות; קשה לunit test | שיפור | נמוכה | `backend/src/services/stockService.js` |
| 48 | **getNewsForTicker fetchs fresh every call** — news לא cached; call נוסף ל-Google News בכל GET /news/:ticker | שיפור | בינונית | `backend/src/services/newsService.js` |
| 49 | **אין לcatch errors ב-require('./jobs/cacheRefresh')** — error ב-module load שובר server | שיפור | גבוהה | `backend/src/index.js:29` |
| 50 | **User model לא מגביל watchlist size** — `watchlist: [String]` ללא maxlength | שיפור | בינונית | `backend/src/models/User.js` |

---

## כובע 6: Security Engineer — אבטחה ו-Hardening

| # | ממצא | סוג | חומרה | קובץ |
|---|------|-----|-------|------|
| 1 | **אין authentication** — כל בקשה לAPI נענית ללא זיהוי; כל אחד ב-LAN יכול לגשת | חולשה | קריטי | כל endpoints |
| 2 | **cors `origin: '*'` עם `credentials: true`** — קומבינציה אסורה לפי spec; מסמן שהdev לא הבין CORS; בproduction ל-set ALLOWED_ORIGIN | חולשה | גבוהה | `backend/src/index.js:8-11` |
| 3 | **אין rate limiting** — API חשוף לbrute force ו-DDoS | חולשה | גבוהה | `backend/src/index.js` |
| 4 | **אין helmet.js** — חסרים: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy` | חולשה | גבוהה | `backend/src/index.js` |
| 5 | **express.json() ללא limit** — גוף בקשה גדול יכול לדרדר memory; `{ limit: '10kb' }` מספיק | חולשה | גבוהה | `backend/src/index.js:12` |
| 6 | **error messages חושפות internals** — `err.message` ישירות לresponse; Yahoo Finance errors כוללים paths ו-module names | חולשה | בינונית | `backend/src/routes/stocks.js` |
| 7 | **`.env` פתוח ב-IDE** — MONGO_URI עם credentials גלוי בeditor; צריך לוודא שלא committed ל-git | חולשה | קריטי | `backend/.env` |
| 8 | **אין CSRF protection** — POST/DELETE endpoints ללא CSRF token | חולשה | בינונית | `backend/src/routes/stocks.js` |
| 9 | **data/db.json ללא access controls** — fallback file עם נתוני watchlist; אין הצפנה | חולשה | נמוכה | `backend/src/db/localStore.js` |
| 10 | **אין audit logging** — אין רישום של who-did-what; impossible לexamine security incident | חולשה | גבוהה | |
| 11 | **אין Content-Type enforcement** — backend מקבל כל Content-Type; צריך לאמת `application/json` | חולשה | נמוכה | `backend/src/index.js` |
| 12 | **אין X-Request-ID** — impossible לtrace request לפי security incident | חולשה | נמוכה | |
| 13 | **MongoDB URI בlogs?** — אם Mongoose error כולל connection string, MONGO_URI מוצג בlogs | חולשה | גבוהה | `backend/src/db/index.js` |
| 14 | **RSS URL injection פוטנציאלי** — `${ticker} stock` ב-URL; ticker validated ל-5 letters אך pattern לא escapes special URL chars | חולשה | נמוכה | `backend/src/services/newsService.js:21` |
| 15 | **SSRF דרך news URL** — news service פותח HTTP request לURLs חיצוניים על בסיס user input; validation מוגבל | חולשה | בינונית | `backend/src/services/newsService.js` |
| 16 | **אין validation אם earningsDate בעתיד** — ניתן לhazing risk score על dates בעבר | חולשה | נמוכה | `backend/src/engines/riskScoreEngine.js:55-63` |
| 17 | **runValidators: false מאפשר כתיבת נתוני garbage** — מדלג schema validation; צד שלישי יכול לכתוב כל נתון | חולשה | גבוהה | `backend/src/services/stockService.js:96` |
| 18 | **`/health` חושף storage mode** — `/health` מחזיר `{ storage: 'local-json' }` — information disclosure | חולשה | נמוכה | `backend/src/index.js:16` |
| 19 | **Yahoo Finance unofficial API** — אין SLA, אין ToS בטוח לuse; עלול להיחסם ללא התרעה | סיכון | גבוהה | `backend/src/providers/YahooFinanceProvider.js` |
| 20 | **אין dependency audit בCI** — `npm audit` לא רץ; dependencies עם CVEs לא מתגלים | חולשה | גבוהה | |
| 21 | **google news RSS ב-HTTP** — ה-URL `https://news.google.com` — תקין, אבל רק אם cert pinning פעיל | חולשה | נמוכה | `backend/src/services/newsService.js:21` |
| 22 | **אין input sanitization על ticker בURL params** — `req.params.ticker` הולך ישירות לDB query; Mongoose מגן אך לא מספיק explicit | חולשה | נמוכה | `backend/src/routes/stocks.js` |
| 23 | **אין Content-Security-Policy ב-Next.js** — ריצת JavaScript מחיצוניים ב-frontend | חולשה | בינונית | `frontend/next.config.js` |
| 24 | **no output encoding ב-news headlines** — headlines מ-RSS מוצגים בUI; אם headlines כוללים HTML, XSS אפשרי | חולשה | גבוהה | `frontend/components/NewsPanel/NewsPanel.tsx` |
| 25 | **אין clickjacking protection** — X-Frame-Options חסר; דף ניתן לembedding ב-iframe | חולשה | בינונית | |
| 26 | **אין Subresource Integrity (SRI)** — external scripts ב-Next.js layout? צריך לבדוק | חולשה | נמוכה | |
| 27 | **אין secrets rotation** — MONGO_URI קבוע; אם leaked, אין מנגנון לrotation ידנית | סיכון | גבוהה | |
| 28 | **אין environment separation** — dev ו-prod עם אותו codebase; env vars מגנים אך risk of confusion | סיכון | בינונית | |
| 29 | **ticker symbol מוחזר בerror messages** — `${t} is already in your watchlist` — echo of user input | חולשה | נמוכה | `backend/src/routes/stocks.js:29-30` |
| 30 | **אין brute force protection על add ticker** — ניתן לenum valid tickers על ידי polling | חולשה | נמוכה | |
| 31 | **MongoDB _id חשוף ב-responses** — stock._id מוחזר; information disclosure | חולשה | נמוכה | `backend/src/routes/stocks.js` |
| 32 | **node-cron side effect ב-require** — אם cron start מוביל לcode injection, הוא רץ בעצמו | סיכון | נמוכה | |
| 33 | **analyzeStock ללא auth check** — `/api/refresh/:ticker` מאפשר הרצת עבודה יקרה על השרת | חולשה | גבוהה | `backend/src/routes/stocks.js:73-82` |
| 34 | **process.exit(1) ללא cleanup** — גורם לDB לא-graceful disconnect; עלול לhang pending operations | חולשה | נמוכה | `backend/src/index.js:37` |
| 35 | **אין לlog rotation** — logs צוברים ל-disk ללא הגבלה בdeployments עצמוניים | סיכון | נמוכה | |
| 36 | **yahoo-finance2 suppressNotices** — דיכוי warnings עלול להסתיר deprecation security-relevant | חולשה | נמוכה | `backend/src/providers/YahooFinanceProvider.js:9` |
| 37 | **אין mutual TLS בין Frontend ו-Backend** — HTTP ב-dev, HTTPS ב-prod; לא מוגדר לforce | חולשה | בינונית | |
| 38 | **RSS parser timeout 8 שנ'** — long-timeout response יכול לhog connection; DoS vector | חולשה | נמוכה | `backend/src/services/newsService.js:4` |
| 39 | **localStore.js כ-plaintext JSON** — financial data stored בcleartext; לא מוצפן | חולשה | נמוכה | `backend/src/db/localStore.js` |
| 40 | **אין IP allowlist** — כל IP יכול לגשת; צריך לפחות basic auth בproduction | חולשה | גבוהה | |
| 41 | **אין logout mechanism** — אין sessions, אין tokens, אין invalidation | חולשה | קריטי | |
| 42 | **Port 5000 בdev** — MacOS Monterey משתמש ב-5000 עבור AirPlay; conflict אפשרי | סיכון | נמוכה | `backend/src/config.js:3` |
| 43 | **אין max request/min per ticker** — rate limit ל-Yahoo Finance יכול להביא לIP ban | סיכון | גבוהה | |
| 44 | **render.yaml ב-repository** — ALLOWED_ORIGIN marked כ-sync:false אך הtemplateו עצמו חשוף | סיכון | נמוכה | `render.yaml` |
| 45 | **Stock data כולל 60 historical points בresponse** — payload גדול לclients לא מאומתים | חולשה | נמוכה | |
| 46 | **אין SameSite=Strict על cookies** — אין cookies כרגע, אך אם נוספות בעתיד, הגדרת default חשובה | חולשה | נמוכה | |
| 47 | **אין integrity check על DB documents** — לא ניתן לזהות corruption או manipulation של Stock data | חולשה | נמוכה | |
| 48 | **אין להגן על /api/stocks DELETE מ-CSRF** — cross-site request יכול להסיר מניות | חולשה | בינונית | |
| 49 | **אין הצפנת data at rest ב-MongoDB Atlas** — Atlas Free tier מציע הצפנה, לא ברור שמופעלת | סיכון | בינונית | |
| 50 | **אין penetration testing** — לא בוצע security audit מעולם | פיצ'ר | גבוהה | |

---

## כובע 7: DevOps Engineer — Infrastructure, Deploy ו-Observability

| # | ממצא | סוג | עדיפות | קובץ |
|---|------|-----|--------|------|
| 1 | **Render Free tier sleep** — שירותים "ישנים" אחרי 15 דקות idle; cold start של 30-60 שנ' למשתמשים | סיכון | גבוהה | `render.yaml` |
| 2 | **אין CI/CD pipeline** — אין GitHub Actions; deploy ידני; אין automated tests לפני deploy | שיפור | קריטי | |
| 3 | **אין `engines` field ב-package.json** — Node.js version לא נעולה; Render בוחר גרסה | שיפור | גבוהה | `backend/package.json` |
| 4 | **אין `.nvmrc`** — developers עובדים עם גרסאות Node שונות | שיפור | בינונית | |
| 5 | **אין health check שמוודא DB connectivity** — `/health` מחזיר `ok` גם אם MongoDB מנותק | שיפור | גבוהה | `backend/src/index.js:16` |
| 6 | **sequential cron job** — analyzing stocks one-by-one; 20+ stocks עלול לחרוג מ-2h interval | שיפור | גבוהה | `backend/src/jobs/cacheRefresh.js` |
| 7 | **אין cron job monitoring** — cron failure silent; analysis הולך stale בלי alerting | שיפור | גבוהה | `backend/src/jobs/cacheRefresh.js` |
| 8 | **אין staging environment** — כל שינוי הולך ישירות לproduction | שיפור | גבוהה | |
| 9 | **Free tier instance hours** — 2 services × free plan; עלול להתמצות; no SLA | סיכון | גבוהה | `render.yaml` |
| 10 | **אין compression** — API responses גדולים (60 historical data points) ללא gzip | שיפור | גבוהה | `backend/src/index.js` |
| 11 | **`npm install` בbuild ללא lock file strict** — `npm ci` עדיף על `npm install` לdeterministic builds | שיפור | גבוהה | `render.yaml:12` |
| 12 | **אין zero-downtime deploy** — Render כבר מספק rolling deploy; לא מנוצל לגמרי | שיפור | בינונית | |
| 13 | **אין SIGTERM handler** — MongoDB connection לא נסגר ב-graceful shutdown; pending queries נחתכות | שיפור | גבוהה | `backend/src/index.js` |
| 14 | **Frontend ב-'use client' לגמרי** — SSR מבוטל; CDN caching לHTML בלתי אפשרי | שיפור | גבוהה | `frontend/app/page.tsx:1` |
| 15 | **1-second polling מhundreds of users** — בscale, כל user שולח 1req/sec; Yahoo Finance יikol | שיפור | קריטי | `frontend/hooks/useStocks.ts:60` |
| 16 | **אין WebSocket / SSE** — long-polling (1s) צורכת bandwidth מיותר; SSE יהיה יעיל יותר | פיצ'ר | גבוהה | |
| 17 | **אין metrics collection** — אין Prometheus, Datadog, New Relic; אין observability | שיפור | גבוהה | |
| 18 | **אין structured logging** — `console.log` strings; לא ניתן לquery logs | שיפור | גבוהה | |
| 19 | **אין log aggregation** — logs רק ב-Render dashboard; לא searchable | שיפור | גבוהה | |
| 20 | **אין alerting** — error rate spike, DB failure, Yahoo Finance down — אין התרעה | שיפור | קריטי | |
| 21 | **LOCAL JSON fallback ב-file system** — לא עובד ב-ephemeral deployments (Render); מתאפס בכל restart | באג | גבוהה | `backend/src/db/localStore.js` |
| 22 | **אין Dockerfile** — לא portable; לא ניתן לrun ב-container | שיפור | בינונית | |
| 23 | **monorepo לא מנוצל לgeneralized** — frontend ו-backend לא share types; duplicated type definitions | שיפור | נמוכה | |
| 24 | **Frontend API proxy layer מוסיף latency** — Next.js route → Express; round trip נוסף | שיפור | גבוהה | `frontend/app/api/` |
| 25 | **אין CDN לassets** — Next.js static files מוגשים מ-Render; לא מ-CDN | שיפור | בינונית | |
| 26 | **ports שונים בdev ו-prod** — 5000 ב-dev, 10000 ב-prod; עלול לבלבל | שיפור | בינונית | `render.yaml:11`, `backend/src/config.js:3` |
| 27 | **אין DB connection retry** — MongoDB Atlas timeout → `process.exit(1)` → restart loop | שיפור | גבוהה | `backend/src/db/index.js` |
| 28 | **process.exit(1) → restart loop ב-Render** — Render מrestart על exit code non-zero; אם DB down, infinite restart | באג | גבוהה | `backend/src/index.js:37` |
| 29 | **אין canary deploy** — כל deploy הוא all-or-nothing | שיפור | נמוכה | |
| 30 | **אין feature flags** — שינויים הולכים ל-100% users מיד | שיפור | נמוכה | |
| 31 | **אין rollback procedure** — git revert + manual deploy; לא documented | שיפור | בינונית | |
| 32 | **ALLOWED_ORIGIN ב-render.yaml sync:false** — operator חייב לזכור להגדיר ידנית; deployment docs חסרים | שיפור | גבוהה | `render.yaml:18-19` |
| 33 | **אין environment variable validation** — EXPRESS_BACKEND_URL לא מוגדר → frontend לא מוצא backend | שיפור | גבוהה | `frontend/.env.local` |
| 34 | **אין DB backup schedule** — Atlas Free tier מספק snapshots; לא מתועד | סיכון | גבוהה | |
| 35 | **RSS parser dependency** — rss-parser לא actively maintained; alternatives (fast-xml-parser) יעילים יותר | שיפור | נמוכה | |
| 36 | **אין lock על cron job** — parallel cron runs (אם cluster) יעבדו על אותו watchlist | שיפור | נמוכה | |
| 37 | **CRON_SCHEDULE validation חסר** — invalid cron expression causes silent failure | שיפור | בינונית | `backend/src/jobs/cacheRefresh.js` |
| 38 | **Render free tier shared resources** — CPU/RAM shared; peaky Yahoo Finance calls חייבים לfit בלimits | סיכון | גבוהה | |
| 39 | **אין pre-deploy health check** — Render לא מוגדר לcheck health endpoint לפני traffic routing | שיפור | גבוהה | `render.yaml` |
| 40 | **אין dependency vulnerability scan ב-CI** — `npm audit` לא חלק מpipeline | שיפור | גבוהה | |
| 41 | **`npm run build` בrender.yaml** — Next.js build cache לא נשמר בין deployments; builds איטיות | שיפור | נמוכה | |
| 42 | **אין resource limits** — לא מוגדר max CPU/memory בRender (free tier; fixed) | שיפור | נמוכה | |
| 43 | **oregon region בלבד** — אין multi-region; latency גבוה ל-users ב-EU/Asia | שיפור | נמוכה | `render.yaml` |
| 44 | **אין uptime monitoring** — Pingdom/UptimeRobot לא מוגדר; downtime לא מזוהה | שיפור | גבוהה | |
| 45 | **Frontend env var NEXT_PUBLIC_APP_NAME** — "MyTrade" בenv אך לא בשימוש בUI | שיפור | נמוכה | `frontend/.env.local` |
| 46 | **אין שמירת state בין restarts** — watchlist ב-JSON file נמחק ב-Render restart (ephemeral FS) | באג | קריטי | `backend/src/db/localStore.js` |
| 47 | **אין test suite** — ציון 0 test coverage; refactoring מסוכן | שיפור | קריטי | |
| 48 | **Render ניהול ENV vars ידני** — אין terraform/pulumi; infrastructure not as code | שיפור | נמוכה | |
| 49 | **אין performance profiling** — לא ברור מה bottleneck: Yahoo Finance? DB? ניתוח? | שיפור | בינונית | |
| 50 | **Yahoo Finance unofficial API dependency** — production system תלוי ב-unofficial API ללא SLA; risk הפסקת service | סיכון | קריטי | |

---

## כובע 8: Data Scientist / Analyst — מודלים, אלגוריתמים ו-Validity

| # | ממצא | סוג | חומרה | קובץ |
|---|------|-----|-------|------|
| 1 | **Arbitrary risk weights** — 25/20/25/15/15 בלי עיגון אמפירי; לא מבוסס על calibration לevents היסטוריים | בעיה | גבוהה | `backend/src/engines/riskScoreEngine.js:84-92` |
| 2 | **Volatility מ-30 ימים בלבד** — 30 daily returns לא מספיקים להערכת annualized vol אמינה (ננית CI רחבה) | בעיה | גבוהה | `backend/src/engines/riskScoreEngine.js:23-48` |
| 3 | **Annualized vol מניח i.i.d. normal returns** — בפועל, returns מניות fat-tailed, autocorrelated; החישוב מזלזל ב-tail risk | בעיה | גבוהה | `backend/src/engines/riskScoreEngine.js:43` |
| 4 | **Static sector average P/E** — Technology P/E=28 קבוע בקוד; בשוק של 2024-2025 Tech P/E הרבה יותר גבוה | בעיה | גבוהה | `backend/src/engines/expectationEngine.js:4-19` |
| 5 | **Sell-the-news threshold שרירותי** — `driftPercent > 10` → risk; לא calibrated על historical data של earnings outcomes | בעיה | גבוהה | `backend/src/engines/preEarningsDriftEngine.js:23` |
| 6 | **Sentiment מ-AFINN keyword list** — npm `sentiment` משתמש ב-1965 AFINN word list; לא מותאם לstock news; מחמיץ context ("miss" בשוק = negative, ב-AFINN = neutral) | בעיה | גבוהה | `backend/src/services/newsService.js:11` |
| 7 | **10 headlines בלבד** — סמפל של 10 כותרות לא מספיק לreliable sentiment signal; גבוהה variance | בעיה | בינונית | `backend/src/services/newsService.js:24` |
| 8 | **Guidance 2x weight ללא בסיס** — הנחה שguidance חשובה פי 2 מkeyword sentiment; לא נבדק | בעיה | בינונית | `backend/src/engines/sentimentEngine.js:14` |
| 9 | **Market regime — VIX חסר** — VIX הוא ה-canonical indicator לmarket stress; SMA על SPY/QQQ בלבד לא מספיק | בעיה | גבוהה | `backend/src/engines/marketRegimeEngine.js` |
| 10 | **SMA200 על פחות מ-200 days** — `Math.min(200, spyCloses.length)` כשיש 150 ימים = SMA150 labeled SMA200 | בעיה | גבוהה | `backend/src/engines/marketRegimeEngine.js:21` |
| 11 | **VOLATILE threshold 2% שרירותי** — "within 2% of SMA200" = VOLATILE; לא מבוסס על market microstructure | בעיה | בינונית | `backend/src/engines/marketRegimeEngine.js:29` |
| 12 | **Scenario base probabilities לא calibrated** — 25% bull, 40% neutral, 35% bear; לא מבוסס על historical earnings distributions | בעיה | גבוהה | `backend/src/engines/earningsScenariosEngine.js:51-52` |
| 13 | **Scenario price target formula שרירותית** — `dailyVol × sectorMultiplier × 1.5`; המקדם 1.5 ממאיפה? | בעיה | גבוהה | `backend/src/engines/earningsScenariosEngine.js:61-63` |
| 14 | **Neutral scenario תמיד חיובי מעט** — `currentPrice + (baseMove × 0.3)` → target תמיד מעל המחיר הנוכחי | בעיה | בינונית | `backend/src/engines/earningsScenariosEngine.js:63` |
| 15 | **probabilities לא מסתכמות ל-100% כשbull/bear ב-edges** — עם `bullProb = 50`, `bearProb = 100-50-40 = 10`; `Math.max(5, 10) = 10` → total = 100. אבל בmaxbull (50) + adjustment, `bearProb = 10` → ok. אך `bullProb = 10`, `bearProb = Math.max(5, 50) = 50` → total = 100. כן OK. | תצפית | נמוכה | |
| 16 | **Drift ignores earnings proximity** — drift מחושב תמיד על 10 ימים אחרונים גם כשearnings רחוקים 6 חודשים | בעיה | גבוהה | `backend/src/engines/preEarningsDriftEngine.js` |
| 17 | **Expectation score confounds signals** — momentum + P/E + analyst target מחוברים לינארית; correlation ביניהם לא מטופל | בעיה | בינונית | `backend/src/engines/expectationEngine.js:71-84` |
| 18 | **Momentum מחושב על 10 ו-30 ימים ב-average** — ממוצע פשוט; exponential weighting מתאים יותר לmomentum signal | שיפור | בינונית | `backend/src/engines/expectationEngine.js:21-38` |
| 19 | **Beta נשלף אך לא בשימוש** — beta הוא ה-market risk measure; מתאים מאוד לrisk score | שיפור | גבוהה | `backend/src/providers/YahooFinanceProvider.js:88` |
| 20 | **Volume לא נכנס לשום חישוב** — volume spikes לפני earnings הם indicator חשוב | שיפור | גבוהה | |
| 21 | **Pre-earnings drift threshold 3%** — RISING/FALLING בסף 3%; לא calibrated לvolatility של המניה עצמה | בעיה | בינונית | `backend/src/engines/preEarningsDriftEngine.js:19-21` |
| 22 | **Sector multipliers לscenarios — שרירותיים** — Biotech 3.0x כי... ניסיון? historical IV? לא documented | בעיה | בינונית | `backend/src/engines/earningsScenariosEngine.js:4-21` |
| 23 | **Probability adjustments additive** — +5% bullProb לdrift/sentiment; לא multiplicative; distribution לא כבדה | בעיה | בינונית | `backend/src/engines/earningsScenariosEngine.js:53-57` |
| 24 | **Risk score לא normalized לvolatility של המניה** — מניה עם vol=30% ומניה עם vol=80% עשויות לקבל אותו risk label | בעיה | גבוהה | `backend/src/engines/riskScoreEngine.js` |
| 25 | **אין confidence intervals** — כל score נקודתי; "risk = 67" ללא טווח שגיאה מטעה | שיפור | גבוהה | |
| 26 | **אין backtesting** — לא נבדק האם high risk score אכן ניבא ירידת מחיר | בעיה | קריטי | |
| 27 | **אין model versioning** — כשmissions score משתנה, אין גרסה לtrack; analysis מ-2 שבועות לא comparable | שיפור | בינונית | |
| 28 | **annualizedVol × √252 כשdata כולל weekends** — data נכנס לcalculation עם תאריכים calendar; trading days != calendar days | בעיה | בינונית | `backend/src/engines/riskScoreEngine.js:43` |
| 29 | **אין sector rotation signal** — BULLISH regime יכול להיות Tech-bullish אך Materials-bearish | שיפור | בינונית | |
| 30 | **forward P/E ב-getCompanyInfo** — `stats.forwardPE` מבוסס על analyst estimates שיכולים להיות מאוד שגויים | בעיה | בינונית | `backend/src/providers/YahooFinanceProvider.js:87` |
| 31 | **Sentiment לא מבדיל בין news על הcompany לnews על industry** — "Tech sector rally" יספור כsentiment חיובי לAPPL | בעיה | בינונית | `backend/src/services/newsService.js` |
| 32 | **10-day window לdrift בsorted historical** — `sorted[sorted.length - 11]` — indices מחושבים מהסוף; gaps בdata עלולים לשנות window | בעיה | נמוכה | `backend/src/engines/preEarningsDriftEngine.js:9-12` |
| 33 | **bearPct נחשב לפני cap של bearTarget** — percentMove יציג כ-"-140%" אם price crash extreme | בעיה | בינונית | `backend/src/engines/earningsScenariosEngine.js:69-71` |
| 34 | **expectationLabel thresholds שרירותיים** — VERY_HIGH ≥76, HIGH ≥56, MODERATE ≥34; לא calibrated | בעיה | בינונית | `backend/src/engines/expectationEngine.js:64-68` |
| 35 | **riskLabel thresholds שרירותיים** — HIGH ≥70, MEDIUM ≥40; לא מבוסס על percentile distribution | בעיה | בינונית | `backend/src/engines/riskScoreEngine.js:77-81` |
| 36 | **analystTargetScore — negative diff = low expectation** — מניה מ-30% מתחת לtarget gets LOW expectation score; אך זה יכול להיות מניה oversold | בעיה | בינונית | `backend/src/engines/expectationEngine.js:52-61` |
| 37 | **market regime זהה לכל המניות בwatchlist** — SPY/QQQ based regime; לא מחושב per-stock | תצפית | גבוהה | `backend/src/engines/marketRegimeEngine.js` |
| 38 | **אין earnings quality analysis** — beat/miss EPS בלי לבחון cash flow, margins, guidance | שיפור | גבוהה | |
| 39 | **אין short interest data** — short squeeze risk (GameStop-style) לא נלקח בחשבון | שיפור | גבוהה | |
| 40 | **Expectation score לא מסביר "מה עושים"** — score גבוה = sell? wait? | שיפור | גבוהה | |
| 41 | **אין correlation בין expectation ל-actual outcomes** — מי יודע אם expectation=80 אכן ניבא underperformance? | בעיה | קריטי | |
| 42 | **momentum10 ו-momentum30 ב-simple average** — 50% weight לכל אחד; מניות עם short-term reversal מטועות | בעיה | נמוכה | `backend/src/engines/expectationEngine.js:31` |
| 43 | **preEarningsDrift מחושב גם כשearnings > 60 ימים** — drift לא רלוונטי כשearnings רחוקים | בעיה | גבוהה | `backend/src/engines/preEarningsDriftEngine.js` |
| 44 | **isSellTheNewsRisk binary** — >10% = risk; אך בפועל זה continuous probability | שיפור | בינונית | `backend/src/engines/preEarningsDriftEngine.js:23` |
| 45 | **אין adj close בhistorical data** — split ו-dividend events גורמים לgaps בprice series | בעיה | גבוהה | `backend/src/providers/YahooFinanceProvider.js:34-53` |
| 46 | **אין seasonality adjustment** — retail stocks לפני holiday season, biotech לפני FDA dates | שיפור | בינונית | |
| 47 | **אין Sharpe ratio** — risk-adjusted return metric חסר לחלוטין | שיפור | בינונית | |
| 48 | **QQQ SMA20/SMA50 לregime** — QQQ כTech proxy; לא מייצג לenergy, utilities, real-estate stocks | בעיה | בינונית | `backend/src/engines/marketRegimeEngine.js:19-20` |
| 49 | **אין implied volatility (options market)** — IV crushes לפני earnings; IV rank/percentile חשוב מherhistorical vol | שיפור | גבוהה | |
| 50 | **"hedge fund style" בתיאור המוצר** — המתודולוגיה בפועל רחוקה מhedge fund analysis; ניתן לגרום להשקעות בהסתמך על self-overconfidence | בעיה | קריטי | README/branding |

---

## סיכום מנהלים

| כובע | באגים | שיפורים | פיצ'רים חדשים | קריטי |
|------|-------|---------|--------------|-------|
| QA Engineer | 22 | 24 | 4 | 4 |
| Product Manager | 0 | 5 | 45 | 5 |
| UX/UI Designer | 3 | 44 | 3 | 8 |
| Frontend Developer | 5 | 43 | 2 | 7 |
| Backend Developer | 7 | 41 | 2 | 5 |
| Security Engineer | 0 | 45 | 5 | 6 |
| DevOps Engineer | 4 | 40 | 6 | 7 |
| Data Scientist | 0 | 38 | 12 | 4 |
| **סה"כ** | **41** | **280** | **79** | **46** |

### Top 10 — הכי דחוף לתקן עכשיו

1. **NewsPanel לא מחובר ל-API** — backend עובד, frontend מציג placeholder
2. **90d stat שקרי** — רק 60 ימי history; label מטעה
3. **אין rate limiting** — production exploit vector
4. **CORS misconfiguration** — `credentials:true` עם `origin:'*'` נדחה בדפדפן
5. **DELETE לא מוחק Stock document** — orphan data צובר ב-DB
6. **analyzeAll עם Promise.all** — כישלון מניה אחת מבטל הכל; צריך `Promise.allSettled`
7. **pollPrices ב-background tab** — בזבוז network + API rate limits
8. **אין auth** — כל endpoint פתוח לכולם
9. **localStore.js אפמרי ב-Render** — data loss בכל restart בmissing MongoDB
10. **אין backtesting/validation** — המודלים לא נבדקו על historical data; branding "hedge fund" מסוכן

---

*נכתב ע"י: סקירה אוטומטית מלאה מקריאת קוד, 2026-06-05*
