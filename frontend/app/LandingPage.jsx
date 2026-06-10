import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import styles from './LandingPage.module.scss';

function MarketTicker({ ticker, price, changePercent }) {
  const isPos = changePercent >= 0;
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

const EXPRESS = import.meta.env.VITE_EXPRESS_URL || '';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  const FEATURES = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
      title: t('landing.features.riskAnalysis'),
      description: t('landing.features.riskAnalysisDesc'),
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      title: t('landing.features.earningsScenarios'),
      description: t('landing.features.earningsScenariosDesc'),
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
        </svg>
      ),
      title: t('landing.features.marketRegime'),
      description: t('landing.features.marketRegimeDesc'),
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      title: t('landing.features.priceAlerts'),
      description: t('landing.features.priceAlertsDesc'),
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
      title: t('landing.features.portfolioTracking'),
      description: t('landing.features.portfolioTrackingDesc'),
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      title: t('landing.features.newsSentiment'),
      description: t('landing.features.newsSentimentDesc'),
    },
  ];

  const STEPS = [
    { n: '01', title: t('landing.steps.addTickers'), desc: t('landing.steps.addTickersDesc') },
    { n: '02', title: t('landing.steps.runAnalysis'), desc: t('landing.steps.runAnalysisDesc') },
    { n: '03', title: t('landing.steps.makeDecisions'), desc: t('landing.steps.makeDecisionsDesc') },
  ];

  const STATS = [
    { n: '6',    label: t('landing.statsEngines') },
    { n: '<2s',  label: t('landing.statsPerAnalysis') },
    { n: '100%', label: t('landing.statsFree') },
    { n: '∞',    label: t('landing.statsStocks') },
  ];

  return (
    <div className={styles.page}>
      {/* Navigation */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.navBrand}>
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>MyTrade</span>
        </Link>
        <div className={styles.navLinks}>
          <Link to="/login" className={styles.navLink}>{t('landing.signIn')}</Link>
          <Link to="/signup" className={styles.navCta}>{t('landing.getStarted')}</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>{t('landing.heroBadge')}</div>
        <h1 className={styles.heroHeading}>{t('landing.heroHeading')}</h1>
        <p className={styles.heroSubheading}>{t('landing.heroSubheading')}</p>
        <div className={styles.heroCtas}>
          <Link to="/signup" className={styles.ctaPrimary}>{t('landing.startFree')}</Link>
          <Link to="/login" className={styles.ctaGhost}>{t('landing.signIn')}</Link>
        </div>

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
        {STATS.map(({ n, label }) => (
          <div key={label} className={styles.stat}>
            <span className={styles.statNum}>{n}</span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </section>

      {/* Feature grid */}
      <section className={styles.features}>
        <h2 className={styles.sectionHeading}>{t('landing.featuresHeading')}</h2>
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
        <h2 className={styles.sectionHeading}>{t('landing.howItWorksHeading')}</h2>
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
        <h2 className={styles.ctaBannerHeading}>{t('landing.ctaBannerHeading')}</h2>
        <p className={styles.ctaBannerSub}>{t('landing.ctaBannerSub')}</p>
        <Link to="/signup" className={styles.ctaPrimary}>{t('landing.createFreeAccount')}</Link>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <img src="/favicon.svg" alt="" width={20} height={20} />
          <span>MyTrade</span>
        </div>
        <p className={styles.footerTagline}>{t('landing.footerTagline')}</p>
        <div className={styles.footerLinks}>
          <Link to="/login">{t('landing.footerSignIn')}</Link>
          <Link to="/signup">{t('landing.footerSignUp')}</Link>
        </div>
      </footer>
    </div>
  );
}
