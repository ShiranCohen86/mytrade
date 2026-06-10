import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authResetPassword } from '@/lib/apiClient';
import styles from './AuthPage.module.scss';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError(t('auth.passwordsDontMatch')); return; }
    if (password.length < 8) { setError(t('auth.passwordTooShort')); return; }
    setLoading(true);
    try {
      await authResetPassword(token, password);
      // Clear the sensitive fields so the new password isn't left on screen on a
      // shared device after success.
      setPassword('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      setError(err.message || t('auth.resetLinkInvalid'));
    } finally {
      setLoading(false);
    }
  };

  // Redirect to login shortly after success — in an effect so the timer is
  // cleaned up if the user navigates away first (no navigate-after-unmount).
  useEffect(() => {
    if (!done) return undefined;
    const id = setTimeout(() => navigate('/login', { replace: true }), 2500);
    return () => clearTimeout(id);
  }, [done, navigate]);

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.errorBanner}>⚠ {t('auth.resetLinkInvalid')}</div>
          <p className={styles.footer}><Link to="/forgot-password">{t('auth.sendResetLink')}</Link></p>
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

        <h1 className={styles.heading}>{t('auth.setPassword')}</h1>
        <p className={styles.subheading}>{t('auth.resetPasswordSub')}</p>

        {error && <div className={styles.errorBanner}><span>⚠</span> {error}</div>}

        {done ? (
          <div className={styles.successBanner}>
            ✓ {t('auth.passwordChanged')}
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">{t('auth.newPassword')}</label>
              <input
                id="password"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                placeholder={t('auth.passwordMin')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="confirm">{t('auth.confirmPassword')}</label>
              <input
                id="confirm"
                className={`${styles.input} ${confirm && confirm !== password ? styles.inputError : ''}`}
                type="password"
                autoComplete="new-password"
                placeholder={t('auth.repeatPassword')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading || !password || !confirm}>
              {loading ? t('auth.setting') : t('auth.setPassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
