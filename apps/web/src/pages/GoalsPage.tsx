import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  LinearProgress,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';

interface Goal {
  id: string;
  name: string;
  description: string | null;
  targetAmount: number;
  targetAge: number | null;
  priority: string;
  category: string;
  householdId: string;
}

interface GoalResult {
  goal: { name: string; targetAmount: number; targetAge: number | null; priority: string; category: string };
  successRate: number;
  progressPercent: number;
  shortfall: number;
  funded: boolean;
}

const CATEGORY_OPTIONS = [
  { value: 'retirement', label: 'Retirement Income' },
  { value: 'legacy', label: 'Legacy / Estate' },
  { value: 'purchase', label: 'Major Purchase' },
  { value: 'lifestyle', label: 'Lifestyle' },
];

const CATEGORY_COLORS: Record<string, string> = {
  retirement: '#2196f3',
  legacy: '#9c27b0',
  purchase: '#ff9800',
  lifestyle: '#4caf50',
};

function formatDollar(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(amount);
}

function successColor(rate: number): string {
  if (rate >= 0.9) return '#4caf50';
  if (rate >= 0.75) return '#ff9800';
  return '#f44336';
}

export function GoalsPage() {
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    targetAmount: 0,
    targetAge: '' as string | number,
    priority: 'essential',
    category: 'retirement',
  });

  // Get household ID
  const { data: households } = useQuery({
    queryKey: ['households'],
    queryFn: () => apiFetch<{ id: string; name: string }[]>('/households'),
  });
  const householdId = households?.[0]?.id;

  // Fetch goals
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', householdId],
    queryFn: () => apiFetch<Goal[]>(`/goals/household/${householdId}`),
    enabled: !!householdId,
  });

  // CRUD mutations
  const createGoal = useMutation({
    mutationFn: (data: Omit<Goal, 'id' | 'householdId'> & { householdId: string }) =>
      apiFetch('/goals', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['goals'] }); setDialogOpen(false); },
  });

  const updateGoal = useMutation({
    mutationFn: ({ id, ...data }: Partial<Goal> & { id: string }) =>
      apiFetch(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['goals'] }); setDialogOpen(false); },
  });

  const deleteGoal = useMutation({
    mutationFn: (id: string) => apiFetch(`/goals/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });

  const openCreate = () => {
    setEditingGoal(null);
    setForm({ name: '', description: '', targetAmount: 0, targetAge: '', priority: 'essential', category: 'retirement' });
    setDialogOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setForm({
      name: goal.name,
      description: goal.description ?? '',
      targetAmount: goal.targetAmount,
      targetAge: goal.targetAge ?? '',
      priority: goal.priority,
      category: goal.category,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = {
      name: form.name,
      description: form.description || null,
      targetAmount: form.targetAmount,
      targetAge: form.targetAge === '' ? null : Number(form.targetAge),
      priority: form.priority,
      category: form.category,
    };
    if (editingGoal) {
      updateGoal.mutate({ id: editingGoal.id, ...payload });
    } else {
      createGoal.mutate({ ...payload, householdId: householdId! });
    }
  };

  if (!householdId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Create a household first to define retirement goals.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            <TrackChangesIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Retirement Goals
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Define what you want to achieve and track your progress toward each goal.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Add Goal
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : goals.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <CardContent>
            <TrackChangesIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>No goals defined yet</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Add retirement goals like "Retire at 60 with $80,000/yr" or "Leave $200,000 to children"
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add Your First Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary row */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{goals.length}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Goals</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: '#2196f3' }}>
                    {goals.filter((g) => g.priority === 'essential').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Essential</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: '#ff9800' }}>
                    {goals.filter((g) => g.priority === 'discretionary').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Discretionary</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Goal cards */}
          <Grid container spacing={2}>
            {goals.map((goal) => (
              <Grid item xs={12} sm={6} md={4} key={goal.id}>
                <Card sx={{ height: '100%', borderLeft: `4px solid ${CATEGORY_COLORS[goal.category] ?? '#999'}` }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>{goal.name}</Typography>
                      <Box>
                        <IconButton size="small" onClick={() => openEdit(goal)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => deleteGoal.mutate(goal.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </Box>
                    </Box>
                    {goal.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{goal.description}</Typography>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                      <Chip
                        label={goal.priority}
                        size="small"
                        color={goal.priority === 'essential' ? 'primary' : 'default'}
                      />
                      <Chip
                        label={CATEGORY_OPTIONS.find((c) => c.value === goal.category)?.label ?? goal.category}
                        size="small"
                        sx={{ bgcolor: CATEGORY_COLORS[goal.category] + '22', color: CATEGORY_COLORS[goal.category] }}
                      />
                    </Stack>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {formatDollar(goal.targetAmount)}
                    </Typography>
                    {goal.targetAge && (
                      <Typography variant="body2" color="text.secondary">
                        Target age: {goal.targetAge}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1, pt: 2.5 }}>{editingGoal ? 'Edit Goal' : 'Add Goal'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Goal Name"
              fullWidth
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder='e.g., "Retire at 60 with $80,000/yr"'
            />
            <TextField
              label="Description (optional)"
              fullWidth
              multiline
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <TextField
              label="Target Amount ($)"
              type="number"
              fullWidth
              value={form.targetAmount || ''}
              onChange={(e) => setForm({ ...form, targetAmount: Number(e.target.value) })}
            />
            <TextField
              label="Target Age (optional)"
              type="number"
              fullWidth
              value={form.targetAge}
              onChange={(e) => setForm({ ...form, targetAge: e.target.value === '' ? '' : Number(e.target.value) })}
              helperText="Leave blank for ongoing goals"
            />
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>Priority</Typography>
              <ToggleButtonGroup
                value={form.priority}
                exclusive
                onChange={(_, v) => v && setForm({ ...form, priority: v })}
                size="small"
              >
                <ToggleButton value="essential">Essential</ToggleButton>
                <ToggleButton value="discretionary">Discretionary</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={form.category}
                label="Category"
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name || !form.targetAmount}>
            {editingGoal ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
