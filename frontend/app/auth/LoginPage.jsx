import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import styles from './AuthPage.module.scss';

const EXPRESS = import.meta.env.VITE_EXPRESS_URL || '';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const from = location.state?.from || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => {
    const code = searchParams.get('error');
    if (code === 'google') return t('auth.googleFailed');
    if (code === 'suspended') return t('auth.accountSuspended');
    return '';
  });
  const [loading, setLoading] = useState(false);

  if (!isLoading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || t('auth.loginFailed'));
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

        <h1 className={styles.heading}>{t('auth.welcomeBack')}</h1>
        <p className={styles.subheading}>{t('auth.welcomeBackSub')}</p>

        {error && <div className={styles.errorBanner} role="alert"><span>⚠</span> {error}</div>}

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

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">{t('auth.password')}</label>
            <input
              id="password"
              className={styles.input}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Link to="/forgot-password" className={styles.forgotLink}>{t('auth.forgotPassword')}</Link>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading || !email || !password}>
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>

        <div className={styles.divider}><span>{t('auth.or')}</span></div>

        <a href={`${EXPRESS}/auth/google`} className={styles.googleBtn}>
          <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {t('auth.continueWithGoogle')}
        </a>

        <p className={styles.footer}>
          {t('auth.noAccount')} <Link to="/signup">{t('auth.createOne')}</Link>
        </p>
      </div>
    </div>
  );
}
