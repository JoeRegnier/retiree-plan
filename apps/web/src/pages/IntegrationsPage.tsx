import { useState } from 'react';
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
} from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import SyncIcon from '@mui/icons-material/Sync';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyIcon from '@mui/icons-material/Key';
import EditIcon from '@mui/icons-material/Edit';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';

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
  householdId: string;
}

interface Household {
  id: string;
  name: string;
}

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
  const qc = useQueryClient();

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number } | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenError, setTokenError] = useState('');

  // ── Queries ───────────────────────────────────────────────────────────────

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

  const { data: budgets, isLoading: budgetsLoading } = useQuery<Budget[]>({
    queryKey: ['ynab-budgets'],
    queryFn: () => apiFetch('/ynab/budgets'),
    enabled: status?.connected === true,
  });

  const { data: ynabCategories, isLoading: categoriesLoading } = useQuery<YnabCategory[]>({
    queryKey: ['ynab-categories'],
    queryFn: () => apiFetch('/ynab/categories'),
    enabled: status?.connected === true && !!status.budgetId,
  });

  const { data: mappings } = useQuery<CategoryMapping[]>({
    queryKey: ['ynab-mappings', householdId],
    queryFn: () => apiFetch(`/ynab/mappings?householdId=${householdId}`),
    enabled: !!householdId && status?.connected === true,
  });

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
    }: {
      ynabCategoryId: string;
      ynabCategoryName: string;
      localCategory: string;
    }) =>
      apiFetch('/ynab/mappings', {
        method: 'POST',
        body: JSON.stringify({ householdId, ynabCategoryId, ynabCategoryName, localCategory }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ynab-mappings'] }),
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/ynab/mappings/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ynab-mappings'] }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getMappingForCategory = (ynabCategoryId: string) =>
    mappings?.find((m) => m.ynabCategoryId === ynabCategoryId);

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
        Connect your YNAB account to automatically import spending data into your retirement plan.
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
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>YNAB Group</TableCell>
                      <TableCell>YNAB Category</TableCell>
                      <TableCell>Monthly Budget</TableCell>
                      <TableCell>Map to</TableCell>
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
                                    upsertMappingMutation.mutate({
                                      ynabCategoryId: cat.id,
                                      ynabCategoryName: cat.name,
                                      localCategory: e.target.value,
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
            type={tokenVisible ? 'text' : 'password'}
            fullWidth
            error={!!tokenError}
            helperText={tokenError}
            autoFocus
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setTokenVisible((v) => !v)} edge="end">
                    {tokenVisible ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBudgetDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!selectedBudgetId || selectBudgetMutation.isPending}
            onClick={() => selectBudgetMutation.mutate(selectedBudgetId)}
          >
            {selectBudgetMutation.isPending ? <CircularProgress size={16} /> : 'Select'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
