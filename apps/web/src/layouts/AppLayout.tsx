import { useState } from 'react';
import TourIcon from '@mui/icons-material/Tour';
import { useTour } from '../contexts/TourContext';
import { APP_TOUR_STEPS } from '../data/tourSteps';
import { TourOverlay } from '../components/TourOverlay';
import { OnboardingWizard } from '../components/OnboardingWizard';
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
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import TimelineIcon from '@mui/icons-material/Timeline';
import CasinoIcon from '@mui/icons-material/Casino';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import FlagIcon from '@mui/icons-material/Flag';
import CompareIcon from '@mui/icons-material/Compare';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PublicIcon from '@mui/icons-material/Public';
import { useAuth } from '../contexts/AuthContext';

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  { label: 'Dashboard',    path: '/',              icon: <DashboardIcon />,              tourId: 'nav-dashboard' },
  { label: 'Household',    path: '/household',     icon: <PeopleIcon />,                 tourId: 'nav-household' },
  { label: 'Accounts',     path: '/accounts',      icon: <AccountBalanceIcon />,         tourId: 'nav-accounts' },
  { label: 'Milestones',   path: '/milestones',    icon: <FlagIcon />,                   tourId: 'nav-milestones' },
  { label: 'Scenarios',    path: '/scenarios',     icon: <CompareArrowsIcon />,          tourId: 'nav-scenarios' },
  { label: 'Projections',  path: '/projections',   icon: <TimelineIcon />,               tourId: 'nav-projections' },
  { label: 'Simulations',  path: '/simulations',   icon: <CasinoIcon />,                 tourId: 'nav-simulations' },
  { label: 'Tax Analytics',path: '/tax-analytics', icon: <BarChartIcon />,               tourId: 'nav-tax' },
  { label: 'Estate',       path: '/estate',        icon: <AccountTreeIcon />,            tourId: 'nav-estate' },
  { label: 'International',path: '/international', icon: <PublicIcon /> },
  { label: 'Compare',      path: '/compare',       icon: <CompareIcon />,                tourId: 'nav-compare' },
  { label: 'AI Assistant', path: '/ai-chat',       icon: <SmartToyIcon />,               tourId: 'nav-ai' },
  { label: 'Integrations', path: '/integrations',  icon: <IntegrationInstructionsIcon /> },
  { label: 'Help',         path: '/help',          icon: <HelpOutlineIcon /> },
];

export function AppLayout() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [onboardingCtx, setOnboardingCtx] = useState<{ openOnboarding: () => void } | null>(null);
  const { startTour } = useTour();

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

      {/* Tour + Onboarding — mounted once, controlled by context */}
      <TourOverlay />
      <OnboardingWizard onContextReady={setOnboardingCtx} />
    </Box>
  );
}
