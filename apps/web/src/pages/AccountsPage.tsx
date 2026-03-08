import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Grid, IconButton, List, ListItem, ListItemText,
  ListItemSecondaryAction, Chip, CircularProgress, Alert, Divider, Tooltip, Stack,
  FormControl, InputLabel, Select, InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';

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

interface Household { id: string; name: string; }

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

const emptyForm = { name: '', type: 'RRSP', balance: '', annualContribution: '', estimatedReturnRate: '', currency: 'CAD', householdId: '', ynabAccountId: '', brokerageProvider: '', brokerageAccountId: '' };

export function AccountsPage() {
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

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

  const invalidateAccounts = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['households'] });
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
    } else {
      setEditingAccount(null);
      setActiveBrokerageProvider('');
      setForm({ ...emptyForm, householdId: household?.id ?? '' });
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingAccount(null);
    setForm(emptyForm);
    setActiveBrokerageProvider('');
  };

  const handleSave = () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    const hasBrokerageBalance = form.brokerageAccountId && form.brokerageProvider !== 'TD';
    if (!form.balance && !form.ynabAccountId && !hasBrokerageBalance) { setError('Balance is required'); return; }
    const selectedYnab = ynabAccounts?.find((a) => a.id === form.ynabAccountId);
    const selectedBrokerage = (brokerageAccounts ?? []).find((a) => a.id === form.brokerageAccountId);
    const payload = {
      name: form.name, type: form.type,
      balance: Number(form.balance) ||
        (selectedYnab?.balance ??
         selectedBrokerage?.balance ?? 0),
      annualContribution: Number(form.annualContribution || 0),
      estimatedReturnRate: form.estimatedReturnRate !== '' ? Number(form.estimatedReturnRate) / 100 : null,
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

  // Group by type
  const byType = (accounts ?? []).reduce<Record<string, Account[]>>((acc, a) => {
    acc[a.type] = acc[a.type] ?? [];
    acc[a.type].push(a);
    return acc;
  }, {});

  const totalBalance = (accounts ?? []).reduce((s, a) => s + a.balance, 0);
  const totalContributions = (accounts ?? []).reduce((s, a) => s + a.annualContribution, 0);

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
          <TextField label="Annual Contribution ($)" type="number" value={form.annualContribution} onChange={(e) => setForm({ ...form, annualContribution: e.target.value })} fullWidth helperText="How much you contribute per year" />
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
    </Box>
  );
}
