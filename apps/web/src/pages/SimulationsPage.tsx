import {
  Box, Typography, Card, CardContent, Grid, Button, FormControl, InputLabel, Select,
  MenuItem, Slider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress, Alert, Divider, Tabs, Tab, Collapse, List, ListItem, ListItemIcon, ListItemText,
  TextField, IconButton,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TuneIcon from '@mui/icons-material/Tune';
import BarChartIcon from '@mui/icons-material/BarChart';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import { MonteCarloChart } from '../components/charts/MonteCarloChart';
import { BacktestChart } from '../components/charts/BacktestChart';
import { GuytonKlingerChart } from '../components/charts/GuytonKlingerChart';
import { HeatmapChart, type HeatmapData } from '../components/charts/HeatmapChart';
import { HistoricalFanChart } from '../components/charts/HistoricalFanChart';
import { OutcomeGauge } from '../components/charts/OutcomeGauge';

interface Scenario { id: string; name: string; parameters: string; }
interface HouseholdMember { id: string; dateOfBirth: string; incomeSources?: { annualAmount: number }[]; }
interface Household { id: string; members: HouseholdMember[]; }
interface Account { id: string; type: string; balance: number; }

/** Returns the member with the highest total income; falls back to the first member. */
function primaryMember(members: HouseholdMember[]): HouseholdMember | undefined {
  if (!members.length) return undefined;
  return [...members].sort(
    (a, b) =>
      (b.incomeSources?.reduce((s, i) => s + i.annualAmount, 0) ?? 0) -
      (a.incomeSources?.reduce((s, i) => s + i.annualAmount, 0) ?? 0),
  )[0];
}
interface PercentileYear { age: number; p5: number; p25: number; p50: number; p75: number; p95: number; }
interface MCResult { percentilesByYear: PercentileYear[]; successRate: number; median: number; }
interface BacktestResult { successRate: number; numWindows: number; windows: any[]; worstCase: any; bestCase: any; dataConstrained?: boolean; }
interface GKResult { years: any[]; portfolioSurvived: boolean; initialWithdrawal: number; finalPortfolio: number; totalWithdrawn: number; }

interface OutcomeCategory { count: number; pct: number; }
interface HistoricalScenariosResult {
  successRate: number;
  trials: number;
  initialNetWorth: number;
  percentilesByYear: Array<{ age: number; year: number; p1: number; p5: number; p25: number; p50: number; p75: number; p95: number }>;
  outcomeCategories: {
    largeSurplus: OutcomeCategory;
    comfortable: OutcomeCategory;
    barelyMadeIt: OutcomeCategory;
    almostMadeIt: OutcomeCategory;
    failedInTheMiddle: OutcomeCategory;
  };
  // returned by backend when equityAsset/bondAsset/label are forwarded
  label?: string;
  equityAsset?: string;
  bondAsset?: string;
  dataYears?: number;
}

interface SeriesInfo {
  asset: string;
  source: string;
  count: number;
  methodology: string;
}

interface InfoPanelProps {
  title: string;
  what: string;
  inputs: string[];
  interpretation: string;
  relevance: string;
}

function InfoPanel({ title, what, inputs, interpretation, relevance }: InfoPanelProps) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ mb: 2 }}>
      <Button
        size="small"
        variant="text"
        startIcon={<InfoOutlinedIcon />}
        onClick={() => setOpen((o) => !o)}
        sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 400, fontSize: '0.8rem' }}
      >
        {open ? 'Hide' : 'How does this work?'}
      </Button>
      <Collapse in={open}>
        <Card variant="outlined" sx={{ mt: 1, bgcolor: 'background.default', borderColor: 'divider' }}>
          <CardContent sx={{ pt: 2, pb: '12px !important' }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>{title}</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                  <BarChartIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight={600} color="primary">What it does</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">{what}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                  <TuneIcon fontSize="small" color="warning" />
                  <Typography variant="caption" fontWeight={600} color="warning.main">Key inputs</Typography>
                </Box>
                <List dense disablePadding>
                  {inputs.map((inp) => (
                    <ListItem key={inp} disablePadding sx={{ alignItems: 'flex-start', mb: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 18, mt: '2px' }}>
                        <CheckCircleOutlineIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                      </ListItemIcon>
                      <ListItemText primary={inp} primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }} />
                    </ListItem>
                  ))}
                </List>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                  <CheckCircleOutlineIcon fontSize="small" color="success" />
                  <Typography variant="caption" fontWeight={600} color="success.main">How to read results</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>{interpretation}</Typography>
                <Typography variant="caption" color="text.secondary" fontStyle="italic">{relevance}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Collapse>
    </Box>
  );
}

function useCommonData() {
  const { apiFetch } = useApi();
  const { data: households } = useQuery<Household[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
  });
  const household = households?.[0];
  const { data: scenarios } = useQuery<Scenario[]>({
    queryKey: ['scenarios', household?.id],
    queryFn: () => apiFetch(`/scenarios/household/${household!.id}`),
    enabled: !!household?.id,
  });
  const { data: accounts } = useQuery<Account[]>({
    queryKey: ['accounts', household?.id],
    queryFn: () => apiFetch(`/accounts/household/${household!.id}`),
    enabled: !!household?.id,
  });
  return { scenarios, household, accounts, apiFetch };
}

// ─── Monte Carlo Tab ──────────────────────────────────────────────────────────
function MonteCarloTab() {
  const { scenarios, household, accounts, apiFetch } = useCommonData();
  const [scenarioId, setScenarioId] = useState('');
  const [numSimulations, setNumSimulations] = useState(1000);
  const [result, setResult] = useState<MCResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!scenarioId || !household) throw new Error('Select a scenario first');
      const scenario = scenarios?.find((s) => s.id === scenarioId);
      if (!scenario) throw new Error('Scenario not found');
      const params = JSON.parse(scenario.parameters ?? '{}');
      const member = primaryMember(household.members);
      const currentAge = member
        ? Math.floor((Date.now() - new Date(member.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
        : 45;
      const rrspBalance = (accounts ?? []).filter((a) => a.type === 'RRSP' || a.type === 'RRIF').reduce((s, a) => s + a.balance, 0);
      const tfsaBalance = (accounts ?? []).filter((a) => a.type === 'TFSA').reduce((s, a) => s + a.balance, 0);
      const nonRegBalance = (accounts ?? []).filter((a) => a.type === 'NON_REG').reduce((s, a) => s + a.balance, 0);
      return apiFetch<MCResult>('/projections/monte-carlo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentAge,
          retirementAge: params.retirementAge ?? 65,
          lifeExpectancy: params.lifeExpectancy ?? 90,
          annualExpensesInRetirement: params.annualExpensesInRetirement ?? 60000,
          annualIncome: params.annualIncome ?? 100000,
          province: params.province ?? 'ON',
          rrspBalance, tfsaBalance, nonRegBalance,
          expectedReturn: params.expectedReturn ?? 0.06,
          inflationRate: params.inflationRate ?? 0.025,
          volatility: params.volatility ?? 0.12,
          numSimulations,
        }),
      });
    },
    onSuccess: (data) => setResult(data),
  });

  const successColor = (rate: number) => (rate >= 90 ? 'success' : rate >= 75 ? 'warning' : 'error') as 'success' | 'warning' | 'error';

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <InfoPanel
          title="Monte Carlo Simulation"
          what="Runs thousands of randomised annual-return sequences through your cash-flow model. Each trial uses a different random return path drawn from a normal distribution, revealing the full spectrum of possible retirement outcomes."
          inputs={[
            'Retirement age & life expectancy (set in your scenario)',
            'Annual expenses in retirement',
            'Expected return & volatility (scenario parameters)',
            'RRSP, TFSA, and non-registered account balances',
            'Number of simulations (more = more precise, slower)',
          ]}
          interpretation="Success rate >= 90% = strong plan. 75-89% = acceptable with some risk. < 75% = consider adjusting spending or retirement age. The fan chart shows the p5-p95 wealth range at each age - a wide fan means high uncertainty."
          relevance="Addresses sequence-of-returns risk: the same average return can produce very different outcomes depending on whether bad years come early or late in retirement."
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Parameters</Typography>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Scenario</InputLabel>
              <Select value={scenarioId} label="Scenario" onChange={(e) => setScenarioId(e.target.value)}>
                {(scenarios ?? []).map((s) => (<MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>))}
              </Select>
            </FormControl>
            <Typography variant="body2" gutterBottom>
              Simulations: <strong>{numSimulations.toLocaleString()}</strong>
            </Typography>
            <Slider
              value={numSimulations} min={100} max={5000} step={null}
              marks={[{ value: 100, label: '100' }, { value: 500, label: '500' }, { value: 1000, label: '1K' }, { value: 2500, label: '2.5K' }, { value: 5000, label: '5K' }]}
              valueLabelDisplay="auto" onChange={(_, v) => setNumSimulations(v as number)} sx={{ mb: 3 }}
            />
            <Button variant="contained" fullWidth size="large"
              startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              disabled={!scenarioId || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Running…' : 'Run Simulation'}
            </Button>
            {mutation.isError && <Alert severity="error" sx={{ mt: 2 }}>{(mutation.error as Error).message}</Alert>}
          </CardContent>
        </Card>
        {result && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Summary</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Success Rate</Typography>
                  <Chip label={`${result.successRate.toFixed(1)}%`} color={successColor(result.successRate)} size="small" />
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Median Final Net Worth</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    ${(result.percentilesByYear?.slice(-1)[0]?.p50 ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Years modelled</Typography>
                  <Typography variant="body2" fontWeight={600}>{result.percentilesByYear?.length ?? 0}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        {!result ? (
          <Card sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography color="text.secondary" sx={{ mb: 1 }}>No simulation run yet</Typography>
              <Typography variant="caption" color="text.secondary">Select a scenario and click "Run Simulation"</Typography>
            </Box>
          </Card>
        ) : (
          <>
            <MonteCarloChart data={result.percentilesByYear ?? []} successRate={result.successRate} />
            <Card sx={{ mt: 2, maxHeight: 320, overflow: 'hidden' }}>
              <CardContent sx={{ p: 0 }}>
                <Typography variant="subtitle2" sx={{ p: 2, pb: 1 }}>Percentile Breakdown by Age</Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 260 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Age', 'p5', 'p25', 'p50 (Median)', 'p75', 'p95'].map((h) => (<TableCell key={h} align="right">{h}</TableCell>))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(result.percentilesByYear ?? []).filter((_, i) => i % 5 === 0).map((row) => (
                        <TableRow key={row.age} sx={{ bgcolor: (row.p50 ?? 0) <= 0 ? 'error.main' : undefined }}>
                          {[row.age, row.p5, row.p25, row.p50, row.p75, row.p95].map((v, i) => (
                            <TableCell key={i} align="right">{i === 0 ? v : `$${(v ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        )}
      </Grid>
    </Grid>
  );
}

// ─── Backtesting Tab ──────────────────────────────────────────────────────────
function BacktestingTab() {
  const { scenarios, household, accounts, apiFetch } = useCommonData();
  const [scenarioId, setScenarioId] = useState('');
  const [result, setResult] = useState<BacktestResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!scenarioId || !household) throw new Error('Select a scenario first');
      const scenario = scenarios?.find((s) => s.id === scenarioId);
      if (!scenario) throw new Error('Scenario not found');
      const params = JSON.parse(scenario.parameters ?? '{}');
      const member = primaryMember(household.members);
      const currentAge = member
        ? Math.floor((Date.now() - new Date(member.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
        : 45;
      const rrspBalance = (accounts ?? []).filter((a) => a.type === 'RRSP' || a.type === 'RRIF').reduce((s, a) => s + a.balance, 0);
      const tfsaBalance = (accounts ?? []).filter((a) => a.type === 'TFSA').reduce((s, a) => s + a.balance, 0);
      const nonRegBalance = (accounts ?? []).filter((a) => a.type === 'NON_REG').reduce((s, a) => s + a.balance, 0);
      return apiFetch<BacktestResult>('/projections/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentAge,
          retirementAge: params.retirementAge ?? 65,
          lifeExpectancy: params.lifeExpectancy ?? 90,
          annualExpensesInRetirement: params.annualExpensesInRetirement ?? 60000,
          annualIncome: params.annualIncome ?? 100000,
          annualSavings: params.annualSavings ?? 20000,
          rrspBalance, tfsaBalance, nonRegBalance,
          equityFraction: params.equityFraction ?? 0.6,
        }),
      });
    },
    onSuccess: (data) => setResult(data),
  });

  const successColor = (rate: number) => (rate >= 90 ? 'success' : rate >= 75 ? 'warning' : 'error') as 'success' | 'warning' | 'error';

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <InfoPanel
          title="Historical Backtesting"
          what="Tests your retirement plan against every overlapping historical return window from 1970-2024 using real TSX Composite and FTSE Canada Bond data. Each window represents a complete retirement starting from a different year in history."
          inputs={[
            'Retirement age & life expectancy',
            'Annual expenses in retirement',
            'Current RRSP, TFSA, non-reg balances',
            'Annual savings rate (pre-retirement accumulation)',
            'Equity fraction (% in stocks vs bonds)',
          ]}
          interpretation="Success rate = % of historical windows where your portfolio never depleted. Worst-case start year (often mid-1960s or 1999) reveals sequence-of-returns risk. Best-case shows upside. Unlike Monte Carlo, these are real market returns - not simulated."
          relevance="Complements Monte Carlo by grounding results in actual history. A plan that survived 1966 (worst sequence ever recorded) or 2000-2002 is genuinely stress-tested."
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Historical Backtesting</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Tests your plan against every recorded historical return window using TSX + Canadian bond data (1970–2024).
            </Typography>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Scenario</InputLabel>
              <Select value={scenarioId} label="Scenario" onChange={(e) => setScenarioId(e.target.value)}>
                {(scenarios ?? []).map((s) => (<MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>))}
              </Select>
            </FormControl>
            <Button variant="contained" fullWidth size="large"
              startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              disabled={!scenarioId || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Running…' : 'Run Backtest'}
            </Button>
            {mutation.isError && <Alert severity="error" sx={{ mt: 2 }}>{(mutation.error as Error).message}</Alert>}
          </CardContent>
        </Card>
        {result && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Results</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Historical Success Rate</Typography>
                  <Chip label={`${result.successRate.toFixed(1)}%`} color={successColor(result.successRate)} size="small" />
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Windows Tested</Typography>
                  <Typography variant="body2" fontWeight={600}>{result.numWindows}</Typography>
                </Box>
                {result.worstCase && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Worst Start Year</Typography>
                    <Typography variant="body2" fontWeight={600}>{result.worstCase.startYear}</Typography>
                  </Box>
                )}
                {result.bestCase && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Best Start Year</Typography>
                    <Typography variant="body2" fontWeight={600}>{result.bestCase.startYear}</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        )}
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        {!result ? (
          <Card sx={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography color="text.secondary" sx={{ mb: 1 }}>No backtest run yet</Typography>
              <Typography variant="caption" color="text.secondary">Select a scenario and click "Run Backtest"</Typography>
            </Box>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{result.windows.length} historical windows tested</Typography>
              {result.dataConstrained && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Your scenario's horizon exceeds the 55-year historical dataset (1970–2024). Windows starting at 1970 use long-term average returns for years beyond 2024. Results are still meaningful but treat with extra caution.
                </Alert>
              )}
              <BacktestChart windows={result.windows} successRate={result.successRate} />
            </CardContent>
          </Card>
        )}
      </Grid>
    </Grid>
  );
}

// ─── Guyton-Klinger Tab ───────────────────────────────────────────────────────
function GuytonKlingerTab() {
  const { scenarios, household, accounts, apiFetch } = useCommonData();
  const [scenarioId, setScenarioId] = useState('');
  const [result, setResult] = useState<GKResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!scenarioId || !household) throw new Error('Select a scenario first');
      const scenario = scenarios?.find((s) => s.id === scenarioId);
      if (!scenario) throw new Error('Scenario not found');
      const params = JSON.parse(scenario.parameters ?? '{}');
      const member = primaryMember(household.members);
      const currentAge = member
        ? Math.floor((Date.now() - new Date(member.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
        : 45;
      const rrspBalance = (accounts ?? []).filter((a) => a.type === 'RRSP' || a.type === 'RRIF').reduce((s, a) => s + a.balance, 0);
      const tfsaBalance = (accounts ?? []).filter((a) => a.type === 'TFSA').reduce((s, a) => s + a.balance, 0);
      const nonRegBalance = (accounts ?? []).filter((a) => a.type === 'NON_REG').reduce((s, a) => s + a.balance, 0);
      const retirementAge = params.retirementAge ?? 65;
      const growthRate = params.expectedReturn ?? 0.06;
      const yearsUntilRetirement = Math.max(0, retirementAge - currentAge);
      const annualSavings = params.annualSavings ?? 20000;
      const initialPortfolio = rrspBalance + tfsaBalance + nonRegBalance;
      const projectedPortfolio = initialPortfolio * Math.pow(1 + growthRate, yearsUntilRetirement)
        + (yearsUntilRetirement > 0 ? annualSavings * ((Math.pow(1 + growthRate, yearsUntilRetirement) - 1) / growthRate) : 0);
      return apiFetch<GKResult>('/projections/guyton-klinger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialPortfolio: projectedPortfolio,
          initialWithdrawal: params.annualExpensesInRetirement ?? 60000,
          expectedReturn: growthRate,
          inflationRate: params.inflationRate ?? 0.025,
          stdDevReturn: params.volatility ?? 0.12,
          years: (params.lifeExpectancy ?? 90) - retirementAge,
          retirementAge,
        }),
      });
    },
    onSuccess: (data) => setResult(data),
  });

  const fmt = (v: number) => `$${v.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <InfoPanel
          title="Guyton-Klinger Guardrails"
          what="Models a flexible spending strategy where withdrawals adapt each year based on portfolio performance. If your withdrawal rate exceeds the upper guardrail (default 7%), spending is cut by 10%. If it drops below the lower guardrail (default 4%), you can spend 10% more - allowing you to enjoy good markets while preserving capital in bad ones."
          inputs={[
            'Initial portfolio value (projected from current accounts to retirement)',
            'Initial annual withdrawal (annual expenses in retirement)',
            'Expected return and volatility',
            'Inflation rate',
            'Retirement duration (life expectancy minus retirement age)',
          ]}
          interpretation="Portfolio Survived means balance stayed positive through all years. Watch the cut/increase counts - frequent cuts signal the plan is stressed. Flat withdrawal periods after cuts confirm the guardrails are working. Compare final portfolio to initial to judge legacy value."
          relevance="Demonstrates why rigid 4% fixed-withdrawal rules can fail in volatile markets, and how dynamic spending rules give a plan much greater longevity."
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Guyton-Klinger Guardrails</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Flexible spending model — withdrawals adapt automatically to portfolio performance via upper/lower guardrails.
            </Typography>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Scenario</InputLabel>
              <Select value={scenarioId} label="Scenario" onChange={(e) => setScenarioId(e.target.value)}>
                {(scenarios ?? []).map((s) => (<MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>))}
              </Select>
            </FormControl>
            <Button variant="contained" fullWidth size="large"
              startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              disabled={!scenarioId || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Running…' : 'Run G-K Analysis'}
            </Button>
            {mutation.isError && <Alert severity="error" sx={{ mt: 2 }}>{(mutation.error as Error).message}</Alert>}
          </CardContent>
        </Card>
        {result && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Outcome</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Portfolio Survived</Typography>
                  <Chip label={result.portfolioSurvived ? 'Yes' : 'No'} color={result.portfolioSurvived ? 'success' : 'error'} size="small" />
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Initial Withdrawal</Typography>
                  <Typography variant="body2" fontWeight={600}>{fmt(result.initialWithdrawal)}/yr</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Final Portfolio</Typography>
                  <Typography variant="body2" fontWeight={600}>{fmt(result.finalPortfolio)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Total Withdrawn</Typography>
                  <Typography variant="body2" fontWeight={600}>{fmt(result.totalWithdrawn)}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Cuts triggered</Typography>
                  <Typography variant="body2" fontWeight={600}>{result.years.filter((y: any) => y.guardrailAction === 'cut').length}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Increases triggered</Typography>
                  <Typography variant="body2" fontWeight={600}>{result.years.filter((y: any) => y.guardrailAction === 'increase').length}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        {!result ? (
          <Card sx={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography color="text.secondary" sx={{ mb: 1 }}>No analysis run yet</Typography>
              <Typography variant="caption" color="text.secondary">Select a scenario and click "Run G-K Analysis"</Typography>
            </Box>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Portfolio Balance &amp; Adaptive Withdrawals</Typography>
                <GuytonKlingerChart years={result.years} initialWithdrawal={result.initialWithdrawal} />
              </CardContent>
            </Card>
            <Card sx={{ mt: 2, maxHeight: 280, overflow: 'hidden' }}>
              <CardContent sx={{ p: 0 }}>
                <Typography variant="subtitle2" sx={{ p: 2, pb: 1 }}>Year-by-Year Withdrawals</Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 230 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Age', 'Portfolio', 'Withdrawal', 'W-Rate', 'Action'].map((h) => (<TableCell key={h} align="right">{h}</TableCell>))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.years.filter((_: any, i: number) => i % 2 === 0).map((row: any) => (
                        <TableRow key={row.age}>
                          <TableCell align="right">{row.age}</TableCell>
                          <TableCell align="right">{fmt(row.portfolioBalance)}</TableCell>
                          <TableCell align="right">{fmt(row.withdrawal)}</TableCell>
                          <TableCell align="right">{(row.withdrawalRate * 100).toFixed(1)}%</TableCell>
                          <TableCell align="right">
                            {row.guardrailAction !== 'none' ? (
                              <Chip label={row.guardrailAction} color={row.guardrailAction === 'cut' ? 'error' : 'success'} size="small" />
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        )}
      </Grid>
    </Grid>
  );
}

// ─── Heatmap Tab ──────────────────────────────────────────────────────────────
function HeatmapTab() {
  const { scenarios, household, accounts, apiFetch } = useCommonData();
  const [scenarioId, setScenarioId] = useState('');
  const [heatmapData, setHeatmapData] = useState<HeatmapData[] | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState('');

  const X_VALUES = ['2.5%', '3.0%', '3.5%', '4.0%', '4.5%', '5.0%'];
  const Y_VALUES = ['30%', '40%', '50%', '60%', '70%', '80%'];

  async function runHeatmap() {
    if (!scenarioId || !household) { setErr('Select a scenario first'); return; }
    const scenario = scenarios?.find((s) => s.id === scenarioId);
    if (!scenario) return;
    const params = JSON.parse(scenario.parameters ?? '{}');
    const member = primaryMember(household.members);
    const currentAge = member
      ? Math.floor((Date.now() - new Date(member.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : 45;
    const rrsp = (accounts ?? []).filter((a) => a.type === 'RRSP' || a.type === 'RRIF').reduce((s, a) => s + a.balance, 0);
    const tfsa = (accounts ?? []).filter((a) => a.type === 'TFSA').reduce((s, a) => s + a.balance, 0);
    const nonReg = (accounts ?? []).filter((a) => a.type === 'NON_REG').reduce((s, a) => s + a.balance, 0);
    const totalPortfolio = rrsp + tfsa + nonReg || 500_000;
    const retirementYears = (params.lifeExpectancy ?? 90) - (params.retirementAge ?? 65);

    setRunning(true);
    setErr('');
    try {
      const results: HeatmapData[] = [];
      const xRates = [0.025, 0.03, 0.035, 0.04, 0.045, 0.05];
      const yEquities = [0.30, 0.40, 0.50, 0.60, 0.70, 0.80];

      for (const eq of yEquities) {
        for (let xi = 0; xi < xRates.length; xi++) {
          const wr = xRates[xi];
          const annualWithdrawal = totalPortfolio * wr;
          const payload = {
            currentAge: params.retirementAge ?? 65,
            endAge: params.lifeExpectancy ?? 90,
            province: 'ON',
            employmentIncome: 0,
            retirementAge: params.retirementAge ?? 65,
            annualExpenses: annualWithdrawal,
            inflationRate: params.inflationRate ?? 0.02,
            nominalReturnRate: eq * 0.07 + (1 - eq) * 0.03,
            rrspBalance: rrsp, tfsaBalance: tfsa, nonRegBalance: nonReg,
            volatility: eq * 0.16 + (1 - eq) * 0.05,
            stdDevReturn: eq * 0.16 + (1 - eq) * 0.05,
            numSimulations: 500,
            trials: 500,
            retirementYears,
            initialPortfolio: totalPortfolio,
            annualWithdrawal,
            equityFraction: eq,
            seed: 42,
          };
          const res = await apiFetch('/projections/monte-carlo', {
            method: 'POST',
            body: JSON.stringify(payload),
          }) as { successRate: number };
          results.push({ xLabel: X_VALUES[xi], yLabel: `${(eq * 100).toFixed(0)}%`, value: res.successRate });
        }
      }
      setHeatmapData(results);
    } catch (e: any) {
      setErr(e.message ?? 'Failed to run heatmap');
    } finally {
      setRunning(false);
    }
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <InfoPanel
          title="Success Rate Heatmap"
          what="Runs 36 Monte Carlo simulations across a grid of 6 withdrawal rates (2.5%-5.0%) x 6 equity fractions (30%-80%). Each cell shows the probability your portfolio survives the full retirement period. Reveals how sensitive your plan is to both spending rate and asset allocation simultaneously."
          inputs={[
            'Scenario retirement age & life expectancy (determines retirement duration)',
            'Current account balances (RRSP + TFSA + non-reg = total portfolio)',
            'Inflation rate from scenario',
            'No other inputs needed - withdrawal rate and equity mix are swept automatically',
          ]}
          interpretation="Green cells = high success (>90%). Red = dangerous. Look for the boundary between green and yellow - that is your safe withdrawal rate range for a given allocation. If the entire grid is green, your portfolio is likely large relative to spending. If mostly red, consider delaying retirement or reducing expenses."
          relevance="Uniquely powerful for understanding trade-offs: you can see at a glance whether shifting from 60% to 70% equities meaningfully improves your success rate, or whether withdrawing 3.5% vs 4.0% is the more impactful lever."
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>Parameters</Typography>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Scenario</InputLabel>
              <Select value={scenarioId} label="Scenario" onChange={(e) => setScenarioId(e.target.value)}>
                {(scenarios ?? []).map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary" mb={2}>
              This will run 36 Monte Carlo simulations across a grid of 6 withdrawal rates × 6 equity fractions.
              Each cell shows the probability your portfolio survives the full retirement period.
            </Typography>
            {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
            <Button
              fullWidth variant="contained"
              startIcon={running ? <CircularProgress size={16} /> : <PlayArrowIcon />}
              disabled={!scenarioId || running}
              onClick={runHeatmap}
            >
              {running ? 'Running 36 simulations…' : 'Generate Heatmap'}
            </Button>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        {heatmapData ? (
          <Card>
            <CardContent>
              <Typography variant="h6" mb={1}>Success Rate Heatmap</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Green = high success, Red = portfolio likely depleted
              </Typography>
              <HeatmapChart
                data={heatmapData}
                xValues={X_VALUES}
                yValues={Y_VALUES}
                xTitle="Withdrawal Rate"
                yTitle="Equity Fraction"
              />
            </CardContent>
          </Card>
        ) : (
          <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CardContent sx={{ textAlign: 'center', py: 8 }}>
              <Typography color="text.secondary">
                Select a scenario and click Generate Heatmap to see success rates across parameter combinations.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Grid>
    </Grid>
  );
}

// ─── Historical Scenarios Tab ─────────────────────────────────────────────────

const OUTCOME_ROWS: { key: keyof HistoricalScenariosResult['outcomeCategories']; label: string; color: string }[] = [
  { key: 'largeSurplus',      label: 'Large Surplus',        color: '#2e7d32' },
  { key: 'comfortable',       label: 'Comfortable',          color: '#388e3c' },
  { key: 'barelyMadeIt',      label: 'Barely Made It',       color: '#f9a825' },
  { key: 'almostMadeIt',      label: 'Almost Made It',       color: '#e65100' },
  { key: 'failedInTheMiddle', label: 'Failed in the Middle', color: '#c62828' },
];

const RUN_COLORS = ['#1565c0', '#2e7d32', '#b71c1c', '#6a1b9a'];

type RunResult = HistoricalScenariosResult & {
  label: string;
  equityAsset: string;
  bondAsset: string;
  dataYears: number;
};

interface RunConfig {
  id: string;
  label: string;
  color: string;
  scenarioId: string;
  equityAsset: string;
  bondAsset: string;
  equityFraction: number;
  trials: number;
  result: RunResult | null;
  isPending: boolean;
  error: string;
}

function mkRun(idx: number): RunConfig {
  return {
    id: generateId(),
    label: `Run ${idx + 1}`,
    color: RUN_COLORS[idx % RUN_COLORS.length],
    scenarioId: '',
    equityAsset: 'TSX',
    bondAsset: 'CA_BOND',
    equityFraction: 0.6,
    trials: 500,
    result: null,
    isPending: false,
    error: '',
  };
}

function generateId(): string {
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
    const hex = Array.from(bytes).map((b: number) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'id-' + Math.random().toString(36).slice(2, 9);
}

function HistoricalScenariosTab() {
  const { scenarios, household, accounts, apiFetch } = useCommonData();
  const [runs, setRuns] = useState<RunConfig[]>([mkRun(0)]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [tickerInput, setTickerInput] = useState('');
  const [fetchingTicker, setFetchingTicker] = useState('');
  const [fetchMsg, setFetchMsg] = useState('');

  const { data: sources, refetch: refetchSources } = useQuery<SeriesInfo[]>({
    queryKey: ['market-data-sources'],
    queryFn: () => apiFetch('/market-data/sources'),
    enabled: sourcesOpen,
  });

  function updateRun(id: string, patch: Partial<RunConfig>) {
    setRuns(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function addRun() {
    if (runs.length >= 4) return;
    setRuns(prev => [...prev, mkRun(prev.length)]);
  }

  function removeRun(id: string) {
    setRuns(prev => prev.filter(r => r.id !== id));
  }

  async function handleFetchTicker(ticker: string) {
    if (!ticker.trim()) return;
    setFetchingTicker(ticker.trim());
    setFetchMsg('');
    try {
      await apiFetch('/market-data/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.trim() }),
      });
      setFetchMsg(`✓ Fetched data for ${ticker.trim()}`);
      if (sourcesOpen) refetchSources();
    } catch (e: any) {
      setFetchMsg(`Error: ${e.message}`);
    } finally {
      setFetchingTicker('');
    }
  }

  async function handleFetchBoC() {
    setFetchingTicker('BOC');
    setFetchMsg('');
    try {
      await apiFetch('/market-data/fetch-boc', { method: 'POST' });
      setFetchMsg('✓ BoC data fetched (BOC_OVERNIGHT, BOC_10Y_BOND)');
      if (sourcesOpen) refetchSources();
    } catch (e: any) {
      setFetchMsg(`Error: ${e.message}`);
    } finally {
      setFetchingTicker('');
    }
  }

  async function runScenario(runId: string) {
    const run = runs.find(r => r.id === runId);
    if (!run || !run.scenarioId || !household) return;
    const scenario = scenarios?.find(s => s.id === run.scenarioId);
    if (!scenario) return;

    updateRun(runId, { isPending: true, error: '', result: null });
    try {
      const params = JSON.parse(scenario.parameters ?? '{}');
      const member = primaryMember(household.members);
      const currentAge = member
        ? Math.floor((Date.now() - new Date(member.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
        : 45;
      const rrspBalance = (accounts ?? []).filter(a => a.type === 'RRSP' || a.type === 'RRIF').reduce((s, a) => s + a.balance, 0);
      const tfsaBalance = (accounts ?? []).filter(a => a.type === 'TFSA').reduce((s, a) => s + a.balance, 0);
      const nonRegBalance = (accounts ?? []).filter(a => a.type === 'NON_REG').reduce((s, a) => s + a.balance, 0);
      const data = await apiFetch<RunResult>('/projections/historical-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentAge,
          retirementAge: params.retirementAge ?? 65,
          endAge: params.lifeExpectancy ?? 90,
          annualExpensesInRetirement: params.annualExpensesInRetirement ?? 60000,
          annualIncome: params.annualIncome ?? 100000,
          province: params.province ?? 'ON',
          rrspBalance, tfsaBalance, nonRegBalance,
          inflationRate: params.inflationRate ?? 0.025,
          nominalReturnRate: params.expectedReturn ?? 0.06,
          cppStartAge: params.cppStartAge ?? 65,
          oasStartAge: params.oasStartAge ?? 65,
          trials: run.trials,
          equityFraction: run.equityFraction,
          equityAsset: run.equityAsset,
          bondAsset: run.bondAsset,
          label: run.label,
        }),
      });
      updateRun(runId, { result: data, isPending: false });
    } catch (e: any) {
      updateRun(runId, { error: e.message, isPending: false });
    }
  }

  const completedRuns = runs.filter(r => r.result);
  const fanSeries = completedRuns.map(r => ({
    label: r.label,
    color: r.color,
    data: r.result!.percentilesByYear,
    successRate: r.result!.successRate,
  }));

  const successColor = (rate: number) => (rate >= 90 ? 'success' : rate >= 75 ? 'warning' : 'error') as 'success' | 'warning' | 'error';
  const successMsg = (rate: number) => {
    if (rate >= 90) return 'Excellent — survives the vast majority of historical environments.';
    if (rate >= 75) return 'Solid but carries some risk. Consider modest adjustments.';
    if (rate >= 50) return 'At risk — a significant fraction of histories result in depletion.';
    return 'Needs attention — most historical scenarios result in depletion.';
  };

  return (
    <Grid container spacing={3}>

      {/* ── InfoPanel ── */}
      <Grid size={{ xs: 12 }}>
        <InfoPanel
          title="Historical Scenarios (Bootstrap Simulation)"
          what="Samples random annual returns from the actual historical record — including real crises, inflation shocks, and bull markets. Add up to 4 comparison runs with different asset mixes or ETF proxies, then overlay them in a single fan chart for direct perspective comparison."
          inputs={[
            'Scenario (retirement age, expenses, balances)',
            'Equity asset: TSX (seeded) or any Yahoo Finance ticker (e.g. XIC.TO, SPY)',
            'Bond asset: CA_BOND (seeded), BOC_10Y_BOND, BOC_OVERNIGHT, or a fetched ticker',
            'Equity fraction (% stocks vs bonds)',
            'Number of bootstrap trials',
          ]}
          interpretation="Overlay multiple runs to compare asset class assumptions side by side. Wide fan = high uncertainty. Green/yellow/red gauge = overall success rate. Outcome breakdown shows how trials ended across the full distribution."
          relevance="Bootstrap resampling from real history preserves fat tails and regime shifts (1970s stagflation, dot-com bust) that parametric models consistently underestimate."
        />
      </Grid>

      {/* ── Data Sources & Live Fetch ── */}
      <Grid size={{ xs: 12 }}>
        <Card variant="outlined">
          <CardContent sx={{ '&:last-child': { pb: 1.5 } }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', py: 0.5 }}
              onClick={() => setSourcesOpen(p => !p)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TuneIcon fontSize="small" color="action" />
                <Typography variant="subtitle2">Data Sources &amp; Live Fetch</Typography>
              </Box>
              <ExpandMoreIcon sx={{ color: 'text.secondary', transform: sourcesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </Box>
            <Collapse in={sourcesOpen}>
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Fetch live data from Yahoo Finance (equities) or the Bank of Canada Valet API (bond/rate proxies).
                  Fetched series are stored by their asset key and available to any run.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <TextField
                    size="small" label="Yahoo ticker (e.g. XIC.TO)" variant="outlined" sx={{ minWidth: 240 }}
                    value={tickerInput}
                    onChange={e => setTickerInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleFetchTicker(tickerInput); }}
                  />
                  <Button
                    variant="outlined" size="small"
                    disabled={!!fetchingTicker || !tickerInput.trim()}
                    startIcon={fetchingTicker && fetchingTicker !== 'BOC' ? <CircularProgress size={14} /> : undefined}
                    onClick={() => handleFetchTicker(tickerInput)}
                  >
                    Fetch Equity
                  </Button>
                  <Button
                    variant="outlined" size="small"
                    disabled={!!fetchingTicker}
                    startIcon={fetchingTicker === 'BOC' ? <CircularProgress size={14} /> : undefined}
                    onClick={handleFetchBoC}
                  >
                    Fetch BoC Rates
                  </Button>
                  {fetchMsg && (
                    <Typography variant="caption" color={fetchMsg.startsWith('✓') ? 'success.main' : 'error.main'}>
                      {fetchMsg}
                    </Typography>
                  )}
                </Box>

                {sources && sources.length > 0 && (
                  <Table size="small" sx={{ mb: 1.5 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Asset Key</TableCell>
                        <TableCell>Source</TableCell>
                        <TableCell align="right">Years</TableCell>
                        <TableCell>Methodology</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sources.map((s: SeriesInfo) => (
                        <TableRow key={s.asset}>
                          <TableCell>
                            <Typography variant="caption" fontWeight={700} sx={{ fontFamily: 'monospace' }}>{s.asset}</Typography>
                          </TableCell>
                          <TableCell><Chip size="small" label={s.source} /></TableCell>
                          <TableCell align="right"><Typography variant="caption">{s.count}</Typography></TableCell>
                          <TableCell><Typography variant="caption" color="text.secondary">{s.methodology}</Typography></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
                  <Typography variant="caption">
                    <strong>Methodology transparency:</strong> Yahoo Finance equity returns are year-over-year from monthly adjusted-close prices (unofficial v8 API).
                    Bond proxy uses BoC V39056 10-year GoC yield converted via modified-duration formula: <em>TR ≈ avg_yield − 8 × Δyield</em> (duration ≈ 8 for universe bond index).
                    GIC proxy uses BoC V122514 overnight rate averaged annually. Data is best-effort; always verify with official sources.
                  </Typography>
                </Alert>
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      </Grid>

      {/* ── Run Configuration Cards ── */}
      {runs.map((run, idx) => (
        <Grid size={{ xs: 12, md: 6 }} key={run.id}>
          <Card variant="outlined" sx={{ borderLeft: `4px solid ${run.color}` }}>
            <CardContent>
              {/* Card header: editable label + remove button */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: run.color, flexShrink: 0 }} />
                  <TextField
                    size="small" variant="standard" value={run.label}
                    onChange={e => updateRun(run.id, { label: e.target.value })}
                    inputProps={{ style: { fontWeight: 600, fontSize: 15 } }}
                    sx={{ width: 130 }}
                  />
                  <Typography variant="caption" color="text.disabled">#{idx + 1}</Typography>
                </Box>
                {runs.length > 1 && (
                  <IconButton size="small" onClick={() => removeRun(run.id)} title="Remove this run">
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>

              {/* Scenario select */}
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Scenario</InputLabel>
                <Select value={run.scenarioId} label="Scenario" onChange={e => updateRun(run.id, { scenarioId: e.target.value })}>
                  {(scenarios ?? []).map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>

              {/* Asset key inputs */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  size="small" label="Equity asset" fullWidth
                  value={run.equityAsset}
                  onChange={e => updateRun(run.id, { equityAsset: e.target.value })}
                  helperText="TSX or Yahoo ticker"
                />
                <TextField
                  size="small" label="Bond asset" fullWidth
                  value={run.bondAsset}
                  onChange={e => updateRun(run.id, { bondAsset: e.target.value })}
                  helperText="CA_BOND or ticker"
                />
              </Box>

              {/* Equity fraction slider */}
              <Typography variant="body2" gutterBottom>
                Equity: <strong>{(run.equityFraction * 100).toFixed(0)}%</strong> stocks / {((1 - run.equityFraction) * 100).toFixed(0)}% bonds
              </Typography>
              <Slider
                value={run.equityFraction} min={0.2} max={1} step={0.1}
                marks={[{ value: 0.2, label: '20%' }, { value: 0.6, label: '60%' }, { value: 1.0, label: '100%' }]}
                valueLabelDisplay="auto" valueLabelFormat={v => `${(v * 100).toFixed(0)}%`}
                onChange={(_, v) => updateRun(run.id, { equityFraction: v as number })}
                sx={{ mb: 2 }}
              />

              {/* Trials slider */}
              <Typography variant="body2" gutterBottom>Trials: <strong>{run.trials.toLocaleString()}</strong></Typography>
              <Slider
                value={run.trials} min={100} max={1000} step={null}
                marks={[{ value: 100, label: '100' }, { value: 250, label: '250' }, { value: 500, label: '500' }, { value: 1000, label: '1K' }]}
                valueLabelDisplay="auto"
                onChange={(_, v) => updateRun(run.id, { trials: v as number })}
                sx={{ mb: 2.5 }}
              />

              {/* Run button */}
              <Button
                variant="contained" fullWidth size="large"
                sx={{ bgcolor: run.color, '&:hover': { bgcolor: run.color, filter: 'brightness(0.85)' } }}
                startIcon={run.isPending ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                disabled={!run.scenarioId || run.isPending}
                onClick={() => runScenario(run.id)}
              >
                {run.isPending ? 'Running…' : 'Run'}
              </Button>
              {run.error && <Alert severity="error" sx={{ mt: 1.5 }}>{run.error}</Alert>}

              {/* Result summary */}
              {run.result && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <OutcomeGauge successRate={run.result.successRate} size={80} />
                    <Box>
                      <Chip
                        label={`${run.result.successRate.toFixed(1)}% success`}
                        color={successColor(run.result.successRate)}
                        size="small"
                        sx={{ mb: 0.5 }}
                      />
                      <Typography variant="caption" color="text.secondary" display="block">
                        {run.result.dataYears ? `${run.result.dataYears} data yrs · ` : ''}{run.result.trials} trials
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Eq: <strong>{run.result.equityAsset ?? run.equityAsset}</strong> · Bd: <strong>{run.result.bondAsset ?? run.bondAsset}</strong>
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    {successMsg(run.result.successRate)}
                  </Typography>
                  <Divider sx={{ mb: 1 }} />
                  <Table size="small">
                    <TableBody>
                      {OUTCOME_ROWS.map(({ key, label, color }) => (
                        <TableRow key={key}>
                          <TableCell sx={{ py: 0.3, border: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                              <Typography variant="caption">{label}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ py: 0.3, border: 0 }}>
                            <Typography variant="caption" fontWeight={600}>
                              {run.result!.outcomeCategories[key].pct.toFixed(1)}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}

      {/* Add Run tile */}
      {runs.length < 4 && (
        <Grid size={{ xs: 12, md: 6 }}>
          <Box
            sx={{
              border: '2px dashed', borderColor: 'divider', borderRadius: 2,
              minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
            }}
            onClick={addRun}
          >
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <AddCircleOutlineIcon sx={{ color: 'text.disabled', fontSize: 36, mb: 0.5 }} />
              <Typography variant="body2" color="text.secondary">Add Comparison Run</Typography>
              <Typography variant="caption" color="text.disabled">Up to 4 overlays</Typography>
            </Box>
          </Box>
        </Grid>
      )}

      {/* ── Multi-series Fan Chart ── */}
      <Grid size={{ xs: 12 }}>
        {fanSeries.length === 0 ? (
          <Card variant="outlined" sx={{ height: 440, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <BarChartIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary" sx={{ mb: 0.5 }}>No simulations run yet</Typography>
              <Typography variant="caption" color="text.secondary">
                Configure a run above and click the play button — completed runs appear here as overlays
              </Typography>
            </Box>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2">Net Worth — Percentile Fan Chart</Typography>
                <Typography variant="caption" color="text.secondary">
                  {fanSeries.length} scenario{fanSeries.length > 1 ? 's' : ''} overlaid · medians + p5–p95 bands per series
                </Typography>
              </Box>
              <HistoricalFanChart series={fanSeries} />
            </CardContent>
          </Card>
        )}
      </Grid>
    </Grid>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function SimulationsPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h3" sx={{ mb: 1 }}>Simulations</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Probabilistic and historical modelling to stress-test your retirement plan.
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Monte Carlo" />
        <Tab label="Historical Backtesting" />
        <Tab label="Guyton-Klinger" />
        <Tab label="Success Rate Heatmap" />
        <Tab label="Historical Scenarios" />
      </Tabs>

      {tab === 0 && <MonteCarloTab />}
      {tab === 1 && <BacktestingTab />}
      {tab === 2 && <GuytonKlingerTab />}
      {tab === 3 && <HeatmapTab />}
      {tab === 4 && <HistoricalScenariosTab />}
    </Box>
  );
}
