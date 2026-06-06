import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell/AppShell';
import Dashboard from '@/app/page';
import StockDetailClient from '@/app/stocks/[ticker]/StockDetailClient';
import PortfolioPage from '@/app/PortfolioPage';
import SectorsPage from '@/app/SectorsPage';

function StockDetailRoute() {
  const { ticker } = useParams();
  return <StockDetailClient ticker={ticker.toUpperCase()} />;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stocks/:ticker" element={<StockDetailRoute />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/sectors" element={<SectorsPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
