
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
  ReferenceLine,
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

// Wilder's RSI (14-period)
function computeRsi(data, period = 14) {
  if (data.length < period + 1) return data.map(() => null);
  const result = new Array(period).fill(null);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(parseFloat((100 - 100 / (1 + rs0)).toFixed(1)));

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(parseFloat((100 - 100 / (1 + rs)).toFixed(1)));
  }
  return result;
}

function formatDate(dateStr, rangeLen) {
  const d = new Date(dateStr);
  if (rangeLen <= 30) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (rangeLen <= 180) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function PriceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { fullDate, price, open, high, low, sma20, sma50 } = payload[0].payload;
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
        {sma20 != null && <><span style={{ color: 'var(--text-disabled)' }}>SMA20</span><span style={{ color: 'var(--warn)' }}>${sma20?.toFixed(2)}</span></>}
        {sma50 != null && <><span style={{ color: 'var(--text-disabled)' }}>SMA50</span><span style={{ color: '#a855f7' }}>${sma50?.toFixed(2)}</span></>}
      </div>
    </div>
  );
}

function RsiTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { fullDate, rsi } = payload[0].payload;
  if (rsi == null) return null;
  const color = rsi >= 70 ? 'var(--neg)' : rsi <= 30 ? 'var(--pos)' : 'var(--accent)';
  return (
    <div style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--chrome-mid)',
      borderRadius: 8,
      padding: '6px 10px',
      fontSize: 12,
      boxShadow: 'var(--shadow-popup)',
    }}>
      <div style={{ color: 'var(--text-tertiary)', marginBottom: 2, fontFamily: 'Inter, sans-serif', fontSize: 10 }}>{fullDate}</div>
      <span style={{ color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>RSI {rsi.toFixed(1)}</span>
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

// Colored RSI line — segment per point
function RsiLine({ points, width: _w, height: _h }) {
  if (!points || points.length < 2) return null;
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b || a.value == null || b.value == null) continue;
    const val = (a.value + b.value) / 2;
    const color = val >= 70 ? 'var(--neg)' : val <= 30 ? 'var(--pos)' : 'var(--accent)';
    segments.push(<line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={1.5} strokeLinecap="round" />);
  }
  return <g>{segments}</g>;
}

export function PriceChart({ historical, ticker, entryPrice = null, alertPrice = null, alertDirection = null }) {
  const [period, setPeriod] = useState('3M');
  const [mode, setMode] = useState('area');
  const [showSma50, setShowSma50] = useState(false);
  const [showRsi, setShowRsi] = useState(false);

  const visible = useMemo(() => {
    if (!historical?.length) return [];
    const days = PERIODS.find((p) => p.label === period)?.days ?? Infinity;
    return days === Infinity ? historical : historical.slice(-days);
  }, [historical, period]);

  const chartData = useMemo(() => {
    const sma20vals = computeSma(visible, 20);
    const sma50vals = computeSma(visible, 50);
    const rsiVals = computeRsi(visible);
    return visible.map((p, i) => {
      const o = parseFloat((p.open ?? p.close).toFixed(2));
      const h = parseFloat((p.high ?? p.close).toFixed(2));
      const l = parseFloat((p.low ?? p.close).toFixed(2));
      const c = parseFloat(p.close.toFixed(2));
      return {
        date: formatDate(p.date, visible.length),
        fullDate: new Date(p.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        price: c,
        sma20: sma20vals[i],
        sma50: sma50vals[i],
        rsi: rsiVals[i],
        open: o, close: c, high: h, low: l,
        wickRange: [l, h],
        volume: p.volume ?? 0,
      };
    });
  }, [visible]);

  if (!historical || historical.length === 0) {
    return <div className={styles.empty}>No price data available</div>;
  }

  const prices = visible.flatMap((p) => [p.high ?? p.close, p.low ?? p.close]).filter(Boolean);
  const allPricePoints = [
    ...prices,
    ...(entryPrice != null ? [entryPrice] : []),
    ...(alertPrice != null ? [alertPrice] : []),
  ];
  const minP = Math.min(...allPricePoints);
  const maxP = Math.max(...allPricePoints);
  const padding = (maxP - minP) * 0.05;
  const tickInterval = Math.max(0, Math.floor(chartData.length / 5) - 1);

  const maxVol = Math.max(...chartData.map((d) => d.volume || 0));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{ticker} — Price History</span>
          <div className={styles.indicatorBtns}>
            <button
              className={`${styles.indicatorBtn} ${showSma50 ? styles.indicatorBtnActive : ''}`}
              onClick={() => setShowSma50((v) => !v)}
              title="Toggle SMA 50"
              style={showSma50 ? { '--ind-color': '#a855f7' } : {}}
            >
              SMA50
            </button>
            <button
              className={`${styles.indicatorBtn} ${showRsi ? styles.indicatorBtnActive : ''}`}
              onClick={() => setShowRsi((v) => !v)}
              title="Toggle RSI (14)"
              style={showRsi ? { '--ind-color': 'var(--accent)' } : {}}
            >
              RSI
            </button>
          </div>
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

      {/* Main price chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.20} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chrome-dim)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--text-disabled)', fontFamily: 'Inter, sans-serif' }}
            axisLine={{ stroke: 'var(--chrome-dim)' }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            yAxisId="price"
            domain={[minP - padding, maxP + padding]}
            tick={{ fontSize: 10, fill: 'var(--text-disabled)', fontFamily: "'JetBrains Mono', monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
            width={55}
          />
          {maxVol > 0 && (
            <YAxis
              yAxisId="vol"
              orientation="right"
              domain={[0, maxVol * 4]}
              hide
            />
          )}
          <Tooltip content={<PriceTooltip />} />
          {/* Volume bars in background */}
          {maxVol > 0 && (
            <Bar
              yAxisId="vol"
              dataKey="volume"
              fill="var(--chrome-dim)"
              opacity={0.45}
              isAnimationActive={false}
              maxBarSize={8}
            />
          )}
          {mode === 'area' ? (
            <Area
              yAxisId="price"
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
              yAxisId="price"
              dataKey="wickRange"
              shape={<CandleShape />}
              isAnimationActive={false}
              maxBarSize={12}
            />
          )}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="sma20"
            stroke="var(--warn)"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
            isAnimationActive={false}
            connectNulls
          />
          {showSma50 && (
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="sma50"
              stroke="#a855f7"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
              isAnimationActive={false}
              connectNulls
            />
          )}
          {entryPrice != null && (
            <ReferenceLine
              yAxisId="price"
              y={entryPrice}
              stroke="var(--warn)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              label={{ value: `Entry $${entryPrice.toFixed(2)}`, position: 'insideBottomLeft', fontSize: 10, fill: 'var(--warn)', fontFamily: 'Inter, sans-serif' }}
            />
          )}
          {alertPrice != null && (
            <ReferenceLine
              yAxisId="price"
              y={alertPrice}
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{
                value: `Alert $${alertPrice.toFixed(2)} ${alertDirection === 'above' ? '▲' : '▼'}`,
                position: 'insideTopLeft',
                fontSize: 10,
                fill: 'var(--accent)',
                fontFamily: 'Inter, sans-serif',
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* RSI sub-chart */}
      {showRsi && (
        <div className={styles.rsiSection}>
          <div className={styles.rsiLabel}>RSI (14)</div>
          <ResponsiveContainer width="100%" height={90}>
            <ComposedChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chrome-dim)" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: 'var(--text-disabled)', fontFamily: "'JetBrains Mono', monospace" }}
                axisLine={false}
                tickLine={false}
                ticks={[30, 50, 70]}
                width={28}
              />
              <Tooltip content={<RsiTooltip />} />
              <ReferenceLine y={70} stroke="var(--neg)" strokeDasharray="3 3" strokeOpacity={0.5} strokeWidth={1} />
              <ReferenceLine y={30} stroke="var(--pos)" strokeDasharray="3 3" strokeOpacity={0.5} strokeWidth={1} />
              <ReferenceLine y={50} stroke="var(--chrome-mid)" strokeDasharray="2 4" strokeOpacity={0.4} strokeWidth={1} />
              <Line
                type="monotone"
                dataKey="rsi"
                stroke="var(--accent)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className={styles.rsiLegend}>
            <span className={styles.rsiOverbought}>Overbought (70)</span>
            <span className={styles.rsiOversold}>Oversold (30)</span>
          </div>
        </div>
      )}

      {/* Chart legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem} style={{ '--lc': 'var(--warn)' }}>SMA 20</span>
        {showSma50 && <span className={styles.legendItem} style={{ '--lc': '#a855f7' }}>SMA 50</span>}
      </div>
    </div>
  );
}
