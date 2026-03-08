import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Alert, CircularProgress,
  Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, IconButton, Tooltip, Chip, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FlagIcon from '@mui/icons-material/Flag';
import HomeIcon from '@mui/icons-material/Home';
import WorkIcon from '@mui/icons-material/Work';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SchoolIcon from '@mui/icons-material/School';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';

interface Household { id: string; name: string; }
interface MilestoneEvent {
  id: string;
  name: string;
  description?: string;
  age: number;
  amount: number;
  type: string;
  householdId: string;
}

type MilestoneType = 'income' | 'expense' | 'lump_sum_in' | 'lump_sum_out';

const TYPE_LABELS: Record<MilestoneType, string> = {
  income: 'Income',
  expense: 'Expense',
  lump_sum_in: 'Lump Sum In',
  lump_sum_out: 'Lump Sum Out',
};

const TYPE_COLORS: Record<MilestoneType, 'success' | 'error' | 'info' | 'warning'> = {
  income: 'success',
  expense: 'error',
  lump_sum_in: 'info',
  lump_sum_out: 'warning',
};

const MILESTONE_TEMPLATES: Array<{
  name: string;
  type: MilestoneType;
  amount: number;
  age: number;
  description: string;
}> = [
  { name: 'Sell Home', type: 'lump_sum_in', amount: 500000, age: 70, description: 'Downsize and sell primary residence - net proceeds after commission' },
  { name: 'Start CPP', type: 'income', amount: 16375, age: 65, description: 'Begin Canada Pension Plan benefits' },
  { name: 'Retirement Community', type: 'expense', amount: 60000, age: 80, description: 'Annual cost of retirement or assisted living facility' },
  { name: 'Pay Off Mortgage', type: 'lump_sum_out', amount: 200000, age: 62, description: 'Final mortgage lump-sum payoff' },
  { name: 'Receive Inheritance', type: 'lump_sum_in', amount: 100000, age: 65, description: 'Expected inheritance from family' },
  { name: 'Part-Time Work', type: 'income', amount: 20000, age: 60, description: 'Part-time or consulting income in early retirement' },
  { name: 'Major Renovation', type: 'lump_sum_out', amount: 75000, age: 63, description: 'Home renovation or major repair project' },
  { name: 'Fund Education', type: 'lump_sum_out', amount: 30000, age: 55, description: 'Help fund grandchildren education (RESP or gifts)' },
];

const emptyForm = {
  name: '',
  description: '',
  age: 65,
  amount: 0,
  type: 'expense' as MilestoneType,
};

export function MilestonesPage() {
  const { apiFetch } = useApi();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MilestoneEvent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const { data: households } = useQuery<Household[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
  });
  const household = households?.[0];

  const { data: milestones, isLoading } = useQuery<MilestoneEvent[]>({
    queryKey: ['milestones', household?.id],
    queryFn: () => apiFetch(`/milestones/household/${household!.id}`),
    enabled: !!household?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm & { householdId: string }) =>
      apiFetch('/milestones', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones'] });
      handleClose();
    },
    onError: () => setFormError('Failed to save milestone.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof emptyForm> }) =>
      apiFetch(`/milestones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones'] });
      handleClose();
    },
    onError: () => setFormError('Failed to update milestone.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/milestones/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['milestones'] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(m: MilestoneEvent) {
    setEditing(m);
    setForm({
      name: m.name,
      description: m.description ?? '',
      age: m.age,
      amount: m.amount,
      type: m.type as MilestoneType,
    });
    setFormError('');
    setDialogOpen(true);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
  }

  function getTemplateIcon(templateName: string, type: MilestoneType) {
    if (templateName === 'Sell Home' || templateName === 'Major Renovation' || templateName === 'Pay Off Mortgage') {
      return <HomeIcon color="primary" fontSize="small" />;
    }
    if (templateName === 'Part-Time Work') {
      return <WorkIcon color="action" fontSize="small" />;
    }
    if (templateName === 'Fund Education') {
      return <SchoolIcon color="action" fontSize="small" />;
    }
    if (type === 'lump_sum_in' || type === 'income') {
      return <TrendingUpIcon color="success" fontSize="small" />;
    }
    return <TrendingDownIcon color="error" fontSize="small" />;
  }

  function applyTemplate(template: (typeof MILESTONE_TEMPLATES)[number]) {
    setEditing(null);
    setForm({
      name: template.name,
      description: template.description,
      amount: template.amount,
      age: template.age,
      type: template.type,
    });
    setFormError('');
    setTemplateDialogOpen(false);
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (form.amount < 0) { setFormError('Amount must be ≥ 0.'); return; }
    if (!household) return;

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate({ ...form, householdId: household.id });
    }
  }

  function formatAmount(type: string, amount: number) {
    const prefix = type === 'lump_sum_out' || type === 'expense' ? '-' : '+';
    return `${prefix}$${amount.toLocaleString()}`;
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <FlagIcon color="primary" />
          <Typography variant="h4" fontWeight={700}>
            Milestone Events
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            onClick={() => setTemplateDialogOpen(true)}
            disabled={!household}
          >
            Add from Template
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            disabled={!household}
          >
            Add Milestone
          </Button>
        </Box>
      </Box>

      <Typography variant="body1" color="text.secondary" mb={3}>
        Define one-time financial events tied to a specific age — inheritance, home sale, car purchase, etc.
        These events will be incorporated into your projections.
      </Typography>

      {!household && (
        <Alert severity="info">Set up your household first before adding milestones.</Alert>
      )}

      {isLoading && (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      )}

      {milestones && milestones.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <FlagIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No milestone events yet
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              Click "Add Milestone" to create your first event.
            </Typography>
          </CardContent>
        </Card>
      )}

      {milestones && milestones.length > 0 && (
        <Card>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Age</strong></TableCell>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell align="right"><strong>Amount</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {milestones.map((m) => (
                  <TableRow key={m.id} hover>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>{m.age}</TableCell>
                    <TableCell>
                      <Chip
                        label={TYPE_LABELS[m.type as MilestoneType] ?? m.type}
                        color={TYPE_COLORS[m.type as MilestoneType] ?? 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right" sx={{
                      fontFamily: 'monospace',
                      color: (m.type === 'expense' || m.type === 'lump_sum_out') ? 'error.main' : 'success.main',
                    }}>
                      {formatAmount(m.type, m.amount)}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                      {m.description ?? '—'}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" aria-label="Edit milestone" onClick={() => openEdit(m)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          aria-label="Delete milestone"
                          color="error"
                          onClick={() => deleteMutation.mutate(m.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Summary stats */}
      {milestones && milestones.length > 0 && (
        <Grid container spacing={2} mt={2}>
          {(['income', 'lump_sum_in', 'expense', 'lump_sum_out'] as MilestoneType[]).map((type) => {
            const items = milestones.filter((m) => m.type === type);
            const total = items.reduce((s, m) => s + m.amount, 0);
            if (items.length === 0) return null;
            return (
              <Grid item xs={12} sm={6} md={3} key={type}>
                <Card variant="outlined">
                  <CardContent>
                    <Chip
                      label={TYPE_LABELS[type]}
                      color={TYPE_COLORS[type]}
                      size="small"
                    />
                    <Typography variant="h6" mt={1}>
                      ${total.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {items.length} event{items.length !== 1 ? 's' : ''}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Choose a Template</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {MILESTONE_TEMPLATES.map((template) => (
              <Grid item xs={12} sm={6} key={template.name}>
                <Card
                  sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}
                  onClick={() => applyTemplate(template)}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      {getTemplateIcon(template.name, template.type)}
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{template.name}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{template.description}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip label={`$${template.amount.toLocaleString()}`} size="small" color="primary" variant="outlined" />
                      <Chip label={`Age ${template.age}`} size="small" variant="outlined" />
                      <Chip label={template.type.replace(/_/g, ' ')} size="small" />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Milestone' : 'Add Milestone Event'}</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12}>
              <TextField
                label="Name"
                fullWidth
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Age at Event"
                type="number"
                fullWidth
                value={form.age}
                inputProps={{ min: 0, max: 120 }}
                onChange={(e) => setForm((f) => ({ ...f, age: Number(e.target.value) }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Type"
                select
                fullWidth
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MilestoneType }))}
              >
                {(Object.entries(TYPE_LABELS) as [MilestoneType, string][]).map(([v, l]) => (
                  <MenuItem key={v} value={v}>{l}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Amount ($)"
                type="number"
                fullWidth
                value={form.amount}
                inputProps={{ min: 0 }}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description (optional)"
                fullWidth
                multiline
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {editing ? 'Save Changes' : 'Add Milestone'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
