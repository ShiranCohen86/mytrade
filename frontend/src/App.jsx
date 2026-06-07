import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { PrivateRoute } from '@/components/PrivateRoute/PrivateRoute';
import { AppShell } from '@/components/AppShell/AppShell';
import Dashboard from '@/app/page';
import StockDetailClient from '@/app/stocks/[ticker]/StockDetailClient';
import PortfolioPage from '@/app/PortfolioPage';
import SectorsPage from '@/app/SectorsPage';
import LoginPage from '@/app/auth/LoginPage';
import SignupPage from '@/app/auth/SignupPage';
import ForgotPasswordPage from '@/app/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/app/auth/ResetPasswordPage';
import GoogleCallbackPage from '@/app/auth/GoogleCallbackPage';
import LandingPage from '@/app/LandingPage';

function StockDetailRoute() {
  const { ticker } = useParams();
  return <StockDetailClient ticker={ticker.toUpperCase()} />;
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
            </Route>
          </Route>

          {/* Legacy redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
