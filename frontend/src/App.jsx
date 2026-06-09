import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeProvider } from '@mui/material/styles';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { buildMuiTheme } from '@/src/theme';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt/PWAUpdatePrompt';
import { PrivateRoute } from '@/components/PrivateRoute/PrivateRoute';
import { AdminRoute } from '@/components/AdminRoute/AdminRoute';
import { AppShell } from '@/components/AppShell/AppShell';
import Dashboard from '@/app/page';
import LoginPage from '@/app/auth/LoginPage';
import SignupPage from '@/app/auth/SignupPage';
import ForgotPasswordPage from '@/app/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/app/auth/ResetPasswordPage';
import GoogleCallbackPage from '@/app/auth/GoogleCallbackPage';
import LandingPage from '@/app/LandingPage';

// Code-split the heavier / less-frequent routes so regular users never download
// admin bundles (recharts-heavy) or detail/portfolio code up front.
const StockDetailClient = lazy(() => import('@/app/stocks/[ticker]/StockDetailClient'));
const PortfolioPage = lazy(() => import('@/app/PortfolioPage'));
const SectorsPage = lazy(() => import('@/app/SectorsPage'));
const SettingsPage = lazy(() => import('@/app/settings/SettingsPage'));
const AdminLayout = lazy(() => import('@/app/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('@/app/admin/dashboard/AdminDashboard'));
const AdminUsers = lazy(() => import('@/app/admin/users/AdminUsers'));
const AdminUserDetail = lazy(() => import('@/app/admin/users/AdminUserDetail'));
const AdminAuditLogs = lazy(() => import('@/app/admin/audit/AdminAuditLogs'));
const AdminWatchlists = lazy(() => import('@/app/admin/watchlists/AdminWatchlists'));
const AdminAnalytics = lazy(() => import('@/app/admin/analytics/AdminAnalytics'));
const AdminSupport = lazy(() => import('@/app/admin/support/AdminSupport'));
const AdminIntelligence = lazy(() => import('@/app/admin/intelligence/AdminIntelligence'));

function DirectionSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const dir = i18n.language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', i18n.language);
  }, [i18n.language]);
  return null;
}

function StockDetailRoute() {
  const { ticker } = useParams();
  return <StockDetailClient ticker={ticker.toUpperCase()} />;
}

function NotFound() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />;
}

function RouteFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }} aria-busy="true">
      <span
        style={{
          width: 26, height: 26, borderRadius: '50%',
          border: '2.5px solid var(--chrome-mid)', borderTopColor: 'var(--accent)',
          animation: 'spin 0.7s linear infinite',
        }}
      />
    </div>
  );
}

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  const { theme } = useTheme();

  return (
    <ThemeProvider theme={buildMuiTheme(theme)}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DirectionSync />
      <CurrencyProvider>
      <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public routes — no AppShell */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<GoogleCallbackPage />} />

          {/* Protected routes — inside AppShell */}
          <Route element={<PrivateRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/stocks/:ticker" element={<StockDetailRoute />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/sectors" element={<SectorsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Admin routes — role-gated, own layout */}
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/users/:id" element={<AdminUserDetail />} />
              <Route path="/admin/audit" element={<AdminAuditLogs />} />
              <Route path="/admin/watchlists" element={<AdminWatchlists />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/support" element={<AdminSupport />} />
              <Route path="/admin/intelligence" element={<AdminIntelligence />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        <PWAUpdatePrompt />
      </AuthProvider>
      </ToastProvider>
      </CurrencyProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
