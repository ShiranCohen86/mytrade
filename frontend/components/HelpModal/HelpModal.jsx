
import { useState, useEffect } from 'react';
import styles from './HelpModal.module.scss';

const LS_KEY = 'mytrade_help_seen';

const TERMS = [
  {
    term: 'Risk Score (0–100)',
    description: 'Composite danger score. Built from 5 factors: volatility (how wildly the price swings), sector (tech/biotech score higher), earnings proximity (closer = riskier), momentum (falling price = riskier), and market regime. ≥70 = HIGH, 40–69 = MEDIUM, <40 = LOW.',
  },
  {
    term: 'Expectation Score (0–100)',
    description: 'How much good news is already priced in. A very high score means the market expects perfection — even a beat can disappoint. Driven by analyst price targets, P/E ratio relative to sector, and sentiment.',
  },
  {
    term: 'Pre-Earnings Drift',
    description: 'The % price move in the 10 days before earnings. RISING means the stock has already run up; FALLING means it has sold off; FLAT means no significant move. Context for sell-the-news risk.',
  },
  {
    term: 'Sell-the-News Risk',
    description: 'Triggered when a stock rises >10% in the 10 days before earnings. Even if results are great, the move may already be priced in — traders often "sell the news" after buying the rumor.',
  },
  {
    term: 'Market Regime',
    description: 'Derived from SPY & QQQ 50/200-day moving averages. BULLISH: both ETFs trending up above their MAs. BEARISH: both below. VOLATILE: SPY near its 200-day MA (unstable). NEUTRAL: mixed signals.',
  },
  {
    term: 'Scenarios (Bull / Neutral / Bear)',
    description: 'Projected price targets for the next earnings event, modeled using implied volatility, analyst targets, and momentum. Probabilities are approximate — treat them as scenarios, not forecasts.',
  },
];

export function HelpModal({ trigger }) {
  const [open, setOpen] = useState(false);
  const [seenBefore, setSeenBefore] = useState(true);

  useEffect(() => {
    const seen = localStorage.getItem(LS_KEY);
    if (!seen) {
      setSeenBefore(false);
      setOpen(true);
    } else {
      setSeenBefore(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(LS_KEY, '1');
    setSeenBefore(true);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') handleClose();
  };

  return (
    <>
      {trigger && (
        <button
          className={styles.triggerBtn}
          onClick={() => setOpen(true)}
          aria-label="Open help / glossary"
        >
          {trigger}
        </button>
      )}
      {!seenBefore && !trigger && (
        <button
          className={styles.triggerBtn}
          onClick={() => setOpen(true)}
          aria-label="Open help / glossary"
        >
          ?
        </button>
      )}

      {open && (
        <div
          className={styles.overlay}
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-label="MyTrade glossary"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <h2 className={styles.title}>How to read MyTrade</h2>
              <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">✕</button>
            </div>
            <p className={styles.intro}>
              MyTrade is a pre-earnings intelligence dashboard. Here is what each indicator means:
            </p>
            <dl className={styles.list}>
              {TERMS.map(({ term, description }) => (
                <div key={term} className={styles.item}>
                  <dt className={styles.term}>{term}</dt>
                  <dd className={styles.desc}>{description}</dd>
                </div>
              ))}
            </dl>
            <div className={styles.footer}>
              <button className={styles.gotItBtn} onClick={handleClose}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
