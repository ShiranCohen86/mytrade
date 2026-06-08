
import { useState, useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import styles from './PriceChart.module.scss';

const PERIODS = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: Infinity },
];

function computeSma(data, period) {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return parseFloat((slice.reduce((s, d) => s + d.close, 0) / period).toFixed(2));
  });
}

function formatDate(dateStr, rangeLen) {
  const d = new Date(dateStr);
  if (rangeLen <= 30) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (rangeLen <= 180) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function PriceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { fullDate, price, open, high, low, sma20 } = payload[0].payload;
  return (
    <div style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--chrome-mid)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
      boxShadow: 'var(--shadow-popup)',
    }}>
      <div style={{ color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: 'Inter, sans-serif' }}>{fullDate}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 12px', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: 'var(--text-disabled)' }}>Close</span><span style={{ color: 'var(--accent)', fontWeight: 600 }}>${price?.toFixed(2)}</span>
        <span style={{ color: 'var(--text-disabled)' }}>Open</span><span style={{ color: 'var(--text-primary)' }}>${open?.toFixed(2)}</span>
        <span style={{ color: 'var(--text-disabled)' }}>High</span><span style={{ color: 'var(--pos)' }}>${high?.toFixed(2)}</span>
        <span style={{ color: 'var(--text-disabled)' }}>Low</span><span style={{ color: 'var(--neg)' }}>${low?.toFixed(2)}</span>
        {sma20 != null && <><span style={{ color: 'var(--text-disabled)' }}>SMA 20</span><span style={{ color: 'var(--warn)' }}>${sma20?.toFixed(2)}</span></>}
      </div>
    </div>
  );
}

// Renders a full OHLC candlestick within the bounding box Recharts provides for wickRange
function CandleShape({ x, y, width, height, payload }) {
  if (!payload || height <= 0) return null;
  const { open, close, high, low } = payload;
  const priceRange = high - low || 0.001;
  const isUp = close >= open;
  const color = isUp ? 'var(--pos)' : 'var(--neg)';

  // Pixel positions within this bar's bounding box (y = top = high, y+height = bottom = low)
  const bodyTopPx = y + ((high - Math.max(open, close)) / priceRange) * height;
  const bodyBotPx = y + ((high - Math.min(open, close)) / priceRange) * height;
  const bodyH = Math.max(1, bodyBotPx - bodyTopPx);
  const candleW = Math.max(3, Math.min(width * 0.75, 10));
  const midX = x + width / 2;

  return (
    <g>
      <line x1={midX} y1={y} x2={midX} y2={y + height} stroke={color} strokeWidth={1} opacity={0.55} />
      <rect
        x={midX - candleW / 2}
        y={bodyTopPx}
        width={candleW}
        height={bodyH}
        fill={color}
        stroke={color}
        strokeWidth={0.5}
        opacity={0.85}
      />
    </g>
  );
}

export function PriceChart({ historical, ticker }) {
  const [period, setPeriod] = useState('3M');
  const [mode, setMode] = useState('area');

  const visible = useMemo(() => {
    if (!historical?.length) return [];
    const days = PERIODS.find((p) => p.label === period)?.days ?? Infinity;
    return days === Infinity ? historical : historical.slice(-days);
  }, [historical, period]);

  const chartData = useMemo(() => {
    const sma20 = computeSma(visible, 20);
    return visible.map((p, i) => {
      const o = parseFloat((p.open ?? p.close).toFixed(2));
      const h = parseFloat((p.high ?? p.close).toFixed(2));
      const l = parseFloat((p.low ?? p.close).toFixed(2));
      const c = parseFloat(p.close.toFixed(2));
      return {
        date: formatDate(p.date, visible.length),
        fullDate: new Date(p.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        price: c,
        sma20: sma20[i],
        open: o, close: c, high: h, low: l,
        wickRange: [l, h],
      };
    });
  }, [visible]);

  if (!historical || historical.length === 0) {
    return <div className={styles.empty}>No price data available</div>;
  }

  const prices = visible.flatMap((p) => [p.high ?? p.close, p.low ?? p.close]).filter(Boolean);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const padding = (maxP - minP) * 0.05;
  const tickInterval = Math.max(0, Math.floor(chartData.length / 5) - 1);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{ticker} — Price History</span>
          <button
            className={`${styles.modeBtn} ${mode === 'candle' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode((m) => m === 'area' ? 'candle' : 'area')}
            title="Toggle candlestick / area chart"
          >
            {mode === 'candle' ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="3" y="4" width="3" height="6" fill="currentColor" rx="0.5" />
                <rect x="4" y="1" width="1" height="3" fill="currentColor" />
                <rect x="4" y="10" width="1" height="3" fill="currentColor" />
                <rect x="9" y="3" width="3" height="5" fill="currentColor" rx="0.5" />
                <rect x="10" y="1" width="1" height="2" fill="currentColor" />
                <rect x="10" y="8" width="1" height="3" fill="currentColor" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <polyline points="1,12 4,8 7,5 10,7 13,2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
        <div className={styles.periodRow}>
          {PERIODS.map(({ label }) => {
            const disabled = label !== 'All' && historical.length < PERIODS.find((p) => p.label === label).days;
            return (
              <button
                key={label}
                className={`${styles.periodBtn} ${period === label ? styles.periodBtnActive : ''}`}
                onClick={() => setPeriod(label)}
                disabled={disabled}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.20} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chrome-dim)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--text-disabled)', fontFamily: 'Inter, sans-serif' }}
            axisLine={{ stroke: 'var(--chrome-dim)' }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            domain={[minP - padding, maxP + padding]}
            tick={{ fontSize: 10, fill: 'var(--text-disabled)', fontFamily: "'JetBrains Mono', monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
            width={55}
          />
          <Tooltip content={<PriceTooltip />} />
          {mode === 'area' ? (
            <Area
              type="monotone"
              dataKey="price"
              stroke="var(--accent)"
              strokeWidth={1.5}
              fill="url(#priceGrad)"
              dot={false}
              isAnimationActive={false}
            />
          ) : (
            <Bar
              dataKey="wickRange"
              shape={<CandleShape />}
              isAnimationActive={false}
              maxBarSize={12}
            />
          )}
          <Line
            type="monotone"
            dataKey="sma20"
            stroke="var(--warn)"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
