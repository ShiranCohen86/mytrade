import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const EXPRESS = import.meta.env.VITE_EXPRESS_URL || '';

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  // After Google OAuth the backend sets only an httpOnly refresh cookie (the
  // access token is no longer passed in the URL). Exchange that cookie for an
  // access token via /auth/refresh, then bootstrap the session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${EXPRESS}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('refresh failed');
        const { accessToken } = await res.json();
        await loginWithToken(accessToken);
        if (!cancelled) navigate('/dashboard', { replace: true });
      } catch {
        if (!cancelled) navigate('/login?error=google', { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [navigate, loginWithToken]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100dvh',
      background: 'var(--surface-base)',
      color: 'var(--text-tertiary)',
      fontFamily: 'var(--font-ui)',
      fontSize: '14px',
    }}>
      Signing you in…
    </div>
  );
}
