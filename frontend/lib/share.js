/**
 * Web Share helpers with a clipboard fallback. Returns one of:
 * 'shared' | 'copied' | 'cancelled' | 'unsupported'.
 */
import { track, EV } from './analytics';

async function share({ title, text, url }, event = EV.SHARE_CLICKED, props = {}) {
  track(event, { url, ...props });
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(url || text || '');
    return 'copied';
  } catch {
    return 'unsupported';
  }
}

export function shareStock(ticker, name) {
  const url = `${window.location.origin}/stocks/${ticker}`;
  return share(
    { title: `${ticker} — MyTrade`, text: `Check out ${name || ticker} on MyTrade`, url },
    EV.SHARE_CLICKED,
    { ticker }
  );
}

export function shareInvite(userId) {
  const ref = userId ? `?ref=${encodeURIComponent(userId)}` : '';
  const url = `${window.location.origin}/${ref}`;
  return share(
    { title: 'MyTrade — Stock Intelligence', text: 'Track stocks with risk scores, earnings AI and price alerts on MyTrade.', url },
    EV.INVITE_SHARED
  );
}

export const canNativeShare = () => typeof navigator !== 'undefined' && !!navigator.share;
