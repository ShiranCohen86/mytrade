import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import { PrivateRoute } from '@/components/PrivateRoute/PrivateRoute';
import { AdminRoute } from '@/components/AdminRoute/AdminRoute';
import { AppShell } from '@/components/AppShell/AppShell';
import Dashboard from '@/app/page';
import StockDetailClient from '@/app/stocks/[ticker]/StockDetailClient';
import PortfolioPage from '@/app/PortfolioPage';
import SectorsPage from '@/app/SectorsPage';
import SettingsPage from '@/app/settings/SettingsPage';
import LoginPage from '@/app/auth/LoginPage';
import SignupPage from '@/app/auth/SignupPage';
import ForgotPasswordPage from '@/app/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/app/auth/ResetPasswordPage';
import GoogleCallbackPage from '@/app/auth/GoogleCallbackPage';
import LandingPage from '@/app/LandingPage';
import AdminLayout from '@/app/admin/AdminLayout';
import AdminDashboard from '@/app/admin/dashboard/AdminDashboard';
import AdminUsers from '@/app/admin/users/AdminUsers';
import AdminUserDetail from '@/app/admin/users/AdminUserDetail';
import AdminAuditLogs from '@/app/admin/audit/AdminAuditLogs';
import AdminWatchlists from '@/app/admin/watchlists/AdminWatchlists';
import AdminAnalytics from '@/app/admin/analytics/AdminAnalytics';
import AdminSupport from '@/app/admin/support/AdminSupport';

function StockDetailRoute() {
  const { ticker } = useParams();
  return <StockDetailClient ticker={ticker.toUpperCase()} />;
}

function NotFound() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />;
}

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
      <AuthProvider>
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
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
