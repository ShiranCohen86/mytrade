import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authForgotPassword } from '@/lib/apiClient';
import styles from './AuthPage.module.scss';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authForgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src="/favicon.svg" alt="MyTrade" />
          <span className={styles.logoName}>MyTrade</span>
        </div>

        <Link to="/login" className={styles.backLink}>← Back to sign in</Link>

        <h1 className={styles.heading}>Reset password</h1>
        <p className={styles.subheading}>
          Enter your email and we'll send you a link to reset your password.
        </p>

        {error && <div className={styles.errorBanner}><span>⚠</span> {error}</div>}

        {sent ? (
          <div className={styles.successBanner}>
            ✓ If an account exists for {email}, you'll receive a reset link shortly.
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                className={styles.input}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading || !email}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
