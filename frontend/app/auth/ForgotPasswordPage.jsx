import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authForgotPassword } from '@/lib/apiClient';
import styles from './AuthPage.module.scss';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authForgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || t('auth.failedToSendReset'));
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

        <Link to="/login" className={styles.backLink}>{t('auth.backToSignIn')}</Link>

        <h1 className={styles.heading}>{t('auth.resetPassword')}</h1>
        <p className={styles.subheading}>{t('auth.resetPasswordSub')}</p>

        {error && <div className={styles.errorBanner} role="alert"><span>⚠</span> {error}</div>}

        {sent ? (
          <div className={styles.successBanner}>
            ✓ {t('auth.resetSent', { email })}
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">{t('auth.email')}</label>
              <input
                id="email"
                className={styles.input}
                type="email"
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading || !email}>
              {loading ? t('auth.sending') : t('auth.sendResetLink')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
