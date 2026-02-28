import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, CircularProgress,
  Grid, Slider, TextField, InputAdornment, Chip, Stack, Alert,
  Tooltip, LinearProgress, Divider, MenuItem,
} from '@mui/material';
import EmojiPeopleIcon from '@mui/icons-material/EmojiPeople';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import { useQuery } from '@tanstack/react-query';
import * as d3 from 'd3';
import { useApi } from '../hooks/useApi';
import { CashFlowChart } from '../components/charts/CashFlowChart';
import type { ProjectionYear } from '../components/charts/CashFlowChart';
import { calcAge } from '../utils/age';

interface Household { id: string; name: string; members: any[]; accounts: any[]; scenarios?: any[]; }
interface Scenario { id: string; name: string; parameters: string; }
interface Expense { id: string; annualAmount: number; startAge?: number | null; endAge?: number | null; indexToInflation?: boolean; }

interface SweepPoint {
  retirementAge: number;
  finalNetWorth: number;
  years: ProjectionYear[];
}

// ── Sweep chart ───────────────────────────────────────────────────────────────

interface SweepChartProps {
  results: SweepPoint[];
  target: number;
  selectedAge: number | null;
  onSelect: (age: number) => void;
}

function SweepChart({ results, target, selectedAge, onSelect }: SweepChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    const cont = containerRef.current;
    if (!el || !cont || results.length === 0) return;

    const W = cont.clientWidth;
    const H = 300;
    const pL = 72, pR = 20, pT = 20, pB = 40;
    const iW = W - pL - pR;
    const iH = H - pT - pB;

    const sorted = [...results].sort((a, b) => a.retirementAge - b.retirementAge);

    const xScale = d3.scaleBand()
      .domain(sorted.map((d) => String(d.retirementAge)))
      .range([0, iW])
      .padding(0.25);

    const maxNW = Math.max(d3.max(sorted, (d) => d.finalNetWorth) ?? 0, target * 1.25);
    const yScale = d3.scaleLinear().domain([0, maxNW]).range([iH, 0]).nice();

    d3.select(el).selectAll('*').remove();
    const svg = d3.select(el).attr('width', W).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${pL},${pT})`);

    // Grid lines
    g.selectAll('line.grid')
      .data(yScale.ticks(5))
      .join('line')
      .attr('class', 'grid')
      .attr('x1', 0).attr('x2', iW)
      .attr('y1', (d) => yScale(d)).attr('y2', (d) => yScale(d))
      .attr('stroke', 'rgba(255,255,255,0.06)').attr('stroke-dasharray', '3,3');

    // Bars
    const barEnter = g.selectAll('rect.bar')
      .data(sorted)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => xScale(String(d.retirementAge)) ?? 0)
      .attr('width', xScale.bandwidth())
      .attr('y', (d) => yScale(Math.max(0, d.finalNetWorth)))
      .attr('height', (d) => Math.abs(yScale(d.finalNetWorth) - yScale(0)))
      .attr('rx', 3)
      .attr('fill', (d) =>
        d.retirementAge === selectedAge
          ? '#90CAF9'
          : d.finalNetWorth >= target
          ? '#66BB6A'
          : d.finalNetWorth >= target * 0.7
          ? '#FFA726'
          : '#EF5350'
      )
      .attr('opacity', (d) => (selectedAge == null || d.retirementAge === selectedAge ? 1 : 0.65))
      .style('cursor', 'pointer')
      .on('click', (_e, d) => onSelect(d.retirementAge));

    barEnter.append('title').text((d) => `Age ${d.retirementAge} → $${(d.finalNetWorth / 1e6).toFixed(2)}M`);

    // Target line
    if (target > 0 && target <= maxNW) {
      const ty = yScale(target);
      g.append('line')
        .attr('x1', -10).attr('x2', iW + 6)
        .attr('y1', ty).attr('y2', ty)
        .attr('stroke', '#FFD54F').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4');

      g.append('text')
        .attr('x', -8).attr('y', ty - 4)
        .attr('fill', '#FFD54F').attr('font-size', 10)
        .text(`$${(target / 1e6).toFixed(1)}M target`);
    }

    // X axis
    g.append('g').attr('transform', `translate(0,${iH})`)
      .call(d3.axisBottom(xScale).tickSize(0))
      .call((ax) => ax.select('.domain').remove())
      .selectAll('text')
      .attr('fill', 'rgba(255,255,255,0.5)').attr('font-size', 11);

    // Y axis
    const fmt = (v: d3.NumberValue) => `$${(Number(v) / 1e6).toFixed(1)}M`;
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(fmt))
      .call((ax) => ax.select('.domain').remove())
      .call((ax) => ax.selectAll('.tick line').remove())
      .selectAll('text')
      .attr('fill', 'rgba(255,255,255,0.5)').attr('font-size', 11);
  }, [results, target, selectedAge, onSelect]);

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <svg ref={svgRef} style={{ width: '100%', height: 300 }} />
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function EarliestRetirePage() {
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

  const { data: expenseItems } = useQuery<Expense[]>({
    queryKey: ['expenses', household?.id],
    queryFn: () => apiFetch(`/expenses/household/${household!.id}`),
    enabled: !!household?.id,
  });

  // ── Controls state ────────────────────────────────────────────────────────
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [targetNW, setTargetNW] = useState(1_000_000);
  const [targetInput, setTargetInput] = useState('1000000');
  const [lifeExpectancy, setLifeExpectancy] = useState(90);
  const [sweepMin, setSweepMin] = useState(45);
  const [sweepMax, setSweepMax] = useState(72);

  // ── Sweep state ───────────────────────────────────────────────────────────
  const [sweeping, setSweeping] = useState(false);
  const [sweepProgress, setSweepProgress] = useState(0);
  const [sweepResults, setSweepResults] = useState<SweepPoint[]>([]);
  const [sweepError, setSweepError] = useState('');
  const [selectedAge, setSelectedAge] = useState<number | null>(null);

  // When scenario changes, populate defaults from its parameters
  const selectedScenario = useMemo(
    () => scenarios?.find((s) => s.id === selectedScenarioId),
    [scenarios, selectedScenarioId],
  );

  useEffect(() => {
    if (!selectedScenarioId && scenarios?.length) {
      setSelectedScenarioId(scenarios[0].id);
    }
  }, [scenarios, selectedScenarioId]);

  useEffect(() => {
    if (!selectedScenario) return;
    try {
      const p = typeof selectedScenario.parameters === 'string'
        ? JSON.parse(selectedScenario.parameters)
        : selectedScenario.parameters;
      if (p.lifeExpectancy) setLifeExpectancy(p.lifeExpectancy);
    } catch { /* ignore */ }
  }, [selectedScenario]);

  // Primary member (highest income)
  const primaryMember = useMemo(() => {
    const members = household?.members ?? [];
    if (!members.length) return undefined;
    return [...members].sort(
      (a: any, b: any) =>
        (b.incomeSources?.reduce((s: number, i: any) => s + i.annualAmount, 0) ?? 0) -
        (a.incomeSources?.reduce((s: number, i: any) => s + i.annualAmount, 0) ?? 0),
    )[0];
  }, [household?.members]);

  const currentAge = primaryMember ? calcAge(primaryMember.dateOfBirth) : 40;

  const weightedRate = useCallback((accs: any[]): number | undefined => {
    const rated = accs.filter((a: any) => a.estimatedReturnRate != null);
    if (!rated.length) return undefined;
    const totalBal = rated.reduce((s: number, a: any) => s + a.balance, 0);
    if (totalBal <= 0) return rated[0].estimatedReturnRate as number;
    return rated.reduce((s: number, a: any) => s + a.balance * a.estimatedReturnRate, 0) / totalBal;
  }, []);

  const buildPayloadForAge = useCallback((retirementAge: number) => {
    if (!household || !selectedScenario) return null;
    const p = (() => {
      try {
        return typeof selectedScenario.parameters === 'string'
          ? JSON.parse(selectedScenario.parameters)
          : (selectedScenario.parameters ?? {});
      } catch { return {}; }
    })();

    const accounts: any[] = household.accounts ?? [];
    const rrsp    = accounts.filter((a) => a.type === 'RRSP' || a.type === 'RRIF').reduce((s: number, a) => s + a.balance, 0);
    const tfsa    = accounts.filter((a) => a.type === 'TFSA').reduce((s: number, a) => s + a.balance, 0);
    const nonReg  = accounts.filter((a) => a.type === 'NON_REG').reduce((s: number, a) => s + a.balance, 0);
    const cashBal = accounts.filter((a) => a.type === 'CASH').reduce((s: number, a) => s + a.balance, 0);
    const rrspRate   = weightedRate(accounts.filter((a) => a.type === 'RRSP' || a.type === 'RRIF'));
    const tfsaRate   = weightedRate(accounts.filter((a) => a.type === 'TFSA'));
    const nonRegRate = weightedRate(accounts.filter((a) => a.type === 'NON_REG'));
    const cashRate   = weightedRate(accounts.filter((a) => a.type === 'CASH'));

    const ENGINE_EXCLUDED = new Set(['CPP', 'OAS']);
    // Income types that represent earned/employment income — must stop at (or before) retirement
    const EMPLOYMENT_INCOME_TYPES = new Set(['Employment', 'Self-Employment']);
    const incomeSources = (household.members ?? []).flatMap((m: any) =>
      (m.incomeSources ?? [])
        .filter((src: any) => !ENGINE_EXCLUDED.has(src.type))
        .map((src: any) => {
          const isEmployment = EMPLOYMENT_INCOME_TYPES.has(src.type);
          // Cap employment income at the retirement age; other income (Pension, RRSP/RRIF, Investment, Rental) flows through untouched
          const endAge: number | undefined = isEmployment
            ? Math.min(src.endAge ?? retirementAge, retirementAge)
            : (src.endAge as number | undefined);
          return {
            annualAmount: src.annualAmount as number,
            startAge: src.startAge as number | undefined,
            endAge,
            indexToInflation: src.indexToInflation !== false,
          };
        })
        // Drop sources that would never contribute (endAge <= currentAge)
        .filter((src: { endAge: number | undefined }) => src.endAge == null || src.endAge > currentAge)
    );

    const expenses: any[] = expenseItems ?? [];
    const totalExpenses = expenses.length > 0
      ? expenses.reduce((s, e) => s + e.annualAmount, 0)
      : p.annualExpenses ?? 60_000;
    const expenseEntries = expenses.length > 0
      ? expenses.map((e) => ({
          annualAmount: e.annualAmount,
          ...(e.startAge != null ? { startAge: e.startAge } : {}),
          ...(e.endAge   != null ? { endAge:   e.endAge   } : {}),
          indexToInflation: e.indexToInflation !== false,
        }))
      : undefined;

    return {
      currentAge,
      endAge: lifeExpectancy,
      province: (primaryMember as any)?.province ?? 'ON',
      employmentIncome: 0,
      incomeSources,
      retirementAge,
      annualExpenses: totalExpenses,
      ...(expenseEntries ? { expenseEntries } : {}),
      inflationRate: p.inflationRate ?? 0.02,
      nominalReturnRate: p.expectedReturnRate ?? 0.06,
      cppStartAge: Math.max(p.cppStartAge ?? 65, retirementAge),
      oasStartAge: Math.max(p.oasStartAge ?? 65, retirementAge),
      rrspBalance: rrsp, tfsaBalance: tfsa, nonRegBalance: nonReg, cashBalance: cashBal,
      rrspContribution: accounts.find((a) => a.type === 'RRSP')?.annualContribution ?? 0,
      tfsaContribution: accounts.find((a) => a.type === 'TFSA')?.annualContribution ?? 0,
      rrifConversionAge: Math.max(p.rrifStartAge ?? 71, retirementAge),
      nonRegTaxDragRate: p.nonRegTaxDragRate ?? 0,
      investSurplus: p.investSurplus ?? false,
      cashSavingsRate: cashRate ?? p.cashSavingsRate ?? 0.025,
      ...(rrspRate != null ? { rrspReturnRate: rrspRate } : {}),
      ...(tfsaRate != null ? { tfsaReturnRate: tfsaRate } : {}),
      ...(nonRegRate != null ? { nonRegReturnRate: nonRegRate } : {}),
      ...(p.glidePathSteps?.length ? { glidePathSteps: p.glidePathSteps } : {}),
    };
  }, [household, selectedScenario, currentAge, lifeExpectancy, primaryMember, weightedRate, expenseItems]);

  const runSweep = useCallback(async () => {
    if (!selectedScenario || !household) {
      setSweepError('Select a scenario first.');
      return;
    }
    setSweeping(true);
    setSweepError('');
    setSweepResults([]);
    setSelectedAge(null);

    const minAge = Math.max(sweepMin, currentAge + 1);
    const ages = Array.from({ length: sweepMax - minAge + 1 }, (_, i) => minAge + i);
    const total = ages.length;
    let done = 0;

    const points = await Promise.all(
      ages.map(async (age): Promise<SweepPoint | null> => {
        try {
          const payload = buildPayloadForAge(age);
          if (!payload) return null;
          const data: any = await apiFetch('/projections/cash-flow', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          const years: any[] = Array.isArray(data) ? data : (data.years ?? data.data ?? []);
          const last = years[years.length - 1];
          const finalNetWorth = (last?.totalNetWorth ?? last?.netWorth ?? 0) as number;
          return { retirementAge: age, finalNetWorth, years: years as ProjectionYear[] };
        } catch {
          return null;
        } finally {
          done++;
          setSweepProgress(done / total);
        }
      })
    );

    const valid = points.filter((p): p is SweepPoint => p !== null);
    valid.sort((a, b) => a.retirementAge - b.retirementAge);
    setSweepResults(valid);

    // Auto-select the earliest viable age
    const earliest = valid.find((p) => p.finalNetWorth >= targetNW);
    if (earliest) setSelectedAge(earliest.retirementAge);
    else if (valid.length > 0) setSelectedAge(valid[valid.length - 1].retirementAge);

    setSweeping(false);
    setSweepProgress(0);
  }, [selectedScenario, household, sweepMin, sweepMax, currentAge, buildPayloadForAge, apiFetch, targetNW]);

  // ── Derived values ────────────────────────────────────────────────────────
  const sorted = useMemo(() => [...sweepResults].sort((a, b) => a.retirementAge - b.retirementAge), [sweepResults]);
  const earliestViable = useMemo(() => sorted.find((p) => p.finalNetWorth >= targetNW), [sorted, targetNW]);
  const selectedPoint = useMemo(() => sorted.find((p) => p.retirementAge === selectedAge), [sorted, selectedAge]);

  const fmt = (n: number) =>
    n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h3" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmojiPeopleIcon fontSize="inherit" sx={{ color: 'primary.main' }} />
          Earliest Retirement Finder
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          Find the earliest age you could retire and still reach your wealth target by end of your timeline.
        </Typography>
      </Box>

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <TuneIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>Configuration</Typography>
          </Stack>
          <Grid container spacing={2} alignItems="flex-end">
            {/* Scenario */}
            <Grid item xs={12} sm={4}>
              <TextField
                label="Base Scenario" select fullWidth size="small"
                value={selectedScenarioId}
                onChange={(e) => setSelectedScenarioId(e.target.value)}
                disabled={!scenarios?.length}
                helperText="Income, accounts & expenses come from this scenario"
              >
                {(scenarios ?? []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
            </Grid>

            {/* Target NW */}
            <Grid item xs={12} sm={3}>
              <TextField
                label="Target Net Worth at End" size="small" fullWidth
                value={targetInput}
                onChange={(e) => {
                  setTargetInput(e.target.value);
                  const n = parseFloat(e.target.value.replace(/,/g, ''));
                  if (!isNaN(n) && n > 0) setTargetNW(n);
                }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                helperText={`Current target: ${fmt(targetNW)}`}
              />
            </Grid>

            {/* Life expectancy */}
            <Grid item xs={6} sm={2}>
              <TextField
                label="Life Expectancy" size="small" fullWidth type="number"
                value={lifeExpectancy}
                onChange={(e) => setLifeExpectancy(Number(e.target.value))}
                InputProps={{ inputProps: { min: 70, max: 100 } }}
              />
            </Grid>

            {/* Sweep range */}
            <Grid item xs={12} sm={3}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Test retirement ages: {sweepMin}–{sweepMax}
              </Typography>
              <Slider
                value={[sweepMin, sweepMax]}
                min={Math.max(currentAge + 1, 40)}
                max={75}
                step={1}
                onChange={(_e, v) => { const [lo, hi] = v as number[]; setSweepMin(lo); setSweepMax(hi); }}
                valueLabelDisplay="auto"
                size="small"
              />
            </Grid>

            {/* Run button */}
            <Grid item xs={12} sm="auto">
              <Button
                variant="contained" size="large" fullWidth
                startIcon={sweeping ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
                disabled={sweeping || !selectedScenarioId}
                onClick={runSweep}
                sx={{ minWidth: 160 }}
              >
                {sweeping ? 'Scanning…' : 'Find Earliest'}
              </Button>
            </Grid>
          </Grid>

          {sweeping && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant="determinate" value={sweepProgress * 100} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Running projections for ages {sweepMin}–{sweepMax}… ({Math.round(sweepProgress * 100)}%)
              </Typography>
            </Box>
          )}
          {sweepError && <Alert severity="error" sx={{ mt: 2 }}>{sweepError}</Alert>}
        </CardContent>
      </Card>

      {/* ── Results ── */}
      {sorted.length > 0 && (
        <>
          {/* KPI row */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card sx={{
                borderLeft: '4px solid',
                borderColor: earliestViable ? 'success.main' : 'error.main',
                height: '100%',
              }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Earliest Viable Age</Typography>
                  {earliestViable ? (
                    <>
                      <Typography variant="h2" fontWeight={700} color="success.main">
                        {earliestViable.retirementAge}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                        <CheckCircleIcon color="success" fontSize="small" />
                        <Typography variant="body2" color="success.main">
                          Ends with {fmt(earliestViable.finalNetWorth)}
                        </Typography>
                      </Stack>
                    </>
                  ) : (
                    <>
                      <Typography variant="h5" fontWeight={700} color="error.main" sx={{ mt: 1 }}>
                        Not found
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                        <CancelIcon color="error" fontSize="small" />
                        <Typography variant="body2" color="error.main">
                          No age in range reaches {fmt(targetNW)}
                        </Typography>
                      </Stack>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Ages Meeting Target</Typography>
                  <Typography variant="h3" fontWeight={700}>
                    {sorted.filter((p) => p.finalNetWorth >= targetNW).length}
                    <Typography component="span" variant="h6" color="text.secondary"> / {sorted.length}</Typography>
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    retirement ages tested
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {selectedPoint && (
              <Grid item xs={12} sm={4}>
                <Card sx={{
                  borderLeft: '4px solid',
                  borderColor: selectedPoint.finalNetWorth >= targetNW ? '#90CAF9' : 'warning.main',
                  height: '100%',
                }}>
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">Selected Age {selectedAge}</Typography>
                    <Typography variant="h3" fontWeight={700}>
                      {fmt(selectedPoint.finalNetWorth)}
                    </Typography>
                    <Chip
                      size="small"
                      icon={selectedPoint.finalNetWorth >= targetNW ? <CheckCircleIcon /> : <CancelIcon />}
                      label={selectedPoint.finalNetWorth >= targetNW ? `${fmt(selectedPoint.finalNetWorth - targetNW)} above target` : `${fmt(targetNW - selectedPoint.finalNetWorth)} below target`}
                      color={selectedPoint.finalNetWorth >= targetNW ? 'success' : 'warning'}
                      variant="outlined"
                      sx={{ mt: 0.75 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>

          {/* Sweep chart */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>Final Net Worth by Retirement Age</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Net worth at age {lifeExpectancy} for each tested retirement age · Click a bar to see full projection
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: '#66BB6A' }} />
                    <Typography variant="caption" color="text.secondary">Meets target</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: '#FFA726' }} />
                    <Typography variant="caption" color="text.secondary">Close (&gt;70%)</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: '#EF5350' }} />
                    <Typography variant="caption" color="text.secondary">Below target</Typography>
                  </Box>
                </Stack>
              </Stack>
              <SweepChart
                results={sorted}
                target={targetNW}
                selectedAge={selectedAge}
                onSelect={setSelectedAge}
              />
            </CardContent>
          </Card>

          {/* Age slider + projection detail */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                Projection Detail — Retirement Age: {selectedAge ?? '—'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Drag the slider to explore any retirement age from the sweep
              </Typography>
              <Box sx={{ px: 2, mb: 3 }}>
                <Slider
                  value={selectedAge ?? sweepMin}
                  min={sorted[0]?.retirementAge ?? sweepMin}
                  max={sorted[sorted.length - 1]?.retirementAge ?? sweepMax}
                  step={1}
                  marks={sorted.map((p) => ({ value: p.retirementAge }))}
                  valueLabelDisplay="on"
                  valueLabelFormat={(v) => `Age ${v}`}
                  onChange={(_e, v) => setSelectedAge(v as number)}
                  sx={{
                    '& .MuiSlider-mark': { height: 8, width: 2, borderRadius: 0 },
                    '& .MuiSlider-markActive': { bgcolor: 'primary.light' },
                  }}
                />
              </Box>

              {selectedPoint && selectedPoint.years.length > 0 ? (
                <>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                    <Chip label={`Retire at ${selectedAge}`} color="primary" variant="outlined" size="small" />
                    <Chip
                      label={`Final NW: ${fmt(selectedPoint.finalNetWorth)}`}
                      color={selectedPoint.finalNetWorth >= targetNW ? 'success' : 'warning'}
                      size="small"
                    />
                    <Chip
                      label={`Life to age ${lifeExpectancy}`}
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                  <CashFlowChart
                    data={selectedPoint.years}
                    milestones={[
                      { age: selectedAge!, label: 'Retire', color: '#FF9800', type: 'event' },
                      { age: Math.max(selectedAge!, 65), label: 'CPP/OAS', color: '#4CAF50', type: 'event' },
                      { age: Math.max(selectedAge!, 71), label: 'RRIF', color: '#9C27B0', type: 'event' },
                    ]}
                  />
                </>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Select an age from the chart above to view the full projection
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state */}
      {!sweeping && sorted.length === 0 && (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <CardContent>
            <EmojiPeopleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Configure your settings and click "Find Earliest"
            </Typography>
            <Typography variant="body2" color="text.disabled">
              The finder will test every retirement age from {sweepMin} to {sweepMax}, running a full
              cash-flow projection for each one, then highlight the earliest age where you still end
              with {fmt(targetNW)}.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
