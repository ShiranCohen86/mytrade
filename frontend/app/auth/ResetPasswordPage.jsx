import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authResetPassword } from '@/lib/apiClient';
import styles from './AuthPage.module.scss';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await authResetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.errorBanner}>⚠ Invalid reset link. Please request a new one.</div>
          <p className={styles.footer}><Link to="/forgot-password">Request new link</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src="/favicon.svg" alt="MyTrade" />
          <span className={styles.logoName}>MyTrade</span>
        </div>

        <h1 className={styles.heading}>Set new password</h1>
        <p className={styles.subheading}>Choose a strong password for your account.</p>

        {error && <div className={styles.errorBanner}><span>⚠</span> {error}</div>}

        {done ? (
          <div className={styles.successBanner}>
            ✓ Password reset! Redirecting to sign in…
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">New Password</label>
              <input
                id="password"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="confirm">Confirm Password</label>
              <input
                id="confirm"
                className={`${styles.input} ${confirm && confirm !== password ? styles.inputError : ''}`}
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading || !password || !confirm}>
              {loading ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
