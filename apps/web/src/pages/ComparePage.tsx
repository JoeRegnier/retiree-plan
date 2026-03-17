import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, MenuItem,
  TextField, Alert, CircularProgress, Chip, Divider, useTheme, alpha,
} from '@mui/material';
import CompareIcon from '@mui/icons-material/Compare';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import { buildProjectionPayload } from '../utils/buildProjectionPayload';
import * as d3 from 'd3';
import { useRef, useEffect } from 'react';

interface Household { id: string; name: string; members: any[]; accounts: any[]; }
interface Scenario { id: string; name: string; parameters: string; }
interface ProjectionYear {
  year: number; age: number;
  totalNetWorth?: number; netWorth?: number;
  totalIncome: number;
  totalExpenses: number; netCashFlow: number; rrspBalance?: number;
  tfsaBalance?: number; nonRegBalance?: number; taxPaid?: number;
}

function parseParams(s: Scenario) {
  try { return typeof s.parameters === 'string' ? JSON.parse(s.parameters) : s.parameters; }
  catch { return {}; }
}

const nw = (d: ProjectionYear) => d.totalNetWorth ?? d.netWorth ?? 0;

function fmt(n: number | undefined) {
  if (n == null || !isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

interface CompareChartProps {
  dataA: ProjectionYear[];
  dataB: ProjectionYear[];
  labelA: string;
  labelB: string;
  colorA: string;
  colorB: string;
  height?: number;
}

function CompareChart({ dataA, dataB, labelA, labelB, colorA, colorB, height: chartHeight = 380 }: CompareChartProps) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const contRef   = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const theme     = useTheme();

  useEffect(() => {
    if (!svgRef.current || !contRef.current || dataA.length === 0) return;

    const draw = () => {
      const containerWidth = contRef.current!.clientWidth;
      if (containerWidth === 0) return;

      const margin = { top: 20, right: 24, bottom: 44, left: 76 };
      const innerW = containerWidth - margin.left - margin.right;
      const innerH = chartHeight - margin.top - margin.bottom;

      d3.select(svgRef.current!).selectAll('*').remove();
      d3.select(svgRef.current!).attr('width', containerWidth).attr('height', chartHeight);

      const svg = d3.select(svgRef.current!)
        .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const allYears = [...dataA, ...dataB];
      const xDomain = d3.extent(allYears, (d) => d.year) as [number, number];
      const xScale = d3.scaleLinear().domain(xDomain).range([0, innerW]);

      const yMax = d3.max(allYears, nw) ?? 1;
      const yMin = Math.min(0, d3.min(allYears, nw) ?? 0);
      const yScale = d3.scaleLinear()
        .domain([yMin, yMax * 1.1]).range([innerH, 0]).nice();
      const yTicks = yScale.ticks(6);

      // ── Grid ────────────────────────────────────────────────────────────────
      svg.selectAll('.gl').data(yTicks).enter().append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
        .attr('stroke', theme.palette.divider).attr('stroke-opacity', 0.5).attr('stroke-width', 0.5);

      // ── Difference shading between the two lines ─────────────────────────
      // Align by year (only intersecting range)
      const yearSetA = new Map(dataA.map(d => [d.year, d]));
      const paired = dataB
        .map(d => ({ year: d.year, vA: nw(yearSetA.get(d.year) ?? d), vB: nw(d) }))
        .filter(d => yearSetA.has(d.year));

      const areaAbove = d3.area<typeof paired[0]>()
        .x(d => xScale(d.year)).curve(d3.curveMonotoneX)
        .y0(d => yScale(Math.min(d.vA, d.vB)))
        .y1(d => yScale(Math.max(d.vA, d.vB)));

      // Split into segments where A > B vs B > A
      const segmentsAWins: typeof paired = [];
      const segmentsBWins: typeof paired = [];
      paired.forEach(d => {
        segmentsAWins.push({ ...d, vA: Math.max(d.vA, d.vB), vB: Math.min(d.vA, d.vB) });
        if (d.vA >= d.vB) segmentsBWins.push({ ...d, vA: d.vA, vB: d.vA }); // hidden
        else segmentsBWins.push({ ...d });
      });

      // Shade where A > B (green-ish) and where B > A (orange-ish)
      const mkArea = (sign: 1 | -1) => d3.area<typeof paired[0]>()
        .x(d => xScale(d.year)).curve(d3.curveMonotoneX)
        .y0(d => yScale(sign === 1 ? Math.min(d.vA, d.vB) : Math.max(d.vA, d.vB)))
        .y1(d => yScale(sign === 1 ? Math.max(d.vA, d.vB) : Math.min(d.vA, d.vB)));

      svg.append('path').datum(paired)
        .attr('fill', colorA).attr('fill-opacity', 0.08)
        .attr('d', mkArea(1)!);
      svg.append('path').datum(paired)
        .attr('fill', colorB).attr('fill-opacity', 0.08)
        .attr('d', mkArea(-1)!);

      // ── Area fills under each line ────────────────────────────────────────
      const areaGen = (data: ProjectionYear[], color: string) => {
        const gen = d3.area<ProjectionYear>()
          .x(d => xScale(d.year)).curve(d3.curveMonotoneX)
          .y0(innerH).y1(d => yScale(nw(d)));
        svg.append('path').datum(data)
          .attr('fill', color).attr('fill-opacity', 0.10)
          .attr('d', gen);
      };
      areaGen(dataA, colorA);
      areaGen(dataB, colorB);

      // ── Lines ────────────────────────────────────────────────────────────
      const lineGen = d3.line<ProjectionYear>()
        .x(d => xScale(d.year)).y(d => yScale(nw(d))).curve(d3.curveMonotoneX);

      [{ data: dataA, color: colorA }, { data: dataB, color: colorB }].forEach(({ data, color }) => {
        svg.append('path').datum(data)
          .attr('fill', 'none').attr('stroke', color)
          .attr('stroke-width', 2.5).attr('d', lineGen);
      });

      // ── Axes ─────────────────────────────────────────────────────────────
      const xAxis = svg.append('g').attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.format('d')));
      xAxis.selectAll('text').attr('fill', theme.palette.text.secondary).attr('font-size', 11);
      xAxis.select('.domain').attr('stroke', theme.palette.divider);
      xAxis.selectAll('.tick line').attr('stroke', theme.palette.divider);

      const yAxisFmt = (d: d3.NumberValue) => fmt(d as number);
      const yAxis = svg.append('g')
        .call(d3.axisLeft(yScale).tickValues(yTicks).tickFormat(yAxisFmt));
      yAxis.select('.domain').remove();
      yAxis.selectAll('.tick line').remove();
      yAxis.selectAll('text').attr('fill', theme.palette.text.secondary).attr('font-size', 11);

      svg.append('text').attr('x', innerW / 2).attr('y', innerH + 36)
        .attr('text-anchor', 'middle').attr('fill', theme.palette.text.disabled).attr('font-size', 11)
        .text('Year');

      // ── Hover crosshair + tooltip ─────────────────────────────────────────
      const TOOLTIP_W = 220;
      const tooltip = d3.select(tooltipRef.current!);
      const crossV = svg.append('line')
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', theme.palette.text.secondary).attr('stroke-width', 1)
        .attr('stroke-dasharray', '4 3').attr('opacity', 0.6).style('display', 'none');
      const dotA = svg.append('circle').attr('r', 4).attr('fill', colorA).style('display', 'none');
      const dotB = svg.append('circle').attr('r', 4).attr('fill', colorB).style('display', 'none');

      d3.select(svgRef.current!).on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event, svg.node()!);
        const year = Math.round(xScale.invert(mx));
        const dA = dataA.reduce((p, c) => Math.abs(c.year - year) < Math.abs(p.year - year) ? c : p);
        const dB = dataB.reduce((p, c) => Math.abs(c.year - year) < Math.abs(p.year - year) ? c : p);
        if (!dA || !dB) return;

        const cx = xScale(dA.year);
        crossV.style('display', null).attr('transform', `translate(${cx},0)`);
        dotA.style('display', null).attr('cx', cx).attr('cy', yScale(nw(dA)));
        dotB.style('display', null).attr('cx', cx).attr('cy', yScale(nw(dB)));

        const diff = nw(dA) - nw(dB);
        const diffColor = diff >= 0 ? colorA : colorB;
        const absX = cx + margin.left;
        const tipLeft = absX + TOOLTIP_W + 14 < containerWidth ? absX + 12 : absX - TOOLTIP_W - 12;

        tooltip.style('display', 'block').style('left', `${tipLeft}px`).style('top', `${margin.top + 4}px`)
          .html(`<strong style="font-size:12px">Year ${dA.year} · Age ${dA.age}</strong>
            <div style="margin-top:6px">
              <span style="color:${colorA}">━</span> <strong>${labelA}:</strong> ${fmt(nw(dA))}<br/>
              <span style="color:${colorB}">━</span> <strong>${labelB}:</strong> ${fmt(nw(dB))}
            </div>
            <div style="margin-top:5px;padding-top:5px;border-top:1px solid rgba(128,128,128,0.25);color:${diffColor}">
              Δ ${diff >= 0 ? '+' : ''}${fmt(diff)}
            </div>`);
      }).on('mouseleave', () => {
        crossV.style('display', 'none');
        dotA.style('display', 'none');
        dotB.style('display', 'none');
        tooltip.style('display', 'none');
      });
    };

    const ro = new ResizeObserver(() => draw());
    ro.observe(contRef.current!);
    draw();
    return () => ro.disconnect();
  }, [dataA, dataB, labelA, labelB, colorA, colorB, chartHeight, theme]);

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      {/* HTML legend */}
      <Box sx={{ display: 'flex', gap: 3, mb: 1.5, pl: '76px' }}>
        {[{ label: labelA, color: colorA }, { label: labelB, color: colorB }].map(({ label, color }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Box sx={{ width: 24, height: 3, borderRadius: 2, bgcolor: color }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
          </Box>
        ))}
      </Box>
      <div ref={contRef} style={{ width: '100%' }}>
        <svg ref={svgRef} style={{ display: 'block' }} />
      </div>
      <Box ref={tooltipRef} sx={{
        display: 'none', position: 'absolute', top: 0,
        bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
        borderRadius: 1.5, p: 1.5, fontSize: 12, lineHeight: 1.8,
        pointerEvents: 'none', zIndex: 10, minWidth: 200, boxShadow: 6,
      }} />
    </Box>
  );
}

export function ComparePage() {
  const { apiFetch } = useApi();
  const [scenarioIdA, setScenarioIdA] = useState('');
  const [scenarioIdB, setScenarioIdB] = useState('');
  const [dataA, setDataA] = useState<ProjectionYear[] | null>(null);
  const [dataB, setDataB] = useState<ProjectionYear[] | null>(null);
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

  const { data: expenseItems } = useQuery<any[]>({
    queryKey: ['expenses', household?.id],
    queryFn: () => apiFetch(`/expenses/household/${household!.id}`),
    enabled: !!household?.id,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!household || !scenarioIdA || !scenarioIdB) throw new Error('Select both scenarios');
      const scenA = scenarios?.find((s) => s.id === scenarioIdA);
      const scenB = scenarios?.find((s) => s.id === scenarioIdB);
      if (!scenA || !scenB) throw new Error('Scenarios not found');
      const payloadA = buildProjectionPayload(household, parseParams(scenA), expenseItems);
      const payloadB = buildProjectionPayload(household, parseParams(scenB), expenseItems);
      if (!payloadA || !payloadB) throw new Error('Household has no members — add a member first.');
      const [resA, resB] = await Promise.all([
        apiFetch('/projections/cash-flow', { method: 'POST', body: JSON.stringify(payloadA) }),
        apiFetch('/projections/cash-flow', { method: 'POST', body: JSON.stringify(payloadB) }),
      ]);
      return { a: resA as ProjectionYear[], b: resB as ProjectionYear[] };
    },
    onSuccess: (res) => {
      setDataA(res.a);
      setDataB(res.b);
      setRunError('');
    },
    onError: (e: any) => setRunError(e.message ?? 'Comparison failed'),
  });

  const scenA = scenarios?.find((s) => s.id === scenarioIdA);
  const scenB = scenarios?.find((s) => s.id === scenarioIdB);

  // Compute summary comparison
  const summary = dataA && dataB && dataA.length > 0 && dataB.length > 0 && scenA && scenB ? (() => {
    const finalA = dataA[dataA.length - 1];
    const finalB = dataB[dataB.length - 1];
    const depletedA = dataA.find((d) => nw(d) <= 0);
    const depletedB = dataB.find((d) => nw(d) <= 0);
    const peakA = dataA.reduce((mx, d) => nw(d) > nw(mx) ? d : mx, dataA[0]);
    const peakB = dataB.reduce((mx, d) => nw(d) > nw(mx) ? d : mx, dataB[0]);
    return { finalA, finalB, depletedA, depletedB, peakA, peakB };
  })() : null;

  const colorA = '#6C63FF';
  const colorB = '#f57c00';

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <CompareIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>What-If Comparison</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Compare two scenarios side-by-side to see how different parameters affect your retirement outlook.
      </Typography>

      {!household && (
        <Alert severity="info" sx={{ mb: 2 }}>Set up your household first.</Alert>
      )}

      {/* ── Scenario selector ─────────────────────────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="stretch">
            {/* Scenario A picker */}
            <Grid size={{ xs: 12, sm: 5 }}>
              <Box sx={{
                borderLeft: `4px solid ${colorA}`, borderRadius: 1,
                pl: 1.5, pt: 0.5, pb: 0.5,
                bgcolor: alpha(colorA, 0.04),
              }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Box sx={{
                    width: 22, height: 22, borderRadius: '50%',
                    bgcolor: colorA, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>A</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: colorA, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Scenario A
                  </Typography>
                </Box>
                <TextField
                  select fullWidth size="small"
                  value={scenarioIdA}
                  onChange={(e) => setScenarioIdA(e.target.value)}
                  disabled={!scenarios?.length}
                  SelectProps={{ displayEmpty: true }}
                  sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(colorA, 0.3) } }}
                >
                  <MenuItem value=""><em>Select a scenario</em></MenuItem>
                  {(scenarios ?? []).map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </TextField>
              </Box>
            </Grid>

            {/* vs badge */}
            <Grid size={{ xs: 12, sm: 1 }} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{
                bgcolor: 'action.hover', borderRadius: '50%',
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>vs</Typography>
              </Box>
            </Grid>

            {/* Scenario B picker */}
            <Grid size={{ xs: 12, sm: 5 }}>
              <Box sx={{
                borderLeft: `4px solid ${colorB}`, borderRadius: 1,
                pl: 1.5, pt: 0.5, pb: 0.5,
                bgcolor: alpha(colorB, 0.04),
              }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Box sx={{
                    width: 22, height: 22, borderRadius: '50%',
                    bgcolor: colorB, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>B</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: colorB, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Scenario B
                  </Typography>
                </Box>
                <TextField
                  select fullWidth size="small"
                  value={scenarioIdB}
                  onChange={(e) => setScenarioIdB(e.target.value)}
                  disabled={!scenarios?.length}
                  SelectProps={{ displayEmpty: true }}
                  sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(colorB, 0.3) } }}
                >
                  <MenuItem value=""><em>Select a scenario</em></MenuItem>
                  {(scenarios ?? []).map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </TextField>
              </Box>
            </Grid>

            {/* Run button */}
            <Grid size={{ xs: 12, sm: 1 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                variant="contained" fullWidth
                startIcon={runMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                disabled={!scenarioIdA || !scenarioIdB || runMutation.isPending}
                onClick={() => runMutation.mutate()}
                sx={{ height: 40 }}
              >
                Run
              </Button>
            </Grid>
          </Grid>
          {runError && <Alert severity="error" sx={{ mt: 2 }}>{runError}</Alert>}
        </CardContent>
      </Card>

      {dataA && dataB && scenA && scenB && (
        <>
          {/* ── Chart ──────────────────────────────────────────────────────── */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={0.5}>Net Worth Projection</Typography>
              <Typography variant="caption" color="text.secondary">
                Hover over the chart to compare values year-by-year
              </Typography>
              <Box mt={2}>
                <CompareChart
                  dataA={dataA} dataB={dataB}
                  labelA={scenA.name} labelB={scenB.name}
                  colorA={colorA} colorB={colorB}
                  height={380}
                />
              </Box>
            </CardContent>
          </Card>

          {/* ── Summary KPI cards ─────────────────────────────────────────── */}
          {summary && (() => {
            const vA = nw(summary.finalA);
            const vB = nw(summary.finalB);
            const diff = vA - vB;
            const aWins = diff > 0;
            const tied  = diff === 0;

            const WinnerIcon = tied ? RemoveIcon : aWins ? TrendingUpIcon : TrendingDownIcon;
            const winnerColor = tied ? 'text.secondary' : aWins ? 'success.main' : 'error.main';

            return (
              <Grid container spacing={2}>
                {/* Final Net Worth */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                        <Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                          Final Net Worth
                        </Typography>
                        <WinnerIcon sx={{ fontSize: 18, color: winnerColor }} />
                      </Box>
                      <Grid container spacing={1}>
                        <Grid size={{ xs: 6 }}>
                          <Box sx={{ borderLeft: `3px solid ${colorA}`, pl: 1 }}>
                            <Typography variant="caption" sx={{ color: colorA, fontWeight: 600 }}>A</Typography>
                            <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>{fmt(vA)}</Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Box sx={{ borderLeft: `3px solid ${colorB}`, pl: 1 }}>
                            <Typography variant="caption" sx={{ color: colorB, fontWeight: 600 }}>B</Typography>
                            <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>{fmt(vB)}</Typography>
                          </Box>
                        </Grid>
                      </Grid>
                      <Divider sx={{ my: 1.5 }} />
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Typography variant="caption" color="text.secondary">Difference:</Typography>
                        <Typography variant="caption" fontWeight={700} sx={{ color: winnerColor }}>
                          {tied ? 'Equal' : `${aWins ? 'A' : 'B'} leads by ${fmt(Math.abs(diff))}`}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Peak Net Worth */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                        <Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                          Peak Net Worth
                        </Typography>
                        <TrendingUpIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                      </Box>
                      <Grid container spacing={1}>
                        <Grid size={{ xs: 6 }}>
                          <Box sx={{ borderLeft: `3px solid ${colorA}`, pl: 1 }}>
                            <Typography variant="caption" sx={{ color: colorA, fontWeight: 600 }}>A</Typography>
                            <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>{fmt(nw(summary.peakA))}</Typography>
                            <Typography variant="caption" color="text.secondary">Year {summary.peakA.year}</Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Box sx={{ borderLeft: `3px solid ${colorB}`, pl: 1 }}>
                            <Typography variant="caption" sx={{ color: colorB, fontWeight: 600 }}>B</Typography>
                            <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>{fmt(nw(summary.peakB))}</Typography>
                            <Typography variant="caption" color="text.secondary">Year {summary.peakB.year}</Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Portfolio Depleted */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                        <Typography variant="subtitle2" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                          Portfolio Status
                        </Typography>
                        <TrendingDownIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                      </Box>
                      <Grid container spacing={1}>
                        <Grid size={{ xs: 6 }}>
                          <Box sx={{ borderLeft: `3px solid ${colorA}`, pl: 1 }}>
                            <Typography variant="caption" sx={{ color: colorA, fontWeight: 600 }}>A</Typography>
                            <Box mt={0.5}>
                              {summary.depletedA
                                ? <Chip label={`Depleted age ${summary.depletedA.age}`} color="error" size="small" />
                                : <Chip label="Never depleted" color="success" size="small" />}
                            </Box>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Box sx={{ borderLeft: `3px solid ${colorB}`, pl: 1 }}>
                            <Typography variant="caption" sx={{ color: colorB, fontWeight: 600 }}>B</Typography>
                            <Box mt={0.5}>
                              {summary.depletedB
                                ? <Chip label={`Depleted age ${summary.depletedB.age}`} color="error" size="small" />
                                : <Chip label="Never depleted" color="success" size="small" />}
                            </Box>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            );
          })()}
        </>
      )}
    </Box>
  );
}
