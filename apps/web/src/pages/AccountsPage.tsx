import { useMemo, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Grid, IconButton, List, ListItem, ListItemText,
  ListItemSecondaryAction, Chip, CircularProgress, Alert, Divider, Tooltip, Stack,
  FormControl, InputLabel, Select, InputAdornment, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calculateContributionRoom } from '@retiree-plan/finance-engine';
import { useApi } from '../hooks/useApi';
import { calcAge } from '../utils/age';
import { AllocationDonut } from '../components/charts/AllocationDonut';

const ACCOUNT_TYPES = [
  { value: 'RRSP', label: 'RRSP – Registered Retirement Savings Plan' },
  { value: 'TFSA', label: 'TFSA – Tax-Free Savings Account' },
  { value: 'RRIF', label: 'RRIF – Registered Retirement Income Fund' },
  { value: 'RESP', label: 'RESP – Registered Education Savings Plan' },
  { value: 'LIRA', label: 'LIRA – Locked-In Retirement Account' },
  { value: 'LIF', label: 'LIF – Life Income Fund' },
  { value: 'NON_REG', label: 'Non-Registered Investment' },
  { value: 'PENSION', label: 'Pension Plan (DB or DC)' },
  { value: 'CASH', label: 'Cash / Savings Account' },
];

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  RRSP: '#6C63FF',
  TFSA: '#00D9A6',
  RRIF: '#FF6584',
  RESP: '#FFB347',
  LIRA: '#87CEEB',
  LIF: '#DDA0DD',
  NON_REG: '#98FB98',
  PENSION: '#FFA07A',
  CASH: '#B0C4DE',
};

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  annualContribution: number;
  /** User-supplied annual return rate for this account. Null = use scenario default. */
  estimatedReturnRate: number | null;
  equityPercent: number | null;
  fixedIncomePercent: number | null;
  alternativesPercent: number | null;
  cashPercent: number | null;
  householdId: string;
  ynabAccountId?: string | null;
  ynabAccountName?: string | null;
  brokerageAccountId?: string | null;
  brokerageProvider?: string | null;
  brokerageAccountName?: string | null;
}

interface YnabBudgetAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  onBudget: boolean;
}

interface BrokerageStatus {
  connected: boolean;
  provider: 'QUESTRADE' | 'WEALTHSIMPLE' | 'TD';
  lastSyncedAt?: string | null;
}

interface BrokerageAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

interface YnabStatus { connected: boolean; budgetId?: string; budgetName?: string; }

interface Household {
  id: string;
  name: string;
  members?: {
    id: string;
    name: string;
    dateOfBirth: string;
    retirementAge?: number | null;
    rrspContributionRoom?: number | null;
    tfsaContributionRoom?: number | null;
    priorYearIncome?: number | null;
  }[];
}

interface RealEstateProperty {
  id: string;
  name: string;
  propertyType: 'PRIMARY_RESIDENCE' | 'RENTAL' | 'VACATION';
  currentValue: number;
  purchasePrice: number;
  annualAppreciation: number;
  grossRentalIncome: number | null;
  rentalExpenses: number | null;
  sellAtAge: number | null;
  netProceedsPercent: number;
  householdId: string;
}

/** Map brokerage provider to a display-friendly label. */
const BROKERAGE_LABELS: Record<string, string> = {
  QUESTRADE:    'Questrade',
  WEALTHSIMPLE: 'Wealthsimple',
  TD:           'TD Bank',
};

const BROKERAGE_COLORS: Record<string, string> = {
  QUESTRADE:    '#e82c2c',
  WEALTHSIMPLE: '#00b0a0',
  TD:           '#1b6b32',
};

const PROPERTY_TYPES = [
  { value: 'PRIMARY_RESIDENCE', label: 'Primary Residence' },
  { value: 'RENTAL', label: 'Rental' },
  { value: 'VACATION', label: 'Vacation' },
];

const emptyForm = { name: '', type: 'RRSP', balance: '', annualContribution: '', estimatedReturnRate: '', currency: 'CAD', householdId: '', ynabAccountId: '', brokerageProvider: '', brokerageAccountId: '' };

export function AccountsPage() {
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [allocationEquity, setAllocationEquity] = useState<number | null>(null);
  const [allocationFixedIncome, setAllocationFixedIncome] = useState<number | null>(null);
  const [allocationAlternatives, setAllocationAlternatives] = useState<number | null>(null);
  const [allocationCash, setAllocationCash] = useState<number | null>(null);

  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<RealEstateProperty | null>(null);
  const [propertyError, setPropertyError] = useState('');
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    propertyType: 'PRIMARY_RESIDENCE' as RealEstateProperty['propertyType'],
    currentValue: '',
    purchasePrice: '',
    annualAppreciation: '3',
    grossRentalIncome: '',
    rentalExpenses: '',
    sellAtAge: '',
    netProceedsPercent: '100',
  });

  const computedReturn = allocationEquity != null
    ? (
      allocationEquity * 0.07 +
      (allocationFixedIncome ?? 0) * 0.035 +
      (allocationAlternatives ?? 0) * 0.055 +
      (allocationCash ?? 0) * 0.025
    ) / 100
    : null;
  const allocationValues = [allocationEquity, allocationFixedIncome, allocationAlternatives, allocationCash];
  const hasAnyAllocationInput = allocationValues.some((v) => v != null);
  const hasAllAllocationInput = allocationValues.every((v) => v != null);
  const allocationSumPercent = allocationValues.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const allocationIsValid = hasAllAllocationInput && Math.abs(allocationSumPercent - 100) <= 0.1;

  const { data: households } = useQuery<Household[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
  });
  const household = households?.[0];

  const { data: ynabStatus } = useQuery<YnabStatus>({
    queryKey: ['ynab-status'],
    queryFn: () => apiFetch('/ynab/status'),
    retry: false,
  });

  const { data: ynabAccounts } = useQuery<YnabBudgetAccount[]>({
    queryKey: ['ynab-accounts'],
    queryFn: () => apiFetch('/ynab/accounts'),
    enabled: ynabStatus?.connected === true && !!ynabStatus.budgetId,
    retry: false,
  });

  // Brokerage integrations
  const { data: brokerageStatuses = [] } = useQuery<BrokerageStatus[]>({
    queryKey: ['brokerage-status'],
    queryFn: () => apiFetch('/brokerage/status'),
    retry: false,
  });

  const connectedBrokerages = brokerageStatuses.filter((s) => s.connected);

  // Fetch accounts for the currently-selected brokerage provider (lazy, only when dialog is open)
  const [activeBrokerageProvider, setActiveBrokerageProvider] = useState('');
  const { data: brokerageAccounts, isFetching: brokerageAccountsFetching } = useQuery<BrokerageAccount[]>({
    queryKey: ['brokerage-accounts', activeBrokerageProvider],
    queryFn: () => apiFetch(`/brokerage/${activeBrokerageProvider.toLowerCase()}/accounts`),
    enabled: !!activeBrokerageProvider && activeBrokerageProvider !== 'TD',
    retry: false,
  });

  const { data: accounts, isLoading } = useQuery<Account[]>({
    queryKey: ['accounts', household?.id],
    queryFn: () => apiFetch(`/accounts/household/${household!.id}`),
    enabled: !!household?.id,
  });

  const { data: realEstate = [] } = useQuery<RealEstateProperty[]>({
    queryKey: ['real-estate', household?.id],
    queryFn: () => apiFetch(`/real-estate/household/${household!.id}`),
    enabled: !!household?.id,
  });

  const { data: scenarios } = useQuery<{ id: string; parameters: string }[]>({
    queryKey: ['scenarios', household?.id],
    queryFn: () => apiFetch(`/scenarios/household/${household!.id}`),
    enabled: !!household?.id,
  });

  const invalidateAccounts = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['households'] });
  };

  const invalidateRealEstate = () => {
    queryClient.invalidateQueries({ queryKey: ['real-estate'] });
  };

  const createAccount = useMutation({
    mutationFn: (data: any) => apiFetch('/accounts', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidateAccounts(); closeDialog(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateAccount = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiFetch(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { invalidateAccounts(); closeDialog(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => apiFetch(`/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAccounts(),
  });

  const createProperty = useMutation({
    mutationFn: (data: any) => apiFetch('/real-estate', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      invalidateRealEstate();
      closePropertyDialog();
    },
    onError: (e: Error) => setPropertyError(e.message),
  });

  const updateProperty = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiFetch(`/real-estate/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      invalidateRealEstate();
      closePropertyDialog();
    },
    onError: (e: Error) => setPropertyError(e.message),
  });

  const deleteProperty = useMutation({
    mutationFn: (id: string) => apiFetch(`/real-estate/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateRealEstate(),
  });

  const parseNullableNumber = (value: string): number | null => {
    if (value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const openDialog = (account?: Account) => {
    setError('');
    if (account) {
      setEditingAccount(account);
      const providerForDialog = account.brokerageProvider ?? '';
      setActiveBrokerageProvider(providerForDialog);
      setForm({
        name: account.name,
        type: account.type,
        balance: String(account.balance),
        annualContribution: String(account.annualContribution),
        estimatedReturnRate: account.estimatedReturnRate != null ? String(account.estimatedReturnRate * 100) : '',
        currency: account.currency,
        householdId: account.householdId,
        ynabAccountId: account.ynabAccountId ?? '',
        brokerageProvider: providerForDialog,
        brokerageAccountId: account.brokerageAccountId ?? '',
      });
      setAllocationEquity(account.equityPercent != null ? account.equityPercent * 100 : null);
      setAllocationFixedIncome(account.fixedIncomePercent != null ? account.fixedIncomePercent * 100 : null);
      setAllocationAlternatives(account.alternativesPercent != null ? account.alternativesPercent * 100 : null);
      setAllocationCash(account.cashPercent != null ? account.cashPercent * 100 : null);
    } else {
      setEditingAccount(null);
      setActiveBrokerageProvider('');
      setForm({ ...emptyForm, householdId: household?.id ?? '' });
      setAllocationEquity(null);
      setAllocationFixedIncome(null);
      setAllocationAlternatives(null);
      setAllocationCash(null);
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingAccount(null);
    setForm(emptyForm);
    setActiveBrokerageProvider('');
    setAllocationEquity(null);
    setAllocationFixedIncome(null);
    setAllocationAlternatives(null);
    setAllocationCash(null);
  };

  const openPropertyDialog = (property?: RealEstateProperty) => {
    setPropertyError('');
    if (property) {
      setEditingProperty(property);
      setPropertyForm({
        name: property.name,
        propertyType: property.propertyType,
        currentValue: String(property.currentValue),
        purchasePrice: String(property.purchasePrice),
        annualAppreciation: String(property.annualAppreciation * 100),
        grossRentalIncome: property.grossRentalIncome != null ? String(property.grossRentalIncome) : '',
        rentalExpenses: property.rentalExpenses != null ? String(property.rentalExpenses) : '',
        sellAtAge: property.sellAtAge != null ? String(property.sellAtAge) : '',
        netProceedsPercent: String(property.netProceedsPercent * 100),
      });
    } else {
      setEditingProperty(null);
      setPropertyForm({
        name: '',
        propertyType: 'PRIMARY_RESIDENCE',
        currentValue: '',
        purchasePrice: '',
        annualAppreciation: '3',
        grossRentalIncome: '',
        rentalExpenses: '',
        sellAtAge: '',
        netProceedsPercent: '100',
      });
    }
    setPropertyDialogOpen(true);
  };

  const closePropertyDialog = () => {
    setPropertyDialogOpen(false);
    setEditingProperty(null);
    setPropertyError('');
    setPropertyForm({
      name: '',
      propertyType: 'PRIMARY_RESIDENCE',
      currentValue: '',
      purchasePrice: '',
      annualAppreciation: '3',
      grossRentalIncome: '',
      rentalExpenses: '',
      sellAtAge: '',
      netProceedsPercent: '100',
    });
  };

  const handleSave = () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    const hasBrokerageBalance = form.brokerageAccountId && form.brokerageProvider !== 'TD';
    if (!form.balance && !form.ynabAccountId && !hasBrokerageBalance) { setError('Balance is required'); return; }

    const allocationParts = [allocationEquity, allocationFixedIncome, allocationAlternatives, allocationCash];
    const hasAnyAllocation = allocationParts.some((v) => v != null);
    const hasFullAllocation = allocationParts.every((v) => v != null);
    const allocationSum = allocationParts.reduce<number>((sum, value) => sum + (value ?? 0), 0);

    if (hasAnyAllocation && !hasFullAllocation) {
      setError('When setting asset allocation, provide all four values (Equity, Fixed Income, Alternatives, Cash).');
      return;
    }
    if (hasFullAllocation && allocationParts.some((v) => (v ?? 0) < 0 || (v ?? 0) > 100)) {
      setError('Each allocation value must be between 0 and 100.');
      return;
    }
    if (hasFullAllocation && Math.abs(allocationSum - 100) > 0.1) {
      setError('Asset allocation must sum to 100%.');
      return;
    }

    const selectedYnab = ynabAccounts?.find((a) => a.id === form.ynabAccountId);
    const selectedBrokerage = (brokerageAccounts ?? []).find((a) => a.id === form.brokerageAccountId);
    const payload = {
      name: form.name, type: form.type,
      balance: Number(form.balance) ||
        (selectedYnab?.balance ??
         selectedBrokerage?.balance ?? 0),
      annualContribution: Number(form.annualContribution || 0),
      estimatedReturnRate: form.estimatedReturnRate !== '' ? Number(form.estimatedReturnRate) / 100 : null,
      equityPercent: hasFullAllocation ? (allocationEquity ?? 0) / 100 : null,
      fixedIncomePercent: hasFullAllocation ? (allocationFixedIncome ?? 0) / 100 : null,
      alternativesPercent: hasFullAllocation ? (allocationAlternatives ?? 0) / 100 : null,
      cashPercent: hasFullAllocation ? (allocationCash ?? 0) / 100 : null,
      currency: form.currency,
      householdId: household?.id,
      ynabAccountId: form.ynabAccountId || null,
      ynabAccountName: selectedYnab?.name ?? null,
      brokerageAccountId:   form.brokerageAccountId || null,
      brokerageProvider:    form.brokerageProvider   || null,
      brokerageAccountName: selectedBrokerage?.name  ?? null,
    };
    if (editingAccount) {
      updateAccount.mutate({ id: editingAccount.id, data: payload });
    } else {
      createAccount.mutate(payload);
    }
  };

  const handleSaveProperty = () => {
    setPropertyError('');
    if (!household?.id) {
      setPropertyError('Please create a household before adding properties.');
      return;
    }
    if (!propertyForm.name.trim()) {
      setPropertyError('Property name is required.');
      return;
    }

    const currentValue = Number(propertyForm.currentValue);
    if (!Number.isFinite(currentValue) || currentValue <= 0) {
      setPropertyError('Current value must be greater than 0.');
      return;
    }

    const payload = {
      name: propertyForm.name,
      propertyType: propertyForm.propertyType,
      currentValue,
      purchasePrice: Number(propertyForm.purchasePrice || 0),
      annualAppreciation: Number(propertyForm.annualAppreciation || 0) / 100,
      grossRentalIncome: propertyForm.grossRentalIncome === '' ? null : Number(propertyForm.grossRentalIncome),
      rentalExpenses: propertyForm.rentalExpenses === '' ? null : Number(propertyForm.rentalExpenses),
      sellAtAge: propertyForm.sellAtAge === '' ? null : Number(propertyForm.sellAtAge),
      netProceedsPercent: Number(propertyForm.netProceedsPercent || 100) / 100,
      householdId: household.id,
    };

    if (editingProperty) {
      updateProperty.mutate({ id: editingProperty.id, data: payload });
    } else {
      createProperty.mutate(payload);
    }
  };

  // Group by type
  const byType = (accounts ?? []).reduce<Record<string, Account[]>>((acc, a) => {
    acc[a.type] = acc[a.type] ?? [];
    acc[a.type].push(a);
    return acc;
  }, {});

  const totalBalance = (accounts ?? []).reduce((s, a) => s + a.balance, 0);
  const totalContributions = (accounts ?? []).reduce((s, a) => s + a.annualContribution, 0);
  const totalRealEstateValue = realEstate.reduce((sum, property) => sum + property.currentValue, 0);

  const householdAllocation = useMemo(() => {
    const allocAccounts = (accounts ?? []).filter((a) => (
      a.equityPercent != null &&
      a.fixedIncomePercent != null &&
      a.alternativesPercent != null &&
      a.cashPercent != null &&
      a.balance > 0
    ));

    if (allocAccounts.length === 0) return null;

    const balanceTotal = allocAccounts.reduce((sum, account) => sum + account.balance, 0);
    if (balanceTotal <= 0) return null;

    return allocAccounts.reduce(
      (agg, account) => {
        const weight = account.balance / balanceTotal;
        return {
          equityPercent: agg.equityPercent + (account.equityPercent ?? 0) * weight,
          fixedIncomePercent: agg.fixedIncomePercent + (account.fixedIncomePercent ?? 0) * weight,
          alternativesPercent: agg.alternativesPercent + (account.alternativesPercent ?? 0) * weight,
          cashPercent: agg.cashPercent + (account.cashPercent ?? 0) * weight,
        };
      },
      { equityPercent: 0, fixedIncomePercent: 0, alternativesPercent: 0, cashPercent: 0 },
    );
  }, [accounts]);

  const rrspAnnualMax = 31560;

  const totalHouseholdRrspContributions = useMemo(
    () => (accounts ?? []).filter((a) => a.type === 'RRSP').reduce((s, a) => s + a.annualContribution, 0),
    [accounts],
  );
  const totalHouseholdTfsaContributions = useMemo(
    () => (accounts ?? []).filter((a) => a.type === 'TFSA').reduce((s, a) => s + a.annualContribution, 0),
    [accounts],
  );

  const memberRooms = useMemo(() => {
    const members = household?.members ?? [];
    if (members.length === 0) return [];

    const scenarioRetirementAge = (() => {
      const firstScenario = scenarios?.[0];
      if (!firstScenario) return 65;
      try {
        return JSON.parse(firstScenario.parameters).retirementAge ?? 65;
      } catch {
        return 65;
      }
    })();

    return members
      .filter((m) => m.rrspContributionRoom != null || m.tfsaContributionRoom != null)
      .map((m) => {
        try {
          const retirementAge = m.retirementAge ?? scenarioRetirementAge;
          const room = calculateContributionRoom({
            currentRrspRoom: m.rrspContributionRoom ?? 0,
            currentTfsaRoom: m.tfsaContributionRoom ?? 0,
            priorYearIncome: m.priorYearIncome ?? 0,
            currentAge: calcAge(m.dateOfBirth),
            retirementAge,
            dateOfBirth: m.dateOfBirth,
            annualRrspContribution: 0,
            annualTfsaContribution: 0,
          });
          const rrspFromPriorIncome = (m.priorYearIncome ?? 0) * 0.18;
          return { member: m, room, rrspFromPriorIncome };
        } catch (error) {
          console.error('Failed to calculate contribution room for member:', error);
          return null;
        }
      })
      .filter(Boolean) as Array<{
        member: NonNullable<NonNullable<typeof household>['members']>[number];
        room: ReturnType<typeof calculateContributionRoom>;
        rrspFromPriorIncome: number;
      }>;
  }, [household, scenarios]);

  if (isLoading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h3">Accounts</Typography>
          <Typography variant="body1" color="text.secondary">
            Track your RRSP, TFSA, RRIF, Non-Reg, and other investment accounts.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog()} disabled={!household}>
          Add Account
        </Button>
      </Box>

      {!household && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Please set up your household first before adding accounts.
        </Alert>
      )}

      {household && accounts && accounts.length > 0 && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card><CardContent>
                <Typography variant="overline" color="text.secondary">Total Balance</Typography>
                <Typography variant="h4">${totalBalance.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card><CardContent>
                <Typography variant="overline" color="text.secondary">Annual Contributions</Typography>
                <Typography variant="h4">${totalContributions.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card><CardContent>
                <Typography variant="overline" color="text.secondary">Accounts</Typography>
                <Typography variant="h4">{accounts.length}</Typography>
              </CardContent></Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card><CardContent>
                <Typography variant="overline" color="text.secondary">Account Types</Typography>
                <Typography variant="h4">{Object.keys(byType).length}</Typography>
              </CardContent></Card>
            </Grid>
          </Grid>

          {Object.entries(byType).map(([type, accs]) => (
            <Card key={type} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip label={type} size="small" sx={{ bgcolor: ACCOUNT_TYPE_COLORS[type] ?? '#999', color: '#000', fontWeight: 700 }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    {ACCOUNT_TYPES.find((t) => t.value === type)?.label.split(' – ')[1] ?? type}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                    ${accs.reduce((s, a) => s + a.balance, 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })} total
                  </Typography>
                </Box>
                <List dense disablePadding>
                  {accs.map((acc, i) => (
                    <Box key={acc.id}>
                      {i > 0 && <Divider />}
                      <ListItem disableGutters sx={{ py: 0.5 }}>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <span>{acc.name}</span>
                              {acc.ynabAccountId && (
                                <Tooltip title={`Synced from YNAB: ${acc.ynabAccountName ?? acc.ynabAccountId}`}>
                                  <Chip icon={<LinkIcon />} label="YNAB" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                </Tooltip>
                              )}
                              {acc.brokerageProvider && (
                                <Tooltip title={`Synced from ${BROKERAGE_LABELS[acc.brokerageProvider] ?? acc.brokerageProvider}: ${acc.brokerageAccountName ?? acc.brokerageAccountId}`}>
                                  <Chip
                                    icon={<LinkIcon />}
                                    label={BROKERAGE_LABELS[acc.brokerageProvider] ?? acc.brokerageProvider}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.65rem', borderColor: BROKERAGE_COLORS[acc.brokerageProvider] ?? undefined, color: BROKERAGE_COLORS[acc.brokerageProvider] ?? undefined }}
                                  />
                                </Tooltip>
                              )}
                            </Stack>
                          }
                          secondary={`Balance: $${acc.balance.toLocaleString('en-CA', { maximumFractionDigits: 0 })} ${acc.currency}${acc.annualContribution > 0 ? ` • Contributes $${acc.annualContribution.toLocaleString()}/yr` : ''}${acc.estimatedReturnRate != null ? ` • ${(acc.estimatedReturnRate * 100).toFixed(1)}% est. return` : ''}`}
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title="Edit">
                            <IconButton size="small" aria-label="Edit account" onClick={() => openDialog(acc)}><EditIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" aria-label="Delete account" onClick={() => deleteAccount.mutate(acc.id)}><DeleteIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                    </Box>
                  ))}
                </List>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {household && (!accounts || accounts.length === 0) && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <AccountBalanceIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>No accounts added</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add your investment and savings accounts to start planning.
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openDialog()}>
              Add Your First Account
            </Button>
          </CardContent>
        </Card>
      )}

      {household && (
        <Card sx={{ mt: 3, mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Household Asset Allocation</Typography>
            {householdAllocation ? (
              <AllocationDonut allocation={householdAllocation} />
            ) : (
              <Alert severity="info">
                Set allocation on individual accounts to see household-level allocation.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {household && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Real Estate Properties</Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openPropertyDialog()}>
                Add Property
              </Button>
            </Box>

            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">Total Property Value</Typography>
                <Typography variant="h5">
                  ${totalRealEstateValue.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                </Typography>
              </CardContent>
            </Card>

            {realEstate.length === 0 ? (
              <Alert severity="info">No properties added yet.</Alert>
            ) : (
              <Grid container spacing={2}>
                {realEstate.map((property) => (
                  <Grid item xs={12} md={6} key={property.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="subtitle1" fontWeight={600}>{property.name}</Typography>
                          <Chip
                            size="small"
                            label={PROPERTY_TYPES.find((t) => t.value === property.propertyType)?.label ?? property.propertyType}
                          />
                          <Box sx={{ ml: 'auto' }}>
                            <Tooltip title="Edit property">
                              <IconButton size="small" onClick={() => openPropertyDialog(property)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete property">
                              <IconButton size="small" onClick={() => deleteProperty.mutate(property.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>

                        <Stack spacing={0.5}>
                          <Typography variant="body2">
                            Current value: <strong>${property.currentValue.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</strong>
                          </Typography>
                          <Typography variant="body2">
                            Appreciation: <strong>{(property.annualAppreciation * 100).toFixed(2)}%/yr</strong>
                          </Typography>
                          {property.propertyType === 'RENTAL' && (
                            <Typography variant="body2">
                              Rental net cash flow: <strong>${((property.grossRentalIncome ?? 0) - (property.rentalExpenses ?? 0)).toLocaleString('en-CA', { maximumFractionDigits: 0 })}/yr</strong>
                              {' '}({`$${(property.grossRentalIncome ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`}
                              {' income - '}
                              {`$${(property.rentalExpenses ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`}
                              {' expenses)'}
                            </Typography>
                          )}
                          {property.sellAtAge != null && (
                            <Typography variant="body2">
                              Downsizing plan: sell at age <strong>{property.sellAtAge}</strong> with <strong>{(property.netProceedsPercent * 100).toFixed(0)}%</strong> net proceeds.
                            </Typography>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contribution Room Tracker */}
      {household && accounts && accounts.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Contribution Room Tracker</Typography>
            {memberRooms.length === 0 ? (
              <Alert severity="info">
                Enter your RRSP and TFSA contribution room in Household {'->'}  Member details to see projections.
              </Alert>
            ) : (
              <>
                {memberRooms.map(({ member, room, rrspFromPriorIncome }, idx) => (
                  <Box key={member.id} sx={{ mb: memberRooms.length > 1 && idx < memberRooms.length - 1 ? 3 : 0 }}>
                    {memberRooms.length > 1 && (
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'primary.main' }}>
                        {member.name}
                      </Typography>
                    )}
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>RRSP</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Metric</TableCell>
                                <TableCell align="right">Value</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              <TableRow>
                                <TableCell>Current Room</TableCell>
                                <TableCell align="right">${room.rrsp.currentRoom.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>18% of Prior Income</TableCell>
                                <TableCell align="right">${rrspFromPriorIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Annual Max (2024)</TableCell>
                                <TableCell align="right">${rrspAnnualMax.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>New Room This Year</TableCell>
                                <TableCell align="right">${room.rrsp.annualNewRoom.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>
                                  Max Room at Retirement
                                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                                    Before contributions
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">${room.rrsp.projectedRoomAtRetirement.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                        {room.rrsp.currentRoom < 0 && (
                          <Alert severity="error" sx={{ mt: 1 }}>
                            Over-contribution alert: RRSP room is negative. You may be subject to penalty tax.
                          </Alert>
                        )}
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>TFSA</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Metric</TableCell>
                                <TableCell align="right">Value</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              <TableRow>
                                <TableCell>Current Room</TableCell>
                                <TableCell align="right">${room.tfsa.currentRoom.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Annual Limit (2024)</TableCell>
                                <TableCell align="right">$7,000</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Cumulative Room Since 18</TableCell>
                                <TableCell align="right">${room.tfsa.totalCumulativeRoom.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>
                                  Max Room at Retirement
                                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                                    Before contributions
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">${room.tfsa.projectedRoomAtRetirement.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                        {room.tfsa.currentRoom < 0 && (
                          <Alert severity="error" sx={{ mt: 1 }}>
                            Over-contribution alert: TFSA room is negative.
                          </Alert>
                        )}
                      </Grid>
                    </Grid>
                  </Box>
                ))}
                {(totalHouseholdRrspContributions > 0 || totalHouseholdTfsaContributions > 0) && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Annual contributions across all accounts: </strong>
                      {totalHouseholdRrspContributions > 0 && (
                        <>RRSP ${totalHouseholdRrspContributions.toLocaleString('en-CA', { maximumFractionDigits: 0 })}/yr</>
                      )}
                      {totalHouseholdRrspContributions > 0 && totalHouseholdTfsaContributions > 0 && ' · '}
                      {totalHouseholdTfsaContributions > 0 && (
                        <>TFSA ${totalHouseholdTfsaContributions.toLocaleString('en-CA', { maximumFractionDigits: 0 })}/yr</>
                      )}
                      . These reduce your available room annually. The projections above show maximum room
                      available at retirement before accounting for contributions.
                    </Typography>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} maxWidth="xs" fullWidth onClose={closeDialog}>
        <DialogTitle>{editingAccount ? 'Edit Account' : 'Add Account'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Account Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth placeholder="e.g. TD RRSP" />
          <TextField label="Account Type" select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} fullWidth>
            {ACCOUNT_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </TextField>
          <TextField
            label="Current Balance ($)"
            type="number"
            value={form.balance}
            onChange={(e) => setForm({ ...form, balance: e.target.value })}
            fullWidth
            InputProps={{ readOnly: !!form.ynabAccountId || (!!form.brokerageAccountId && form.brokerageProvider !== 'TD') }}
            helperText={
              form.ynabAccountId ? 'Balance is synced from YNAB — read-only' :
              (form.brokerageAccountId && form.brokerageProvider !== 'TD') ? `Balance is synced from ${BROKERAGE_LABELS[form.brokerageProvider] ?? form.brokerageProvider} — read-only` :
              undefined
            }
            sx={(!!form.ynabAccountId || (!!form.brokerageAccountId && form.brokerageProvider !== 'TD')) ? { '& .MuiOutlinedInput-root': { bgcolor: 'action.disabledBackground' } } : undefined}
          />
          <TextField label="Annual Contribution ($)" type="number" value={form.annualContribution} onChange={(e) => setForm({ ...form, annualContribution: e.target.value })} fullWidth helperText={form.type === 'RRSP' ? 'Include employer matching in this total — both your contribution and the employer match use your RRSP room' : 'How much you contribute per year'} />
          <TextField
            label="Estimated Annual Return (%)"
            type="number"
            value={form.estimatedReturnRate}
            onChange={(e) => setForm({ ...form, estimatedReturnRate: e.target.value })}
            fullWidth
            placeholder="Leave blank to use scenario default"
            helperText={
              form.type === 'CASH'
                ? 'Interest rate for this savings/chequing account (e.g. 3.5 for 3.5%)'
                : 'Override the scenario’s expected return for this account (e.g. 6 for 6%). Leave blank to use the scenario default.'
            }
            inputProps={{ min: 0, max: 30, step: 0.1 }}
            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
          />

          <Divider />
          <Typography variant="subtitle2">Asset Allocation (optional)</Typography>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <TextField
                label="Equity %"
                type="number"
                fullWidth
                value={allocationEquity ?? ''}
                onChange={(e) => setAllocationEquity(parseNullableNumber(e.target.value))}
                inputProps={{ min: 0, max: 100, step: 1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Fixed Income %"
                type="number"
                fullWidth
                value={allocationFixedIncome ?? ''}
                onChange={(e) => setAllocationFixedIncome(parseNullableNumber(e.target.value))}
                inputProps={{ min: 0, max: 100, step: 1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Alternatives %"
                type="number"
                fullWidth
                value={allocationAlternatives ?? ''}
                onChange={(e) => setAllocationAlternatives(parseNullableNumber(e.target.value))}
                inputProps={{ min: 0, max: 100, step: 1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Cash %"
                type="number"
                fullWidth
                value={allocationCash ?? ''}
                onChange={(e) => setAllocationCash(parseNullableNumber(e.target.value))}
                inputProps={{ min: 0, max: 100, step: 1 }}
              />
            </Grid>
          </Grid>

          {hasAnyAllocationInput && (
            <Alert severity={allocationIsValid ? 'success' : 'warning'}>
              Allocation total: {allocationSumPercent.toFixed(1)}%. Set all 4 fields and ensure they sum to 100%.
              {computedReturn != null && hasAllAllocationInput && allocationIsValid
                ? ` Expected return: ${(computedReturn * 100).toFixed(2)}%`
                : ''}
            </Alert>
          )}

          <TextField label="Currency" select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} fullWidth>
            <MenuItem value="CAD">CAD – Canadian Dollar</MenuItem>
            <MenuItem value="USD">USD – US Dollar</MenuItem>
          </TextField>
          {ynabStatus?.connected && ynabStatus.budgetId && (
            <FormControl fullWidth>
              <InputLabel>Link to YNAB Account (optional)</InputLabel>
              <Select
                value={form.ynabAccountId}
                label="Link to YNAB Account (optional)"
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const ynabAcc = ynabAccounts?.find((a) => a.id === selectedId);
                  setForm({
                    ...form,
                    ynabAccountId: selectedId,
                    // auto-fill balance from YNAB; clear when unlinking
                    balance: ynabAcc ? String(ynabAcc.balance) : '',
                  });
                }}
              >
                <MenuItem value=""><em>Not linked</em></MenuItem>
                {(ynabAccounts ?? []).map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    <Stack direction="row" justifyContent="space-between" width="100%" alignItems="center">
                      <span>{a.name}</span>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        ${a.balance.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                      </Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {ynabStatus?.connected && !ynabStatus.budgetId && (
            <Alert severity="info" sx={{ py: 0.5 }}>Select a budget in Integrations to link YNAB accounts.</Alert>
          )}
          {!ynabStatus?.connected && (
            <Alert severity="info" sx={{ py: 0.5 }}>Connect YNAB in Integrations to sync account balances automatically.</Alert>
          )}
          {/* ── Brokerage linking ─────────────────────── */}
          {connectedBrokerages.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Link to Brokerage Account (optional)</InputLabel>
              <Select
                value={form.brokerageProvider}
                label="Link to Brokerage Account (optional)"
                onChange={(e) => {
                  const provider = e.target.value;
                  setActiveBrokerageProvider(provider);
                  setForm({ ...form, brokerageProvider: provider, brokerageAccountId: '', balance: '' });
                }}
              >
                <MenuItem value=""><em>Not linked</em></MenuItem>
                {connectedBrokerages.map((s) => (
                  <MenuItem key={s.provider} value={s.provider}>
                    {BROKERAGE_LABELS[s.provider] ?? s.provider}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {form.brokerageProvider && form.brokerageProvider !== 'TD' && (
            <FormControl fullWidth>
              <InputLabel>Select Account</InputLabel>
              <Select
                value={form.brokerageAccountId}
                label="Select Account"
                disabled={brokerageAccountsFetching}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const brokAcc = (brokerageAccounts ?? []).find((a) => a.id === selectedId);
                  setForm({
                    ...form,
                    brokerageAccountId: selectedId,
                    balance: brokAcc ? String(brokAcc.balance) : '',
                  });
                }}
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {(brokerageAccounts ?? []).map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    <Stack direction="row" justifyContent="space-between" width="100%" alignItems="center">
                      <span>{a.name}</span>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        ${a.balance.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                      </Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {form.brokerageProvider === 'TD' && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              TD does not offer a public API. Balance will not be synced automatically — update it manually as needed.
            </Alert>
          )}
          {connectedBrokerages.length === 0 && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              Connect Questrade, Wealthsimple, or TD in Integrations to link and sync brokerage accounts.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={createAccount.isPending || updateAccount.isPending}>
            {editingAccount ? 'Update' : 'Add Account'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={propertyDialogOpen} maxWidth="sm" fullWidth onClose={closePropertyDialog}>
        <DialogTitle>{editingProperty ? 'Edit Property' : 'Add Property'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {propertyError && <Alert severity="error">{propertyError}</Alert>}

          <TextField
            label="Property Name"
            value={propertyForm.name}
            onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
            fullWidth
          />

          <TextField
            label="Property Type"
            select
            value={propertyForm.propertyType}
            onChange={(e) => setPropertyForm({ ...propertyForm, propertyType: e.target.value as RealEstateProperty['propertyType'] })}
            fullWidth
          >
            {PROPERTY_TYPES.map((type) => (
              <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
            ))}
          </TextField>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Current Value ($)"
                type="number"
                fullWidth
                value={propertyForm.currentValue}
                onChange={(e) => setPropertyForm({ ...propertyForm, currentValue: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Purchase Price ($)"
                type="number"
                fullWidth
                value={propertyForm.purchasePrice}
                onChange={(e) => setPropertyForm({ ...propertyForm, purchasePrice: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Annual Appreciation (%)"
                type="number"
                fullWidth
                value={propertyForm.annualAppreciation}
                onChange={(e) => setPropertyForm({ ...propertyForm, annualAppreciation: e.target.value })}
                inputProps={{ min: -20, max: 30, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Net Proceeds (%)"
                type="number"
                fullWidth
                value={propertyForm.netProceedsPercent}
                onChange={(e) => setPropertyForm({ ...propertyForm, netProceedsPercent: e.target.value })}
                inputProps={{ min: 0, max: 100, step: 1 }}
                helperText="Percent of sale value you keep after costs"
              />
            </Grid>
          </Grid>

          {propertyForm.propertyType === 'RENTAL' && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Gross Rental Income ($/yr)"
                  type="number"
                  fullWidth
                  value={propertyForm.grossRentalIncome}
                  onChange={(e) => setPropertyForm({ ...propertyForm, grossRentalIncome: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Rental Expenses ($/yr)"
                  type="number"
                  fullWidth
                  value={propertyForm.rentalExpenses}
                  onChange={(e) => setPropertyForm({ ...propertyForm, rentalExpenses: e.target.value })}
                />
              </Grid>
            </Grid>
          )}

          <TextField
            label="Sell At Age (optional)"
            type="number"
            fullWidth
            value={propertyForm.sellAtAge}
            onChange={(e) => setPropertyForm({ ...propertyForm, sellAtAge: e.target.value })}
            helperText="Set this to model downsizing or sale proceeds"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closePropertyDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveProperty}
            disabled={createProperty.isPending || updateProperty.isPending}
          >
            {editingProperty ? 'Update' : 'Add Property'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
