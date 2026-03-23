import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Stack,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Link,
  Checkbox,
  FormControlLabel,
  LinearProgress,
} from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import SyncIcon from '@mui/icons-material/Sync';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyIcon from '@mui/icons-material/Key';
import EditIcon from '@mui/icons-material/Edit';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────

interface YnabStatus {
  connected: boolean;
  budgetId?: string;
  budgetName?: string;
  lastSyncedAt?: string;
}

interface Budget {
  id: string;
  name: string;
}

interface YnabCategory {
  id: string;
  name: string;
  groupName: string;
  budgeted: number;
  activity: number;
}

interface CategoryMapping {
  id: string;
  ynabCategoryId: string;
  ynabCategoryName: string;
  localCategory: string;
  startAge?: number | null;
  endAge?: number | null;
  householdId: string;
}

interface Household {
  id: string;
  name: string;
}

interface BrokerageStatus {
  connected: boolean;
  provider: 'QUESTRADE' | 'WEALTHSIMPLE' | 'TD';
  lastSyncedAt?: string | null;
}

// ── Import preview types ──────────────────────────────────────────────────────

interface OFXPreviewAccount {
  accountId: string;
  bankId?: string;
  accountType: string;
  localAccountType: string;
  balance: number;
  currency: string;
  institution?: string;
  description?: string;
  matchedLocalAccount: { id: string; name: string } | null;
  action: 'create' | 'update';
}

interface OFXPreviewResult {
  accounts: OFXPreviewAccount[];
}

interface MonarchExpensePreview {
  category: string;
  monthlyAvg: number;
  annualAmount: number;
}

interface MonarchPreviewResult {
  expenses: MonarchExpensePreview[];
  totalCategories: number;
}

// ── Static config for each brokerage integration ──────────────────────────────

const BROKERAGE_CONFIG = [
  {
    provider: 'QUESTRADE'    as const,
    name:     'Questrade',
    subheader: 'Sync account balances from your Questrade brokerage accounts',
    tokenLabel: 'Questrade API Refresh Token',
    tokenInstructions: (
      <>
        Generate a personal API token in Questrade under{' '}
        <strong>Account → Apps {'&'} Platforms → Personal API Access</strong>.
        Copy the refresh token and paste it here. The token is stored encrypted on the server.
      </>
    ),
    tokenLink: 'https://www.questrade.com/api/home',
    tokenLinkText: 'Questrade Developer Portal',
    hasApi: true,
    apiNote: null as string | null,
  },
  {
    provider: 'WEALTHSIMPLE' as const,
    name:     'Wealthsimple',
    subheader: 'Sync Wealthsimple cash and investment account balances',
    tokenLabel: 'Wealthsimple Bearer Token',
    tokenInstructions: (
      <>
        Obtain your Bearer token by signing into{' '}
        <a href="https://my.wealthsimple.com" target="_blank" rel="noopener">my.wealthsimple.com</a>, opening
        browser DevTools (F12), going to the <strong>Network</strong> tab, then copying the{' '}
        <code>Authorization: Bearer</code> header value from any API request.
      </>
    ),
    tokenLink: 'https://my.wealthsimple.com',
    tokenLinkText: 'Sign in to Wealthsimple',
    hasApi: true,
    apiNote: 'Wealthsimple does not offer a public developer API. This integration relies on their internal API, which may change without notice.',
  },
  {
    provider: 'TD'           as const,
    name:     'TD Bank',
    subheader: 'Tag your TD accounts for organisation — balances must be updated manually',
    tokenLabel: '',
    tokenInstructions: null as React.ReactNode,
    tokenLink: 'https://easyweb.td.com',
    tokenLinkText: 'TD EasyWeb',
    hasApi: false,
    apiNote: 'TD does not offer a public consumer API. Connecting lets you tag accounts as TD so they are easily identified. Update balances manually from the Accounts page.',
  },
] as const;

// ── Local expense categories ──────────────────────────────────────────────────

const LOCAL_CATEGORIES = [
  // Living Expenses
  'Housing',
  'Food',
  'Transportation',
  'Healthcare',
  'Entertainment',
  'Clothing',
  'Education',
  'Travel',
  'Insurance',
  'Utilities',
  'Personal Care',
  'Subscriptions',
  'Savings',
  'Gifts',
  'Charitable',
  'Other',
  // Debt Payments
  'Mortgage',
  'Car Loan',
  'Student Loan',
  'Government Loan',
  'Line of Credit',
  'Other Debt',
];

// ── Component ─────────────────────────────────────────────────────────────────

export function IntegrationsPage() {
  const { apiFetch } = useApi();
  const { token } = useAuth();
  const qc = useQueryClient();

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number } | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenError, setTokenError] = useState('');

  // Local state for in-progress age edits keyed by ynabCategoryId
  const [ageEdits, setAgeEdits] = useState<Record<string, { startAge: string; endAge: string }>>({});

  // Brokerage dialog state
  const [brokDialog, setBrokDialog] = useState<{
    provider: 'QUESTRADE' | 'WEALTHSIMPLE' | 'TD';
    token: string;
    visible: boolean;
    error: string;
  } | null>(null);
  const [brokSyncResults, setBrokSyncResults] = useState<Record<string, number>>({});

  // ── Import state ────────────────────────────────────────────────────────────
  const ofxInputRef  = useRef<HTMLInputElement>(null);
  const wsInputRef   = useRef<HTMLInputElement>(null);
  const monInputRef  = useRef<HTMLInputElement>(null);

  const [ofxPreview,     setOfxPreview]     = useState<OFXPreviewResult | null>(null);
  const [ofxSkip,        setOfxSkip]        = useState<Record<string, boolean>>({});
  const [ofxImportDone,  setOfxImportDone]  = useState<{ created: number; updated: number } | null>(null);

  const [wsPreview,      setWsPreview]      = useState<OFXPreviewResult | null>(null);
  const [wsSkip,         setWsSkip]         = useState<Record<string, boolean>>({});
  const [wsImportDone,   setWsImportDone]   = useState<{ created: number; updated: number } | null>(null);

  const [monarchPreview,    setMonarchPreview]    = useState<MonarchPreviewResult | null>(null);
  const [monarchSkip,       setMonarchSkip]       = useState<Record<string, boolean>>({});
  const [monarchImportDone, setMonarchImportDone] = useState<{ created: number } | null>(null);

  const [positionsSyncResult, setPositionsSyncResult] = useState<{ synced: number } | null>(null);

  // ── File upload helper (bypasses apiFetch's hard-coded Content-Type) ────────
  const apiUpload = async <T = unknown>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error((err as any).message || `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  };

  const { data: status, isLoading: statusLoading } = useQuery<YnabStatus>({
    queryKey: ['ynab-status'],
    queryFn: () => apiFetch('/ynab/status'),
    refetchInterval: 30_000,
  });

  const { data: households } = useQuery<Household[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
  });

  const householdId = households?.[0]?.id ?? '';

  const { data: budgets, isLoading: budgetsLoading, isError: budgetsError, error: budgetsErrorObj } = useQuery<Budget[]>({
    queryKey: ['ynab-budgets'],
    queryFn: () => apiFetch('/ynab/budgets'),
    enabled: status?.connected === true,
    retry: false,
  });

  const { data: ynabCategories, isLoading: categoriesLoading, isError: categoriesError, error: categoriesErrorObj } = useQuery<YnabCategory[]>({
    queryKey: ['ynab-categories'],
    queryFn: () => apiFetch('/ynab/categories'),
    enabled: status?.connected === true && !!status.budgetId,
    retry: false,
  });

  const { data: mappings } = useQuery<CategoryMapping[]>({
    queryKey: ['ynab-mappings', householdId],
    queryFn: () => apiFetch(`/ynab/mappings?householdId=${householdId}`),
    enabled: !!householdId && status?.connected === true,
  });

  const { data: brokerageStatuses = [] } = useQuery<BrokerageStatus[]>({
    queryKey: ['brokerage-status'],
    queryFn: () => apiFetch('/brokerage/status'),
    refetchInterval: 30_000,
  });

  // Seed ageEdits from server data whenever mappings are loaded/refreshed
  useEffect(() => {
    if (!mappings) return;
    setAgeEdits((prev) => {
      const next = { ...prev };
      for (const m of mappings) {
        if (!(m.ynabCategoryId in next)) {
          next[m.ynabCategoryId] = {
            startAge: m.startAge?.toString() ?? '',
            endAge:   m.endAge?.toString()   ?? '',
          };
        }
      }
      return next;
    });
  }, [mappings]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveTokenMutation = useMutation({
    mutationFn: (token: string) =>
      apiFetch('/ynab/token', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ynab-status'] });
      qc.invalidateQueries({ queryKey: ['ynab-budgets'] });
      qc.invalidateQueries({ queryKey: ['ynab-categories'] });
      setTokenDialogOpen(false);
      setTokenInput('');
    },
    onError: () => setTokenError('Failed to save token. Please check it is valid.'),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiFetch('/ynab/disconnect', { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ynab-status'] });
      qc.invalidateQueries({ queryKey: ['ynab-budgets'] });
      qc.invalidateQueries({ queryKey: ['ynab-categories'] });
      qc.invalidateQueries({ queryKey: ['ynab-mappings'] });
    },
  });

  const selectBudgetMutation = useMutation({
    mutationFn: (budgetId: string) =>
      apiFetch(`/ynab/budgets/${budgetId}/select`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ynab-status'] });
      qc.invalidateQueries({ queryKey: ['ynab-categories'] });
      setBudgetDialogOpen(false);
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => apiFetch<{ synced: number; skipped: number }>('/ynab/sync', {
      method: 'POST',
      body: JSON.stringify({ householdId }),
    }),
    onSuccess: (data) => {
      setSyncResult(data);
      qc.invalidateQueries({ queryKey: ['ynab-status'] });
    },
  });

  const upsertMappingMutation = useMutation({
    mutationFn: ({
      ynabCategoryId,
      ynabCategoryName,
      localCategory,
      startAge,
      endAge,
    }: {
      ynabCategoryId: string;
      ynabCategoryName: string;
      localCategory: string;
      startAge?: number | null;
      endAge?: number | null;
    }) =>
      apiFetch('/ynab/mappings', {
        method: 'POST',
        body: JSON.stringify({ householdId, ynabCategoryId, ynabCategoryName, localCategory, startAge, endAge }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ynab-mappings'] }),
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/ynab/mappings/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ynab-mappings'] }),
  });

  const connectBrokerageMutation = useMutation({
    mutationFn: ({ provider, token }: { provider: string; token?: string }) =>
      apiFetch(`/brokerage/${provider.toLowerCase()}/connect`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brokerage-status'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      setBrokDialog(null);
    },
    onError: () =>
      setBrokDialog((prev) => prev ? { ...prev, error: 'Failed to connect. Please check your token and try again.' } : prev),
  });

  const disconnectBrokerageMutation = useMutation({
    mutationFn: (provider: string) =>
      apiFetch(`/brokerage/${provider.toLowerCase()}/disconnect`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brokerage-status'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const syncBrokerageMutation = useMutation({
    mutationFn: ({ provider }: { provider: string }) =>
      apiFetch<{ synced: number }>(`/brokerage/${provider.toLowerCase()}/sync`, {
        method: 'POST',
        body: JSON.stringify({ householdId }),
      }),
    onSuccess: (data, { provider }) => {
      setBrokSyncResults((prev) => ({ ...prev, [provider]: data.synced }));
      qc.invalidateQueries({ queryKey: ['brokerage-status'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  // ── Import mutations ──────────────────────────────────────────────────────

  const ofxPreviewMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('householdId', householdId);
      return apiUpload<OFXPreviewResult>('/import/ofx/preview', fd);
    },
    onSuccess: (data) => {
      setOfxPreview(data);
      setOfxSkip({});
    },
  });

  const ofxApplyMutation = useMutation({
    mutationFn: () => {
      const accounts = (ofxPreview?.accounts ?? []).map((a) => ({
        accountId:            a.accountId,
        localAccountType:     a.localAccountType,
        balance:              a.balance,
        currency:             a.currency,
        description:          a.description,
        institution:          a.institution,
        matchedLocalAccountId: a.matchedLocalAccount?.id ?? null,
        skip:                 !!(ofxSkip[a.accountId]),
      }));
      return apiFetch<{ created: number; updated: number }>('/import/ofx/apply', {
        method: 'POST',
        body: JSON.stringify({ householdId, accounts }),
      });
    },
    onSuccess: (data) => {
      setOfxImportDone(data);
      setOfxPreview(null);
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const wsPreviewMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('householdId', householdId);
      return apiUpload<OFXPreviewResult>('/import/csv/wealthsimple/preview', fd);
    },
    onSuccess: (data) => {
      setWsPreview(data);
      setWsSkip({});
    },
  });

  const wsApplyMutation = useMutation({
    mutationFn: () => {
      const accounts = (wsPreview?.accounts ?? []).map((a) => ({
        accountId:            a.accountId,
        localAccountType:     a.localAccountType,
        balance:              a.balance,
        currency:             a.currency,
        description:          a.description,
        institution:          a.institution,
        matchedLocalAccountId: a.matchedLocalAccount?.id ?? null,
        skip:                 !!(wsSkip[a.accountId]),
      }));
      return apiFetch<{ created: number; updated: number }>('/import/csv/wealthsimple/apply', {
        method: 'POST',
        body: JSON.stringify({ householdId, accounts }),
      });
    },
    onSuccess: (data) => {
      setWsImportDone(data);
      setWsPreview(null);
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const monarchPreviewMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('householdId', householdId);
      return apiUpload<MonarchPreviewResult>('/import/csv/monarch/preview', fd);
    },
    onSuccess: (data) => {
      setMonarchPreview(data);
      setMonarchSkip({});
    },
  });

  const monarchApplyMutation = useMutation({
    mutationFn: () => {
      const expenses = (monarchPreview?.expenses ?? [])
        .filter((e) => !monarchSkip[e.category])
        .map(({ category, annualAmount }) => ({ category, annualAmount }));
      return apiFetch<{ created: number }>('/import/csv/monarch/apply', {
        method: 'POST',
        body: JSON.stringify({ householdId, expenses }),
      });
    },
    onSuccess: (data) => {
      setMonarchImportDone(data);
      setMonarchPreview(null);
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const syncPositionsMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ synced: number; provider: string }>('/brokerage/questrade/sync-positions', {
        method: 'POST',
        body: JSON.stringify({ householdId }),
      }),
    onSuccess: (data) => {
      setPositionsSyncResult({ synced: data.synced });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['brokerage-status'] });
    },
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getMappingForCategory = (ynabCategoryId: string) =>
    mappings?.find((m) => m.ynabCategoryId === ynabCategoryId);

  const getBrokerageStatus = (provider: string) =>
    brokerageStatuses.find((s) => s.provider === provider);

  const openTokenDialog = () => {
    setTokenInput('');
    setTokenError('');
    setTokenVisible(false);
    setTokenDialogOpen(true);
  };

  const handleSaveToken = () => {
    if (!tokenInput.trim()) {
      setTokenError('Please enter a token.');
      return;
    }
    saveTokenMutation.mutate(tokenInput.trim());
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Integrations
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Connect your financial accounts to automatically populate your retirement plan. Supported integrations:
        YNAB budgeting, Questrade (balances + positions), Wealthsimple (balance sync + CSV import), and
        universal OFX/QFX file import for RBC, TD, BMO, Scotiabank, CIBC, and all Canadian brokerages.
      </Typography>

      {syncResult && (
        <Alert severity="info" onClose={() => setSyncResult(null)} sx={{ mt: 2, mb: 2 }}>
          Sync complete — {syncResult.synced} categories imported, {syncResult.skipped} skipped (no mapping).
        </Alert>
      )}

      {/* ── YNAB Connection Card ─────────────────────────────────────── */}
      <Card sx={{ mt: 3 }}>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" fontWeight={600}>
                YNAB (You Need A Budget)
              </Typography>
              {statusLoading ? (
                <CircularProgress size={16} />
              ) : status?.connected ? (
                <Chip label="Connected" color="success" size="small" />
              ) : (
                <Chip label="Not connected" variant="outlined" size="small" />
              )}
            </Box>
          }
          subheader="Sync budget categories and transaction totals into your expense plan"
        />
        <Divider />
        <CardContent>
          {!status?.connected ? (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Enter your YNAB{' '}
                <Link
                  href="https://app.youneedabudget.com/settings/developer"
                  target="_blank"
                  rel="noopener"
                >
                  Personal Access Token
                </Link>
                . You can generate one in YNAB → <strong>Account Settings → Developer Settings</strong>.
                The token is stored securely on the server and never exposed to the browser again after saving.
              </Typography>
              <Button
                variant="contained"
                startIcon={<KeyIcon />}
                onClick={openTokenDialog}
                sx={{ mt: 1 }}
              >
                Enter API Token
              </Button>
            </Box>
          ) : (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Box>
                  <Typography variant="body2" color="text.secondary">Budget</Typography>
                  <Typography fontWeight={600}>
                    {status.budgetName ?? '(none selected)'}
                  </Typography>
                </Box>
                {status.lastSyncedAt && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">Last synced</Typography>
                    <Typography>{new Date(status.lastSyncedAt).toLocaleString()}</Typography>
                  </Box>
                )}
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={openTokenDialog}
                >
                  Update Token
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setBudgetDialogOpen(true)}
                  disabled={budgetsLoading}
                >
                  {status.budgetId ? 'Change Budget' : 'Select Budget'}
                </Button>
                {status.budgetId && (
                  <Button
                    variant="contained"
                    startIcon={syncMutation.isPending ? <CircularProgress size={16} /> : <SyncIcon />}
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending || !householdId}
                  >
                    Sync Now
                  </Button>
                )}
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<LinkOffIcon />}
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  Disconnect
                </Button>
              </Stack>
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* ── Category Mapping Table ───────────────────────────────────── */}
      {status?.connected && status.budgetId && (
        <Card sx={{ mt: 3 }}>
          <CardHeader
            title="Category Mapping"
            subheader="Map your YNAB categories to RetireePlan expense categories"
          />
          <Divider />
          <CardContent>
            {categoriesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : categoriesError ? (
              <Alert severity="error">
                {(categoriesErrorObj as Error)?.message || 'Failed to load categories.'}
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>YNAB Group</TableCell>
                      <TableCell>YNAB Category</TableCell>
                      <TableCell>Monthly Budget</TableCell>
                      <TableCell>Map to</TableCell>
                      <TableCell sx={{ width: 96 }}>Start Age</TableCell>
                      <TableCell sx={{ width: 96 }}>End Age</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(ynabCategories ?? []).map((cat) => {
                      const existing = getMappingForCategory(cat.id);
                      return (
                        <TableRow key={cat.id}>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {cat.groupName}
                            </Typography>
                          </TableCell>
                          <TableCell>{cat.name}</TableCell>
                          <TableCell>
                            ${Math.round(cat.budgeted).toLocaleString()}
                          </TableCell>
                          <TableCell sx={{ minWidth: 180 }}>
                            <FormControl size="small" fullWidth>
                              <InputLabel>Local category</InputLabel>
                              <Select
                                value={existing?.localCategory ?? ''}
                                label="Local category"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const edits = ageEdits[cat.id] ?? { startAge: '', endAge: '' };
                                    upsertMappingMutation.mutate({
                                      ynabCategoryId: cat.id,
                                      ynabCategoryName: cat.name,
                                      localCategory: e.target.value,
                                      startAge: edits.startAge ? Number(edits.startAge) : null,
                                      endAge:   edits.endAge   ? Number(edits.endAge)   : null,
                                    });
                                  }
                                }}
                              >
                                <MenuItem value="">
                                  <em>— skip —</em>
                                </MenuItem>
                                {LOCAL_CATEGORIES.map((lc) => (
                                  <MenuItem key={lc} value={lc}>
                                    {lc}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          {/* Start Age */}
                          <TableCell sx={{ width: 96 }}>
                            {existing && (
                              <TextField
                                size="small"
                                type="number"
                                placeholder="e.g. 40"
                                value={ageEdits[cat.id]?.startAge ?? existing.startAge?.toString() ?? ''}
                                onChange={(e) =>
                                  setAgeEdits((prev) => ({
                                    ...prev,
                                    [cat.id]: { ...(prev[cat.id] ?? { startAge: '', endAge: '' }), startAge: e.target.value },
                                  }))
                                }
                                onBlur={() => {
                                  const edits = ageEdits[cat.id] ?? { startAge: '', endAge: '' };
                                  upsertMappingMutation.mutate({
                                    ynabCategoryId: cat.id,
                                    ynabCategoryName: cat.name,
                                    localCategory: existing.localCategory,
                                    startAge: edits.startAge ? Number(edits.startAge) : null,
                                    endAge:   edits.endAge   ? Number(edits.endAge)   : null,
                                  });
                                }}
                                inputProps={{ min: 0, max: 120, style: { width: 60 } }}
                              />
                            )}
                          </TableCell>
                          {/* End Age */}
                          <TableCell sx={{ width: 96 }}>
                            {existing && (
                              <TextField
                                size="small"
                                type="number"
                                placeholder="e.g. 65"
                                value={ageEdits[cat.id]?.endAge ?? existing.endAge?.toString() ?? ''}
                                onChange={(e) =>
                                  setAgeEdits((prev) => ({
                                    ...prev,
                                    [cat.id]: { ...(prev[cat.id] ?? { startAge: '', endAge: '' }), endAge: e.target.value },
                                  }))
                                }
                                onBlur={() => {
                                  const edits = ageEdits[cat.id] ?? { startAge: '', endAge: '' };
                                  upsertMappingMutation.mutate({
                                    ynabCategoryId: cat.id,
                                    ynabCategoryName: cat.name,
                                    localCategory: existing.localCategory,
                                    startAge: edits.startAge ? Number(edits.startAge) : null,
                                    endAge:   edits.endAge   ? Number(edits.endAge)   : null,
                                  });
                                }}
                                inputProps={{ min: 0, max: 120, style: { width: 60 } }}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {existing && (
                              <Tooltip title="Remove mapping">
                                <IconButton
                                  size="small"
                                  onClick={() => deleteMappingMutation.mutate(existing.id)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Brokerage Integration Cards ──────────────────────── */}
      {BROKERAGE_CONFIG.map((cfg) => {
        const brokStatus = getBrokerageStatus(cfg.provider);
        const syncCount  = brokSyncResults[cfg.provider];
        return (
          <Card key={cfg.provider} sx={{ mt: 3 }}>
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" fontWeight={600}>{cfg.name}</Typography>
                  {brokStatus?.connected ? (
                    <Chip label="Connected" color="success" size="small" />
                  ) : cfg.hasApi ? (
                    <Chip label="Not connected" variant="outlined" size="small" />
                  ) : (
                    <Chip label="Manual only" variant="outlined" color="warning" size="small" />
                  )}
                </Box>
              }
              subheader={cfg.subheader}
            />
            <Divider />
            <CardContent>
              {cfg.apiNote && (
                <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
                  {cfg.apiNote}
                </Alert>
              )}
              {syncCount != null && (
                <Alert severity="success" sx={{ mb: 2, py: 0.5 }} onClose={() => setBrokSyncResults((p) => { const n = { ...p }; delete n[cfg.provider]; return n; })}>
                  Sync complete — {syncCount} account{syncCount !== 1 ? 's' : ''} updated.
                </Alert>
              )}
              {cfg.provider === 'QUESTRADE' && positionsSyncResult !== null && (
                <Alert severity="success" sx={{ mb: 2, py: 0.5 }} onClose={() => setPositionsSyncResult(null)}>
                  Positions sync complete — {positionsSyncResult.synced} account{positionsSyncResult.synced !== 1 ? 's' : ''} updated with cost basis &amp; allocation data.
                </Alert>
              )}
              {!brokStatus?.connected ? (
                <Button
                  variant="contained"
                  startIcon={<KeyIcon />}
                  onClick={() => setBrokDialog({ provider: cfg.provider, token: '', visible: false, error: '' })}
                >
                  {cfg.hasApi ? 'Connect with Token' : 'Connect (Manual)'}
                </Button>
              ) : (
                <Stack spacing={2}>
                {(budgetsError || categoriesError) && (
                  <Alert
                    severity="error"
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        startIcon={<LinkOffIcon />}
                        onClick={() => disconnectMutation.mutate()}
                      >
                        Disconnect
                      </Button>
                    }
                  >
                    {(budgetsErrorObj as Error)?.message || (categoriesErrorObj as Error)?.message ||
                      'Could not load YNAB data. Disconnect and reconnect to fix.'}
                  </Alert>
                )}
                  {brokStatus.lastSyncedAt && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">Last synced</Typography>
                      <Typography>{new Date(brokStatus.lastSyncedAt).toLocaleString()}</Typography>
                    </Box>
                  )}
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {cfg.hasApi && (
                      <>
                        <Button
                          variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={() => setBrokDialog({ provider: cfg.provider, token: '', visible: false, error: '' })}
                        >
                          Update Token
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={syncBrokerageMutation.isPending ? <CircularProgress size={16} /> : <SyncIcon />}
                          onClick={() => syncBrokerageMutation.mutate({ provider: cfg.provider })}
                          disabled={syncBrokerageMutation.isPending || !householdId}
                        >
                          Sync Balances
                        </Button>
                        {cfg.provider === 'QUESTRADE' && (
                          <Tooltip title="Fetch individual holdings to update cost basis (ACB) and asset allocation percentages">
                            <span>
                              <Button
                                variant="outlined"
                                color="secondary"
                                startIcon={syncPositionsMutation.isPending ? <CircularProgress size={16} /> : <AccountTreeIcon />}
                                onClick={() => syncPositionsMutation.mutate()}
                                disabled={syncPositionsMutation.isPending || !householdId}
                              >
                                Sync Positions + ACB
                              </Button>
                            </span>
                          </Tooltip>
                        )}
                      </>
                    )}
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<LinkOffIcon />}
                      onClick={() => disconnectBrokerageMutation.mutate(cfg.provider)}
                      disabled={disconnectBrokerageMutation.isPending}
                    >
                      Disconnect
                    </Button>
                  </Stack>
                </Stack>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* ── File & CSV Import Section ─────────────────────────── */}
      <Typography variant="h5" sx={{ mt: 5, mb: 1, fontWeight: 700 }}>
        File &amp; CSV Import
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Import data from your bank or brokerage without connecting directly. Every Canadian bank
        (RBC, TD, BMO, Scotiabank, CIBC, National Bank, Desjardins) supports OFX/QFX export from
        their web portal.
      </Typography>

      {/* ── OFX / QFX Import ────────────────────────────────── */}
      <Card sx={{ mt: 2 }}>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" fontWeight={600}>Universal OFX / QFX Import</Typography>
              <Chip label="All Canadian Banks & Brokerages" size="small" color="primary" variant="outlined" />
            </Box>
          }
          subheader="Upload an OFX or QFX statement file to import account balances. Covers RBC, TD, BMO, Scotiabank, CIBC, National Bank, Desjardins, Qtrade, BMO InvestorLine, Scotia iTRADE, and more."
        />
        <Divider />
        <CardContent>
          {ofxImportDone && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOfxImportDone(null)}>
              Import complete — {ofxImportDone.created} account{ofxImportDone.created !== 1 ? 's' : ''} created,{' '}
              {ofxImportDone.updated} updated.
            </Alert>
          )}
          {ofxPreviewMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(ofxPreviewMutation.error as Error)?.message ?? 'Failed to parse OFX file.'}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            How to export: log in to your bank → Accounts → Download / Export → select OFX or QFX format →
            upload below. Investment accounts use QFX; banking accounts use OFX.
          </Typography>
          <input
            ref={ofxInputRef}
            type="file"
            accept=".ofx,.qfx"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && householdId) ofxPreviewMutation.mutate(file);
              e.target.value = '';
            }}
          />
          <Button
            variant="contained"
            startIcon={ofxPreviewMutation.isPending ? <CircularProgress size={16} /> : <UploadFileIcon />}
            onClick={() => ofxInputRef.current?.click()}
            disabled={ofxPreviewMutation.isPending || !householdId}
          >
            Upload OFX / QFX File
          </Button>
          {!householdId && (
            <Typography variant="caption" color="error" sx={{ ml: 1 }}>
              Set up a household first.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* ── Wealthsimple CSV Import ──────────────────────────── */}
      <Card sx={{ mt: 3 }}>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" fontWeight={600}>Wealthsimple Activity CSV Import</Typography>
              <Chip label="3M+ Users" size="small" variant="outlined" />
            </Box>
          }
          subheader="Upload your Wealthsimple Activity CSV export to sync account balances. More reliable than the live token connection."
        />
        <Divider />
        <CardContent>
          {wsImportDone && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setWsImportDone(null)}>
              Import complete — {wsImportDone.created} created, {wsImportDone.updated} updated.
            </Alert>
          )}
          {wsPreviewMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(wsPreviewMutation.error as Error)?.message ?? 'Failed to parse Wealthsimple CSV.'}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            In the Wealthsimple web app: go to <strong>Activity</strong> → click <strong>Export</strong> →
            select a date range → download the CSV → upload it here. Supports RRSP, TFSA, non-registered,
            and crypto accounts.
          </Typography>
          <input
            ref={wsInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && householdId) wsPreviewMutation.mutate(file);
              e.target.value = '';
            }}
          />
          <Button
            variant="contained"
            startIcon={wsPreviewMutation.isPending ? <CircularProgress size={16} /> : <UploadFileIcon />}
            onClick={() => wsInputRef.current?.click()}
            disabled={wsPreviewMutation.isPending || !householdId}
          >
            Upload Wealthsimple CSV
          </Button>
        </CardContent>
      </Card>

      {/* ── Monarch Money CSV Import ─────────────────────────── */}
      <Card sx={{ mt: 3 }}>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" fontWeight={600}>Monarch Money CSV Import</Typography>
              <Chip label="Budget → Expenses" size="small" variant="outlined" />
            </Box>
          }
          subheader="Upload your Monarch Money transaction export to automatically populate your annual expense categories."
        />
        <Divider />
        <CardContent>
          {monarchImportDone && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMonarchImportDone(null)}>
              Import complete — {monarchImportDone.created} expense categor{monarchImportDone.created !== 1 ? 'ies' : 'y'} created.
            </Alert>
          )}
          {monarchPreviewMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(monarchPreviewMutation.error as Error)?.message ?? 'Failed to parse Monarch CSV.'}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            In Monarch Money: go to <strong>Settings → Export Data</strong> → download the transactions CSV →
            upload it here. Monthly averages per category will be computed and added as annual expenses.
          </Typography>
          <input
            ref={monInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && householdId) monarchPreviewMutation.mutate(file);
              e.target.value = '';
            }}
          />
          <Button
            variant="contained"
            startIcon={monarchPreviewMutation.isPending ? <CircularProgress size={16} /> : <UploadFileIcon />}
            onClick={() => monInputRef.current?.click()}
            disabled={monarchPreviewMutation.isPending || !householdId}
          >
            Upload Monarch Money CSV
          </Button>
        </CardContent>
      </Card>

      {/* ── OFX Preview Dialog ─────────────────────────────────────── */}
      {ofxPreview && (
        <Dialog open onClose={() => setOfxPreview(null)} maxWidth="md" fullWidth>
          <DialogTitle>OFX Import Preview</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Found {ofxPreview.accounts.length} account{ofxPreview.accounts.length !== 1 ? 's' : ''}.
              Review and confirm which accounts to import. Uncheck any accounts you want to skip.
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Description</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Matches</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ofxPreview.accounts.map((acc) => (
                    <TableRow key={acc.accountId} selected={!ofxSkip[acc.accountId]}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={!ofxSkip[acc.accountId]}
                          onChange={(e) =>
                            setOfxSkip((prev) => ({ ...prev, [acc.accountId]: !e.target.checked }))
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{acc.description ?? acc.accountId}</Typography>
                        {acc.bankId && (
                          <Typography variant="caption" color="text.secondary">{acc.bankId}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={acc.localAccountType} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>
                          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: acc.currency }).format(acc.balance)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={acc.action === 'update' ? 'Update balance' : 'Create new account'}
                          color={acc.action === 'update' ? 'warning' : 'success'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {acc.matchedLocalAccount && (
                          <Typography variant="caption" color="text.secondary">
                            → {acc.matchedLocalAccount.name}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {ofxApplyMutation.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {(ofxApplyMutation.error as Error)?.message ?? 'Import failed.'}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOfxPreview(null)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => ofxApplyMutation.mutate()}
              disabled={ofxApplyMutation.isPending || ofxPreview.accounts.every((a) => ofxSkip[a.accountId])}
            >
              {ofxApplyMutation.isPending ? <CircularProgress size={16} /> : 'Confirm Import'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── Wealthsimple CSV Preview Dialog ──────────────────────── */}
      {wsPreview && (
        <Dialog open onClose={() => setWsPreview(null)} maxWidth="md" fullWidth>
          <DialogTitle>Wealthsimple CSV Import Preview</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Found {wsPreview.accounts.length} account{wsPreview.accounts.length !== 1 ? 's' : ''} in the Wealthsimple CSV.
              Review and confirm which accounts to import.
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Account</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {wsPreview.accounts.map((acc) => (
                    <TableRow key={acc.accountId}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={!wsSkip[acc.accountId]}
                          onChange={(e) =>
                            setWsSkip((prev) => ({ ...prev, [acc.accountId]: !e.target.checked }))
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{acc.description ?? acc.accountId}</TableCell>
                      <TableCell><Chip label={acc.localAccountType} size="small" /></TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>
                          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: acc.currency }).format(acc.balance)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={acc.action === 'update' ? 'Update balance' : 'Create new'}
                          color={acc.action === 'update' ? 'warning' : 'success'}
                          size="small" variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setWsPreview(null)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => wsApplyMutation.mutate()}
              disabled={wsApplyMutation.isPending || wsPreview.accounts.every((a) => wsSkip[a.accountId])}
            >
              {wsApplyMutation.isPending ? <CircularProgress size={16} /> : 'Confirm Import'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── Monarch Money CSV Preview Dialog ─────────────────────── */}
      {monarchPreview && (
        <Dialog open onClose={() => setMonarchPreview(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Monarch Money Expense Categories</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Found {monarchPreview.totalCategories} spending categories. These will be added to your
              plan as annual expenses. Uncheck any categories to skip.
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Monthly Avg</TableCell>
                    <TableCell align="right">Annual</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monarchPreview.expenses.map((e) => (
                    <TableRow key={e.category}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={!monarchSkip[e.category]}
                          onChange={(ev) =>
                            setMonarchSkip((prev) => ({ ...prev, [e.category]: !ev.target.checked }))
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell align="right">
                        {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(e.monthlyAvg)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={600}>
                          {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(e.annualAmount)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {monarchApplyMutation.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {(monarchApplyMutation.error as Error)?.message ?? 'Import failed.'}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMonarchPreview(null)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => monarchApplyMutation.mutate()}
              disabled={monarchApplyMutation.isPending || monarchPreview.expenses.every((e) => monarchSkip[e.category])}
            >
              {monarchApplyMutation.isPending ? <CircularProgress size={16} /> : 'Import Expenses'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── Brokerage Connect Dialog ──────────────────────────── */}
      {brokDialog && (() => {
        const cfg = BROKERAGE_CONFIG.find((c) => c.provider === brokDialog.provider)!;
        return (
          <Dialog open onClose={() => setBrokDialog(null)} maxWidth="sm" fullWidth>
            <DialogTitle>
              {getBrokerageStatus(brokDialog.provider)?.connected
                ? `Update ${cfg.name} Token`
                : `Connect ${cfg.name}`}
            </DialogTitle>
            <DialogContent>
              {cfg.tokenInstructions && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 0.5 }}>
                  {cfg.tokenInstructions}
                </Typography>
              )}
              {!cfg.hasApi && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 0.5 }}>
                  Click <strong>Connect</strong> to register TD as an institution. You can then link your
                  accounts to TD from the Accounts page and update balances manually.
                </Typography>
              )}
              {cfg.hasApi && (
                <TextField
                  label={cfg.tokenLabel}
                  value={brokDialog.token}
                  onChange={(e) => setBrokDialog({ ...brokDialog, token: e.target.value, error: '' })}
                  type={brokDialog.visible ? 'text' : 'password'}
                  fullWidth
                  error={!!brokDialog.error}
                  helperText={brokDialog.error}
                  autoFocus
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setBrokDialog({ ...brokDialog, visible: !brokDialog.visible })} edge="end">
                          {brokDialog.visible ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              {brokDialog.error && !cfg.hasApi && (
                <Alert severity="error" sx={{ mt: 1 }}>{brokDialog.error}</Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setBrokDialog(null)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={() => {
                  if (cfg.hasApi && !brokDialog.token.trim()) {
                    setBrokDialog({ ...brokDialog, error: 'Please enter a token.' });
                    return;
                  }
                  connectBrokerageMutation.mutate({
                    provider: brokDialog.provider,
                    token: cfg.hasApi ? brokDialog.token.trim() : undefined,
                  });
                }}
                disabled={connectBrokerageMutation.isPending}
              >
                {connectBrokerageMutation.isPending ? <CircularProgress size={16} /> : 'Connect'}
              </Button>
            </DialogActions>
          </Dialog>
        );
      })()}

      {/* ── Token Input Dialog ────────────────────────────────── */}
      <Dialog open={tokenDialogOpen} onClose={() => setTokenDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{status?.connected ? 'Update YNAB Token' : 'Enter YNAB Personal Access Token'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 0.5 }}>
            Generate a token at{' '}
            <Link
              href="https://app.youneedabudget.com/settings/developer"
              target="_blank"
              rel="noopener"
            >
              app.youneedabudget.com/settings/developer
            </Link>.
            Your token is transmitted over HTTPS and stored server-side only.
          </Typography>
          <TextField
            label="Personal Access Token"
            value={tokenInput}
            onChange={(e) => { setTokenInput(e.target.value); setTokenError(''); }}
            type="text"
            fullWidth
            error={!!tokenError}
            helperText={tokenError}
            autoFocus
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setTokenVisible((v) => !v)} edge="end">
                      {tokenVisible ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
              htmlInput: {
                style: { WebkitTextSecurity: tokenVisible ? 'none' : 'disc' } as React.CSSProperties,
                autoComplete: 'off',
                spellCheck: false,
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTokenDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveToken}
            disabled={saveTokenMutation.isPending}
          >
            {saveTokenMutation.isPending ? <CircularProgress size={16} /> : 'Save Token'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Budget Selection Dialog ───────────────────────────────── */}
      <Dialog open={budgetDialogOpen} onClose={() => setBudgetDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Select a Budget</DialogTitle>
        <DialogContent>
          {budgetsError ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              {(budgetsErrorObj as Error)?.message || 'Failed to load budgets.'}
            </Alert>
          ) : (
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Budget</InputLabel>
            <Select
              value={selectedBudgetId}
              label="Budget"
              onChange={(e) => setSelectedBudgetId(e.target.value)}
            >
              {(budgets ?? []).map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBudgetDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!selectedBudgetId || selectBudgetMutation.isPending || !!budgetsError}
            onClick={() => selectBudgetMutation.mutate(selectedBudgetId)}
          >
            {selectBudgetMutation.isPending ? <CircularProgress size={16} /> : 'Select'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
