import { useEffect, useMemo, useState } from 'react';
import TourIcon from '@mui/icons-material/Tour';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useTour } from '../contexts/TourContext';
import { APP_TOUR_STEPS } from '../data/tourSteps';
import { TourOverlay } from '../components/TourOverlay';
import { OnboardingWizard } from '../components/OnboardingWizard';
import { QuickActionsPanel } from '../components/QuickActionsPanel';
import { QuickActionsProvider, useQuickActions } from '../contexts/QuickActionsContext';
import { Outlet, useNavigate, useLocation } from 'react-router';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import TimelineIcon from '@mui/icons-material/Timeline';
import CasinoIcon from '@mui/icons-material/Casino';
import EmojiPeopleIcon from '@mui/icons-material/EmojiPeople';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import FlagIcon from '@mui/icons-material/Flag';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import CompareIcon from '@mui/icons-material/Compare';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PublicIcon from '@mui/icons-material/Public';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import { WhatIfDrawer } from '../components/WhatIfDrawer';

const DRAWER_WIDTH = 260;
const INSIGHT_COUNT_STORAGE_KEY = 'retiree-plan-insight-count';

const NAV_ITEMS = [
  { label: 'Dashboard',    path: '/',              icon: <DashboardIcon />,              tourId: 'nav-dashboard' },
  { label: 'Household',    path: '/household',     icon: <PeopleIcon />,                 tourId: 'nav-household' },
  { label: 'Accounts',     path: '/accounts',      icon: <AccountBalanceIcon />,         tourId: 'nav-accounts' },
  { label: 'Milestones',   path: '/milestones',    icon: <FlagIcon />,                   tourId: 'nav-milestones' },
  { label: 'Scenarios',    path: '/scenarios',     icon: <CompareArrowsIcon />,          tourId: 'nav-scenarios' },
  { label: 'Projections',  path: '/projections',   icon: <TimelineIcon />,               tourId: 'nav-projections' },
  { label: 'Simulations',  path: '/simulations',   icon: <CasinoIcon />,                 tourId: 'nav-simulations' },
  { label: 'Retire Finder',path: '/retire-finder', icon: <EmojiPeopleIcon /> },
  { label: 'Tax Analytics',path: '/tax-analytics', icon: <BarChartIcon />,               tourId: 'nav-tax' },
  { label: 'Estate',       path: '/estate',        icon: <AccountTreeIcon />,            tourId: 'nav-estate' },
  { label: 'Goals',        path: '/goals',         icon: <TrackChangesIcon /> },
  { label: 'International',path: '/international', icon: <PublicIcon /> },
  { label: 'Compare',      path: '/compare',       icon: <CompareIcon />,                tourId: 'nav-compare' },
  { label: 'AI Assistant', path: '/ai-chat',       icon: <SmartToyIcon />,               tourId: 'nav-ai' },
  { label: 'Integrations', path: '/integrations',  icon: <IntegrationInstructionsIcon /> },
  { label: 'Help',         path: '/help',          icon: <HelpOutlineIcon /> },
];

/**
 * Fetches the base-case projection once (shares the cache key with DashboardPage) and
 * registers the What-If Calculator globally so it's available on every page.
 * Must be rendered inside QuickActionsProvider.
 */
function GlobalWhatIfController() {
  const { apiFetch } = useApi();
  const { setWhatIfAction } = useQuickActions();
  const [whatIfOpen, setWhatIfOpen] = useState(false);

  const { data: households } = useQuery<any[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
    staleTime: 5 * 60 * 1000,
  });

  const hh = households?.[0];
  const primaryMember = hh?.members?.[0];
  const accounts: any[] = useMemo(() => hh?.accounts ?? [], [hh]);
  const scenarios: any[] = useMemo(() => hh?.scenarios ?? [], [hh]);

  const currentAge = useMemo(() => {
    const dob = primaryMember?.dateOfBirth;
    if (!dob) return 45;
    return new Date().getFullYear() - new Date(dob).getFullYear();
  }, [primaryMember?.dateOfBirth]);

  const retirementAge: number = primaryMember?.retirementAge ?? 65;

  const rrspTotal = useMemo(() => accounts.filter((a) => ['RRSP', 'RRIF'].includes(a.type)).reduce((s, a) => s + a.balance, 0), [accounts]);
  const tfsaTotal = useMemo(() => accounts.filter((a) => a.type === 'TFSA').reduce((s, a) => s + a.balance, 0), [accounts]);
  const nonRegTotal = useMemo(() => accounts.filter((a) => a.type === 'NON_REG').reduce((s, a) => s + a.balance, 0), [accounts]);
  const cashTotal = useMemo(() => accounts.filter((a) => a.type === 'CASH').reduce((s, a) => s + a.balance, 0), [accounts]);
  const totalPortfolio = rrspTotal + tfsaTotal + nonRegTotal + cashTotal;

  const firstScenarioParams = useMemo<Record<string, any>>(() => {
    const raw = scenarios[0]?.parameters;
    if (!raw) return {};
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
    return raw as Record<string, any>;
  }, [scenarios]);

  const ENGINE_EXCLUDED = useMemo(() => new Set(['CPP', 'OAS']), []);

  const projPayload = useMemo(() => {
    if (!hh || !primaryMember) return null;
    const p = firstScenarioParams;
    return {
      currentAge,
      endAge: p.lifeExpectancy ?? 90,
      province: primaryMember.province ?? 'ON',
      employmentIncome: 0,
      incomeSources: (hh.members ?? []).flatMap((m: any) =>
        (m.incomeSources ?? [])
          .filter((src: any) => !ENGINE_EXCLUDED.has(src.type))
          .map((src: any) => ({ annualAmount: src.annualAmount, startAge: src.startAge, endAge: src.endAge, indexToInflation: true })),
      ),
      retirementAge,
      annualExpenses: hh.annualExpenses ?? 60_000,
      inflationRate: p.inflationRate ?? 0.02,
      nominalReturnRate: p.expectedReturnRate ?? 0.06,
      cppStartAge: p.cppStartAge ?? 65,
      oasStartAge: p.oasStartAge ?? 65,
      rrspBalance: rrspTotal,
      tfsaBalance: tfsaTotal,
      nonRegBalance: nonRegTotal,
      cashBalance: cashTotal,
      rrspContribution: accounts.find((a: any) => a.type === 'RRSP')?.annualContribution ?? 0,
      tfsaContribution: accounts.find((a: any) => a.type === 'TFSA')?.annualContribution ?? 0,
      rrifConversionAge: p.rrifStartAge ?? 71,
      investSurplus: p.investSurplus ?? false,
    };
  }, [hh, primaryMember, currentAge, retirementAge, rrspTotal, tfsaTotal, nonRegTotal, cashTotal, firstScenarioParams, ENGINE_EXCLUDED, accounts]);

  const { data: projData } = useQuery<any[]>({
    queryKey: ['dash-projection', hh?.id],
    queryFn: async () => {
      const raw: any = await apiFetch('/projections/cash-flow', { method: 'POST', body: JSON.stringify(projPayload) });
      return Array.isArray(raw) ? raw : (raw.years ?? raw.data ?? []);
    },
    enabled: !!projPayload && totalPortfolio > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const baselineData = useMemo(
    () =>
      (projData ?? []).map((y: any) => ({
        age: y.age as number,
        totalNetWorth: Math.max(0, (y.totalNetWorth ?? y.netWorth ?? 0) as number),
      })),
    [projData],
  );

  useEffect(() => {
    setWhatIfAction(() => setWhatIfOpen(true));
    return () => setWhatIfAction(null);
  }, [setWhatIfAction]);

  return (
    <WhatIfDrawer
      open={whatIfOpen}
      onClose={() => setWhatIfOpen(false)}
      baselineInput={projPayload as any}
      baselineData={baselineData}
    />
  );
}

export function AppLayout() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [insightCount, setInsightCount] = useState(0);
  const [onboardingCtx, setOnboardingCtx] = useState<{ openOnboarding: () => void } | null>(null);
  const { startTour } = useTour();

  useEffect(() => {
    const readStoredCount = () => {
      const raw = window.localStorage.getItem(INSIGHT_COUNT_STORAGE_KEY) ?? '0';
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    };

    setInsightCount(readStoredCount());

    const handleInsightsCount = (event: Event) => {
      const customEvent = event as CustomEvent<number>;
      if (typeof customEvent.detail === 'number' && Number.isFinite(customEvent.detail)) {
        setInsightCount(Math.max(0, Math.floor(customEvent.detail)));
        return;
      }
      setInsightCount(readStoredCount());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === INSIGHT_COUNT_STORAGE_KEY) {
        setInsightCount(readStoredCount());
      }
    };

    window.addEventListener('insights-count', handleInsightsCount as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('insights-count', handleInsightsCount as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
        onClick={() => navigate('/overview')}
        title="View feature overview"
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '1.1rem',
            color: '#fff',
          }}
        >
          RP
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          RetireePlan
        </Typography>
      </Box>
      <Divider sx={{ mx: 2 }} />
      <List component="nav" aria-label="Main navigation" sx={{ flex: 1, px: 1.5, py: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path;
          return (
            <ListItemButton
              key={item.path}
              aria-current={active ? 'page' : undefined}
              {...(item.tourId ? { 'data-tour': item.tourId } : {})}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                ...(active && {
                  bgcolor: `${theme.palette.primary.main}18`,
                  color: theme.palette.primary.light,
                  '& .MuiListItemIcon-root': { color: theme.palette.primary.light },
                }),
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: active ? 600 : 400 }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <QuickActionsProvider>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Skip navigation for keyboard users */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          top: -60,
          left: 0,
          zIndex: 9999,
          p: 1,
          bgcolor: 'primary.main',
          color: '#fff',
          borderRadius: 1,
          '&:focus': { top: 8, left: 8 },
        }}
      >
        Skip to main content
      </Box>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        aria-label="Navigation menu"
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: 'background.paper' },
        }}
      >
        {drawer}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        aria-label="Navigation menu"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main content */}
      <Box sx={{ flex: 1, ml: { md: `${DRAWER_WIDTH}px` } }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'background.default',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              aria-label="Open navigation menu"
              sx={{ display: { md: 'none' }, mr: 1 }}
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ flex: 1 }} />
            <IconButton
              aria-label="View insights"
              title="Automated insights"
              onClick={() => navigate('/')}
              sx={{ mr: 0.5 }}
            >
              <Badge badgeContent={insightCount} color="error" max={9} invisible={insightCount === 0}>
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>
            <IconButton
              aria-label="Start guided tour"
              data-tour="tour-help"
              title="Start guided tour"
              onClick={() => startTour(APP_TOUR_STEPS)}
              sx={{ mr: 0.5 }}
            >
              <TourIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label="User account menu"
              aria-haspopup="true"
              aria-expanded={!!anchorEl}
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.85rem' }}>
                {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={!!anchorEl}
              onClose={() => setAnchorEl(null)}
            >
              <MenuItem disabled>
                <Typography variant="body2">{user?.email}</Typography>
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  navigate('/overview');
                }}
              >
                Feature Overview
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  onboardingCtx?.openOnboarding();
                }}
              >
                Getting Started
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  startTour(APP_TOUR_STEPS);
                }}
              >
                Take a Tour
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  navigate('/settings');
                }}
              >
                <SettingsIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                Settings
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  logout();
                }}
              >
                Sign out
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box id="main-content" component="main" sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>

      {/* Tour + Onboarding + Quick Actions — mounted once, controlled by context */}
      <TourOverlay />
      <OnboardingWizard onContextReady={setOnboardingCtx} />
    </Box>
    <GlobalWhatIfController />
    <QuickActionsPanel />
  </QuickActionsProvider>
  );
}
