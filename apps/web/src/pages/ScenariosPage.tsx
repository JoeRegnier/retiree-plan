import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, IconButton, Chip, CircularProgress, Alert,
  Accordion, AccordionSummary, AccordionDetails, Tooltip, Slider, InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ScienceIcon from '@mui/icons-material/Science';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useApi } from '../hooks/useApi';

interface ScenarioParameters {
  retirementAge: number;
  lifeExpectancy: number;
  annualExpenses: number;
  inflationRate: number;
  expectedReturnRate: number;
  volatility: number;
  cppStartAge: number;
  oasStartAge: number;
  rrifStartAge: number;
  withdrawalOrder: string[];
  province: string;
  flexSpending: boolean;
  flexFloor: number;
  flexCeiling: number;
}

interface Scenario {
  id: string;
  name: string;
  description?: string;
  parameters: string | ScenarioParameters;
  householdId: string;
  createdAt: string;
}

interface Household { id: string; name: string; }

const DEFAULT_PARAMS: ScenarioParameters = {
  retirementAge: 65,
  lifeExpectancy: 90,
  annualExpenses: 60_000,
  inflationRate: 0.02,
  expectedReturnRate: 0.06,
  volatility: 0.12,
  cppStartAge: 65,
  oasStartAge: 65,
  rrifStartAge: 71,
  withdrawalOrder: ['TFSA', 'RRSP', 'NON_REG'],
  province: 'ON',
  flexSpending: false,
  flexFloor: 0.9,
  flexCeiling: 1.2,
};

function parseParams(s: Scenario): ScenarioParameters {
  if (typeof s.parameters === 'string') {
    try { return JSON.parse(s.parameters); } catch { return DEFAULT_PARAMS; }
  }
  return s.parameters;
}

export function ScenariosPage() {
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [params, setParams] = useState<ScenarioParameters>(DEFAULT_PARAMS);
  const [error, setError] = useState('');

  const { data: households } = useQuery<Household[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
  });
  const household = households?.[0];

  const { data: scenarios, isLoading } = useQuery<Scenario[]>({
    queryKey: ['scenarios', household?.id],
    queryFn: () => apiFetch(`/scenarios/household/${household!.id}`),
    enabled: !!household?.id,
  });

  const createScenario = useMutation({
    mutationFn: (data: any) => apiFetch('/scenarios', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['scenarios'] }); closeDialog(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateScenario = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiFetch(`/scenarios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['scenarios'] }); closeDialog(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteScenario = useMutation({
    mutationFn: (id: string) => apiFetch(`/scenarios/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenarios'] }),
  });

  const openDialog = (scenario?: Scenario) => {
    setError('');
    if (scenario) {
      setEditingScenario(scenario);
      setName(scenario.name);
      setDescription(scenario.description ?? '');
      setParams(parseParams(scenario));
    } else {
      setEditingScenario(null);
      setName('');
      setDescription('');
      setParams(DEFAULT_PARAMS);
    }
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingScenario(null); };

  const handleSave = () => {
    if (!name.trim()) { setError('Name is required'); return; }
    const payload = { name, description, parameters: params, householdId: household?.id };
    if (editingScenario) {
      updateScenario.mutate({ id: editingScenario.id, data: payload });
    } else {
      createScenario.mutate(payload);
    }
  };

  const setParam = <K extends keyof ScenarioParameters>(key: K, value: ScenarioParameters[K]) =>
    setParams((p) => ({ ...p, [key]: value }));

  if (isLoading) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h3">Scenarios</Typography>
          <Typography variant="body1" color="text.secondary">
            Create and compare retirement scenarios — what-if analysis at your fingertips.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog()} disabled={!household}>
          New Scenario
        </Button>
      </Box>

      {!household && (
        <Alert severity="warning" sx={{ mb: 3 }}>Please set up your household first.</Alert>
      )}

      {household && (!scenarios || scenarios.length === 0) ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <ScienceIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>No scenarios created</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first scenario to explore retirement strategies.
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openDialog()}>
              Create Scenario
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {(scenarios ?? []).map((s) => {
            const p = parseParams(s);
            return (
              <Grid item xs={12} md={6} lg={4} key={s.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6">{s.name}</Typography>
                      <Box>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openDialog(s)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => deleteScenario.mutate(s.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                    {s.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{s.description}</Typography>
                    )}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      <Chip label={`Retire @ ${p.retirementAge}`} size="small" />
                      <Chip label={`Live to ${p.lifeExpectancy}`} size="small" />
                      <Chip label={`${(p.expectedReturnRate * 100).toFixed(1)}% return`} size="small" />
                      <Chip label={`${(p.inflationRate * 100).toFixed(1)}% inflation`} size="small" />
                      {p.annualExpenses && <Chip label={`$${p.annualExpenses.toLocaleString('en-CA', { maximumFractionDigits: 0 })} exp.`} size="small" variant="outlined" />}
                    </Box>
                    <Typography variant="caption" color="text.disabled">
                      CPP @ {p.cppStartAge} • OAS @ {p.oasStartAge} • Province: {p.province}
                    </Typography>
                  </CardContent>
                  <Box sx={{ p: 2, pt: 0 }}>
                    <Button
                      fullWidth variant="contained" size="small"
                      startIcon={<PlayArrowIcon />}
                      onClick={() => navigate(`/projections?scenarioId=${s.id}`)}
                    >
                      Run Projection
                    </Button>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={dialogOpen} maxWidth="md" fullWidth onClose={closeDialog}>
        <DialogTitle>{editingScenario ? 'Edit Scenario' : 'New Scenario'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField label="Scenario Name" fullWidth value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Base Case – Retire at 65" />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description (optional)" fullWidth multiline rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Grid>

            {/* Spending */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Spending</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Annual Expenses (fallback)"
                type="number"
                fullWidth
                helperText="Used when no expenses are entered on the Expenses page"
                value={params.annualExpenses}
                onChange={(e) => setParam('annualExpenses', Number(e.target.value))}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                inputProps={{ min: 0, step: 1000 }}
              />
            </Grid>

            {/* Retirement Timeline */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Retirement Timeline</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>Retirement Age: {params.retirementAge}</Typography>
              <Slider value={params.retirementAge} min={50} max={75} step={1}
                onChange={(_, v) => setParam('retirementAge', v as number)} marks valueLabelDisplay="auto" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>Life Expectancy: {params.lifeExpectancy}</Typography>
              <Slider value={params.lifeExpectancy} min={75} max={105} step={1}
                onChange={(_, v) => setParam('lifeExpectancy', v as number)} marks valueLabelDisplay="auto" />
            </Grid>

            {/* Government Benefits */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Government Benefits</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography gutterBottom>CPP Start Age: {params.cppStartAge}</Typography>
              <Slider value={params.cppStartAge} min={60} max={70} step={1}
                onChange={(_, v) => setParam('cppStartAge', v as number)} marks valueLabelDisplay="auto" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography gutterBottom>OAS Start Age: {params.oasStartAge}</Typography>
              <Slider value={params.oasStartAge} min={65} max={70} step={1}
                onChange={(_, v) => setParam('oasStartAge', v as number)} marks valueLabelDisplay="auto" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography gutterBottom>RRIF Start Age: {params.rrifStartAge}</Typography>
              <Slider value={params.rrifStartAge} min={65} max={71} step={1}
                onChange={(_, v) => setParam('rrifStartAge', v as number)} marks valueLabelDisplay="auto" />
            </Grid>

            {/* Market Assumptions */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Market Assumptions</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Expected Return"
                type="number"
                fullWidth
                value={(params.expectedReturnRate * 100).toFixed(1)}
                onChange={(e) => setParam('expectedReturnRate', Number(e.target.value) / 100)}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                inputProps={{ min: 0, max: 20, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Inflation Rate"
                type="number"
                fullWidth
                value={(params.inflationRate * 100).toFixed(1)}
                onChange={(e) => setParam('inflationRate', Number(e.target.value) / 100)}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                inputProps={{ min: 0, max: 10, step: 0.1 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Volatility (Std Dev)"
                type="number"
                fullWidth
                value={(params.volatility * 100).toFixed(1)}
                onChange={(e) => setParam('volatility', Number(e.target.value) / 100)}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                inputProps={{ min: 0, max: 40, step: 0.5 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={createScenario.isPending || updateScenario.isPending}>
            {editingScenario ? 'Update' : 'Create Scenario'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
