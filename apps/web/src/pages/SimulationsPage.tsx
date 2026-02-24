import {
  Box, Typography, Card, CardContent, Grid, Button, FormControl, InputLabel, Select,
  MenuItem, Slider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress, Alert, Divider, Tabs, Tab, Collapse, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TuneIcon from '@mui/icons-material/Tune';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import { MonteCarloChart } from '../components/charts/MonteCarloChart';
import { BacktestChart } from '../components/charts/BacktestChart';
import { GuytonKlingerChart } from '../components/charts/GuytonKlingerChart';
import { HeatmapChart, type HeatmapData } from '../components/charts/HeatmapChart';

interface Scenario { id: string; name: string; parameters: string; }
interface Household { id: string; members: { id: string; dateOfBirth: string; }[]; }
interface Account { id: string; type: string; balance: number; }
interface PercentileYear { age: number; p5: number; p25: number; p50: number; p75: number; p95: number; }
interface MCResult { percentilesByYear: PercentileYear[]; successRate: number; median: number; }
interface BacktestResult { successRate: number; numWindows: number; windows: any[]; worstCase: any; bestCase: any; }
interface GKResult { years: any[]; portfolioSurvived: boolean; initialWithdrawal: number; finalPortfolio: number; totalWithdrawn: number; }

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
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                  <BarChartIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight={600} color="primary">What it does</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">{what}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
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
              <Grid item xs={12} sm={4}>
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
      const member = household.members[0];
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
      <Grid item xs={12}>
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
      <Grid item xs={12} md={4}>
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
      <Grid item xs={12} md={8}>
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
      const member = household.members[0];
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
      <Grid item xs={12}>
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
      <Grid item xs={12} md={4}>
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
      <Grid item xs={12} md={8}>
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
      const member = household.members[0];
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
      <Grid item xs={12}>
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
      <Grid item xs={12} md={4}>
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
      <Grid item xs={12} md={8}>
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
    const member = household.members[0];
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
      <Grid item xs={12}>
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
      <Grid item xs={12} md={4}>
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
      <Grid item xs={12} md={8}>
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
      </Tabs>

      {tab === 0 && <MonteCarloTab />}
      {tab === 1 && <BacktestingTab />}
      {tab === 2 && <GuytonKlingerTab />}
      {tab === 3 && <HeatmapTab />}
    </Box>
  );
}
