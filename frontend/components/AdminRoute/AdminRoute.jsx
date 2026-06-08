import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'support_agent', 'analyst']);

export function AdminRoute({ requiredRole }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
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
        gap: '10px',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Loading…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!ADMIN_ROLES.has(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredRole && user?.role !== 'super_admin' && user?.role !== requiredRole) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}

export { ADMIN_ROLES };
