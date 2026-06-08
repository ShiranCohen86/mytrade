import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      loginWithToken(token).then(() => {
        navigate('/dashboard', { replace: true });
      });
    } else {
      navigate('/login?error=google', { replace: true });
    }
  }, [params, navigate, loginWithToken]);

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
