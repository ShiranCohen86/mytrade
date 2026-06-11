// US equity market (NYSE/Nasdaq) session status in America/New_York wall-clock time.

// Easter Sunday (Gregorian, Anonymous Computus) — needed for Good Friday.
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Apr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

// Nth weekday of a month, e.g. nthWeekday(2026, 0, 1, 3) = 3rd Monday of January.
function nthWeekday(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const offset = (weekday - first + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

// Last given weekday of a month, e.g. Memorial Day = last Monday of May.
function lastWeekday(year, month, weekday) {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month, last.getUTCDate() - offset));
}

// A fixed-date holiday observed on the nearest weekday (Sat→Fri, Sun→Mon),
// matching the NYSE/Nasdaq calendar.
function observed(year, month, day) {
  const d = new Date(Date.UTC(year, month, day));
  const dow = d.getUTCDay();
  if (dow === 6) return new Date(Date.UTC(year, month, day - 1)); // Sat → Fri
  if (dow === 0) return new Date(Date.UTC(year, month, day + 1)); // Sun → Mon
  return d;
}

const md = (d) => `${d.getUTCMonth()}-${d.getUTCDate()}`;

// Full-day market closures for a given year, as a Set of "month-day" keys.
function fullHolidays(year) {
  const easter = easterSunday(year);
  const goodFriday = new Date(easter.getTime() - 2 * 86400000);
  return new Set([
    observed(year, 0, 1),                 // New Year's Day
    nthWeekday(year, 0, 1, 3),            // MLK Day (3rd Mon Jan)
    nthWeekday(year, 1, 1, 3),            // Washington's Birthday (3rd Mon Feb)
    goodFriday,                           // Good Friday
    lastWeekday(year, 4, 1),             // Memorial Day (last Mon May)
    observed(year, 5, 19),                // Juneteenth
    observed(year, 6, 4),                 // Independence Day
    nthWeekday(year, 8, 1, 1),           // Labor Day (1st Mon Sep)
    nthWeekday(year, 10, 4, 4),          // Thanksgiving (4th Thu Nov)
    observed(year, 11, 25),               // Christmas
  ].map(md));
}

// Early-close days (1:00 PM ET): July 3 (if 4th is a weekday), Black Friday,
// and Christmas Eve. Computed conservatively for the common cases.
function earlyCloseDays(year) {
  const days = [];
  const july4 = new Date(Date.UTC(year, 6, 4)).getUTCDay();
  if (july4 !== 0 && july4 !== 6) days.push(new Date(Date.UTC(year, 6, 3))); // July 3
  days.push(new Date(nthWeekday(year, 10, 4, 4).getTime() + 86400000));      // day after Thanksgiving
  const dec24 = new Date(Date.UTC(year, 11, 24)).getUTCDay();
  if (dec24 !== 0 && dec24 !== 6) days.push(new Date(Date.UTC(year, 11, 24))); // Christmas Eve
  return new Set(days.map(md));
}

// ET wall-clock components. Reading only the broken-out fields (year/day/hours/…)
// is correct across DST — the timeZone option already resolves the offset.
function etParts() {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return {
    year: et.getFullYear(),
    monthDay: `${et.getMonth()}-${et.getDate()}`,
    day: et.getDay(),
    minutes: et.getHours() * 60 + et.getMinutes(),
  };
}

export function getMarketStatus() {
  const { year, monthDay, day, minutes } = etParts();

  if (day === 0 || day === 6) return 'closed';
  if (fullHolidays(year).has(monthDay)) return 'closed';

  // Regular session closes at 13:00 ET on early-close days, 16:00 otherwise.
  const regularClose = earlyCloseDays(year).has(monthDay) ? 13 * 60 : 16 * 60;

  if (minutes < 4 * 60)        return 'closed'; // before 04:00
  if (minutes < 9 * 60 + 30)   return 'pre';    // 04:00–09:30
  if (minutes < regularClose)  return 'open';   // 09:30–close
  if (minutes < 20 * 60)       return 'after';  // close–20:00
  return 'closed';                               // after 20:00
}

// Returns true when any price action is possible (pre, open, after-hours).
// Returns false only during overnight/weekend/holiday dead periods.
export function isMarketActive() {
  return getMarketStatus() !== 'closed';
}
