
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchStocks } from '@/lib/apiClient';
import { useStocks } from '@/hooks/useStocks';
import styles from './CommandPalette.module.scss';

const NAV_ITEMS = [
  {
    id: 'nav:dashboard', type: 'nav', label: 'Watchlist', path: '/dashboard',
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
  {
    id: 'nav:portfolio', type: 'nav', label: 'Portfolio', path: '/portfolio',
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
  },
  {
    id: 'nav:sectors', type: 'nav', label: 'Sectors', path: '/sectors',
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    id: 'nav:settings', type: 'nav', label: 'Settings', path: '/settings',
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [stockResults, setStockResults] = useState([]);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();
  const { stocks: watchlistStocks } = useStocks();

  // ⌘K / Ctrl+K to open; also listen for custom event from TopBar button
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('palette:open', onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('palette:open', onOpen);
    };
  }, []);

  // Focus + reset when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setStockResults([]);
      setHighlighted(0);
      // RAF so the element is in DOM before focusing
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced stock search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setStockResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchStocks(q);
        setStockResults(Array.isArray(data) ? data : []);
        setHighlighted(0);
      } catch {
        setStockResults([]);
      }
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const filteredNav = query
    ? NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
    : NAV_ITEMS;

  // Watchlist stocks that match the query
  const filteredWatchlist = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return watchlistStocks
      .filter((s) => s.ticker.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q))
      .slice(0, 5)
      .map((s) => ({
        id: `watchlist:${s.ticker}`,
        type: 'watchlist',
        label: s.name || s.ticker,
        ticker: s.ticker,
        sector: s.sector,
        path: `/stocks/${s.ticker}`,
      }));
  }, [query, watchlistStocks]);

  // Flat list of all selectable items (for keyboard nav)
  const allItems = [
    ...filteredNav,
    ...filteredWatchlist,
    ...stockResults
      .filter((r) => !filteredWatchlist.some((w) => w.ticker === r.ticker))
      .map((r) => ({
        id: `stock:${r.ticker}`,
        type: 'stock',
        label: r.name,
        sublabel: r.ticker,
        exchange: r.exchange,
        path: `/stocks/${r.ticker}`,
      })),
  ];

  const close = useCallback(() => { setOpen(false); setQuery(''); }, []);

  const execute = useCallback((item) => {
    if (item?.path) navigate(item.path);
    close();
  }, [navigate, close]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % Math.max(allItems.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + Math.max(allItems.length, 1)) % Math.max(allItems.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[highlighted]) execute(allItems[highlighted]);
    }
  };

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className={styles.panel}>
        <div className={styles.searchRow}>
          <span className={styles.searchIcon}><SearchIcon /></span>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Go to page or search a ticker…"
            aria-label="Command search"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={styles.escKbd} onClick={close}>esc</kbd>
        </div>

        <div className={styles.body}>
          {filteredNav.length > 0 && (
            <div className={styles.group}>
              {!query && <span className={styles.groupLabel}>Navigate</span>}
              {filteredNav.map((item) => {
                const idx = allItems.findIndex((a) => a.id === item.id);
                return (
                  <button
                    key={item.id}
                    className={`${styles.item} ${highlighted === idx ? styles.itemActive : ''}`}
                    onClick={() => execute(item)}
                    onMouseEnter={() => setHighlighted(idx)}
                  >
                    <span className={styles.itemIcon}>{item.icon}</span>
                    <span className={styles.itemLabel}>{item.label}</span>
                    <span className={styles.itemMeta}>page</span>
                  </button>
                );
              })}
            </div>
          )}

          {filteredWatchlist.length > 0 && (
            <div className={styles.group}>
              <span className={styles.groupLabel}>My Watchlist</span>
              {filteredWatchlist.map((r) => {
                const idx = allItems.findIndex((a) => a.id === r.id);
                return (
                  <button
                    key={r.id}
                    className={`${styles.item} ${highlighted === idx ? styles.itemActive : ''}`}
                    onClick={() => execute(r)}
                    onMouseEnter={() => setHighlighted(idx)}
                  >
                    <span className={styles.itemTicker}>{r.ticker}</span>
                    <span className={styles.itemLabel}>{r.label}</span>
                    {r.sector && r.sector !== 'Unknown' && <span className={styles.itemMeta}>{r.sector}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {stockResults.filter((r) => !filteredWatchlist.some((w) => w.ticker === r.ticker)).length > 0 && (
            <div className={styles.group}>
              <span className={styles.groupLabel}>Stocks</span>
              {stockResults
                .filter((r) => !filteredWatchlist.some((w) => w.ticker === r.ticker))
                .map((r) => {
                  const idx = allItems.findIndex((a) => a.id === `stock:${r.ticker}`);
                  return (
                    <button
                      key={r.ticker}
                      className={`${styles.item} ${highlighted === idx ? styles.itemActive : ''}`}
                      onClick={() => execute({ path: `/stocks/${r.ticker}` })}
                      onMouseEnter={() => setHighlighted(idx)}
                    >
                      <span className={styles.itemTicker}>{r.ticker}</span>
                      <span className={styles.itemLabel}>{r.name}</span>
                      {r.exchange && <span className={styles.itemMeta}>{r.exchange}</span>}
                    </button>
                  );
                })}
            </div>
          )}

          {query && filteredNav.length === 0 && stockResults.length === 0 && (
            <p className={styles.empty}>No results for "<strong>{query}</strong>"</p>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.hint}><kbd>↑↓</kbd> navigate</span>
          <span className={styles.hint}><kbd>↵</kbd> open</span>
          <span className={styles.hint}><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
