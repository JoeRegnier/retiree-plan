import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, MenuItem,
  TextField, Alert, CircularProgress, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip,
} from '@mui/material';
import CompareIcon from '@mui/icons-material/Compare';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import * as d3 from 'd3';
import { useRef, useEffect } from 'react';

interface Household { id: string; name: string; members: any[]; accounts: any[]; }
interface Scenario { id: string; name: string; parameters: string; }
interface ProjectionYear {
  year: number; age: number; netWorth: number; totalIncome: number;
  totalExpenses: number; netCashFlow: number; rrspBalance?: number;
  tfsaBalance?: number; nonRegBalance?: number; taxPaid?: number;
}

function parseParams(s: Scenario) {
  try { return typeof s.parameters === 'string' ? JSON.parse(s.parameters) : s.parameters; }
  catch { return {}; }
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

interface CompareChartProps {
  dataA: ProjectionYear[];
  dataB: ProjectionYear[];
  labelA: string;
  labelB: string;
}

function CompareChart({ dataA, dataB, labelA, labelB }: CompareChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || dataA.length === 0) return;
    const el = svgRef.current;
    d3.select(el).selectAll('*').remove();

    const margin = { top: 20, right: 140, bottom: 40, left: 80 };
    const width = el.clientWidth - margin.left - margin.right;
    const height = 340 - margin.top - margin.bottom;

    const svg = d3.select(el)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const allYears = [...dataA, ...dataB];
    const xScale = d3.scaleLinear()
      .domain(d3.extent(allYears, (d) => d.year) as [number, number])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(allYears, (d) => d.netWorth) as number * 1.05])
      .range([height, 0]);

    // Grid
    svg.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-width).tickFormat(() => ''))
      .selectAll('line').attr('stroke', '#e0e0e0').attr('stroke-dasharray', '3,3');
    svg.select('.grid .domain').remove();

    // Axes
    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format('d')));
    svg.append('g').call(d3.axisLeft(yScale).tickFormat((d) => fmt(d as number)));

    // Lines
    const lineGen = d3.line<ProjectionYear>()
      .x((d) => xScale(d.year))
      .y((d) => yScale(d.netWorth))
      .curve(d3.curveMonotoneX);

    const colors = ['#1976d2', '#f57c00'];

    [dataA, dataB].forEach((data, i) => {
      svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', colors[i])
        .attr('stroke-width', 2.5)
        .attr('d', lineGen);
    });

    // Legend
    [labelA, labelB].forEach((label, i) => {
      const ly = i * 22;
      svg.append('line')
        .attr('x1', width + 10).attr('x2', width + 30)
        .attr('y1', ly + 6).attr('y2', ly + 6)
        .attr('stroke', colors[i]).attr('stroke-width', 2.5);
      svg.append('text')
        .attr('x', width + 34).attr('y', ly + 10)
        .attr('font-size', 12)
        .text(label.length > 16 ? label.slice(0, 14) + '…' : label);
    });

    svg.append('text').attr('x', width / 2).attr('y', height + 36)
      .attr('text-anchor', 'middle').attr('font-size', 12).text('Year');
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', -60)
      .attr('text-anchor', 'middle').attr('font-size', 12).text('Net Worth');
  }, [dataA, dataB, labelA, labelB]);

  return <svg ref={svgRef} width="100%" height={340} />;
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

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!household || !scenarioIdA || !scenarioIdB) throw new Error('Select both scenarios');
      const scenA = scenarios?.find((s) => s.id === scenarioIdA);
      const scenB = scenarios?.find((s) => s.id === scenarioIdB);
      if (!scenA || !scenB) throw new Error('Scenarios not found');
      const paramsA = parseParams(scenA);
      const paramsB = parseParams(scenB);
      const body = { members: household.members, accounts: household.accounts };
      const [resA, resB] = await Promise.all([
        apiFetch('/projections/cash-flow', {
          method: 'POST',
          body: JSON.stringify({ ...body, scenarioParameters: paramsA }),
        }),
        apiFetch('/projections/cash-flow', {
          method: 'POST',
          body: JSON.stringify({ ...body, scenarioParameters: paramsB }),
        }),
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
  const summary = dataA && dataB && scenA && scenB ? (() => {
    const finalA = dataA[dataA.length - 1];
    const finalB = dataB[dataB.length - 1];
    const depletedA = dataA.find((d) => d.netWorth <= 0);
    const depletedB = dataB.find((d) => d.netWorth <= 0);
    const peakA = dataA.reduce((mx, d) => d.netWorth > mx.netWorth ? d : mx, dataA[0]);
    const peakB = dataB.reduce((mx, d) => d.netWorth > mx.netWorth ? d : mx, dataB[0]);
    return { finalA, finalB, depletedA, depletedB, peakA, peakB };
  })() : null;

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <CompareIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>What-If Comparison</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Compare two scenarios side-by-side to see how different parameters affect your retirement outlook.
      </Typography>

      {!household && (
        <Alert severity="info">Set up your household first.</Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={5}>
              <TextField
                label="Scenario A"
                select fullWidth
                value={scenarioIdA}
                onChange={(e) => setScenarioIdA(e.target.value)}
                disabled={!scenarios?.length}
              >
                {scenarios?.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={1} sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">vs</Typography>
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField
                label="Scenario B"
                select fullWidth
                value={scenarioIdB}
                onChange={(e) => setScenarioIdB(e.target.value)}
                disabled={!scenarios?.length}
              >
                {scenarios?.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={1}>
              <Button
                variant="contained"
                fullWidth
                startIcon={runMutation.isPending ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                disabled={!scenarioIdA || !scenarioIdB || runMutation.isPending}
                onClick={() => runMutation.mutate()}
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
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" mb={2}>Net Worth Projection</Typography>
              <CompareChart dataA={dataA} dataB={dataB} labelA={scenA.name} labelB={scenB.name} />
            </CardContent>
          </Card>

          {summary && (
            <Card>
              <CardContent>
                <Typography variant="h6" mb={2}>Summary Comparison</Typography>
                <TableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Metric</strong></TableCell>
                        <TableCell align="center">
                          <Chip label={scenA.name} color="primary" size="small" />
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={scenB.name} color="warning" size="small" />
                        </TableCell>
                        <TableCell align="center"><strong>Difference</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Final Net Worth</TableCell>
                        <TableCell align="center">{fmt(summary.finalA.netWorth)}</TableCell>
                        <TableCell align="center">{fmt(summary.finalB.netWorth)}</TableCell>
                        <TableCell align="center" sx={{
                          color: summary.finalA.netWorth > summary.finalB.netWorth ? 'success.main' : 'error.main',
                        }}>
                          {fmt(summary.finalA.netWorth - summary.finalB.netWorth)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Peak Net Worth</TableCell>
                        <TableCell align="center">{fmt(summary.peakA.netWorth)} (yr {summary.peakA.year})</TableCell>
                        <TableCell align="center">{fmt(summary.peakB.netWorth)} (yr {summary.peakB.year})</TableCell>
                        <TableCell align="center">—</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Portfolio Depleted</TableCell>
                        <TableCell align="center">
                          {summary.depletedA
                            ? <Chip label={`Age ${summary.depletedA.age}`} color="error" size="small" />
                            : <Chip label="Never" color="success" size="small" />}
                        </TableCell>
                        <TableCell align="center">
                          {summary.depletedB
                            ? <Chip label={`Age ${summary.depletedB.age}`} color="error" size="small" />
                            : <Chip label="Never" color="success" size="small" />}
                        </TableCell>
                        <TableCell align="center">—</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
