import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { CircularProgress, Box } from '@mui/material';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './contexts/AuthContext';
import { TourProvider } from './contexts/TourContext';
import { OverviewPage } from './pages/OverviewPage';

// Route-level code splitting — each page chunk is loaded on demand
const DashboardPage    = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const HouseholdPage    = lazy(() => import('./pages/HouseholdPage').then((m) => ({ default: m.HouseholdPage })));
const AccountsPage     = lazy(() => import('./pages/AccountsPage').then((m) => ({ default: m.AccountsPage })));
const ScenariosPage    = lazy(() => import('./pages/ScenariosPage').then((m) => ({ default: m.ScenariosPage })));
const ProjectionsPage  = lazy(() => import('./pages/ProjectionsPage').then((m) => ({ default: m.ProjectionsPage })));
const SimulationsPage  = lazy(() => import('./pages/SimulationsPage').then((m) => ({ default: m.SimulationsPage })));
const EarliestRetirePage = lazy(() => import('./pages/EarliestRetirePage').then((m) => ({ default: m.EarliestRetirePage })));
const TaxAnalyticsPage = lazy(() => import('./pages/TaxAnalyticsPage').then((m) => ({ default: m.TaxAnalyticsPage })));
const SettingsPage     = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const MilestonesPage   = lazy(() => import('./pages/MilestonesPage').then((m) => ({ default: m.MilestonesPage })));
const ComparePage      = lazy(() => import('./pages/ComparePage').then((m) => ({ default: m.ComparePage })));
const EstatePage       = lazy(() => import('./pages/EstatePage').then((m) => ({ default: m.EstatePage })));
const HelpPage         = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })));
const IntegrationsPage   = lazy(() => import('./pages/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })));
const AiChatPage         = lazy(() => import('./pages/AiChatPage').then((m) => ({ default: m.AiChatPage })));
const InternationalPage  = lazy(() => import('./pages/InternationalPage').then((m) => ({ default: m.InternationalPage })));

function PageSpinner() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress />
    </Box>
  );
}

export function App() {
  const { isAuthenticated } = useAuth();

  return (
    <TourProvider>
      {!isAuthenticated ? (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/overview" element={<OverviewPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/household" element={<HouseholdPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/milestones" element={<MilestonesPage />} />
              <Route path="/scenarios" element={<ScenariosPage />} />
              <Route path="/projections" element={<ProjectionsPage />} />
              <Route path="/simulations" element={<SimulationsPage />} />
              <Route path="/retire-finder" element={<EarliestRetirePage />} />
              <Route path="/tax-analytics" element={<TaxAnalyticsPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/estate" element={<EstatePage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/ai-chat" element={<AiChatPage />} />
              <Route path="/international" element={<InternationalPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      )}
    </TourProvider>
  );
}

