import { Box, Grid, Card, CardContent, Typography, useTheme, Button, List, ListItem, ListItemText, Alert } from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PeopleIcon from '@mui/icons-material/People';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useApi } from '../hooks/useApi';

interface Account { id: string; name: string; type: string; balance: number; }
interface Member { id: string; name: string; dateOfBirth: string; incomeSources?: { annualAmount: number }[]; }
interface Household { id: string; name: string; members: Member[]; accounts: Account[]; }

export function DashboardPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { apiFetch } = useApi();

  const { data: households } = useQuery<Household[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
  });

  const household = households?.[0];
  const accounts = household?.accounts ?? [];
  const members = household?.members ?? [];

  const totalNetWorth = accounts.reduce((s, a) => s + a.balance, 0);
  const totalIncome = members.flatMap((m) => m.incomeSources ?? []).reduce((s, i) => s + i.annualAmount, 0);

  // Account breakdown
  const rrspTotal = accounts.filter((a) => a.type === 'RRSP' || a.type === 'RRIF').reduce((s, a) => s + a.balance, 0);
  const tfsaTotal = accounts.filter((a) => a.type === 'TFSA').reduce((s, a) => s + a.balance, 0);
  const nonRegTotal = accounts.filter((a) => a.type === 'NON_REG').reduce((s, a) => s + a.balance, 0);
  const otherTotal = totalNetWorth - rrspTotal - tfsaTotal - nonRegTotal;

  const summaryCards = [
    {
      title: 'Net Worth', value: `$${totalNetWorth.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`,
      subtitle: accounts.length > 0 ? `${accounts.length} accounts` : 'Add accounts to see total',
      icon: <AccountBalanceIcon />, color: '#6C63FF',
    },
    {
      title: 'Annual Income', value: `$${totalIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`,
      subtitle: members.length > 0 ? `${members.length} member${members.length > 1 ? 's' : ''}` : 'Add income sources',
      icon: <TrendingUpIcon />, color: '#00D9A6',
    },
    {
      title: 'RRSP/RRIF', value: `$${rrspTotal.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`,
      subtitle: `TFSA: $${tfsaTotal.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`,
      icon: <ReceiptIcon />, color: '#FFB84D',
    },
    {
      title: 'Members', value: `${members.length}`,
      subtitle: household ? household.name : 'No household yet',
      icon: <PeopleIcon />, color: '#FF6B6B',
    },
  ];

  const quickActions = [
    { label: 'Manage Household', path: '/household' },
    { label: 'Add Accounts', path: '/accounts' },
    { label: 'Create Scenario', path: '/scenarios' },
    { label: 'Run Projection', path: '/projections' },
    { label: 'Tax Analytics', path: '/tax' },
    { label: 'Monte Carlo', path: '/simulations' },
  ];

  return (
    <Box>
      <Typography variant="h3" sx={{ mb: 1 }}>Dashboard</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {household ? `Welcome back — ${household.name}` : 'Welcome to RetireePlan. Start by setting up your household.'}
      </Typography>

      {!household && (
        <Alert severity="info" sx={{ mb: 3 }} action={<Button color="inherit" size="small" onClick={() => navigate('/household')}>Set Up Now</Button>}>
          Get started by setting up your household and adding members, income sources, and accounts.
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.title}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${card.color}18`, color: card.color, display: 'flex' }}>
                  {card.icon}
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">{card.title}</Typography>
                  <Typography variant="h4" sx={{ my: 0.5 }}>{card.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{card.subtitle}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Account breakdown */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%', minHeight: 300 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Portfolio Breakdown</Typography>
              {accounts.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>No accounts added yet</Typography>
                    <Button variant="outlined" size="small" onClick={() => navigate('/accounts')}>Add Accounts</Button>
                  </Box>
                </Box>
              ) : (
                <Box>
                  {[
                    { label: 'RRSP / RRIF', value: rrspTotal, color: '#6C63FF' },
                    { label: 'TFSA', value: tfsaTotal, color: '#00D9A6' },
                    { label: 'Non-Registered', value: nonRegTotal, color: '#FFB347' },
                    { label: 'Other', value: otherTotal, color: '#98FB98' },
                  ].filter((b) => b.value > 0).map((bar) => {
                    const pct = totalNetWorth > 0 ? (bar.value / totalNetWorth) * 100 : 0;
                    return (
                      <Box key={bar.label} sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">{bar.label}</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            ${bar.value.toLocaleString('en-CA', { maximumFractionDigits: 0 })} ({pct.toFixed(1)}%)
                          </Typography>
                        </Box>
                        <Box sx={{ bgcolor: 'background.default', borderRadius: 1, height: 12, overflow: 'hidden' }}>
                          <Box sx={{ width: `${pct}%`, bgcolor: bar.color, height: '100%', borderRadius: 1, transition: 'width 0.5s ease' }} />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick actions */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Quick Actions</Typography>
              <List dense disablePadding>
                {quickActions.map((action) => (
                  <ListItem
                    key={action.path}
                    disableGutters
                    secondaryAction={<ArrowForwardIcon fontSize="small" color="action" />}
                    sx={{ cursor: 'pointer', borderRadius: 1, px: 1, '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => navigate(action.path)}
                  >
                    <ListItemText primary={action.label} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
