/**
 * OverviewPage — public landing page
 *
 * Accessible whether or not the user is authenticated.
 * Showcases every feature with a card that deep-links into the app,
 * or redirects to /login if the user is not yet signed in.
 */
import { useNavigate } from 'react-router';
import {
  Box, Typography, Button, Grid, Card, CardContent, CardActionArea,
  Chip, Container, useTheme, alpha, Divider,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import TimelineIcon from '@mui/icons-material/Timeline';
import CasinoIcon from '@mui/icons-material/Casino';
import BarChartIcon from '@mui/icons-material/BarChart';
import FlagIcon from '@mui/icons-material/Flag';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PublicIcon from '@mui/icons-material/Public';
import CompareIcon from '@mui/icons-material/Compare';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useAuth } from '../contexts/AuthContext';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  path: string;
  tag?: string;
  tagColor?: 'primary' | 'secondary' | 'success' | 'warning' | 'info';
}

const FEATURES: Feature[] = [
  {
    icon: <DashboardIcon fontSize="large" />,
    title: 'Dashboard',
    description: 'Get an instant snapshot of your net worth, total income, RRSP/TFSA balances, and household composition — all in one place.',
    path: '/',
    tag: 'Start here',
    tagColor: 'secondary',
  },
  {
    icon: <PeopleIcon fontSize="large" />,
    title: 'Household Setup',
    description: 'Register each family member with their date of birth, province, and income sources (employment, CPP, OAS, pension). Powers every calculation in the app.',
    path: '/household',
    tag: 'Required',
    tagColor: 'warning',
  },
  {
    icon: <AccountBalanceIcon fontSize="large" />,
    title: 'Accounts',
    description: 'Track RRSP, TFSA, and non-registered accounts with current balances and annual contributions. Optionally link to YNAB for live balance sync.',
    path: '/accounts',
    tag: 'Required',
    tagColor: 'warning',
  },
  {
    icon: <FlagIcon fontSize="large" />,
    title: 'Milestones',
    description: 'Model life events that change your cash flow — partner retiring, a lump-sum inheritance, mortgage payoff, or RRSP-to-RRIF conversion at age 71.',
    path: '/milestones',
  },
  {
    icon: <CompareArrowsIcon fontSize="large" />,
    title: 'Scenarios',
    description: 'Create named what-if sets of assumptions: retirement age, life expectancy, expected return, inflation, and equity fraction. Switch between them at any time.',
    path: '/scenarios',
    tag: 'Required',
    tagColor: 'warning',
  },
  {
    icon: <TimelineIcon fontSize="large" />,
    title: 'Cash-Flow Projections',
    description: 'Run deterministic year-by-year projections through retirement showing income, expenses, tax, and net worth by account type. Export to CSV or PDF.',
    path: '/projections',
    tag: 'Core',
    tagColor: 'primary',
  },
  {
    icon: <CasinoIcon fontSize="large" />,
    title: 'Simulations',
    description: 'Go beyond deterministic projections with Monte Carlo (1 000 runs), 55-year historical backtesting, Guyton-Klinger dynamic withdrawal rules, and a success-rate heatmap.',
    path: '/simulations',
    tag: 'Advanced',
    tagColor: 'info',
  },
  {
    icon: <BarChartIcon fontSize="large" />,
    title: 'Tax Analytics',
    description: 'Visualise 2024 federal and provincial tax brackets side-by-side. Pre-populated from your household income. See effective vs. marginal rate curves for any income level.',
    path: '/tax-analytics',
    tag: 'Core',
    tagColor: 'primary',
  },
  {
    icon: <AccountTreeIcon fontSize="large" />,
    title: 'Estate Planning',
    description: 'Estimate tax on death for RRSP/RRIF, capital gains on non-registered assets, and principal residence exemption — with after-tax estate summary.',
    path: '/estate',
    tag: 'Advanced',
    tagColor: 'info',
  },
  {
    icon: <CompareIcon fontSize="large" />,
    title: 'Scenario Compare',
    description: 'Chart two scenarios side-by-side — net worth trajectory, peak balance, depletion age, and total tax paid — to clearly see the impact of different assumptions.',
    path: '/compare',
  },
  {
    icon: <PublicIcon fontSize="large" />,
    title: 'International / Cross-Border',
    description: 'Tools for Canadians living abroad or moving to Canada: RRSP withholding tax, Canada-US tax treaty rates, departure tax, UK pension transfers, and OAS eligibility.',
    path: '/international',
    tag: 'Specialty',
    tagColor: 'secondary',
  },
  {
    icon: <SmartToyIcon fontSize="large" />,
    title: 'AI Assistant',
    description: 'Ask plain-English questions about your retirement plan. The context-aware assistant knows your household, accounts, and scenarios to give personalised answers.',
    path: '/ai-chat',
    tag: 'New',
    tagColor: 'secondary',
  },
  {
    icon: <IntegrationInstructionsIcon fontSize="large" />,
    title: 'YNAB Integration',
    description: 'Connect Your Number And Budget to automatically sync account balances and map YNAB spending categories to your expense model for real-time cashflow insight.',
    path: '/integrations',
    tag: 'Optional',
  },
];

const WHY_ITEMS = [
  'Built specifically for Canadian tax rules and registered accounts',
  'All calculations run locally — your data never leaves the app',
  'Handles CPP, OAS, RRSP, TFSA, and RRIF in every projection',
  'Province-aware federal + provincial tax for all 13 jurisdictions',
  'Multiple simulation methods to stress-test your plan',
  'Free, open-source, and self-hostable',
];

export function OverviewPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  function go(path: string) {
    if (isAuthenticated) {
      navigate(path);
    } else {
      navigate('/login');
    }
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>

      {/* ── Top nav bar ──────────────────────────────────────────────────── */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          bgcolor: alpha(theme.palette.background.default, 0.85),
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: { xs: 2, md: 4 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.95rem',
              color: '#fff',
            }}
          >
            RP
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            RetireePlan
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isAuthenticated ? (
            <Button variant="contained" size="small" onClick={() => navigate('/')}>
              Go to Dashboard
            </Button>
          ) : (
            <>
              <Button variant="text" size="small" onClick={() => navigate('/login')}>
                Sign In
              </Button>
              <Button variant="contained" size="small" onClick={() => navigate('/login')}>
                Get Started Free
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${alpha(theme.palette.primary.main, 0.25)}, transparent)`,
          pt: { xs: 8, md: 12 },
          pb: { xs: 6, md: 10 },
          textAlign: 'center',
          px: 2,
        }}
      >
        <Chip
          label="Canadian Retirement Planning"
          size="small"
          sx={{ mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.15), color: 'primary.light', borderRadius: 2 }}
        />
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '2rem', sm: '2.8rem', md: '3.5rem' },
            fontWeight: 800,
            letterSpacing: '-0.03em',
            mb: 2,
            maxWidth: 800,
            mx: 'auto',
            lineHeight: 1.15,
          }}
        >
          Retire with{' '}
          <Box
            component="span"
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            confidence
          </Box>
        </Typography>
        <Typography
          variant="h5"
          color="text.secondary"
          sx={{ maxWidth: 600, mx: 'auto', mb: 5, fontWeight: 400, lineHeight: 1.6 }}
        >
          The complete Canadian retirement planner — from RRSP projections and Monte Carlo simulations
          to CPP/OAS timing and estate tax estimates.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForwardIcon />}
            onClick={() => go('/')}
            sx={{ px: 4 }}
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Start Planning Free'}
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => {
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Explore Features
          </Button>
        </Box>
      </Box>

      {/* ── Why RetireePlan ──────────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        <Typography variant="h3" sx={{ textAlign: 'center', mb: 1 }}>
          Built for Canadians
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 5 }}>
          Most retirement planners ignore the nuances of Canadian tax law. We don't.
        </Typography>
        <Grid container spacing={2} justifyContent="center">
          {WHY_ITEMS.map((item) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <CheckCircleIcon sx={{ color: 'secondary.main', mt: 0.3, flexShrink: 0 }} />
                <Typography variant="body1">{item}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Divider />

      {/* ── Feature Cards ─────────────────────────────────────────────────── */}
      <Container maxWidth="xl" id="features" sx={{ py: { xs: 6, md: 10 } }}>
        <Typography variant="h3" sx={{ textAlign: 'center', mb: 1 }}>
          Everything you need in one place
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 6 }}>
          Click any feature to jump straight in — or{' '}
          {isAuthenticated ? 'use the sidebar to navigate.' : 'sign in and get started.'}
        </Typography>

        <Grid container spacing={3}>
          {FEATURES.map((f) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={f.title}>
              <Card
                sx={{
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.2)}`,
                  },
                }}
              >
                <CardActionArea
                  onClick={() => go(f.path)}
                  sx={{ height: '100%', alignItems: 'flex-start', display: 'flex', flexDirection: 'column' }}
                >
                  <CardContent sx={{ flex: 1, width: '100%' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.primary.main, 0.12),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'primary.light',
                        }}
                      >
                        {f.icon}
                      </Box>
                      {f.tag && (
                        <Chip
                          label={f.tag}
                          size="small"
                          color={f.tagColor ?? 'default'}
                          sx={{ height: 22, fontSize: '0.7rem', borderRadius: 1 }}
                        />
                      )}
                    </Box>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {f.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                      {f.description}
                    </Typography>
                  </CardContent>
                  <Box
                    sx={{
                      px: 2,
                      pb: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      color: 'primary.light',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    Open <ArrowForwardIcon sx={{ fontSize: 16 }} />
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.secondary.main, 0.1)})`,
          borderTop: '1px solid',
          borderColor: 'divider',
          py: { xs: 6, md: 10 },
          textAlign: 'center',
          px: 2,
        }}
      >
        <Typography variant="h3" sx={{ mb: 2 }}>
          Ready to start?
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
          Set up your household in under 5 minutes and run your first retirement projection.
        </Typography>
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForwardIcon />}
          onClick={() => go('/household')}
          sx={{ px: 5 }}
        >
          {isAuthenticated ? 'Set Up Household' : 'Get Started Free'}
        </Button>
      </Box>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <Box
        component="footer"
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          py: 3,
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          RetireePlan &mdash; Canadian Retirement Planning &mdash;{' '}
          <Box
            component="span"
            sx={{ cursor: 'pointer', color: 'primary.light', '&:hover': { textDecoration: 'underline' } }}
            onClick={() => navigate('/overview')}
          >
            Overview
          </Box>
          {' '}&bull;{' '}
          <Box
            component="span"
            sx={{ cursor: 'pointer', color: 'primary.light', '&:hover': { textDecoration: 'underline' } }}
            onClick={() => navigate('/login')}
          >
            Sign In
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}
