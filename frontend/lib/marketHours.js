export function getMarketStatus() {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  const day = et.getDay(); // 0=Sun, 6=Sat

  if (day === 0 || day === 6) return 'closed';

  const minutes = et.getHours() * 60 + et.getMinutes();
  if (minutes < 4 * 60)        return 'closed'; // before 04:00
  if (minutes < 9 * 60 + 30)   return 'pre';    // 04:00–09:30
  if (minutes < 16 * 60)       return 'open';   // 09:30–16:00
  if (minutes < 20 * 60)       return 'after';  // 16:00–20:00
  return 'closed';                               // after 20:00
}

// Returns true when any price action is possible (pre, open, after-hours).
// Returns false only during overnight/weekend dead periods.
export function isMarketActive() {
  return getMarketStatus() !== 'closed';
}
