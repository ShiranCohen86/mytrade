
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updateProfile } from '@/lib/apiClient';
import styles from './WelcomeCard.module.scss';

export function WelcomeCard() {
  const { user, updateUser } = useAuth();
  const [done, setDone] = useState(false);

  if (done || user?.onboardingDone) return null;

  const handleDismiss = async () => {
    setDone(true);
    try {
      await updateProfile({ onboardingDone: true });
      updateUser({ onboardingDone: true });
    } catch {
      updateUser({ onboardingDone: true });
    }
  };

  return (
    <div className={styles.card} role="region" aria-label="Welcome">
      <div className={styles.header}>
        <span className={styles.emoji}>📈</span>
        <div>
          <h2 className={styles.title}>Welcome to MyTrade</h2>
          <p className={styles.subtitle}>Your personal stock intelligence dashboard</p>
        </div>
      </div>

      <ol className={styles.steps}>
        <li>
          <span className={styles.stepNum}>1</span>
          <div>
            <strong>Add a ticker</strong> — type a symbol (e.g. AAPL) in the search box above and click + Add.
          </div>
        </li>
        <li>
          <span className={styles.stepNum}>2</span>
          <div>
            <strong>Run Analysis</strong> — click "Analyze All" to get risk scores, earnings scenarios, and market regime for every stock.
          </div>
        </li>
        <li>
          <span className={styles.stepNum}>3</span>
          <div>
            <strong>Tap any row</strong> — set price alerts, track P&amp;L, and add personal notes.
          </div>
        </li>
      </ol>

      <div className={styles.footer}>
        <button className={styles.btn} onClick={handleDismiss}>
          Let's go →
        </button>
        <span className={styles.tip}>Tip: press <kbd>⌘K</kbd> any time to search tickers or navigate pages.</span>
      </div>
    </div>
  );
}
