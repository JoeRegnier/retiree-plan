import { useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Alert, CircularProgress,
  Grid, Chip, Tab, Tabs, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, MenuItem, TextField, Tooltip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useApi } from '../hooks/useApi';
import { CashFlowChart } from '../components/charts/CashFlowChart';
import type { ProjectionYear, ChartMilestone } from '../components/charts/CashFlowChart';
import { MonteCarloChart, type MonteCarloPercentiles } from '../components/charts/MonteCarloChart';
import { SankeyChart } from '../components/charts/SankeyChart';
import { WaterfallChart } from '../components/charts/WaterfallChart';
import { IncomeAllocationChart } from '../components/charts/IncomeAllocationChart';

interface Household { id: string; name: string; members: any[]; accounts: any[]; }
interface Scenario { id: string; name: string; parameters: string; }
interface Expense { id: string; name: string; annualAmount: number; startAge?: number | null; endAge?: number | null; indexToInflation?: boolean; }
interface YnabStatus { connected: boolean; }
interface HistorySnapshot { year: number; month: number; monthKey: string; netWorth: number; }

interface MonteCarloResult {
  successRate: number;
  percentilesByYear: MonteCarloPercentiles[];
}

function parseParams(s: Scenario) {
  try { return typeof s.parameters === 'string' ? JSON.parse(s.parameters) : s.parameters; }
  catch { return {}; }
}

function exportCsv(data: ProjectionYear[]) {
  const header = 'Year,Age,RRSP,TFSA,Non-Reg,Net Worth,Total Income,Expenses,Tax,Net Cash Flow';
  const rows = data.map((d) =>
    `${d.year},${d.age},${d.rrspBalance ?? 0},${d.tfsaBalance ?? 0},${d.nonRegBalance ?? 0},${d.netWorth},${d.totalIncome},${d.totalExpenses},${d.taxPaid ?? 0},${d.netCashFlow}`
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'projection.csv';
  a.click();
  URL.revokeObjectURL(url);
}

import type { WaterfallYear } from '../components/charts/WaterfallChart';
import { calcAge } from '../utils/age';

function WaterfallSection({
  projectionData, nwHistory, memberDob, milestones,
}: { projectionData: ProjectionYear[]; nwHistory: HistorySnapshot[]; memberDob?: string; milestones?: ChartMilestone[]; }) {
  const merged = useMemo((): WaterfallYear[] => {
    const birthYear = memberDob ? new Date(memberDob).getFullYear() : null;

    // Aggregate monthly snapshots to year-end (last month seen per year)
    const yearEnd = new Map<number, number>();
    for (const s of nwHistory) {
      const existing = yearEnd.get(s.year);
      if (existing === undefined || s.month > (nwHistory.find(x => x.year === s.year && x.netWorth === existing)?.month ?? 0)) {
        yearEnd.set(s.year, s.netWorth);
      }
    }
    // Simpler: just keep the max month per year
    const byYear = new Map<number, { netWorth: number; month: number }>();
    for (const s of nwHistory) {
      const cur = byYear.get(s.year);
      if (!cur || s.month > cur.month) byYear.set(s.year, { netWorth: s.netWorth, month: s.month });
    }

    const historicalYears = Array.from(byYear.entries()).sort(([a], [b]) => a - b);

    const historicalBars: WaterfallYear[] = historicalYears.map(([year, { netWorth }], i) => {
      const prevNw = i === 0 ? netWorth : (historicalYears[i - 1][1].netWorth);
      return {
        year,
        age: birthYear ? year - birthYear : undefined,
        netWorth,
        netCashFlow: netWorth - prevNw,
        isHistorical: true,
      };
    });

    const projectedBars: WaterfallYear[] = projectionData.map((d) => ({
      year: d.year,
      age: d.age,
      netWorth: d.totalNetWorth ?? 0,
      netCashFlow: d.netCashFlow,
      isHistorical: false,
    }));

    // Remove projected years that overlap with historical
    const lastHistYear = historicalBars.length > 0 ? historicalBars[historicalBars.length - 1].year : -Infinity;
    const nonOverlapping = projectedBars.filter((b) => b.year > lastHistYear);

    return [...historicalBars, ...nonOverlapping];
  }, [projectionData, nwHistory, memberDob]);

  const hasHistory = nwHistory.length > 0;
  const subtitle = hasHistory
    ? `Actual history from YNAB + projected (${nwHistory[0].year}–present, then forward)`
    : 'Year-by-year net worth changes (projected only)';

  return (
    <>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>{subtitle}</Typography>
      <WaterfallChart data={merged} milestones={milestones} />
    </>
  );
}

export function ProjectionsPage() {
  const { apiFetch } = useApi();
  const [searchParams] = useSearchParams();
  const defaultScenarioId = searchParams.get('scenarioId') ?? '';
  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultScenarioId);
  const [tab, setTab] = useState(0);
  const [projectionData, setProjectionData] = useState<ProjectionYear[] | null>(null);
  const [mcData, setMcData] = useState<MonteCarloResult | null>(null);
  const [runError, setRunError] = useState('');

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

  const { data: expenseItems } = useQuery<Expense[]>({
    queryKey: ['expenses', household?.id],
    queryFn: () => apiFetch(`/expenses/household/${household!.id}`),
    enabled: !!household?.id,
  });

  const { data: ynabStatus } = useQuery<YnabStatus>({
    queryKey: ['ynab-status'],
    queryFn: () => apiFetch('/ynab/status'),
    retry: false,
  });

  const { data: nwHistory } = useQuery<HistorySnapshot[]>({
    queryKey: ['ynab-nw-history', household?.id],
    queryFn: () => apiFetch(`/ynab/net-worth-history?householdId=${household!.id}`),
    enabled: !!household?.id && !!ynabStatus?.connected,
    staleTime: 5 * 60 * 1000,
  });

  /** Member with the highest total income; determines the "current age" used across projections. */
  const primaryMember = useMemo(() => {
    const members = household?.members ?? [];
    if (!members.length) return undefined;
    return [...members].sort(
      (a: any, b: any) =>
        (b.incomeSources?.reduce((s: number, i: any) => s + i.annualAmount, 0) ?? 0) -
        (a.incomeSources?.reduce((s: number, i: any) => s + i.annualAmount, 0) ?? 0),
    )[0] as any;
  }, [household?.members]);

  const runProjection = useMutation({
    mutationFn: (payload: any) => apiFetch('/projections/cash-flow', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (data: any) => { setProjectionData(data); setRunError(''); },
    onError: (e: Error) => setRunError(e.message),
  });

  const runMC = useMutation({
    mutationFn: (payload: any) => apiFetch('/projections/monte-carlo', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (data: any) => { setMcData(data); setRunError(''); },
    onError: (e: Error) => setRunError(e.message),
  });

  const buildPayload = useCallback(() => {
    if (!household || !selectedScenarioId) return null;
    const scenario = scenarios?.find((s) => s.id === selectedScenarioId);
    if (!scenario) return null;
    const p = parseParams(scenario);
    const member = primaryMember;
    if (!member) return null;
    const currentAge = calcAge(member.dateOfBirth);
    const rrsp    = household.accounts?.filter((a: any) => a.type === 'RRSP' || a.type === 'RRIF').reduce((s: number, a: any) => s + a.balance, 0) ?? 0;
    const tfsa    = household.accounts?.filter((a: any) => a.type === 'TFSA').reduce((s: number, a: any) => s + a.balance, 0) ?? 0;
    const nonReg  = household.accounts?.filter((a: any) => a.type === 'NON_REG').reduce((s: number, a: any) => s + a.balance, 0) ?? 0;
    const cashBal = household.accounts?.filter((a: any) => a.type === 'CASH').reduce((s: number, a: any) => s + a.balance, 0) ?? 0;

    // Compute weighted-average estimatedReturnRate per account type.
    // When an account has null rate it is excluded from the average; if all are
    // null for a type we pass undefined and the engine uses the scenario default.
    const weightedRate = (accs: any[]): number | undefined => {
      const rated = accs.filter((a: any) => a.estimatedReturnRate != null);
      if (!rated.length) return undefined;
      const totalBal = rated.reduce((s: number, a: any) => s + a.balance, 0);
      if (totalBal <= 0) return rated[0].estimatedReturnRate as number;
      return rated.reduce((s: number, a: any) => s + a.balance * a.estimatedReturnRate, 0) / totalBal;
    };
    const rrspRate   = weightedRate(household.accounts?.filter((a: any) => a.type === 'RRSP' || a.type === 'RRIF') ?? []);
    const tfsaRate   = weightedRate(household.accounts?.filter((a: any) => a.type === 'TFSA') ?? []);
    const nonRegRate = weightedRate(household.accounts?.filter((a: any) => a.type === 'NON_REG') ?? []);
    const cashRate   = weightedRate(household.accounts?.filter((a: any) => a.type === 'CASH') ?? []);

    // Collect income sources from ALL members, excluding CPP/OAS which the engine
    // models separately via benefit formulas.
    const ENGINE_EXCLUDED = new Set(['CPP', 'OAS']);
    const incomeSources = (household.members ?? []).flatMap((m: any) =>
      (m.incomeSources ?? [])
        .filter((src: any) => !ENGINE_EXCLUDED.has(src.type))
        .map((src: any) => ({
          annualAmount: src.annualAmount as number,
          startAge: src.startAge as number | undefined,
          endAge: src.endAge as number | undefined,
          indexToInflation: src.indexToInflation !== false,
        }))
    );

    // Build per-entry expense list so start/end ages are respected in the engine.
    const expenseEntries = expenseItems && expenseItems.length > 0
      ? expenseItems.map((e) => ({
          annualAmount: e.annualAmount,
          ...(e.startAge != null ? { startAge: e.startAge } : {}),
          ...(e.endAge   != null ? { endAge:   e.endAge   } : {}),
          indexToInflation: e.indexToInflation !== false,
        }))
      : undefined;

    return {
      currentAge, endAge: p.lifeExpectancy ?? 90, province: member.province ?? 'ON',
      employmentIncome: 0, // superseded by incomeSources below
      incomeSources,
      retirementAge: p.retirementAge ?? 65,
      annualExpenses: expenseItems && expenseItems.length > 0
        ? expenseItems.reduce((s, e) => s + e.annualAmount, 0)
        : p.annualExpenses ?? 60_000,
      expenseEntries,
      inflationRate: p.inflationRate ?? 0.02,
      nominalReturnRate: p.expectedReturnRate ?? 0.06,
      cppStartAge: p.cppStartAge ?? 65, oasStartAge: p.oasStartAge ?? 65,
      rrspBalance: rrsp, tfsaBalance: tfsa, nonRegBalance: nonReg,
      cashBalance: cashBal,
      rrspContribution: household.accounts?.find((a: any) => a.type === 'RRSP')?.annualContribution ?? 0,
      tfsaContribution: household.accounts?.find((a: any) => a.type === 'TFSA')?.annualContribution ?? 0,
      rrifConversionAge: p.rrifStartAge ?? 71,
      nonRegTaxDragRate: p.nonRegTaxDragRate ?? 0,
      investSurplus: p.investSurplus ?? false,
      cashSavingsRate: cashRate ?? p.cashSavingsRate ?? 0.025,
      ...(rrspRate   != null ? { rrspReturnRate:   rrspRate   } : {}),
      ...(tfsaRate   != null ? { tfsaReturnRate:   tfsaRate   } : {}),
      ...(nonRegRate != null ? { nonRegReturnRate: nonRegRate } : {}),
      ...(p.glidePathSteps?.length ? { glidePathSteps: p.glidePathSteps } : {}),
      ...(p.spendingPhases?.length ? { spendingPhases: p.spendingPhases } : {}),
    };
  }, [household, selectedScenarioId, scenarios, expenseItems, primaryMember]);

  const handleRun = () => {
    const payload = buildPayload();
    if (!payload) { setRunError('Select a scenario and ensure your household has members.'); return; }
    setProjectionData(null);
    setMcData(null);
    runProjection.mutate(payload);
  };

  const handleRunMC = () => {
    const payload = buildPayload();
    if (!payload) { setRunError('Select a scenario first.'); return; }
    const scenario = scenarios?.find((s) => s.id === selectedScenarioId);
    const p = parseParams(scenario ?? { id: '', name: '', parameters: '{}' });
    runMC.mutate({ ...payload, volatility: p.volatility ?? 0.12, numSimulations: 1000, seed: 42 });
  };

  const isRunning = runProjection.isPending || runMC.isPending;

  /** Milestone markers derived from the selected scenario's parameters. */
  const milestones = useMemo((): ChartMilestone[] => {
    const scenario = scenarios?.find((s) => s.id === selectedScenarioId);
    if (!scenario) return [];
    const p = parseParams(scenario);
    const markers: ChartMilestone[] = [
      { age: p.retirementAge ?? 65, label: 'Retire', color: '#FF9800', type: 'event' },
      { age: p.rrifStartAge ?? 71,  label: 'RRIF',   color: '#9C27B0', type: 'event' },
    ];
    const cppAge = p.cppStartAge ?? 65;
    const oasAge = p.oasStartAge ?? 65;
    if (cppAge === oasAge) {
      markers.push({ age: cppAge, label: 'CPP/OAS', color: '#4CAF50', type: 'event' });
    } else {
      markers.push({ age: cppAge, label: 'CPP', color: '#4CAF50', type: 'event' });
      markers.push({ age: oasAge, label: 'OAS', color: '#4CAF50', type: 'event' });
    }
    for (const step of (p.glidePathSteps ?? [])) {
      markers.push({ age: step.age, label: `${(step.returnRate * 100).toFixed(1)}% rtn`, color: '#607D8B', type: 'glide' });
    }
    for (const phase of (p.spendingPhases ?? [])) {
      markers.push({ age: phase.fromAge, label: `${Math.round(phase.factor * 100)}% spend`, color: '#FF5722', type: 'spending' });
    }
    // Expense end-age events (mortgage payoff, debt payoff, etc.)
    for (const exp of (expenseItems ?? [])) {
      if (exp.endAge != null) {
        const label = exp.name ? exp.name.slice(0, 12) : `$${Math.round(exp.annualAmount / 1000)}K ends`;
        markers.push({ age: exp.endAge, label, color: '#E91E63', type: 'event' });
      }
    }
    return markers;
  }, [scenarios, selectedScenarioId, expenseItems]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h3">Cash-Flow Projections</Typography>
          <Typography variant="body1" color="text.secondary">
            Year-by-year income, expense, and net worth projections through retirement.
          </Typography>
        </Box>
        {projectionData && (
          <Tooltip title="Export to CSV">
            <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={() => exportCsv(projectionData)}>
              Export CSV
            </Button>
          </Tooltip>
        )}
      </Box>

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
              <TextField
                label="Scenario" select fullWidth size="small"
                inputProps={{ 'data-tour': 'scenario-select' }}
                value={selectedScenarioId} onChange={(e) => setSelectedScenarioId(e.target.value)}
                disabled={!scenarios?.length}
              >
                {(scenarios ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Button fullWidth variant="contained" startIcon={<PlayArrowIcon />}
                data-tour="run-projection-btn"
                onClick={handleRun} disabled={isRunning || !selectedScenarioId}>
                {runProjection.isPending ? <CircularProgress size={20} /> : 'Run Projection'}
              </Button>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Button fullWidth variant="outlined" onClick={handleRunMC}
                data-tour="run-mc-btn"
                disabled={isRunning || !selectedScenarioId || !projectionData}>
                {runMC.isPending ? <CircularProgress size={20} /> : 'Run Monte Carlo'}
              </Button>
            </Grid>
          </Grid>
          {runError && <Alert severity="error" sx={{ mt: 2 }}>{runError}</Alert>}
        </CardContent>
      </Card>

      {!household && (
        <Alert severity="warning">Set up your household first, then create a scenario to run projections.</Alert>
      )}

      {projectionData && projectionData.length > 0 && (
        <>
          {/* Summary chips */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
            {(() => {
              const last = projectionData[projectionData.length - 1];
              const peakNW = Math.max(...projectionData.map((d) => d.totalNetWorth ?? d.netWorth ?? 0));
              const depleted = projectionData.find((d) => (d.totalNetWorth ?? d.netWorth ?? 0) <= 0);
              return (
                <>
                  <Chip label={`Peak Net Worth: $${peakNW.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`} color="primary" />
                  <Chip label={`Final Net Worth (age ${last.age}): $${(last.totalNetWorth ?? last.netWorth ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`} color={(last.totalNetWorth ?? last.netWorth ?? 0) > 0 ? 'success' : 'error'} />
                  {depleted && <Chip label={`Portfolio depletes at age ${depleted.age}`} color="error" />}
                  {mcData && <Chip label={`MC Success Rate: ${mcData.successRate.toFixed(1)}%`} color={mcData.successRate >= 90 ? 'success' : mcData.successRate >= 75 ? 'warning' : 'error'} />}
                  {(() => {
                    const avgUnusedRrsp = projectionData.filter(d => (d.unusedRrspRoom ?? 0) > 0);
                    if (avgUnusedRrsp.length === 0) return null;
                    const avg = avgUnusedRrsp.reduce((s, d) => s + (d.unusedRrspRoom ?? 0), 0) / avgUnusedRrsp.length;
                    return <Chip label={`Avg unused RRSP room: $${avg.toLocaleString('en-CA', { maximumFractionDigits: 0 })}/yr`} color="warning" variant="outlined" />;
                  })()}
                  {(() => {
                    const unusedTfsa = projectionData.filter(d => (d.unusedTfsaRoom ?? 0) > 0);
                    if (unusedTfsa.length === 0) return null;
                    const avg = unusedTfsa.reduce((s, d) => s + (d.unusedTfsaRoom ?? 0), 0) / unusedTfsa.length;
                    return <Chip label={`Avg unused TFSA room: $${avg.toLocaleString('en-CA', { maximumFractionDigits: 0 })}/yr`} color="warning" variant="outlined" />;
                  })()}
                </>
              );
            })()}
          </Box>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Cash Flow" />
            <Tab label="Monte Carlo" />
            <Tab label="Income Flow" />
            <Tab label="Sankey" />
            <Tab label="Waterfall" />
            <Tab label="Year-by-Year" />
          </Tabs>

          {tab === 0 && (
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                  Portfolio balance by account type over time
                </Typography>
                <CashFlowChart data={projectionData} height={360} milestones={milestones} />
              </CardContent>
            </Card>
          )}

          {tab === 1 && mcData && (
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                  Monte Carlo simulation — 1000 runs with randomized returns
                </Typography>
                <MonteCarloChart data={mcData.percentilesByYear} successRate={mcData.successRate} height={360} milestones={milestones} />
              </CardContent>
            </Card>
          )}

          {tab === 1 && !mcData && (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Typography color="text.secondary">Click "Run Monte Carlo" to generate the simulation fan chart.</Typography>
              </CardContent>
            </Card>
          )}

          {tab === 2 && (
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                  Where does income go each year? Stacked by use — ghosted sections show unused tax-sheltered room.
                </Typography>
                <IncomeAllocationChart data={projectionData} height={380} milestones={milestones} />
              </CardContent>
            </Card>
          )}

          {tab === 3 && (
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                  Annual income → tax → expense → savings flow (mid working year)
                </Typography>
                <SankeyChart data={projectionData} />
              </CardContent>
            </Card>
          )}

          {tab === 4 && (
            <Card>
              <CardContent>
                <WaterfallSection
                  projectionData={projectionData}
                  nwHistory={nwHistory ?? []}
                  memberDob={primaryMember?.dateOfBirth}
                  milestones={milestones}
                />
              </CardContent>
            </Card>
          )}

          {tab === 5 && (
            <Card>
              <CardContent sx={{ p: 0 }}>
                <TableContainer component={Paper} sx={{ maxHeight: 480 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Year</TableCell>
                        <TableCell>Age</TableCell>
                        <TableCell align="right">Income</TableCell>
                        <TableCell align="right">Expenses</TableCell>
                        <TableCell align="right">Tax</TableCell>
                        <TableCell align="right">Net Cash Flow</TableCell>
                        <TableCell align="right">Net Worth</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {projectionData.map((row) => (
                        <TableRow key={row.year} sx={{ '&:last-child td': { border: 0 }, bgcolor: (row.totalNetWorth ?? row.netWorth ?? 0) <= 0 ? 'error.dark' : 'inherit' }}>
                          <TableCell>{row.year}</TableCell>
                          <TableCell>{row.age}</TableCell>
                          <TableCell align="right">${row.totalIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</TableCell>
                          <TableCell align="right">${(row.expenses ?? row.totalExpenses ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</TableCell>
                          <TableCell align="right">${(row.totalTax ?? row.taxPaid ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</TableCell>
                          <TableCell align="right" sx={{ color: row.netCashFlow >= 0 ? 'success.main' : 'error.main' }}>
                            ${row.netCashFlow.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell align="right">${(row.totalNetWorth ?? row.netWorth ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!projectionData && !isRunning && household && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <PlayArrowIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>No projections yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Select a scenario and click "Run Projection" to see your retirement cash flow.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
