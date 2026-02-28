import {
  Box, Grid, Card, CardContent, Typography, useTheme, Button,
  Chip, Skeleton, Stack, Divider, Avatar, alpha,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SavingsIcon from '@mui/icons-material/Savings';
import BarChartIcon from '@mui/icons-material/BarChart';
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import GavelIcon from '@mui/icons-material/Gavel';
import FlagIcon from '@mui/icons-material/Flag';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import * as d3 from 'd3';
import { useApi } from '../hooks/useApi';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Account { id: string; name: string; type: string; balance: number; estimatedReturnRate?: number; annualContribution?: number; }
interface IncomeSource { id: string; name: string; type: string; annualAmount: number; startAge?: number; endAge?: number; }
interface Member { id: string; name: string; dateOfBirth?: string; retirementAge: number; province?: string; incomeSources?: IncomeSource[]; }
interface Scenario { id: string; name: string; description?: string; parameters?: string | Record<string, any>; }
interface Household { id: string; name: string; members: Member[]; accounts: Account[]; scenarios?: Scenario[]; annualExpenses?: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const money = (n: number, compact = false) =>
  compact
    ? n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
      : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
      : `$${n.toFixed(0)}`
    : new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

function ageNow(dob?: string): number {
  if (!dob) return 45;
  return new Date().getFullYear() - new Date(dob).getFullYear();
}

function parseParams(raw: string | Record<string, any> | undefined): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** D3 donut chart showing portfolio allocation by account type. */
function PortfolioDonut({ slices, size = 180 }: { slices: { label: string; value: number; color: string }[]; size?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();

  useEffect(() => {
    const el = svgRef.current;
    if (!el || slices.length === 0) return;
    const r = size / 2;
    const inner = r * 0.58, outer = r * 0.90;
    const total = slices.reduce((s, d) => s + d.value, 0);

    d3.select(el).selectAll('*').remove();
    const svg = d3.select(el).attr('width', size).attr('height', size);
    const g = svg.append('g').attr('transform', `translate(${r},${r})`);

    const pie = d3.pie<{ label: string; value: number; color: string }>()
      .value(d => d.value).sort(null).padAngle(0.025);

    const arc = d3.arc<d3.PieArcDatum<{ label: string; value: number; color: string }>>()
      .innerRadius(inner).outerRadius(outer).cornerRadius(4);
    const hoverArc = d3.arc<d3.PieArcDatum<{ label: string; value: number; color: string }>>()
      .innerRadius(inner).outerRadius(outer + 6).cornerRadius(4);

    const center = g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.2em')
      .attr('fill', theme.palette.text.primary).attr('font-size', size * 0.115).attr('font-weight', 700)
      .text(money(total, true));
    const sub = g.append('text').attr('text-anchor', 'middle').attr('dy', `${size * 0.115 * 0.07 + 16}px`)
      .attr('fill', theme.palette.text.secondary).attr('font-size', size * 0.065).text('Total Portfolio');

    g.selectAll('path').data(pie(slices)).enter().append('path')
      .attr('d', arc).attr('fill', d => d.data.color).style('cursor', 'pointer')
      .on('mouseenter', function (_, d) {
        d3.select(this).transition().duration(150).attr('d', hoverArc as any);
        center.text(money(d.data.value, true));
        sub.text(`${((d.data.value / total) * 100).toFixed(1)}% ${d.data.label}`);
      })
      .on('mouseleave', function () {
        d3.select(this).transition().duration(150).attr('d', arc as any);
        center.text(money(total, true));
        sub.text('Total Portfolio');
      });
  }, [slices, size, theme]);

  return <svg ref={svgRef} />;
}

/** D3 CatmullRom area sparkline for projected net worth, with entrance animation. */
function NetWorthSparkline({ data }: { data: { age: number; netWorth: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();
  const H = 150, pL = 60, pR = 16, pT = 10, pB = 26;

  const draw = useMemo(() => (width: number) => {
    const el = svgRef.current;
    if (!el || data.length < 2 || width < 10) return;
    const W = width;

    d3.select(el).selectAll('*').remove();
    d3.select(el).attr('width', W).attr('height', H);

    const x = d3.scaleLinear().domain([data[0].age, data[data.length - 1].age]).range([pL, W - pR]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.netWorth) ?? 1]).nice().range([H - pB, pT]);

    const ticks = y.ticks(4);

    // Grid + Y labels
    d3.select(el).selectAll('.grid').data(ticks).enter().append('line')
      .attr('x1', pL).attr('x2', W - pR)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', theme.palette.divider).attr('stroke-width', 0.5);
    d3.select(el).selectAll('.ytick').data(ticks).enter().append('text')
      .attr('x', pL - 6).attr('y', d => y(d) + 3.5)
      .attr('text-anchor', 'end')
      .attr('fill', theme.palette.text.secondary).attr('font-size', 11)
      .text(d => money(d, true));

    // Area
    const area = d3.area<{ age: number; netWorth: number }>()
      .x(d => x(d.age)).y0(H - pB).y1(d => y(d.netWorth)).curve(d3.curveCatmullRom);
    d3.select(el).append('path').datum(data)
      .attr('fill', alpha(theme.palette.primary.main, 0.12)).attr('d', area);

    // Line with entrance animation
    const line = d3.line<{ age: number; netWorth: number }>()
      .x(d => x(d.age)).y(d => y(d.netWorth)).curve(d3.curveCatmullRom);
    const path = d3.select(el).append('path').datum(data)
      .attr('fill', 'none').attr('stroke', theme.palette.primary.main)
      .attr('stroke-width', 2).attr('d', line);
    const len = (path.node() as SVGPathElement)?.getTotalLength() ?? 0;
    path.attr('stroke-dasharray', `${len} ${len}`).attr('stroke-dashoffset', len)
      .transition().duration(1200).ease(d3.easeQuadOut).attr('stroke-dashoffset', 0);

    // X baseline
    d3.select(el).append('line')
      .attr('x1', pL).attr('x2', W - pR)
      .attr('y1', H - pB).attr('y2', H - pB)
      .attr('stroke', theme.palette.divider).attr('stroke-width', 0.5);

    // X labels
    d3.select(el).selectAll('.xlabel').data(data.filter(d => d.age % 5 === 0)).enter().append('text')
      .attr('x', d => x(d.age)).attr('y', H - 7)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.palette.text.secondary).attr('font-size', 11)
      .text(d => d.age);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, theme]);

  // Initial draw + redraw on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    draw(container.clientWidth);
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) draw(w);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
    </Box>
  );
}

/** KPI summary card with avatar icon. */
function KpiCard({ title, value, subValue, icon, color, loading }: {
  title: string; value: string; subValue?: string; icon: React.ReactNode; color: string; loading?: boolean;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Avatar sx={{ bgcolor: alpha(color, 0.12), color, width: 44, height: 44 }}>{icon}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary"
              sx={{ fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.68rem' }}>
              {title}
            </Typography>
            {loading ? <Skeleton width="70%" height={36} /> : (
              <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2, mt: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {value}
              </Typography>
            )}
            {subValue && (
              <Typography variant="caption" color="text.secondary"
                sx={{ mt: 0.25, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {subValue}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Compact scenario card showing key parameters. */
function ScenarioCard({ sc, idx }: { sc: Scenario; idx: number }) {
  const navigate = useNavigate();
  const p = parseParams(sc.parameters);
  const chips: string[] = [];
  if (p.retirementAge) chips.push(`Retire ${p.retirementAge}`);
  if (p.expectedReturnRate) chips.push(`${(p.expectedReturnRate * 100).toFixed(1)}% return`);
  if (p.inflationRate) chips.push(`${(p.inflationRate * 100).toFixed(1)}% inflation`);
  const hue = (idx * 47 + 200) % 360;
  return (
    <Card sx={{ cursor: 'pointer', height: '100%', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 4 } }}
      onClick={() => navigate('/scenarios')}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Avatar sx={{ bgcolor: `hsl(${hue},60%,88%)`, color: `hsl(${hue},50%,35%)`, width: 28, height: 28, fontSize: 12, fontWeight: 700 }}>
            {idx + 1}
          </Avatar>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }} noWrap>{sc.name}</Typography>
        </Stack>
        {sc.description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{sc.description}</Typography>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {chips.map(c => <Chip key={c} label={c} size="small" sx={{ fontSize: '0.63rem', height: 18 }} />)}
        </Box>
      </CardContent>
    </Card>
  );
}

/** Single milestone row with avatar + label + detail + optional "Next" chip. */
function MilestoneRow({ icon, color, label, detail, isNext }: {
  icon: React.ReactNode; color: string; label: string; detail: string; isNext?: boolean;
}) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.75 }}>
      <Avatar sx={{ bgcolor: alpha(color, 0.12), color, width: 32, height: 32 }}>{icon}</Avatar>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: isNext ? 700 : 500 }}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{detail}</Typography>
      </Box>
      {isNext && <Chip label="Next" size="small" color="primary" sx={{ height: 18, fontSize: '0.6rem' }} />}
    </Stack>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { apiFetch } = useApi();

  const { data: households, isLoading: hhLoading } = useQuery<Household[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
  });

  const hh = households?.[0];
  const primaryMember = hh?.members?.[0];
  const accounts = hh?.accounts ?? [];
  const scenarios = hh?.scenarios ?? [];

  // Aggregates
  const currentAge = ageNow(primaryMember?.dateOfBirth);
  const retirementAge = primaryMember?.retirementAge ?? 65;
  const yearsToRetire = Math.max(0, retirementAge - currentAge);
  const retirementYear = new Date().getFullYear() + yearsToRetire;

  const rrspTotal   = accounts.filter(a => ['RRSP', 'RRIF'].includes(a.type)).reduce((s, a) => s + a.balance, 0);
  const tfsaTotal   = accounts.filter(a => a.type === 'TFSA').reduce((s, a) => s + a.balance, 0);
  const nonRegTotal = accounts.filter(a => a.type === 'NON_REG').reduce((s, a) => s + a.balance, 0);
  const cashTotal   = accounts.filter(a => a.type === 'CASH').reduce((s, a) => s + a.balance, 0);
  const totalPortfolio = accounts.reduce((s, a) => s + a.balance, 0);
  const totalIncome = (hh?.members ?? []).flatMap(m => m.incomeSources ?? []).reduce((s, i) => s + i.annualAmount, 0);

  const portfolioSlices = [
    { label: 'RRSP / RRIF',    value: rrspTotal,   color: '#6C63FF' },
    { label: 'TFSA',           value: tfsaTotal,   color: '#00C49F' },
    { label: 'Non-Registered', value: nonRegTotal, color: '#FFB347' },
    { label: 'Cash / Savings', value: cashTotal,   color: '#74B9FF' },
  ].filter(s => s.value > 0);

  // Pull key ages from first scenario parameters (fallback to defaults)
  const firstScenarioParams = useMemo(() => parseParams(scenarios[0]?.parameters), [scenarios]);
  const cppStartAge: number    = firstScenarioParams.cppStartAge    ?? 65;
  const oasStartAge: number    = firstScenarioParams.oasStartAge    ?? 65;
  const lifeExpectancy: number = firstScenarioParams.lifeExpectancy ?? 90;

  // ── Live base-case projection ─────────────────────────────────────────────
  const ENGINE_EXCLUDED = useMemo(() => new Set(['CPP', 'OAS']), []);

  const projPayload = useMemo(() => {
    if (!hh || !primaryMember) return null;
    const p = firstScenarioParams;
    return {
      currentAge,
      endAge: lifeExpectancy,
      province: primaryMember.province ?? 'ON',
      employmentIncome: 0,
      incomeSources: (hh.members ?? []).flatMap(m =>
        (m.incomeSources ?? [])
          .filter(src => !ENGINE_EXCLUDED.has(src.type))
          .map(src => ({ annualAmount: src.annualAmount, startAge: src.startAge, endAge: src.endAge, indexToInflation: true })),
      ),
      retirementAge,
      annualExpenses: hh.annualExpenses ?? 60_000,
      inflationRate:       p.inflationRate       ?? 0.02,
      nominalReturnRate:   p.expectedReturnRate  ?? 0.06,
      cppStartAge,
      oasStartAge,
      rrspBalance:    rrspTotal,
      tfsaBalance:    tfsaTotal,
      nonRegBalance:  nonRegTotal,
      cashBalance:    cashTotal,
      rrspContribution: accounts.find(a => a.type === 'RRSP')?.annualContribution ?? 0,
      tfsaContribution: accounts.find(a => a.type === 'TFSA')?.annualContribution ?? 0,
      rrifConversionAge: p.rrifStartAge ?? 71,
      investSurplus: p.investSurplus ?? false,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hh?.id, currentAge, retirementAge, rrspTotal, tfsaTotal, nonRegTotal, cashTotal]);

  const { data: projData, isLoading: projLoading } = useQuery<any[]>({
    queryKey: ['dash-projection', hh?.id],
    queryFn: async () => {
      const raw: any = await apiFetch('/projections/cash-flow', { method: 'POST', body: JSON.stringify(projPayload) });
      return Array.isArray(raw) ? raw : (raw.years ?? raw.data ?? []);
    },
    enabled: !!projPayload && totalPortfolio > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const sparkData = useMemo(
    () => (projData ?? []).map((y: any) => ({ age: y.age as number, netWorth: Math.max(0, (y.totalNetWorth ?? y.netWorth ?? 0) as number) })),
    [projData],
  );

  const depletionAge = useMemo(() => {
    if (!projData?.length) return null;
    const hit = projData.find((y: any) => ((y.totalNetWorth ?? y.netWorth ?? 0) as number) <= 0);
    return hit ? (hit.age as number) : null;
  }, [projData]);

  const nwAtRetirement = useMemo(() => {
    if (!projData?.length) return null;
    const row = projData.find((y: any) => y.age === retirementAge);
    return row ? Math.max(0, (row.totalNetWorth ?? row.netWorth ?? 0) as number) : null;
  }, [projData, retirementAge]);

  // Personalised greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (primaryMember?.name ?? hh?.name ?? 'there').split(' ')[0];

  // Quick navigation tiles
  const navTiles = [
    { label: 'Household',    path: '/household',     icon: <PeopleAltIcon />,     color: '#6C63FF' },
    { label: 'Accounts',     path: '/accounts',      icon: <AccountBalanceIcon />,color: '#00C49F' },
    { label: 'Scenarios',    path: '/scenarios',     icon: <ContentPasteIcon />,  color: '#FFB347' },
    { label: 'Projections',  path: '/projections',   icon: <BarChartIcon />,      color: '#FF6B6B' },
    { label: 'Monte Carlo',  path: '/simulations',   icon: <ScatterPlotIcon />,   color: '#A29BFE' },
    { label: 'Tax Analytics',path: '/tax-analytics', icon: <ReceiptLongIcon />,   color: '#00CEC9' },
    { label: 'Compare',      path: '/compare',       icon: <CompareArrowsIcon />, color: '#FDCB6E' },
    { label: 'Estate',       path: '/estate',        icon: <GavelIcon />,         color: '#E17055' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Greeting */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {greeting}, {firstName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          {yearsToRetire > 0 && ` · ${yearsToRetire} year${yearsToRetire !== 1 ? 's' : ''} to retirement`}
        </Typography>
      </Box>

      {/* KPI cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} xl={3}>
          <KpiCard
            title="Total Portfolio" icon={<SavingsIcon />} color={theme.palette.primary.main} loading={hhLoading}
            value={money(totalPortfolio)}
            subValue={accounts.length ? `${accounts.length} account${accounts.length !== 1 ? 's' : ''}` : 'No accounts yet'}
          />
        </Grid>
        <Grid item xs={12} sm={6} xl={3}>
          <KpiCard
            title="Annual Income" icon={<TrendingUpIcon />} color="#00C49F" loading={hhLoading}
            value={money(totalIncome)}
            subValue={totalIncome > 0 ? `${money(Math.round(totalIncome / 12))}/mo` : 'Add income sources'}
          />
        </Grid>
        <Grid item xs={12} sm={6} xl={3}>
          <KpiCard
            title="Years to Retirement"
            icon={<HourglassTopIcon />}
            color={yearsToRetire <= 5 ? theme.palette.warning.main : '#FFB347'}
            loading={hhLoading}
            value={yearsToRetire > 0 ? `${yearsToRetire} yrs` : 'Retired'}
            subValue={yearsToRetire > 0 ? `Age ${retirementAge} · ${retirementYear}` : `Age ${currentAge}`}
          />
        </Grid>
        <Grid item xs={12} sm={6} xl={3}>
          <KpiCard
            title={nwAtRetirement != null ? 'Net Worth at Retirement' : 'Scenarios'}
            icon={depletionAge ? <WarningAmberIcon /> : <CheckCircleIcon />}
            color={depletionAge ? theme.palette.error.main : theme.palette.success.main}
            loading={hhLoading || projLoading}
            value={nwAtRetirement != null ? money(nwAtRetirement, true) : `${scenarios.length}`}
            subValue={
              depletionAge         ? `⚠ Depletes at age ${depletionAge}` :
              nwAtRetirement != null ? `Projected at age ${retirementAge}` :
              scenarios.length     ? `${scenarios.length} scenario${scenarios.length !== 1 ? 's' : ''} configured` :
              'Create a scenario'
            }
          />
        </Grid>
      </Grid>

      {/* Portfolio allocation + milestones */}
      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Portfolio Allocation</Typography>
              {accounts.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 2 }}>
                  <AccountBalanceIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                  <Typography color="text.secondary">No accounts added yet</Typography>
                  <Button variant="outlined" size="small" onClick={() => navigate('/accounts')}>Add Accounts</Button>
                </Box>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
                  <Box sx={{ flexShrink: 0 }}>
                    <PortfolioDonut slices={portfolioSlices} size={174} />
                  </Box>
                  <Box sx={{ flex: 1, width: '100%' }}>
                    {portfolioSlices.map(s => {
                      const pct = totalPortfolio > 0 ? (s.value / totalPortfolio) * 100 : 0;
                      return (
                        <Box key={s.label} sx={{ mb: 1.5 }}>
                          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                              <Typography variant="body2">{s.label}</Typography>
                            </Stack>
                            <Typography variant="body2" fontWeight={600}>
                              {money(s.value)}&nbsp;
                              <Typography component="span" variant="caption" color="text.secondary">({pct.toFixed(1)}%)</Typography>
                            </Typography>
                          </Stack>
                          <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, height: 8, overflow: 'hidden' }}>
                            <Box sx={{ width: `${pct}%`, bgcolor: s.color, height: '100%', borderRadius: 2, transition: 'width 0.8s ease' }} />
                          </Box>
                        </Box>
                      );
                    })}
                    <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                      <Button size="small" endIcon={<ArrowForwardIosIcon sx={{ fontSize: 11 }} />} onClick={() => navigate('/accounts')}>
                        Manage Accounts
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Key Milestones</Typography>
              {!hh ? (
                <Typography color="text.secondary" variant="body2">Set up your household to see milestones.</Typography>
              ) : (
                <Box>
                  <MilestoneRow icon={<FlagIcon fontSize="small" />} color={theme.palette.primary.main}
                    label={`Retirement — Age ${retirementAge}`}
                    detail={yearsToRetire > 0 ? `In ${yearsToRetire} years · ${retirementYear}` : 'Already reached'}
                    isNext={yearsToRetire > 0 && currentAge < cppStartAge && currentAge < oasStartAge}
                  />
                  <Divider sx={{ my: 0.5, opacity: 0.4 }} />
                  <MilestoneRow icon={<AccountBalanceIcon fontSize="small" />} color="#6C63FF"
                    label={`CPP Start — Age ${cppStartAge}`}
                    detail={currentAge < cppStartAge ? `In ${cppStartAge - currentAge} years · ${new Date().getFullYear() + (cppStartAge - currentAge)}` : 'Reached'}
                    isNext={currentAge >= retirementAge && currentAge < cppStartAge}
                  />
                  <Divider sx={{ my: 0.5, opacity: 0.4 }} />
                  <MilestoneRow icon={<AccountBalanceIcon fontSize="small" />} color="#00C49F"
                    label={`OAS Start — Age ${oasStartAge}`}
                    detail={currentAge < oasStartAge ? `In ${oasStartAge - currentAge} years · ${new Date().getFullYear() + (oasStartAge - currentAge)}` : 'Reached'}
                    isNext={currentAge >= cppStartAge && currentAge < oasStartAge}
                  />
                  <Divider sx={{ my: 0.5, opacity: 0.4 }} />
                  <MilestoneRow icon={<HourglassTopIcon fontSize="small" />} color={theme.palette.text.secondary}
                    label={`Plan End — Age ${lifeExpectancy}`}
                    detail={`${new Date().getFullYear() + (lifeExpectancy - currentAge)} · ${lifeExpectancy - currentAge} years away`}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Projected net worth sparkline */}
      {(sparkData.length > 0 || projLoading) && (
        <Card sx={{ mb: 2.5 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Projected Net Worth</Typography>
                <Typography variant="caption" color="text.secondary">
                  Base-case scenario · ages {currentAge}–{lifeExpectancy}
                  {depletionAge ? ` · ⚠ Depletion at age ${depletionAge}` :
                   nwAtRetirement ? ` · ${money(nwAtRetirement, true)} at retirement` : ''}
                </Typography>
              </Box>
              <Button size="small" endIcon={<ArrowForwardIosIcon sx={{ fontSize: 11 }} />} onClick={() => navigate('/projections')}>
                Full Analysis
              </Button>
            </Stack>
            {projLoading ? (
              <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 1 }} />
            ) : (
              <>
                <NetWorthSparkline data={sparkData} />
                {depletionAge && (
                  <Box sx={{ mt: 1, p: 1.25, borderRadius: 1, bgcolor: alpha(theme.palette.error.main, 0.08), display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningAmberIcon fontSize="small" color="error" />
                    <Typography variant="caption" color="error.main">
                      Based on current assumptions, the portfolio depletes at age {depletionAge}. Consider adjusting your scenarios.
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scenarios */}
      {scenarios.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Scenarios</Typography>
            <Button size="small" endIcon={<ArrowForwardIosIcon sx={{ fontSize: 11 }} />} onClick={() => navigate('/scenarios')}>Manage</Button>
          </Stack>
          <Grid container spacing={2}>
            {scenarios.map((sc, i) => (
              <Grid item xs={12} sm={6} md={4} key={sc.id}>
                <ScenarioCard sc={sc} idx={i} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Quick navigation tiles */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Quick Navigation</Typography>
          <Grid container spacing={1.5}>
            {navTiles.map(tile => (
              <Grid item xs={6} sm={3} key={tile.path}>
                <Box
                  onClick={() => navigate(tile.path)}
                  sx={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 0.75, p: 1.75, borderRadius: 2, cursor: 'pointer',
                    bgcolor: alpha(tile.color, 0.07), border: `1px solid ${alpha(tile.color, 0.18)}`,
                    transition: 'background-color 0.18s, box-shadow 0.18s',
                    '&:hover': { bgcolor: alpha(tile.color, 0.14), boxShadow: 2 },
                  }}
                >
                  <Avatar sx={{ bgcolor: alpha(tile.color, 0.15), color: tile.color, width: 40, height: 40 }}>
                    {tile.icon}
                  </Avatar>
                  <Typography variant="caption" sx={{ fontWeight: 600, textAlign: 'center' }}>{tile.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
