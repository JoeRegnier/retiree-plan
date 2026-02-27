import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';
import type { ChartMilestone } from './CashFlowChart';
import type { ProjectionYear } from './CashFlowChart';

interface Props {
  data: ProjectionYear[];
  height?: number;
  milestones?: ChartMilestone[];
}

const ALLOC_COLORS = {
  expenses:      '#FF9800',
  tax:           '#F44336',
  rrsp:          '#7B1FA2',
  tfsa:          '#00BCD4',
  surplusNonReg: '#4CAF50',
  surplusCash:   '#81D4FA',  // light blue — savings account, not investments
  unusedRrsp:    '#CE93D8',
  unusedTfsa:    '#80DEEA',
};

export function IncomeAllocationChart({ data, height = 360, milestones = [] }: Props) {
  const svgRef   = useRef<SVGSVGElement>(null);
  const contRef  = useRef<HTMLDivElement>(null);
  const theme    = useTheme();

  useEffect(() => {
    if (!svgRef.current || !contRef.current || data.length === 0) return;

    const width  = contRef.current.clientWidth;
    const margin = { top: 36, right: 30, bottom: 50, left: 72 };
    const innerW = width  - margin.left - margin.right;
    const innerH = height - margin.top  - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();
    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    const g   = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Sample: every 2nd year to keep bars readable
    const step    = Math.max(1, Math.floor(data.length / 40));
    const sampled = data.filter((_, i) => i % step === 0);

    // Per-bar data
    interface Bar {
      age: number;
      year: number;
      expenses:      number;
      tax:           number;
      rrsp:          number;
      tfsa:          number;
      surplusNonReg: number;
      surplusCash:   number;
      unusedRrsp:    number;
      unusedTfsa:    number;
      total:         number;
    }
    const bars: Bar[] = sampled.map((d) => {
      const expenses      = d.expenses   ?? d.totalExpenses ?? 0;
      const tax           = d.totalTax   ?? d.taxPaid       ?? 0;
      const rrsp          = d.rrspContributionYear  ?? 0;
      const tfsa          = d.tfsaContributionYear  ?? 0;
      const surplusNonReg = d.surplusToNonReg ?? 0;
      const surplusCash   = d.surplusToCash   ?? 0;
      const unusedRrsp    = d.unusedRrspRoom  ?? 0;
      const unusedTfsa    = d.unusedTfsaRoom  ?? 0;
      return {
        age: d.age, year: d.year,
        expenses, tax, rrsp, tfsa, surplusNonReg, surplusCash, unusedRrsp, unusedTfsa,
        total: expenses + tax + rrsp + tfsa + surplusNonReg + surplusCash + unusedRrsp + unusedTfsa,
      };
    });

    const ages   = bars.map((b) => b.age);
    const maxVal = d3.max(bars, (b) => b.total) ?? 1;

    const x = d3.scaleLinear()
      .domain([ages[0], ages[ages.length - 1]])
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.05])
      .range([innerH, 0])
      .nice();

    const barW = Math.max(2, (innerW / bars.length) * 0.72);

    // ── Retirement shading ────────────────────────────────────────────────────
    const retireYear = data.find((d) => (d.rrspContributionYear ?? 0) === 0 && d.age > (data[0]?.age ?? 0));
    if (retireYear) {
      g.append('rect')
        .attr('x', x(retireYear.age)).attr('y', 0)
        .attr('width', innerW - x(retireYear.age)).attr('height', innerH)
        .attr('fill', theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)');
      g.append('text')
        .attr('x', x(retireYear.age) + 4).attr('y', 12)
        .attr('fill', theme.palette.text.disabled).attr('font-size', 9)
        .text('Retirement →');
    }

    // ── Grid ─────────────────────────────────────────────────────────────────
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', theme.palette.divider).attr('stroke-opacity', 0.4);
    g.select('.domain').remove();

    // ── Stacked bars ─────────────────────────────────────────────────────────
    const layers: { key: keyof Bar; color: string }[] = [
      { key: 'expenses',      color: ALLOC_COLORS.expenses      },
      { key: 'tax',           color: ALLOC_COLORS.tax           },
      { key: 'rrsp',          color: ALLOC_COLORS.rrsp          },
      { key: 'tfsa',          color: ALLOC_COLORS.tfsa          },
      { key: 'surplusNonReg', color: ALLOC_COLORS.surplusNonReg },
      { key: 'surplusCash',   color: ALLOC_COLORS.surplusCash   },
      { key: 'unusedRrsp',    color: ALLOC_COLORS.unusedRrsp    },
      { key: 'unusedTfsa',    color: ALLOC_COLORS.unusedTfsa    },
    ];

    bars.forEach((b) => {
      let base = 0;
      const bx = x(b.age) - barW / 2;
      layers.forEach(({ key, color }) => {
        const val = b[key] as number;
        if (val <= 0) return;
        const isUnused = key === 'unusedRrsp' || key === 'unusedTfsa';
        g.append('rect')
          .attr('x', bx).attr('y', y(base + val))
          .attr('width', barW).attr('height', Math.max(1, y(base) - y(base + val)))
          .attr('fill', color)
          .attr('fill-opacity', isUnused ? 0.35 : 0.82)
          .attr('stroke', isUnused ? color : 'none')
          .attr('stroke-width', isUnused ? 0.5 : 0)
          .attr('stroke-dasharray', isUnused ? '2,2' : '');
        base += val;
      });
    });

    // ── Milestone markers ────────────────────────────────────────────────────
    const byAge = new Map<number, ChartMilestone[]>();
    milestones.forEach((m) => {
      if (!byAge.has(m.age)) byAge.set(m.age, []);
      byAge.get(m.age)!.push(m);
    });
    byAge.forEach((ms, age) => {
      const cx = x(age);
      if (cx < 0 || cx > innerW) return;
      const primary = ms.find((m) => m.type === 'event') ?? ms[0];
      g.append('line')
        .attr('x1', cx).attr('x2', cx).attr('y1', 0).attr('y2', innerH)
        .attr('stroke', primary.color).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', primary.type === 'event' ? '4,3' : '2,4')
        .attr('opacity', 0.75);
      ms.forEach((m, li) => {
        g.append('text')
          .attr('x', cx).attr('y', -6 - li * 10)
          .attr('text-anchor', 'middle')
          .attr('fill', m.color).attr('font-size', 9)
          .attr('font-weight', m.type === 'event' ? '600' : '400')
          .attr('opacity', 0.9)
          .text(m.label);
      });
    });

    // ── Axes ─────────────────────────────────────────────────────────────────
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat((d) => `${d}`))
      .selectAll('text').attr('fill', theme.palette.text.secondary);

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `$${d3.format('.2s')(d as number)}`))
      .selectAll('text').attr('fill', theme.palette.text.secondary);

    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.palette.text.secondary).attr('font-size', 12)
      .text('Age');

    // ── Legend ────────────────────────────────────────────────────────────────
    const legendItems = [
      { label: 'Expenses',           color: ALLOC_COLORS.expenses,      dashed: false },
      { label: 'Tax',                color: ALLOC_COLORS.tax,           dashed: false },
      { label: 'RRSP',               color: ALLOC_COLORS.rrsp,          dashed: false },
      { label: 'TFSA',               color: ALLOC_COLORS.tfsa,          dashed: false },
      { label: 'Surplus → NonReg',   color: ALLOC_COLORS.surplusNonReg, dashed: false },
      { label: 'Surplus → Savings',  color: ALLOC_COLORS.surplusCash,   dashed: false },
      { label: 'Unused RRSP ◌',      color: ALLOC_COLORS.unusedRrsp,    dashed: true  },
      { label: 'Unused TFSA ◌',      color: ALLOC_COLORS.unusedTfsa,    dashed: true  },
    ];
    const leg = svg.append('g').attr('transform', `translate(${margin.left}, ${height - 8})`);
    const itemW = Math.floor(innerW / legendItems.length);
    legendItems.forEach(({ label, color, dashed }, i) => {
      const lx = i * itemW;
      leg.append('rect')
        .attr('x', lx).attr('y', -12).attr('width', 10).attr('height', 10)
        .attr('fill', color).attr('fill-opacity', dashed ? 0.35 : 0.82)
        .attr('stroke', dashed ? color : 'none').attr('stroke-width', dashed ? 0.5 : 0)
        .attr('stroke-dasharray', dashed ? '2,2' : '');
      leg.append('text')
        .attr('x', lx + 13).attr('y', -3)
        .attr('fill', theme.palette.text.secondary).attr('font-size', 10)
        .text(label);
    });

    // ── Hover tooltip ────────────────────────────────────────────────────────
    const tooltip = d3.select(contRef.current).select<HTMLDivElement>('.ia-tooltip');
    const focus   = g.append('line')
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', theme.palette.text.disabled).attr('stroke-width', 1)
      .attr('stroke-dasharray', '4').style('display', 'none');

    svg.on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event, g.node()!);
      const age  = Math.round(x.invert(mx));
      const b    = bars.reduce((prev, curr) =>
        Math.abs(curr.age - age) < Math.abs(prev.age - age) ? curr : prev,
      );
      if (!b) return;
      const cx = x(b.age);
      focus.style('display', null).attr('transform', `translate(${cx},0)`);

      const fmt = (v: number) => `$${v.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;
      const unusedBit = b.unusedRrsp + b.unusedTfsa > 0
        ? `<hr style="margin:4px 0;border-color:rgba(128,128,128,0.3)"/>`
          + (b.unusedRrsp > 0 ? `<span style="color:${ALLOC_COLORS.unusedRrsp}">◌ Unused RRSP room: ${fmt(b.unusedRrsp)}</span><br/>` : '')
          + (b.unusedTfsa > 0 ? `<span style="color:${ALLOC_COLORS.unusedTfsa}">◌ Unused TFSA room: ${fmt(b.unusedTfsa)}</span>` : '')
        : '';

      tooltip.style('display', 'block')
        .style('left', `${cx + margin.left + 10}px`)
        .style('top', `${margin.top}px`)
        .html(`
          <strong>Age ${b.age} (${b.year})</strong><br/>
          <span style="color:${ALLOC_COLORS.expenses}">■</span> Expenses: ${fmt(b.expenses)}<br/>
          <span style="color:${ALLOC_COLORS.tax}">■</span> Tax: ${fmt(b.tax)}<br/>
          <span style="color:${ALLOC_COLORS.rrsp}">■</span> RRSP contrib: ${fmt(b.rrsp)}<br/>
          <span style="color:${ALLOC_COLORS.tfsa}">■</span> TFSA contrib: ${fmt(b.tfsa)}<br/>
          ${b.surplusNonReg > 0 ? `<span style="color:${ALLOC_COLORS.surplusNonReg}">■</span> Surplus → NonReg: ${fmt(b.surplusNonReg)}<br/>` : ''}
          ${b.surplusCash   > 0 ? `<span style="color:${ALLOC_COLORS.surplusCash}">■</span> Surplus → Savings: ${fmt(b.surplusCash)}<br/>` : ''}${unusedBit}
        `);
    }).on('mouseleave', () => {
      focus.style('display', 'none');
      tooltip.style('display', 'none');
    });

  }, [data, height, milestones, theme]);

  return (
    <Box ref={contRef} sx={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} style={{ overflow: 'visible', display: 'block' }} />
      <Box
        className="ia-tooltip"
        sx={{
          display: 'none', position: 'absolute',
          bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
          borderRadius: 1, p: 1.5, fontSize: 12, lineHeight: 1.7,
          pointerEvents: 'none', zIndex: 10, maxWidth: 240, boxShadow: 4,
        }}
      />
    </Box>
  );
}
