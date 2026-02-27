import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';

export interface ProjectionYear {
  year: number;
  age: number;
  rrspBalance?: number;
  tfsaBalance?: number;
  nonRegBalance?: number;
  totalNetWorth: number;
  // aliases accepted
  netWorth?: number;
  totalIncome: number;
  totalExpenses?: number;
  expenses?: number;
  netCashFlow: number;
  taxPaid?: number;
  totalTax?: number;
  rrifMinimum?: number;
  oasClawback?: number;
  nonRegTaxDrag?: number;
  appliedReturnRate?: number;
  spendingFactor?: number;
  rrspContributionYear?: number;
  tfsaContributionYear?: number;
  surplusToNonReg?: number;
  /** Surplus directed to the cash/savings bucket (investSurplus=false) */
  surplusToCash?: number;
  /** Cash withdrawn from savings bucket to cover shortfall this year */
  cashWithdrawal?: number;
  /** Balance in the cash/savings bucket */
  cashBalance?: number;
  unusedRrspRoom?: number;
  unusedTfsaRoom?: number;
}

/** A labelled vertical marker drawn on the chart at a specific age. */
export interface ChartMilestone {
  age: number;
  /** Short label displayed above the line (e.g. "Retire", "RRIF", "CPP") */
  label: string;
  /** Hex / CSS colour string */
  color: string;
  /** Visual style — 'event' draws a solid tick; 'glide' draws a thinner dash */
  type?: 'event' | 'glide' | 'spending';
}

interface Props {
  data: ProjectionYear[];
  height?: number;
  milestones?: ChartMilestone[];
}

const COLORS = {
  RRSP: '#6C63FF',
  TFSA: '#00D9A6',
  NON_REG: '#FFB347',
  CASH: '#81D4FA',
  income: '#4CAF50',
  expenses: '#F44336',
  netWorth: '#2196F3',
};

export function CashFlowChart({ data, height = 340, milestones = [] }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const margin = { top: 28, right: 30, bottom: 50, left: 70 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleLinear()
      .domain(d3.extent(data, (d) => d.age) as [number, number])
      .range([0, innerW]);

    const nw = (d: ProjectionYear) => d.totalNetWorth ?? d.netWorth ?? 0;
    const exp = (d: ProjectionYear) => d.expenses ?? d.totalExpenses ?? 0;

    const maxNetWorth = d3.max(data, nw) ?? 0;
    const y = d3.scaleLinear()
      .domain([0, maxNetWorth * 1.05])
      .range([innerH, 0])
      .nice();

    // ── Grid lines ────────────────────────────────────────────────────────────
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y).ticks(6).tickSize(-innerW).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', theme.palette.divider)
      .attr('stroke-opacity', 0.5);
    g.select('.grid .domain').remove();

    // ── Stacked area (RRSP, TFSA, Non-Reg, Cash) ───────────────────────────────
    const stackKeys = ['rrspBalance', 'tfsaBalance', 'nonRegBalance', 'cashBalance'] as const;
    const stackColors = [COLORS.RRSP, COLORS.TFSA, COLORS.NON_REG, COLORS.CASH];
    const stackLabels = ['RRSP/RRIF', 'TFSA', 'Non-Reg', 'Cash/Savings'];

    let prevBaseline = data.map(() => 0);
    stackKeys.forEach((key, idx) => {
      const area = d3.area<ProjectionYear>()
        .x((d) => x(d.age))
        .y0((d, i) => y(prevBaseline[i]))
        .y1((d, i) => y(prevBaseline[i] + (d[key] ?? 0)))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', stackColors[idx])
        .attr('fill-opacity', 0.55)
        .attr('d', area);

      prevBaseline = data.map((d, i) => prevBaseline[i] + (d[key] ?? 0));
    });

    // ── Net worth line ────────────────────────────────────────────────────────
    const netWorthLine = d3.line<ProjectionYear>()
      .x((d) => x(d.age))
      .y((d) => y(nw(d)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', COLORS.netWorth)
      .attr('stroke-width', 2.5)
      .attr('d', netWorthLine);

    // ── Milestone markers ─────────────────────────────────────────────────────
    // De-duplicate: if two milestones land on the same age, stack their labels.
    const byAge = new Map<number, ChartMilestone[]>();
    milestones.forEach((m) => {
      if (!byAge.has(m.age)) byAge.set(m.age, []);
      byAge.get(m.age)!.push(m);
    });

    byAge.forEach((ms, age) => {
      const cx = x(age);
      if (cx < 0 || cx > innerW) return; // out of view

      // Choose the "primary" milestone for line style (event > glide > spending)
      const primary = ms.find((m) => m.type === 'event') ?? ms[0];
      const isGlide = primary.type === 'glide';
      const isSpend = primary.type === 'spending';

      // Vertical reference line
      g.append('line')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', primary.color)
        .attr('stroke-width', isGlide ? 1 : (isSpend ? 1 : 1.5))
        .attr('stroke-dasharray', isGlide ? '3,4' : (isSpend ? '2,5' : '4,3'))
        .attr('opacity', 0.75);

      // Small square tick at top
      g.append('rect')
        .attr('x', cx - 3).attr('y', -6)
        .attr('width', 6).attr('height', 6)
        .attr('fill', primary.color)
        .attr('opacity', 0.9);

      // Label(s) rotated above the tick — stack multiple labels if same age
      ms.forEach((m, labelIdx) => {
        const labelOffset = labelIdx * 52;
        g.append('text')
          .attr('x', cx)
          .attr('y', -8 - labelOffset)
          .attr('text-anchor', 'middle')
          .attr('fill', m.color)
          .attr('font-size', 9)
          .attr('font-weight', m.type === 'event' ? '600' : '400')
          .attr('opacity', 0.9)
          .text(m.label);
      });
    });

    // ── Axes ──────────────────────────────────────────────────────────────────
    const xAxis = d3.axisBottom(x).ticks(10).tickFormat((d) => `${d}`);
    const yAxis = d3.axisLeft(y).ticks(6).tickFormat((d) => `$${d3.format('.2s')(d as number)}`);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', theme.palette.text.secondary);

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', theme.palette.text.secondary);

    // X-axis label
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.palette.text.secondary)
      .attr('font-size', 12)
      .text('Age');

    // ── Legend ────────────────────────────────────────────────────────────────
    const legendData = [
      ...stackLabels.map((label, i) => ({ label, color: stackColors[i], type: 'area' })),
      { label: 'Net Worth', color: COLORS.netWorth, type: 'line' },
    ];
    const legend = svg.append('g').attr('transform', `translate(${margin.left}, ${height - 8})`);
    legendData.forEach((item, i) => {
      const lx = i * 115;
      if (item.type === 'area') {
        legend.append('rect').attr('x', lx).attr('y', -12).attr('width', 12).attr('height', 12)
          .attr('fill', item.color).attr('fill-opacity', 0.7);
      } else {
        legend.append('line').attr('x1', lx).attr('x2', lx + 12).attr('y1', -6).attr('y2', -6)
          .attr('stroke', item.color).attr('stroke-width', 2.5);
      }
      legend.append('text').attr('x', lx + 16).attr('y', -2)
        .attr('fill', theme.palette.text.secondary).attr('font-size', 11).text(item.label);
    });

    // ── Tooltip crosshair ─────────────────────────────────────────────────────
    const focus = g.append('g').style('display', 'none');
    focus.append('line').attr('class', 'x-hover-line').attr('y1', 0).attr('y2', innerH)
      .attr('stroke', theme.palette.text.disabled).attr('stroke-width', 1).attr('stroke-dasharray', '4');

    const tooltip = d3.select(container).select<HTMLDivElement>('.cf-tooltip');

    svg.on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event, g.node()!);
      const age = Math.round(x.invert(mx));
      const d = data.find((p) => p.age === age) ?? data[data.findIndex((p) => p.age >= age) ?? 0];
      if (!d) return;
      focus.style('display', null);
      focus.select('.x-hover-line').attr('transform', `translate(${x(d.age)},0)`);

      // Extra diagnostic rows when new engine fields are present
      const rrifRow = (d.rrifMinimum ?? 0) > 0 ? `<br/>RRIF Min: <b>$${(d.rrifMinimum!).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</b>` : '';
      const clawbackRow = (d.oasClawback ?? 0) > 0 ? `<br/>OAS Clawback: <span style="color:#f44336">–$${(d.oasClawback!).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</span>` : '';
      const dragRow = (d.nonRegTaxDrag ?? 0) > 0 ? `<br/>Non-Reg Drag: <span style="color:#f44336">–$${(d.nonRegTaxDrag!).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</span>` : '';
      const returnRow = d.appliedReturnRate != null ? `<br/>Return: ${(d.appliedReturnRate * 100).toFixed(1)}%` : '';
      const spendRow = d.spendingFactor != null && d.spendingFactor !== 1 ? `<br/>Spend factor: ${(d.spendingFactor * 100).toFixed(0)}%` : '';
      const rrspRoomRow = (d.unusedRrspRoom ?? 0) > 0 ? `<br/><span style="color:#CE93D8">⚠ Unused RRSP room: $${(d.unusedRrspRoom!).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</span>` : '';
      const tfsaRoomRow = (d.unusedTfsaRoom ?? 0) > 0 ? `<br/><span style="color:#80DEEA">⚠ Unused TFSA room: $${(d.unusedTfsaRoom!).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</span>` : '';

      tooltip
        .style('display', 'block')
        .style('left', `${x(d.age) + margin.left + 10}px`)
        .style('top', `${margin.top}px`)
        .html(`
          <strong>Age ${d.age} (${d.year})</strong><br/>
          Net Worth: <b>$${nw(d).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</b><br/>
          RRSP/RRIF: $${(d.rrspBalance ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}<br/>
          TFSA: $${(d.tfsaBalance ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}<br/>
          Non-Reg: $${(d.nonRegBalance ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}<br/>
          ${(d.cashBalance ?? 0) > 0 ? `Cash/Savings: $${(d.cashBalance!).toLocaleString('en-CA', { maximumFractionDigits: 0 })}<br/>` : ''}
          Income: $${d.totalIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}<br/>
          Expenses: $${exp(d).toLocaleString('en-CA', { maximumFractionDigits: 0 })}${rrifRow}${clawbackRow}${dragRow}${returnRow}${spendRow}${rrspRoomRow}${tfsaRoomRow}
        `);
    }).on('mouseleave', () => { focus.style('display', 'none'); tooltip.style('display', 'none'); });
  }, [data, height, milestones, theme]);

  // Resize observer
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (svgRef.current && containerRef.current && data.length > 0) {
        const event = new Event('resize');
        window.dispatchEvent(event);
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [data]);

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} style={{ overflow: 'visible', display: 'block' }} />
      <Box
        className="cf-tooltip"
        sx={{
          display: 'none',
          position: 'absolute',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 1.5,
          fontSize: 12,
          lineHeight: 1.6,
          pointerEvents: 'none',
          zIndex: 10,
          maxWidth: 220,
          boxShadow: 4,
        }}
      />
    </Box>
  );
}


