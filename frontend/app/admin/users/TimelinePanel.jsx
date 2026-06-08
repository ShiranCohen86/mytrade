import { useEffect, useMemo, useState } from 'react';
import { adminGetUserActivity } from '@/lib/apiClient';
import styles from './TimelinePanel.module.scss';

// ─── Lookups ─────────────────────────────────────────────────────────────────

const ACTION_LABEL = {
  'auth.login':                'Logged in',
  'auth.logout':               'Logged out',
  'auth.register':             'Registered',
  'auth.login_failed':         'Login failed',
  'watchlist.add':             'Added to watchlist',
  'watchlist.remove':          'Removed from watchlist',
  'stock.viewed':              'Viewed analysis',
  'stock.searched':            'Searched for stock',
  'portfolio.set':             'Set portfolio entry',
  'portfolio.removed':         'Removed portfolio entry',
  'alert.set':                 'Set price alert',
  'alert.removed':             'Removed price alert',
  'note.saved':                'Saved note',
  'note.removed':              'Removed note',
  'admin.user.suspend':        'Account suspended',
  'admin.user.unsuspend':      'Account unsuspended',
  'admin.user.role_change':    'Role changed',
  'admin.user.delete':         'Account deleted',
  'admin.support.impersonate': 'Impersonated by admin',
  'admin.support.flag_user':   'Flagged by admin',
  'admin.watchlist.restore':   'Watchlist item restored',
  'admin.watchlist.force_disable': 'Watchlist item disabled',
  'admin.audit.export':        'Audit logs exported',
};

const ACTION_ICON = {
  'auth.login':    '→',  'auth.logout':   '←',  'auth.register': '✓',
  'auth.login_failed': '✗',
  'watchlist.add': '+',  'watchlist.remove': '−',
  'stock.viewed':  '◉',  'stock.searched': '⌕',
  'portfolio.set': '$',  'portfolio.removed': '$',
  'alert.set':     '⚡', 'alert.removed': '⚡',
  'note.saved':    '✏',  'note.removed': '✏',
};

const ACTION_COLOR = (type) => {
  if (type.startsWith('auth.'))      return '#6366f1';
  if (type.startsWith('watchlist.')) return '#3b82f6';
  if (type.startsWith('stock.'))     return '#8b5cf6';
  if (type.startsWith('portfolio.')) return '#10b981';
  if (type.startsWith('alert.'))     return '#f59e0b';
  if (type.startsWith('note.'))      return '#64748b';
  if (type.startsWith('admin.'))     return '#ef4444';
  return '#9ca3af';
};

const SECTOR_COLOR = {
  Technology:   '#3b82f6',
  Finance:      '#10b981',
  Healthcare:   '#06b6d4',
  Energy:       '#f97316',
  Consumer:     '#8b5cf6',
  Industrials:  '#6b7280',
  'Real Estate':'#ec4899',
  Materials:    '#b45309',
  Utilities:    '#84cc16',
  Crypto:       '#eab308',
  ETF:          '#6366f1',
  Other:        '#9ca3af',
};

const ALL_ACTION_TYPES = [
  'auth.login', 'auth.logout', 'auth.register', 'auth.login_failed',
  'watchlist.add', 'watchlist.remove',
  'stock.viewed', 'stock.searched',
  'portfolio.set', 'portfolio.removed',
  'alert.set', 'alert.removed',
  'note.saved', 'note.removed',
  'admin.user.suspend', 'admin.user.unsuspend', 'admin.user.role_change',
  'admin.support.impersonate', 'admin.support.flag_user',
];

const ALL_SECTORS = [
  'Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer',
  'Industrials', 'Real Estate', 'Materials', 'Utilities', 'Crypto', 'ETF', 'Other',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now - 86400_000).toISOString().slice(0, 10);
  if (dateStr === today)     return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtNum(n) {
  if (n == null) return '';
  return typeof n === 'number' ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(n);
}

function fmtPct(n) {
  if (n == null) return '';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${Number(n).toFixed(2)}%`;
}

function groupByDay(events) {
  const groups = {};
  for (const ev of events) {
    const day = new Date(ev.timestamp).toISOString().slice(0, 10);
    if (!groups[day]) groups[day] = [];
    groups[day].push(ev);
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectorBadge({ sector }) {
  if (!sector || sector === 'Other') return null;
  const color = SECTOR_COLOR[sector] || SECTOR_COLOR.Other;
  return (
    <span className={styles.sectorBadge} style={{ '--sector-color': color }}>
      {sector}
    </span>
  );
}

function SymbolBadge({ symbol }) {
  if (!symbol) return null;
  return <span className={styles.symbolBadge}>{symbol}</span>;
}

function EventRow({ ev }) {
  const [open, setOpen] = useState(false);
  const icon     = ACTION_ICON[ev.actionType] || '·';
  const color    = ACTION_COLOR(ev.actionType);
  const label    = ACTION_LABEL[ev.actionType] || ev.actionType;
  const symbol   = ev.metadata?.symbol;
  const sector   = ev.metadata?.sector;
  const price    = ev.metadata?.price_at_event;
  const pct      = ev.metadata?.price_change_24h;
  const hasExtra = symbol || sector || price != null || pct != null || ev.ip ||
                   (ev.metadata && Object.keys(ev.metadata).length > 0);

  return (
    <div className={`${styles.eventRow} ${open ? styles.eventRowOpen : ''}`}>
      {/* Dot + connector line */}
      <div className={styles.dotCol}>
        <span className={styles.eventDot} style={{ '--dot-color': color, '--dot-bg': `${color}22` }}>
          {icon}
        </span>
      </div>

      {/* Main content */}
      <div className={styles.eventContent}>
        <button
          className={styles.eventHeader}
          onClick={() => hasExtra && setOpen((o) => !o)}
          aria-expanded={open}
          style={{ cursor: hasExtra ? 'pointer' : 'default' }}
        >
          <span className={styles.eventLabel}>{label}</span>
          {symbol && <SymbolBadge symbol={symbol} />}
          {sector && <SectorBadge sector={sector} />}
          <span className={styles.eventTime}>{fmtTime(ev.timestamp)}</span>
          {hasExtra && (
            <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>›</span>
          )}
        </button>

        {open && (
          <div className={styles.eventDetail}>
            {symbol && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Symbol</span>
                <span className={styles.detailVal}>{symbol}</span>
              </div>
            )}
            {sector && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Sector</span>
                <SectorBadge sector={sector} />
              </div>
            )}
            {price != null && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Price at event</span>
                <span className={styles.detailVal}>{fmtNum(price)}</span>
              </div>
            )}
            {pct != null && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>24h change</span>
                <span className={`${styles.detailVal} ${pct >= 0 ? styles.pos : styles.neg}`}>
                  {fmtPct(pct)}
                </span>
              </div>
            )}
            {ev.metadata?.targetPrice != null && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Alert target</span>
                <span className={styles.detailVal}>
                  {fmtNum(ev.metadata.targetPrice)} ({ev.metadata.direction ?? '—'})
                </span>
              </div>
            )}
            {ev.metadata?.entryPrice != null && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Entry price</span>
                <span className={styles.detailVal}>{fmtNum(ev.metadata.entryPrice)}</span>
              </div>
            )}
            {ev.metadata?.shares != null && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Shares</span>
                <span className={styles.detailVal}>{ev.metadata.shares}</span>
              </div>
            )}
            {ev.metadata?.query && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Search query</span>
                <span className={styles.detailVal}>&ldquo;{ev.metadata.query}&rdquo;</span>
              </div>
            )}
            {ev.ip && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>IP</span>
                <span className={`${styles.detailVal} ${styles.mono}`}>{ev.ip}</span>
              </div>
            )}
            {ev.severity && ev.severity !== 'info' && (
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Severity</span>
                <span className={`${styles.sevBadge} ${styles[`sev_${ev.severity}`]}`}>{ev.severity}</span>
              </div>
            )}
            {ev.metadata && Object.keys(ev.metadata).filter(
              k => !['symbol','sector','price_at_event','price_change_24h','targetPrice','direction','entryPrice','shares','query'].includes(k)
            ).length > 0 && (
              <details className={styles.rawDetails}>
                <summary>Raw metadata</summary>
                <pre className={styles.rawPre}>{JSON.stringify(
                  Object.fromEntries(
                    Object.entries(ev.metadata).filter(
                      ([k]) => !['symbol','sector','price_at_event','price_change_24h'].includes(k)
                    )
                  ), null, 2
                )}</pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TimelinePanel({ userId }) {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [search,     setSearch]     = useState('');
  const [actionType, setActionType] = useState('');
  const [sector,     setSector]     = useState('');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    adminGetUserActivity(userId, 200)
      .then((data) => { setEvents(Array.isArray(data) ? data : []); setError(''); })
      .catch((e)   => setError(e.message))
      .finally(()  => setLoading(false));
  }, [userId]);

  const filtered = useMemo(() => {
    let list = events;
    if (actionType) list = list.filter((e) => e.actionType === actionType);
    if (sector)     list = list.filter((e) => e.metadata?.sector === sector);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.actionType?.toLowerCase().includes(q) ||
        e.metadata?.symbol?.toLowerCase().includes(q) ||
        e.metadata?.sector?.toLowerCase().includes(q) ||
        e.metadata?.query?.toLowerCase().includes(q) ||
        (ACTION_LABEL[e.actionType] || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, actionType, sector, search]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const hasFilters = search || actionType || sector;

  return (
    <div className={styles.panel}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder="Search timeline…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
        >
          <option value="">All event types</option>
          {ALL_ACTION_TYPES.map((t) => (
            <option key={t} value={t}>{ACTION_LABEL[t] || t}</option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        >
          <option value="">All sectors</option>
          {ALL_SECTORS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            className={styles.clearBtn}
            onClick={() => { setSearch(''); setActionType(''); setSector(''); }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Summary strip */}
      <div className={styles.strip}>
        <span className={styles.stripItem}>
          {loading ? '…' : `${filtered.length} event${filtered.length !== 1 ? 's' : ''}`}
          {hasFilters && events.length !== filtered.length && ` (of ${events.length})`}
        </span>
        {!loading && events.length > 0 && (
          <span className={styles.stripItem}>{groups.length} day{groups.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Content */}
      {loading && <div className={styles.loading}>Loading activity…</div>}
      {error   && <div className={styles.error}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className={styles.empty}>
          {hasFilters ? 'No events match the current filters.' : 'No recorded activity yet.'}
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <div className={styles.feed}>
          {groups.map(([day, dayEvents]) => (
            <div key={day} className={styles.dayGroup}>
              <div className={styles.dayLabel}>{fmtDateLabel(day)}</div>
              <div className={styles.dayEvents}>
                {dayEvents.map((ev) => (
                  <EventRow key={ev.eventId || ev._id} ev={ev} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
