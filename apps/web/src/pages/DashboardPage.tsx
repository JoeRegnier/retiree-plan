import {
  Box, Grid, Card, CardContent, Typography, useTheme, Button,
  Chip, Skeleton, Stack, Divider, Avatar, CircularProgress, alpha, Alert,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import HomeIcon from '@mui/icons-material/Home';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
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
import CalculateIcon from '@mui/icons-material/Calculate';
import { useEffect, useRef, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import * as d3 from 'd3';
import { calculatePlanCompleteness } from '@retiree-plan/finance-engine';
import { ReadinessGauge } from '../components/charts/ReadinessGauge';
import { AssumptionsAuditDialog } from '../components/AssumptionsAuditDialog';
import { DecisionReviewCard } from '../components/dashboard/DecisionReviewCard';
import { useApi } from '../hooks/useApi';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Account { id: string; name: string; type: string; balance: number; estimatedReturnRate?: number; annualContribution?: number; }
interface IncomeSource { id: string; name: string; type: string; annualAmount: number; startAge?: number; endAge?: number; }
interface Member { id: string; name: string; dateOfBirth?: string; retirementAge: number; province?: string; incomeSources?: IncomeSource[]; cppExpectedBenefit?: number | null; rrspContributionRoom?: number | null; tfsaContributionRoom?: number | null; priorYearIncome?: number | null; }
interface Scenario { id: string; name: string; description?: string; parameters?: string | Record<string, any>; }
interface Household { id: string; name: string; members: Member[]; accounts: Account[]; scenarios?: Scenario[]; annualExpenses?: number; }
interface Insight {
  id: string;
  title: string;
  description: string;
  dollarImpact: number;
  priority: 'high' | 'medium' | 'low';
  linkTo: string;
  category: 'tax' | 'benefits' | 'investment' | 'estate';
}
interface InsightInput {
  currentAge: number;
  retirementAge: number;
  annualIncome: number;
  province: string;
  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  unusedTfsaRoom: number;
  unusedRrspRoom: number;
  cppStartAge: number;
  oasStartAge: number;
  oasClawbackYears: number[];
  projectedIncomeAtRetirement: number;
  hasSpouse: boolean;
  spouseIncome?: number;
  rrifConversionAge: number;
}

const INSIGHT_COUNT_STORAGE_KEY = 'retiree-plan-insight-count';
const ASSUMPTIONS_DISMISS_STORAGE_KEY = 'retiree-plan-assumptions-dismissed';

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
function NetWorthSparkline({ data, milestones, currentAge }: {
  data: { age: number; netWorth: number }[];
  milestones?: { age: number; label: string; color: string }[];
  currentAge?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();
  const H = 150, pL = 60, pR = 16, pT = 22, pB = 26;

  const draw = useMemo(() => (width: number) => {
    const el = svgRef.current;
    if (!el || data.length < 2 || width < 10) return;
    const W = width;
    const minAge = data[0].age;
    const maxAge = data[data.length - 1].age;

    d3.select(el).selectAll('*').remove();
    d3.select(el).attr('width', W).attr('height', H);

    d3.select(el).append('style').text(`
      @keyframes dashboard-current-age-pulse {
        0%   { r: 5; opacity: 1; }
        50%  { r: 7.5; opacity: 0.45; }
        100% { r: 5; opacity: 1; }
      }
      .dashboard-current-age-dot {
        animation: dashboard-current-age-pulse 1.8s ease-in-out infinite;
      }
    `);

    const x = d3.scaleLinear().domain([minAge, maxAge]).range([pL, W - pR]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.netWorth) ?? 1]).nice().range([H - pB, pT]);
    const plotWidth = W - pL - pR;
    const plotTop = pT;
    const plotBottom = H - pB;

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

    const visibleMilestones = (milestones ?? []).filter(m => m.age >= minAge && m.age <= maxAge);
    const milestoneGroup = d3.select(el).append('g');
    visibleMilestones.forEach(m => {
      const mx = x(m.age);
      milestoneGroup.append('line')
        .attr('x1', mx)
        .attr('x2', mx)
        .attr('y1', plotBottom)
        .attr('y2', plotTop)
        .attr('stroke', m.color)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4 4')
        .attr('opacity', 0.9);

      milestoneGroup.append('text')
        .attr('transform', `translate(${mx - 2},${plotTop - 4}) rotate(-45)`)
        .attr('text-anchor', 'end')
        .attr('fill', m.color)
        .attr('font-size', 10)
        .attr('font-weight', 600)
        .text(m.label);
    });

    if (typeof currentAge === 'number' && currentAge >= minAge && currentAge <= maxAge) {
      const leftIdx = d3.bisector((d: { age: number }) => d.age).left(data, currentAge);
      const currentNetWorth = leftIdx <= 0
        ? data[0].netWorth
        : leftIdx >= data.length
          ? data[data.length - 1].netWorth
          : (() => {
              const prev = data[leftIdx - 1];
              const next = data[leftIdx];
              const span = Math.max(1e-9, next.age - prev.age);
              const t = (currentAge - prev.age) / span;
              return prev.netWorth + (next.netWorth - prev.netWorth) * t;
            })();

      d3.select(el).append('circle')
        .attr('class', 'dashboard-current-age-dot')
        .attr('cx', x(currentAge))
        .attr('cy', y(currentNetWorth))
        .attr('r', 5)
        .attr('fill', theme.palette.primary.main)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);
    }

    const hover = d3.select(el).append('g').style('display', 'none');
    const hoverLine = hover.append('line')
      .attr('y1', plotTop)
      .attr('y2', plotBottom)
      .attr('stroke', theme.palette.text.secondary)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 4');

    const hoverDot = hover.append('circle')
      .attr('r', 4)
      .attr('fill', theme.palette.primary.main)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.25);

    const hoverLabel = hover.append('g');
    const hoverLabelBg = hoverLabel.append('rect')
      .attr('width', 132)
      .attr('height', 20)
      .attr('rx', 6)
      .attr('fill', alpha(theme.palette.background.paper, 0.95))
      .attr('stroke', theme.palette.divider);
    const hoverLabelText = hoverLabel.append('text')
      .attr('x', 8)
      .attr('y', 14)
      .attr('fill', theme.palette.text.primary)
      .attr('font-size', 11)
      .attr('font-weight', 600);

    const bisect = d3.bisector((d: { age: number }) => d.age).center;
    d3.select(el).append('rect')
      .attr('x', pL)
      .attr('y', plotTop)
      .attr('width', plotWidth)
      .attr('height', plotBottom - plotTop)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event, this as SVGRectElement);
        const clamped = Math.max(0, Math.min(plotWidth, mx));
        const hoveredAge = x.invert(clamped + pL);
        const idx = Math.max(0, Math.min(data.length - 1, bisect(data, hoveredAge)));
        const point = data[idx];
        const px = x(point.age);
        const py = y(point.netWorth);
        const tooltipWidth = 132;
        const tooltipX = px + tooltipWidth + 10 <= (W - pR)
          ? px + 10
          : Math.max(pL, px - tooltipWidth - 10);

        hover.style('display', null);
        hoverLine.attr('x1', px).attr('x2', px);
        hoverDot.attr('cx', px).attr('cy', py);
        hoverLabel.attr('transform', `translate(${tooltipX},${plotTop + 4})`);
        hoverLabelText.text(`Age ${point.age}: ${money(point.netWorth, true)}`);
        hoverLabelBg.attr('height', 20);
      })
      .on('mouseleave', () => {
        hover.style('display', 'none');
      });

    // X labels
    d3.select(el).selectAll('.xlabel').data(data.filter(d => d.age % 5 === 0)).enter().append('text')
      .attr('x', d => x(d.age)).attr('y', H - 7)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.palette.text.secondary).attr('font-size', 11)
      .text(d => d.age);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, milestones, currentAge, theme]);

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

function IncomeReplacementCard({ projData, retirementAge, loading }: {
  projData: any[] | undefined;
  retirementAge: number;
  loading: boolean;
}) {
  const theme = useTheme();

  const { preRetirement, retirement, ratio } = useMemo(() => {
    if (!projData?.length) return { preRetirement: 0, retirement: 0, ratio: 0 };
    const preRow = projData.find((y: any) => y.age === retirementAge - 1);
    const retRow = projData.find((y: any) => y.age === retirementAge);
    const pre = (preRow?.grossIncome ?? 0) as number;
    const ret = (retRow?.grossIncome ?? 0) as number;
    return { preRetirement: pre, retirement: ret, ratio: pre > 0 ? ret / pre : 0 };
  }, [projData, retirementAge]);

  const pct = Math.round(ratio * 100);
  const barColor = pct >= 70 ? theme.palette.success.main : pct >= 50 ? theme.palette.warning.main : theme.palette.error.main;
  const label = pct >= 70 ? 'On track' : pct >= 50 ? 'Needs attention' : 'Below target';

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Avatar sx={{ bgcolor: alpha(barColor, 0.12), color: barColor, width: 44, height: 44 }}>
            <TrendingUpIcon />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary"
              sx={{ fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.68rem' }}>
              Income Replacement
            </Typography>
            {loading ? <Skeleton width="70%" height={36} /> : (
              <>
                <Stack direction="row" alignItems="baseline" spacing={0.75}>
                  <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2, mt: 0.3, color: barColor }}>
                    {pct}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: barColor, fontWeight: 600 }}>{label}</Typography>
                </Stack>
                <Box sx={{ mt: 0.75, bgcolor: 'action.hover', borderRadius: 2, height: 5, overflow: 'hidden' }}>
                  <Box sx={{ width: `${Math.min(pct, 100)}%`, bgcolor: barColor, height: '100%', borderRadius: 2, transition: 'width 0.8s ease' }} />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.4, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {money(retirement, true)} of {money(preRetirement, true)} pre-retirement
                </Typography>
              </>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ReadinessScoreCard({ data, loading, projData, depletionAge, nwAtRetirement, lifeExpectancy, rrspTotal, tfsaTotal, nonRegTotal, cashTotal }: {
  data: any; loading: boolean;
  projData?: any[]; depletionAge?: number | null; nwAtRetirement?: number | null;
  lifeExpectancy?: number; rrspTotal: number; tfsaTotal: number; nonRegTotal: number; cashTotal: number;
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  if (loading) return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        <Skeleton width={160} height={24} sx={{ mb: 2 }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
          <Skeleton variant="rounded" width={200} height={110} sx={{ borderRadius: 2, flexShrink: 0 }} />
          <Box sx={{ flex: 1, width: '100%' }}>
            {[40, 25, 20, 15].map(w => (
              <Box key={w} sx={{ mb: 1.5 }}>
                <Skeleton width="60%" height={16} sx={{ mb: 0.5 }} />
                <Skeleton variant="rounded" height={6} />
              </Box>
            ))}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
  if (!data) return null;

  const components = [
    { label: 'Monte Carlo Success', score: data.monteCarloComponent, max: 40 },
    { label: 'Income Replacement', score: data.incomeReplacementComponent, max: 25 },
    { label: 'Tax Efficiency', score: data.taxEfficiencyComponent, max: 20 },
    { label: 'Diversification', score: data.diversificationComponent, max: 15 },
  ];

  const scoreLabel = data.score >= 80 ? 'Excellent' : data.score >= 70 ? 'Good' : data.score >= 50 ? 'Fair' : 'Needs Work';
  const scoreLabelColor = data.score >= 80 ? theme.palette.success.main : data.score >= 70 ? theme.palette.warning.main : data.score >= 50 ? theme.palette.warning.main : theme.palette.error.main;

  // Derived projection stats
  const mcSuccessRate = Math.round((data.monteCarloComponent / 40) * 100);
  const portfolioSurvives = !depletionAge;
  const surviveAge = depletionAge ?? lifeExpectancy ?? 90;
  const peakNW = projData?.length ? Math.max(...projData.map((y: any) => y.totalNetWorth ?? y.netWorth ?? 0)) : null;
  const peakNWAge = (peakNW != null && projData?.length) ? projData.find((y: any) => (y.totalNetWorth ?? y.netWorth ?? 0) === peakNW)?.age : null;
  const portfolioTotal = rrspTotal + tfsaTotal + nonRegTotal + cashTotal;
  const accountBars = [
    { label: 'RRSP/RRIF', value: rrspTotal, color: '#6C63FF' },
    { label: 'TFSA', value: tfsaTotal, color: '#00C49F' },
    { label: 'Non-Reg', value: nonRegTotal, color: '#FFB347' },
    { label: 'Cash', value: cashTotal, color: '#74B9FF' },
  ].filter(b => b.value > 0);
  const statTiles = [
    {
      label: 'Monte Carlo Success',
      value: `${mcSuccessRate}%`,
      sub: mcSuccessRate >= 80 ? 'Strong confidence' : mcSuccessRate >= 60 ? 'Moderate confidence' : 'Low confidence',
      color: mcSuccessRate >= 80 ? theme.palette.success.main : mcSuccessRate >= 60 ? theme.palette.warning.main : theme.palette.error.main,
    },
    {
      label: portfolioSurvives ? 'Portfolio Survives To' : 'Portfolio Depletes At',
      value: `Age ${surviveAge}`,
      sub: portfolioSurvives ? `Past life expectancy (${lifeExpectancy ?? 90})` : '⚠ Shortfall detected',
      color: portfolioSurvives ? theme.palette.success.main : theme.palette.error.main,
    },
    {
      label: 'Peak Net Worth',
      value: peakNW != null ? money(peakNW, true) : '—',
      sub: peakNWAge != null ? `At age ${peakNWAge}` : '',
      color: theme.palette.info.main,
    },
  ];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexShrink: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Retirement Readiness</Typography>
          <Chip label={scoreLabel} size="small"
            sx={{ bgcolor: alpha(scoreLabelColor, 0.12), color: scoreLabelColor, fontWeight: 700, fontSize: '0.72rem', border: `1px solid ${alpha(scoreLabelColor, 0.3)}` }} />
        </Stack>

        {/* Gauge (left) + score component bars (right) */}
        <Grid container spacing={2} alignItems="flex-start" sx={{ flexShrink: 0 }}>
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
            <ReadinessGauge score={data.score} size={180} />
            <Box sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: alpha(scoreLabelColor, 0.08), border: `1px solid ${alpha(scoreLabelColor, 0.2)}`, width: '100%', textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: scoreLabelColor, fontWeight: 700, display: 'block', fontSize: '0.75rem' }}>
                {scoreLabel}
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <Stack spacing={1.75}>
              {components.map(c => {
                const score = Number(c.score ?? 0);
                const pct = Math.max(0, Math.min(100, (score / c.max) * 100));
                const color = score / c.max >= 0.7
                  ? theme.palette.success.main
                  : score / c.max >= 0.4
                    ? theme.palette.warning.main
                    : theme.palette.error.main;
                return (
                  <Box key={c.label}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.4 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{c.label}</Typography>
                      <Typography variant="caption" fontWeight={700} sx={{ color, letterSpacing: 0.3 }}>
                        {score.toFixed(0)}<Typography component="span" variant="caption" color="text.disabled"> / {c.max}</Typography>
                      </Typography>
                    </Stack>
                    <Box sx={{ bgcolor: 'action.hover', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                      <Box sx={{ width: `${pct}%`, bgcolor: color, height: '100%', borderRadius: 99, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Grid>
        </Grid>

        {/* Projection stat tiles */}
        {projData?.length ? (
          <Box sx={{ mt: 2, flexShrink: 0 }}>
            <Box sx={{ height: '1px', bgcolor: 'divider', mb: 1.5 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
              {statTiles.map(t => (
                <Box key={t.label} sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(t.color, 0.06), border: `1px solid ${alpha(t.color, 0.18)}`, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem', display: 'block', mb: 0.4, lineHeight: 1.3 }}>{t.label}</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: t.color, lineHeight: 1.1 }}>{t.value}</Typography>
                  {t.sub && (
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem', display: 'block', mt: 0.4, lineHeight: 1.3 }}>{t.sub}</Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}

        {/* Portfolio allocation stacked bar */}
        {portfolioTotal > 0 && (
          <Box sx={{ mt: 2, flexShrink: 0 }}>
            <Box sx={{ height: '1px', bgcolor: 'divider', mb: 1.5 }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                Portfolio allocation
              </Typography>
              <Typography variant="caption" onClick={() => navigate('/accounts')}
                sx={{ color: 'primary.main', cursor: 'pointer', fontSize: '0.7rem', '&:hover': { textDecoration: 'underline' } }}>
                View accounts →
              </Typography>
            </Stack>
            <Box sx={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', mb: 1 }}>
              {accountBars.map(b => (
                <Box key={b.label} sx={{ width: `${(b.value / portfolioTotal) * 100}%`, bgcolor: b.color, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
              ))}
            </Box>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {accountBars.map(b => (
                <Stack key={b.label} direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: b.color, flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                    {b.label} <Typography component="span" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.68rem' }}>
                      {Math.round((b.value / portfolioTotal) * 100)}%
                    </Typography>
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}

        {/* Opportunities — fills remaining height */}
        {data.issues?.length > 0 && (
          <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid`, borderColor: 'divider', flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 0.75, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
              Opportunities to improve
            </Typography>
            <Stack spacing={0.75}>
              {data.issues.map((issue: any, i: number) => {
                const dotColor = issue.impact === 'high' ? theme.palette.error.main : issue.impact === 'medium' ? theme.palette.warning.main : theme.palette.text.disabled;
                return (
                  <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0, mt: '5px' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>{issue.label}</Typography>
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

const CATEGORY_META: { key: string; label: string; color: string; linkTo: string }[] = [
  { key: 'basics',   label: 'Basics',   color: '#6C63FF', linkTo: '/household' },
  { key: 'income',   label: 'Income',   color: '#00C49F', linkTo: '/household' },
  { key: 'accounts', label: 'Accounts', color: '#74B9FF', linkTo: '/accounts'  },
  { key: 'planning', label: 'Planning', color: '#FFB347', linkTo: '/scenarios'  },
];

function PlanCompletenessCard({ data, navigate }: { data: any; navigate: (path: string) => void }) {
  const theme = useTheme();
  if (!data) return null;

  const ringColor = data.percentage >= 80 ? theme.palette.success.main : data.percentage >= 50 ? theme.palette.warning.main : theme.palette.error.main;
  const incomplete = data.items.filter((i: any) => !i.completed);
  const complete = data.items.filter((i: any) => i.completed);
  const completedCount = complete.length;

  const categoryStats = CATEGORY_META.map(({ key, label, color, linkTo }) => {
    const items = data.items.filter((i: any) => i.category === key);
    const done = items.filter((i: any) => i.completed).length;
    return { key, label, color, linkTo, done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
  });

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.75, flexShrink: 0 }}>
          <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
            <CircularProgress variant="determinate" value={100} size={64}
              sx={{ color: alpha(ringColor, 0.12), position: 'absolute', top: 0, left: 0 }} />
            <CircularProgress variant="determinate" value={data.percentage} size={64}
              sx={{ color: ringColor, '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }} />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, lineHeight: 1 }}>{data.percentage}%</Typography>
            </Box>
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Plan Quality</Typography>
            <Typography variant="caption" color="text.secondary">
              {completedCount} of {data.items.length} complete
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 1, flexShrink: 0 }} />

        {/* Scrollable item list */}
        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {incomplete.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 2 }}>
              <CheckCircleIcon sx={{ fontSize: 28, color: 'success.main', mb: 0.5 }} />
              <Typography variant="caption" color="success.main" fontWeight={600}>All items complete</Typography>
            </Stack>
          ) : (
            incomplete.map((item: any) => (
              <Stack key={item.id} direction="row" spacing={1} alignItems="flex-start"
                onClick={() => item.linkTo && navigate(item.linkTo)}
                sx={{
                  px: 0.75, py: 0.75, borderRadius: 1,
                  cursor: item.linkTo ? 'pointer' : 'default',
                  '&:hover': item.linkTo ? { bgcolor: 'action.hover' } : {},
                  transition: 'background-color 0.15s',
                }}>
                <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main', flexShrink: 0, mt: '3px' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}>{item.label}</Typography>
                  {item.hint && (
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.disabled', lineHeight: 1.4, display: 'block', mt: 0.3 }}>{item.hint}</Typography>
                  )}
                </Box>
                {item.linkTo && <ArrowForwardIosIcon sx={{ fontSize: 9, color: 'text.disabled', flexShrink: 0, mt: '4px' }} />}
              </Stack>
            ))
          )}

          {/* Completed items — 2-col compact grid */}
          {complete.length > 0 && incomplete.length > 0 && (
            <>
              <Divider sx={{ my: 0.75 }} />
              <Typography variant="caption" sx={{ px: 0.75, pb: 0.5, display: 'block', color: 'text.disabled', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Completed
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {complete.map((item: any) => (
                  <Stack key={item.id} direction="row" spacing={0.75} alignItems="center"
                    onClick={() => item.linkTo && navigate(item.linkTo)}
                    sx={{
                      px: 0.75, py: 0.4, borderRadius: 1,
                      cursor: item.linkTo ? 'pointer' : 'default',
                      '&:hover': item.linkTo ? { bgcolor: 'action.hover' } : {},
                    }}>
                    <CheckCircleIcon sx={{ fontSize: 11, color: 'success.main', flexShrink: 0, opacity: 0.75 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.disabled', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</Typography>
                  </Stack>
                ))}
              </Box>
            </>
          )}
        </Box>

        {/* Category breakdown — pinned to bottom */}
        <Divider sx={{ mt: 1.25, mb: 1.25, flexShrink: 0 }} />
        <Box sx={{ flexShrink: 0 }}>
          <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.disabled', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            By category
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
            {categoryStats.map(({ key, label, color, linkTo, done, total, pct }) => (
              <Box key={key} onClick={() => navigate(linkTo)} sx={{ cursor: 'pointer' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.3 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: pct === 100 ? 'success.main' : 'text.disabled' }}>{done}/{total}</Typography>
                </Stack>
                <Box sx={{ height: 4, borderRadius: 2, bgcolor: alpha(color, 0.15), overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${pct}%`, borderRadius: 2, bgcolor: pct === 100 ? 'success.main' : color, transition: 'width 0.4s ease' }} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

/** Compact scenario card showing key parameters. */
function ScenarioCard({ sc, idx }: { sc: Scenario; idx: number }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const p = parseParams(sc.parameters);

  const retAge   = p.retirementAge   ?? 65;
  const lifeExp  = p.lifeExpectancy  ?? 90;
  const retRate  = p.expectedReturnRate != null ? `${(p.expectedReturnRate * 100).toFixed(1)}%` : null;
  const infRate  = p.inflationRate    != null ? `${(p.inflationRate * 100).toFixed(1)}%` : null;
  const cppAge   = p.cppStartAge      ?? null;
  const oasAge   = p.oasStartAge      ?? null;
  const expenses = p.annualExpenses   ?? null;
  const vol      = p.volatility       != null ? `${(p.volatility * 100).toFixed(0)}%` : null;

  const hue = (idx * 47 + 200) % 360;
  const accentColor = `hsl(${hue},50%,50%)`;

  const fmt$ = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1_000)}K`;

  const statItems: { label: string; value: string }[] = [];
  if (expenses)           statItems.push({ label: 'Expenses/yr', value: fmt$(expenses) });
  if (cppAge != null)     statItems.push({ label: 'CPP start',   value: `Age ${cppAge}` });
  if (oasAge != null)     statItems.push({ label: 'OAS start',   value: `Age ${oasAge}` });
                          statItems.push({ label: 'Horizon',     value: `Age ${lifeExp}` });
  if (vol)                statItems.push({ label: 'Volatility',  value: vol });

  return (
    <Card sx={{ cursor: 'pointer', height: '100%', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 4 } }}
      onClick={() => navigate('/scenarios')}>
      <CardContent sx={{ p: 2, pb: '16px !important' }}>
        {/* Header */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
          <Avatar sx={{ bgcolor: `hsl(${hue},60%,88%)`, color: `hsl(${hue},50%,35%)`, width: 28, height: 28, fontSize: 12, fontWeight: 700 }}>
            {idx + 1}
          </Avatar>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }} noWrap>{sc.name}</Typography>
          <Chip
            label={`Retire ${retAge}`}
            size="small"
            sx={{ fontSize: '0.63rem', height: 18, bgcolor: alpha(accentColor, 0.12), color: accentColor, fontWeight: 600 }}
          />
        </Stack>

        {sc.description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{sc.description}</Typography>
        )}

        {/* Return + Inflation chips */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.25 }}>
          {retRate && <Chip key="ret"  label={`${retRate} return`}    size="small" sx={{ fontSize: '0.63rem', height: 18 }} />}
          {infRate && <Chip key="inf"  label={`${infRate} inflation`} size="small" sx={{ fontSize: '0.63rem', height: 18 }} />}
        </Box>

        {/* Detail stat grid */}
        {statItems.length > 0 && (
          <>
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mb: 1 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '4px 8px' }}>
              {statItems.map(({ label, value }) => (
                <Box key={label}>
                  <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.primary', lineHeight: 1.3 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}
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

function InsightsCard({
  householdId,
  input,
  apiFetch,
  onCountChange,
}: {
  householdId?: string;
  input: InsightInput | null;
  apiFetch: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  onCountChange: (count: number) => void;
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const enabled = !!householdId && !!input;

  const { data: insights, isLoading, isFetching } = useQuery<Insight[]>({
    queryKey: ['automated-insights', householdId, input],
    queryFn: async () => {
      const raw = await apiFetch<Insight[] | { insights?: Insight[] }>('/projections/insights', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray(raw.insights)) return raw.insights;
      return [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!enabled) {
      onCountChange(0);
      return;
    }
    onCountChange(Math.min((insights ?? []).length, 5));
  }, [enabled, insights, onCountChange]);

  const topInsights = (insights ?? []).slice(0, 5);

  const categoryIcon = (category: Insight['category']) => {
    if (category === 'tax') return <MonetizationOnIcon fontSize="small" />;
    if (category === 'investment') return <TrendingUpIcon fontSize="small" />;
    if (category === 'benefits') return <AccountBalanceIcon fontSize="small" />;
    return <HomeIcon fontSize="small" />;
  };

  if (isLoading || (isFetching && !insights)) {
    return (
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Skeleton width={170} height={30} />
            <Skeleton width={58} height={24} />
          </Stack>
          <Stack spacing={1}>
            {[0, 1, 2].map((idx) => (
              <Skeleton key={idx} variant="rounded" height={58} sx={{ borderRadius: 1.5 }} />
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Automated Insights</Typography>
          <Chip
            size="small"
            label={`${topInsights.length}`}
            sx={{ fontWeight: 700, minWidth: 36 }}
          />
        </Stack>

        {topInsights.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No actionable insights found. Your plan looks great!
          </Typography>
        ) : (
          <Stack spacing={1}>
            {topInsights.map((insight) => {
              const priorityColor =
                insight.priority === 'high'
                  ? theme.palette.error.main
                  : insight.priority === 'medium'
                    ? theme.palette.warning.main
                    : theme.palette.grey[500];

              return (
                <Box
                  key={insight.id}
                  onClick={() => navigate(insight.linkTo)}
                  sx={{
                    px: 1.25,
                    py: 1,
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main' }}>
                      {categoryIcon(insight.category)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: priorityColor, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                          {insight.title}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {insight.description}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={`${money(Math.abs(insight.dollarImpact))} potential savings`}
                      sx={{
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        color: 'success.main',
                        border: `1px solid ${alpha(theme.palette.success.main, 0.25)}`,
                        fontWeight: 700,
                        fontSize: '0.7rem',
                      }}
                    />
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { apiFetch } = useApi();
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [reminderDismissed, setReminderDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(ASSUMPTIONS_DISMISS_STORAGE_KEY) === String(currentYear);
  });
  const [insightCount, setInsightCount] = useState(0);

  useEffect(() => {
    window.localStorage.setItem(INSIGHT_COUNT_STORAGE_KEY, insightCount.toString());
    window.dispatchEvent(new CustomEvent<number>('insights-count', { detail: insightCount }));
  }, [insightCount]);

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

  const { data: expenseItems } = useQuery<{ annualAmount: number }[]>({
    queryKey: ['expenses', hh?.id],
    queryFn: () => apiFetch(`/expenses/household/${hh!.id}`),
    enabled: !!hh?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: readinessData, isLoading: readinessLoading } = useQuery<any>({
    queryKey: ['readiness-score', hh?.id],
    queryFn: () => apiFetch('/projections/readiness-score', { method: 'POST', body: JSON.stringify(projPayload) }),
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

  const projectedIncomeAtRetirement = useMemo(() => {
    if (!projData?.length) return 0;
    const row = projData.find((y: any) => y.age === retirementAge);
    return Math.max(0, Number(row?.grossIncome ?? 0));
  }, [projData, retirementAge]);

  const spouseIncome = useMemo(() => {
    if (!hh || hh.members.length < 2) return undefined;
    return hh.members
      .slice(1)
      .flatMap(m => m.incomeSources ?? [])
      .reduce((sum, source) => sum + source.annualAmount, 0);
  }, [hh]);

  const insightsInput = useMemo<InsightInput | null>(() => {
    if (!hh || !primaryMember) return null;
    const hasSpouse = (hh.members?.length ?? 0) > 1;
    const rrifConversionAge = Number(firstScenarioParams.rrifStartAge ?? 71);

    return {
      currentAge,
      retirementAge,
      annualIncome: totalIncome,
      province: primaryMember.province ?? 'ON',
      rrspBalance: rrspTotal,
      tfsaBalance: tfsaTotal,
      nonRegBalance: nonRegTotal,
      unusedTfsaRoom: 0,
      unusedRrspRoom: 0,
      cppStartAge,
      oasStartAge,
      oasClawbackYears: [],
      projectedIncomeAtRetirement,
      hasSpouse,
      spouseIncome: hasSpouse ? (spouseIncome ?? 0) : undefined,
      rrifConversionAge: Number.isFinite(rrifConversionAge) ? rrifConversionAge : 71,
    };
  }, [
    hh,
    primaryMember,
    currentAge,
    retirementAge,
    totalIncome,
    rrspTotal,
    tfsaTotal,
    nonRegTotal,
    cppStartAge,
    oasStartAge,
    projectedIncomeAtRetirement,
    spouseIncome,
    firstScenarioParams,
  ]);

  const planCompleteness = useMemo(() => {
    if (!hh) return null;
    // Prefer fetched expense items (includes YNAB-synced categories); fall back to household-level annualExpenses
    const resolvedExpenses = expenseItems && expenseItems.length > 0
      ? expenseItems.map(e => ({ annualAmount: e.annualAmount }))
      : hh.annualExpenses != null && hh.annualExpenses > 0 ? [{ annualAmount: hh.annualExpenses }] : [];
    return calculatePlanCompleteness({
      members: (hh.members ?? []).map(m => ({
        dateOfBirth: m.dateOfBirth,
        province: m.province,
        cppExpectedBenefit: m.cppExpectedBenefit,
        rrspContributionRoom: m.rrspContributionRoom,
        tfsaContributionRoom: m.tfsaContributionRoom,
        priorYearIncome: m.priorYearIncome,
        incomeSources: (m.incomeSources ?? []).map(s => ({ type: s.type, startAge: s.startAge, annualAmount: s.annualAmount })),
      })),
      accounts: accounts.map(a => ({ type: a.type, balance: a.balance })),
      scenarios: scenarios.map(s => ({ parameters: s.parameters })),
      expenses: resolvedExpenses,
    });
  }, [hh, accounts, scenarios, expenseItems]);

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

      {!reminderDismissed && (
        <Alert
          severity="info"
          sx={{ mb: 2.5, borderRadius: 2 }}
          action={(
            <Stack direction="row" spacing={1}>
              <Button color="inherit" size="small" onClick={() => setAssumptionsOpen(true)}>
                Review Now
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  window.localStorage.setItem(ASSUMPTIONS_DISMISS_STORAGE_KEY, String(currentYear));
                  setReminderDismissed(true);
                }}
              >
                Dismiss
              </Button>
            </Stack>
          )}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Time to review your plan assumptions for {currentYear}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Tax limits and market assumptions may have changed since your last review.
          </Typography>
        </Alert>
      )}

      {/* KPI cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <KpiCard
            title="Total Portfolio" icon={<SavingsIcon />} color={theme.palette.primary.main} loading={hhLoading}
            value={money(totalPortfolio)}
            subValue={accounts.length ? `${accounts.length} account${accounts.length !== 1 ? 's' : ''}` : 'No accounts yet'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <KpiCard
            title="Annual Income" icon={<TrendingUpIcon />} color="#00C49F" loading={hhLoading}
            value={money(totalIncome)}
            subValue={totalIncome > 0 ? `${money(Math.round(totalIncome / 12))}/mo` : 'Add income sources'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <KpiCard
            title="Years to Retirement"
            icon={<HourglassTopIcon />}
            color={yearsToRetire <= 5 ? theme.palette.warning.main : '#FFB347'}
            loading={hhLoading}
            value={yearsToRetire > 0 ? `${yearsToRetire} yrs` : 'Retired'}
            subValue={yearsToRetire > 0 ? `Age ${retirementAge} · ${retirementYear}` : `Age ${currentAge}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
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
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <IncomeReplacementCard projData={projData} retirementAge={retirementAge} loading={hhLoading || projLoading} />
        </Grid>
      </Grid>

      {/* Readiness Score + Plan Completeness */}
      {(readinessData || readinessLoading || planCompleteness) && (
        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <ReadinessScoreCard
              data={readinessData} loading={readinessLoading}
              projData={projData} depletionAge={depletionAge} nwAtRetirement={nwAtRetirement}
              lifeExpectancy={lifeExpectancy} rrspTotal={rrspTotal} tfsaTotal={tfsaTotal}
              nonRegTotal={nonRegTotal} cashTotal={cashTotal}
            />
          </Grid>
          {planCompleteness && (
            <Grid size={{ xs: 12, md: 4 }}>
              <PlanCompletenessCard data={planCompleteness} navigate={navigate} />
            </Grid>
          )}
        </Grid>
      )}

      {/* Automated Insights */}
      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12 }}>
          <InsightsCard
            householdId={hh?.id}
            input={insightsInput}
            apiFetch={apiFetch}
            onCountChange={setInsightCount}
          />
        </Grid>
      </Grid>

      {/* Portfolio allocation + milestones */}
      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, md: 7 }}>
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

        <Grid size={{ xs: 12, md: 5 }}>
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
                <NetWorthSparkline
                  data={sparkData}
                  currentAge={currentAge}
                  milestones={[
                    { age: retirementAge, label: 'Retire', color: theme.palette.primary.main },
                    { age: cppStartAge, label: 'CPP', color: '#6C63FF' },
                    { age: oasStartAge, label: 'OAS', color: '#00C49F' },
                    { age: 71, label: 'RRIF', color: '#FF6B6B' },
                  ]}
                />
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
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={sc.id}>
                <ScenarioCard sc={sc} idx={i} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Quick navigation tiles */}
      {hh && (
        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <DecisionReviewCard householdId={hh?.id} />
          </Grid>
        </Grid>
      )}

      {/* Quick navigation tiles */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Quick Navigation</Typography>
          <Grid container spacing={1.5}>
            {navTiles.map(tile => (
              <Grid size={{ xs: 6, sm: 3 }} key={tile.path}>
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

      <AssumptionsAuditDialog open={assumptionsOpen} onClose={() => setAssumptionsOpen(false)} />
    </Box>
  );
}
