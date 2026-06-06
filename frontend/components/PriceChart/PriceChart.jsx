
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import styles from './PriceChart.module.scss';

function computeSma(data, period) {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return parseFloat((slice.reduce((s, d) => s + d.close, 0) / period).toFixed(2));
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function PriceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { fullDate, price, open, high, low, sma20 } = payload[0].payload;
  return (
    <div style={{ background: '#0C1525', border: '1px solid #1A2840', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: '#8A97AA', marginBottom: 4, fontFamily: 'Inter, sans-serif' }}>{fullDate}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 12px', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: '#4E5E72' }}>Close</span><span style={{ color: '#3D7EFF', fontWeight: 600 }}>${price?.toFixed(2)}</span>
        <span style={{ color: '#4E5E72' }}>Open</span><span style={{ color: '#DCE4F0' }}>${open?.toFixed(2)}</span>
        <span style={{ color: '#4E5E72' }}>High</span><span style={{ color: '#00C076' }}>${high?.toFixed(2)}</span>
        <span style={{ color: '#4E5E72' }}>Low</span><span style={{ color: '#F23645' }}>${low?.toFixed(2)}</span>
        {sma20 != null && <><span style={{ color: '#4E5E72' }}>SMA 20</span><span style={{ color: '#F5A623' }}>${sma20?.toFixed(2)}</span></>}
      </div>
    </div>
  );
}

export function PriceChart({ historical, ticker }) {
  if (!historical || historical.length === 0) {
    return <div className={styles.empty}>No price data available</div>;
  }

  const sma20 = computeSma(historical, 20);

  const chartData = historical.map((p, i) => ({
    date: formatDate(p.date),
    fullDate: new Date(p.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    price: parseFloat(p.close.toFixed(2)),
    sma20: sma20[i],
    open: parseFloat(p.open?.toFixed(2) ?? p.close.toFixed(2)),
    high: parseFloat(p.high?.toFixed(2) ?? p.close.toFixed(2)),
    low: parseFloat(p.low?.toFixed(2) ?? p.close.toFixed(2)),
  }));

  const prices = historical.map((p) => p.close);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const padding = (maxP - minP) * 0.05;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{ticker} — Price History</span>
        <span className={styles.subtitle}>{historical.length}-day chart</span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3D7EFF" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#3D7EFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#101928" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#4E5E72', fontFamily: 'Inter, sans-serif' }}
            axisLine={{ stroke: '#101928' }}
            tickLine={false}
            interval={Math.floor(chartData.length / 6)}
          />
          <YAxis
            domain={[minP - padding, maxP + padding]}
            tick={{ fontSize: 10, fill: '#4E5E72', fontFamily: "'JetBrains Mono', monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
            width={55}
          />
          <Tooltip content={<PriceTooltip />} />
          <Legend
            formatter={(v) => v === 'price' ? 'Close' : 'SMA 20'}
            iconType="line"
            iconSize={10}
            wrapperStyle={{ fontSize: '10px', fontFamily: 'Inter, sans-serif', color: '#8A97AA' }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#3D7EFF"
            strokeWidth={1.5}
            fill="url(#priceGrad)"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="sma20"
            stroke="#F5A623"
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
