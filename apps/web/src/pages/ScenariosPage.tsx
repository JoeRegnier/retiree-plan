import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, IconButton, Chip, CircularProgress, Alert,
  Tooltip, Slider, InputAdornment, Tab, Tabs, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Switch, FormControlLabel, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ScienceIcon from '@mui/icons-material/Science';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useApi } from '../hooks/useApi';
import { SpendingCurveChart } from '../components/charts/SpendingCurveChart';

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
  nonRegTaxDragRate?: number;
  glidePathSteps?: { age: number; returnRate: number }[];
  spendingPhases?: { fromAge: number; factor: number }[];
  /** Annual interest/savings rate on the cash bucket (bank accounts). Default 2.5%. */
  cashSavingsRate?: number;
  /** When true, income surplus after expenses is automatically invested in non-reg. Default false. */
  investSurplus?: boolean;
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

const SPENDING_PRESETS = [
  {
    label: 'Smile Curve',
    phases: [
      { fromAge: 65, factor: 0.85 },
      { fromAge: 75, factor: 0.75 },
      { fromAge: 85, factor: 0.85 },
    ],
  },
  {
    label: 'Step Down',
    phases: [
      { fromAge: 65, factor: 0.85 },
      { fromAge: 75, factor: 0.70 },
    ],
  },
  { label: 'Healthcare Rise', phases: [{ fromAge: 80, factor: 1.15 }] },
  { label: 'Clear All', phases: [] },
] as const;

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
  nonRegTaxDragRate: 0,
  glidePathSteps: [],
  spendingPhases: [],
  cashSavingsRate: 0.025,
  investSurplus: false,
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
  const [activeTab, setActiveTab] = useState(0);

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
    setActiveTab(0);
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

  const hasMatchingSpendingPreset = (presetPhases: { fromAge: number; factor: number }[]) =>
    JSON.stringify(params.spendingPhases ?? []) === JSON.stringify(presetPhases);

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
                          <IconButton size="small" aria-label="Edit scenario" onClick={() => openDialog(s)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" aria-label="Delete scenario" onClick={() => deleteScenario.mutate(s.id)}><DeleteIcon fontSize="small" /></IconButton>
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
        <DialogTitle sx={{ pb: 0 }}>{editingScenario ? 'Edit Scenario' : 'New Scenario'}</DialogTitle>

        {/* Tab bar sits flush under the title */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Basics" />
          <Tab label="Timeline" />
          <Tab label="Returns" />
          <Tab label="Spending" />
        </Tabs>

        <DialogContent sx={{ pt: 3, minHeight: 380 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* ── Tab 0: Basics ── */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="Scenario Name" fullWidth
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Base Case – Retire at 65"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description (optional)" fullWidth multiline rows={3}
                  value={description} onChange={(e) => setDescription(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <Divider />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Tip: fill in the remaining tabs to fine-tune market assumptions, benefit timing, and spending phases.
                </Typography>
              </Grid>
            </Grid>
          )}

          {/* ── Tab 1: Timeline ── */}
          {activeTab === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="overline" color="text.secondary">Retirement Window</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Retirement Age: <strong>{params.retirementAge}</strong></Typography>
                <Slider value={params.retirementAge} min={50} max={75} step={1}
                  onChange={(_, v) => setParam('retirementAge', v as number)} marks valueLabelDisplay="auto" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography gutterBottom>Life Expectancy: <strong>{params.lifeExpectancy}</strong></Typography>
                <Slider value={params.lifeExpectancy} min={75} max={105} step={1}
                  onChange={(_, v) => setParam('lifeExpectancy', v as number)} marks valueLabelDisplay="auto" />
              </Grid>

              <Grid item xs={12}>
                <Divider />
                <Typography variant="overline" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Government Benefits</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography gutterBottom>CPP Start Age: <strong>{params.cppStartAge}</strong></Typography>
                <Slider value={params.cppStartAge} min={60} max={70} step={1}
                  onChange={(_, v) => setParam('cppStartAge', v as number)} marks valueLabelDisplay="auto" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography gutterBottom>OAS Start Age: <strong>{params.oasStartAge}</strong></Typography>
                <Slider value={params.oasStartAge} min={65} max={70} step={1}
                  onChange={(_, v) => setParam('oasStartAge', v as number)} marks valueLabelDisplay="auto" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography gutterBottom>
                  RRIF Conversion: <strong>{params.rrifStartAge}</strong>
                  {params.rrifStartAge < 65 && (
                    <Tooltip title="Early RRIF conversion triggers mandatory minimum withdrawals which are fully taxable. Unusual but valid — useful to model accelerated RRSP drawdown or income-splitting strategies.">
                      <span style={{ marginLeft: 6, cursor: 'help', fontSize: 13, color: '#FF9800' }}>⚠ early</span>
                    </Tooltip>
                  )}
                </Typography>
                <Slider
                  value={params.rrifStartAge}
                  min={45} max={71} step={1}
                  onChange={(_, v) => setParam('rrifStartAge', v as number)}
                  marks={[
                    { value: 45,  label: '45'  },
                    { value: params.retirementAge, label: `${params.retirementAge}\n(retire)` },
                    { value: 65,  label: '65'  },
                    { value: 71,  label: '71 ★' },
                  ].filter((m, i, arr) => arr.findIndex(x => x.value === m.value) === i).sort((a, b) => a.value - b.value)}
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="text.secondary">
                  CRA requires conversion by 71 (★). Retirement age or 65 is most common.
                </Typography>
              </Grid>
            </Grid>
          )}

          {/* ── Tab 2: Returns ── */}
          {activeTab === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="overline" color="text.secondary">Market Assumptions</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Expected Return" type="number" fullWidth
                  value={(params.expectedReturnRate * 100).toFixed(1)}
                  onChange={(e) => setParam('expectedReturnRate', Number(e.target.value) / 100)}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  inputProps={{ min: 0, max: 20, step: 0.1 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Inflation Rate" type="number" fullWidth
                  value={(params.inflationRate * 100).toFixed(1)}
                  onChange={(e) => setParam('inflationRate', Number(e.target.value) / 100)}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  inputProps={{ min: 0, max: 10, step: 0.1 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Volatility (σ)" type="number" fullWidth
                  value={(params.volatility * 100).toFixed(1)}
                  onChange={(e) => setParam('volatility', Number(e.target.value) / 100)}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  inputProps={{ min: 0, max: 40, step: 0.5 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider />
                <Typography variant="overline" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Non-Registered Tax Drag
                </Typography>
              </Grid>
              <Grid item xs={12} sm={7}>
                <Typography gutterBottom>
                  Annual tax on non-reg growth: <strong>{((params.nonRegTaxDragRate ?? 0) * 100).toFixed(0)}%</strong>
                  <Tooltip title="Fraction of non-reg growth taxed each year as income (mimics dividend/interest taxation). 0% = fully deferred; 30–40% = heavily interest-bearing.">
                    <span style={{ marginLeft: 6, cursor: 'help', fontSize: 14, color: '#888' }}>ⓘ</span>
                  </Tooltip>
                </Typography>
                <Slider
                  value={(params.nonRegTaxDragRate ?? 0) * 100}
                  min={0} max={40} step={1}
                  onChange={(_, v) => setParam('nonRegTaxDragRate', (v as number) / 100)}
                  marks={[{ value: 0, label: '0%' }, { value: 20, label: '20%' }, { value: 40, label: '40%' }]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider />
                <Typography variant="overline" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Cash / Savings Accounts
                </Typography>
              </Grid>
              <Grid item xs={12} sm={7}>
                <Typography gutterBottom>
                  Savings account rate: <strong>{((params.cashSavingsRate ?? 0.025) * 100).toFixed(1)}%</strong>
                  <Tooltip title="Annual interest / growth rate applied to CASH-type accounts and any income surplus that isn't actively invested (bank accounts, HISAs, etc.).  Typically 2–4%.">
                    <span style={{ marginLeft: 6, cursor: 'help', fontSize: 14, color: '#888' }}>ⓘ</span>
                  </Tooltip>
                </Typography>
                <Slider
                  value={(params.cashSavingsRate ?? 0.025) * 100}
                  min={0} max={8} step={0.25}
                  onChange={(_, v) => setParam('cashSavingsRate', (v as number) / 100)}
                  marks={[{ value: 0, label: '0%' }, { value: 4, label: '4%' }, { value: 8, label: '8%' }]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={params.investSurplus ?? false}
                      onChange={(e) => setParam('investSurplus', e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Auto-invest income surplus</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {params.investSurplus
                          ? 'Surplus after expenses goes directly into non-reg investments.'
                          : 'Surplus after expenses stays in the savings/cash bucket (default — more realistic).'}
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', mt: 1 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider />
                <Typography variant="overline" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Portfolio Glide Path
                  <Tooltip title="Override the base return rate at specific ages (e.g. de-risk at 70). Steps are applied from the latest matching age.">
                    <span style={{ marginLeft: 6, cursor: 'help', fontSize: 14, color: '#888' }}>ⓘ</span>
                  </Tooltip>
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TableContainer component={Box} sx={{ mb: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>From Age</TableCell>
                        <TableCell>Annual Return</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(params.glidePathSteps ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3}>
                            <Typography variant="caption" color="text.disabled">No steps — using base return rate for all ages.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {(params.glidePathSteps ?? []).map((step, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <TextField type="number" size="small" variant="standard"
                              value={step.age}
                              onChange={(e) => {
                                const steps = [...(params.glidePathSteps ?? [])];
                                steps[i] = { ...steps[i], age: Number(e.target.value) };
                                setParam('glidePathSteps', steps);
                              }}
                              inputProps={{ min: 50, max: 100, step: 1 }}
                              sx={{ width: 80 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField type="number" size="small" variant="standard"
                              value={(step.returnRate * 100).toFixed(1)}
                              onChange={(e) => {
                                const steps = [...(params.glidePathSteps ?? [])];
                                steps[i] = { ...steps[i], returnRate: Number(e.target.value) / 100 };
                                setParam('glidePathSteps', steps);
                              }}
                              inputProps={{ min: 0, max: 20, step: 0.1 }}
                              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() =>
                              setParam('glidePathSteps', (params.glidePathSteps ?? []).filter((_, idx) => idx !== i))
                            }><DeleteIcon fontSize="small" /></IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Button size="small" startIcon={<AddIcon />} onClick={() =>
                  setParam('glidePathSteps', [...(params.glidePathSteps ?? []), { age: 70, returnRate: Math.max(0, params.expectedReturnRate - 0.01) }])
                }>
                  Add Step
                </Button>
              </Grid>
            </Grid>
          )}

          {/* ── Tab 3: Spending ── */}
          {activeTab === 3 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="overline" color="text.secondary">Fallback Budget</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Annual Expenses (fallback)"
                  type="number" fullWidth
                  helperText="Used when no line-item expenses are entered on the Expenses page"
                  value={params.annualExpenses}
                  onChange={(e) => setParam('annualExpenses', Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  inputProps={{ min: 0, step: 1000 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider />
                <Typography variant="overline" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Spending Phases
                  <Tooltip title="Apply a multiplier to inflation-adjusted expenses from a given age (e.g. 0.85 from age 75 as travel slows down).">
                    <span style={{ marginLeft: 6, cursor: 'help', fontSize: 14, color: '#888' }}>ⓘ</span>
                  </Tooltip>
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {SPENDING_PRESETS.map((preset) => (
                    <Chip
                      key={preset.label}
                      label={preset.label}
                      onClick={() => setParam('spendingPhases', [...preset.phases])}
                      variant={hasMatchingSpendingPreset([...preset.phases]) ? 'filled' : 'outlined'}
                      color={hasMatchingSpendingPreset([...preset.phases]) ? 'primary' : 'default'}
                      size="small"
                    />
                  ))}
                </Stack>
              </Grid>
              <Grid item xs={12}>
                <TableContainer component={Box} sx={{ mb: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>From Age</TableCell>
                        <TableCell>Spending Factor</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(params.spendingPhases ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3}>
                            <Typography variant="caption" color="text.disabled">No phases — expenses scale with inflation only.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {(params.spendingPhases ?? []).map((phase, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <TextField type="number" size="small" variant="standard"
                              value={phase.fromAge}
                              onChange={(e) => {
                                const phases = [...(params.spendingPhases ?? [])];
                                phases[i] = { ...phases[i], fromAge: Number(e.target.value) };
                                setParam('spendingPhases', phases);
                              }}
                              inputProps={{ min: 50, max: 100, step: 1 }}
                              sx={{ width: 80 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField type="number" size="small" variant="standard"
                              value={(phase.factor * 100).toFixed(0)}
                              onChange={(e) => {
                                const phases = [...(params.spendingPhases ?? [])];
                                phases[i] = { ...phases[i], factor: Number(e.target.value) / 100 };
                                setParam('spendingPhases', phases);
                              }}
                              inputProps={{ min: 50, max: 200, step: 1 }}
                              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                              sx={{ width: 100 }}
                            />
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                              ~${Math.round((params.annualExpenses ?? 0) * phase.factor).toLocaleString('en-CA', { maximumFractionDigits: 0 })}/yr
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() =>
                              setParam('spendingPhases', (params.spendingPhases ?? []).filter((_, idx) => idx !== i))
                            }><DeleteIcon fontSize="small" /></IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Button size="small" startIcon={<AddIcon />} onClick={() =>
                  setParam('spendingPhases', [...(params.spendingPhases ?? []), { fromAge: 75, factor: 0.85 }])
                }>
                  Add Phase
                </Button>
                {(params.spendingPhases ?? []).length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <SpendingCurveChart
                      phases={params.spendingPhases ?? []}
                      retirementAge={params.retirementAge ?? 65}
                      endAge={params.lifeExpectancy ?? 90}
                      baseExpenses={params.annualExpenses ?? 60000}
                    />
                  </Box>
                )}
              </Grid>
            </Grid>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          {activeTab < 3 && (
            <Button onClick={() => setActiveTab(activeTab + 1)}>Next</Button>
          )}
          <Button variant="contained" onClick={handleSave} disabled={createScenario.isPending || updateScenario.isPending}>
            {editingScenario ? 'Update' : 'Create Scenario'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
