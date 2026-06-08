import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import styles from './LandingPage.module.scss';

function MarketTicker({ ticker, price, changePercent }) {
  const isPos = changePercent >= 0;
  // VIX is an inverse sentiment indicator: rising VIX = fear = bad → show red when up
  const isVix = ticker === 'VIX';
  const colorPos = isVix ? !isPos : isPos;
  return (
    <div className={styles.tickerCard}>
      <span className={styles.tickerSymbol}>{ticker}</span>
      <span className={styles.tickerPrice}>
        {price != null ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
      </span>
      <span className={`${styles.tickerChange} ${colorPos ? styles.pos : styles.neg}`}>
        {changePercent != null ? `${isPos ? '+' : ''}${changePercent.toFixed(2)}%` : '—'}
      </span>
    </div>
  );
}

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'Risk Analysis',
    description: 'Score 0–100 across 6 engines. Know your risk before you trade.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: 'Earnings Scenarios',
    description: 'Bull, neutral, and bear price targets modeled before every earnings event.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
      </svg>
    ),
    title: 'Market Regime',
    description: 'BULLISH · BEARISH · VOLATILE · NEUTRAL — updated per analysis run.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: 'Price Alerts',
    description: 'Set target prices. Get notified the moment a stock crosses your threshold.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    title: 'Portfolio Tracking',
    description: 'Track your entry price, P&L, and performance vs SPY all in one view.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: 'News Sentiment',
    description: 'Headlines scored and aggregated per ticker. Know the narrative before the move.',
  },
];

const STEPS = [
  { n: '01', title: 'Add your tickers', desc: 'Type any stock symbol to add it to your watchlist.' },
  { n: '02', title: 'Run analysis', desc: 'One click runs 6 engines across risk, regime, earnings, and sentiment.' },
  { n: '03', title: 'Make informed decisions', desc: 'Act on data — not hope — with risk scores and scenario targets.' },
];

const EXPRESS = import.meta.env.VITE_EXPRESS_URL || '';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [market, setMarket] = useState([]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
      return;
    }
    const fetchMarket = () => {
      fetch(`${EXPRESS}/api/market/overview`)
        .then((r) => r.ok ? r.json() : [])
        .then(setMarket)
        .catch(() => {});
    };
    fetchMarket();
    const id = setInterval(fetchMarket, 60_000);
    return () => clearInterval(id);
  }, [isAuthenticated, navigate]);

  return (
    <div className={styles.page}>
      {/* Navigation */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.navBrand}>
          <img src="/favicon.svg" alt="MyTrade" width={28} height={28} />
          <span>MyTrade</span>
        </Link>
        <div className={styles.navLinks}>
          <Link to="/login" className={styles.navLink}>Sign in</Link>
          <Link to="/signup" className={styles.navCta}>Get started →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>6 analysis engines · Real-time data</div>
        <h1 className={styles.heroHeading}>
          Know what the market<br />expects. Before earnings.
        </h1>
        <p className={styles.heroSubheading}>
          Risk scores, market regime analysis, earnings scenarios, and price alerts —
          all in one intelligent dashboard built for serious traders.
        </p>
        <div className={styles.heroCtas}>
          <Link to="/signup" className={styles.ctaPrimary}>Start free →</Link>
          <Link to="/login" className={styles.ctaGhost}>Sign in</Link>
        </div>

        {/* Market preview strip */}
        {market.length > 0 && (
          <div className={styles.marketStrip}>
            {market.map((m) => (
              <MarketTicker key={m.ticker} {...m} />
            ))}
          </div>
        )}
      </section>

      {/* Social proof stats */}
      <section className={styles.statsBar}>
        {[
          { n: '6', label: 'Analysis engines' },
          { n: '<2s', label: 'Per analysis' },
          { n: '100%', label: 'Free to use' },
          { n: '∞', label: 'Stocks supported' },
        ].map(({ n, label }) => (
          <div key={label} className={styles.stat}>
            <span className={styles.statNum}>{n}</span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </section>

      {/* Feature grid */}
      <section className={styles.features}>
        <h2 className={styles.sectionHeading}>Everything you need to trade smarter</h2>
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionHeading}>Up and running in 60 seconds</h2>
        <div className={styles.steps}>
          {STEPS.map((s) => (
            <div key={s.n} className={styles.step}>
              <span className={styles.stepNum}>{s.n}</span>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className={styles.ctaBanner}>
        <h2 className={styles.ctaBannerHeading}>Ready to trade smarter?</h2>
        <p className={styles.ctaBannerSub}>Free account. No credit card. No limits.</p>
        <Link to="/signup" className={styles.ctaPrimary}>Create free account →</Link>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <img src="/favicon.svg" alt="MyTrade" width={20} height={20} />
          <span>MyTrade</span>
        </div>
        <p className={styles.footerTagline}>Built for serious traders.</p>
        <div className={styles.footerLinks}>
          <Link to="/login">Sign in</Link>
          <Link to="/signup">Sign up</Link>
        </div>
      </footer>
    </div>
  );
}
