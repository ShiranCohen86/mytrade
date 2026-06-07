import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const TOKEN_KEY = 'mytrade-token';

export default function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/login?error=google', { replace: true });
    }
  }, [params, navigate]);

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
