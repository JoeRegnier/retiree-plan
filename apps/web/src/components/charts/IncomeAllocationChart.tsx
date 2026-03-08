import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';
import type { ChartMilestone } from './CashFlowChart';
import type { ProjectionYear } from './CashFlowChart';

interface Props {
  data: ProjectionYear[];
  height?: number;
  milestones?: ChartMilestone[];
  /** Extra top padding (px) reserved for milestone labels. Auto-calculated when omitted. */
  milestoneHeadroom?: number;
}

const ALLOC_COLORS = {
  expenses:      '#FF9800',
  tax:           '#F44336',
  rrsp:          '#7B1FA2',
  tfsa:          '#00BCD4',
  surplusNonReg: '#4CAF50',
  surplusCash:   '#81D4FA',
  unusedRrsp:    '#CE93D8',
  unusedTfsa:    '#80DEEA',
};

const LEGEND_ITEMS = [
  { label: 'Expenses',          color: ALLOC_COLORS.expenses,      dashed: false },
  { label: 'Tax',               color: ALLOC_COLORS.tax,           dashed: false },
  { label: 'RRSP contrib',      color: ALLOC_COLORS.rrsp,          dashed: false },
  { label: 'TFSA contrib',      color: ALLOC_COLORS.tfsa,          dashed: false },
  { label: 'Surplus → NonReg',  color: ALLOC_COLORS.surplusNonReg, dashed: false },
  { label: 'Surplus → Cash',    color: ALLOC_COLORS.surplusCash,   dashed: false },
  { label: 'Unused RRSP room',  color: ALLOC_COLORS.unusedRrsp,    dashed: true  },
  { label: 'Unused TFSA room',  color: ALLOC_COLORS.unusedTfsa,    dashed: true  },
];

export function IncomeAllocationChart({ data, height = 420, milestones = [], milestoneHeadroom }: Props) {
  const svgRef   = useRef<SVGSVGElement>(null);
  const contRef  = useRef<HTMLDivElement>(null);
  const theme    = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  // Track container width so the chart redraws on window / panel resize
  useEffect(() => {
    if (!contRef.current) return;
    const el = contRef.current;
    const sync = () => setContainerWidth(el.clientWidth || 0);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !contRef.current || data.length === 0 || containerWidth <= 0) return;

    const width  = containerWidth;
    // Top headroom: enough for 3 staggered rows of -40° milestone labels, or a small
    // fixed gap when there are none.  Caller can override via milestoneHeadroom prop.
    const topMargin = milestoneHeadroom ?? (milestones.length > 0 ? 100 : 20);
    const margin = { top: topMargin, right: 24, bottom: 48, left: 68 };
    const innerW = width  - margin.left - margin.right;
    const innerH = height - margin.top  - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();
    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    const g   = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Sample to keep bars readable at any width
    const step    = Math.max(1, Math.floor(data.length / 45));
    const sampled = data.filter((_, i) => i % step === 0);

    interface Bar {
      age: number; year: number;
      expenses: number; tax: number; rrsp: number; tfsa: number;
      surplusNonReg: number; surplusCash: number;
      unusedRrsp: number; unusedTfsa: number; total: number;
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

    // Pad the domain by half an age-slot on each side so the first and last bars
    // are fully centred inside the plot area and don't bleed into the axis margins.
    const ageStep = bars.length > 1 ? (ages[ages.length - 1] - ages[0]) / (bars.length - 1) : 1;
    const xPad    = ageStep / 2;
    const x = d3.scaleLinear()
      .domain([ages[0] - xPad, ages[ages.length - 1] + xPad])
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.08])
      .range([innerH, 0])
      .nice();

    const barW = Math.max(2, (innerW / bars.length) * 0.74);

    // Clip-path so bars (and retirement shading) never paint outside the plot area.
    svg.append('defs').append('clipPath').attr('id', 'ia-bars-clip')
      .append('rect').attr('width', innerW).attr('height', innerH);
    const barG = g.append('g').attr('clip-path', 'url(#ia-bars-clip)');

    // ── Retirement shading ────────────────────────────────────────────────────
    const retireYear = data.find((d) => (d.rrspContributionYear ?? 0) === 0 && d.age > (data[0]?.age ?? 0));
    if (retireYear) {
      const rx = x(retireYear.age);
      barG.append('rect')
        .attr('x', rx).attr('y', 0)
        .attr('width', innerW - rx).attr('height', innerH)
        .attr('fill', theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)');
      // Label floats at the top of the shaded zone, above the bars
      g.append('text')
        .attr('x', rx + 8).attr('y', 13)
        .attr('fill', theme.palette.text.disabled).attr('font-size', 10).attr('font-style', 'italic')
        .text('Retirement →');
    }

    // ── Grid lines ───────────────────────────────────────────────────────────
    const yTicks = y.ticks(6);
    g.selectAll('.grid-line').data(yTicks).enter().append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d))
      .attr('stroke', theme.palette.divider).attr('stroke-opacity', 0.4).attr('stroke-width', 0.5);

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
        barG.append('rect')
          .attr('x', bx).attr('y', y(base + val))
          .attr('width', barW).attr('height', Math.max(1, y(base) - y(base + val)))
          .attr('fill', color)
          .attr('fill-opacity', isUnused ? 0.32 : 0.88)
          .attr('stroke', isUnused ? color : 'none')
          .attr('stroke-width', isUnused ? 0.6 : 0)
          .attr('stroke-dasharray', isUnused ? '2,2' : '');
        base += val;
      });
    });

    // ── Milestone markers ─────────────────────────────────────────────────────
    // Group by age, draw one label per age group.  Use a 3-row greedy layout:
    // each label is assigned to the first row where it doesn't overlap any
    // previously placed label.  Rows are at y = -7, -23, -39 (from chart top).
    const byAge = new Map<number, ChartMilestone[]>();
    milestones.forEach((m) => {
      if (!byAge.has(m.age)) byAge.set(m.age, []);
      byAge.get(m.age)!.push(m);
    });

    const LABEL_ROWS   = [-7, -23, -39];           // y offsets (px above chart)
    const rowEndX      = LABEL_ROWS.map(() => -Infinity);  // rightmost used x per row
    const GAP_PX       = 8;                        // minimum gap between labels in same row
    const PX_PER_CHAR  = 6.2;                      // approximate px per char at font-size 9.5
    const COS40        = Math.cos(Math.PI * 40 / 180);

    const sortedAges = [...byAge.keys()].sort((a, b) => a - b);

    sortedAges.forEach((age) => {
      const ms  = byAge.get(age)!;
      const cx  = x(age);
      if (cx < 0 || cx > innerW) return;

      const primary = ms.find((m) => m.type !== 'event') ?? ms[0];
      const extras  = ms.filter((m) => m !== primary);

      g.append('line')
        .attr('x1', cx).attr('x2', cx).attr('y1', 0).attr('y2', innerH)
        .attr('stroke', primary.color).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', primary.type === 'event' ? '4,3' : '2,4')
        .attr('opacity', 0.8);

      const MAX_CHARS    = 13;
      const rawLabel     = primary.label.length > MAX_CHARS
        ? primary.label.slice(0, MAX_CHARS - 1) + '…'
        : primary.label;
      const displayLabel = extras.length > 0 ? `${rawLabel} +${extras.length}` : rawLabel;

      // Horizontal footprint of this label after -40° rotation
      const textPx    = displayLabel.length * PX_PER_CHAR;
      const labelEndX = cx + 3 + textPx * COS40;

      // Greedy row assignment: first row where label start clears previous end + gap
      let row = LABEL_ROWS.length - 1; // fallback: highest row
      for (let r = 0; r < LABEL_ROWS.length; r++) {
        if (cx >= rowEndX[r] + GAP_PX) { row = r; break; }
      }
      // If still no clear row, pick whichever row has the most available space
      if (row === LABEL_ROWS.length - 1 && cx < rowEndX[row] + GAP_PX) {
        row = rowEndX.reduce((best, end, i) => end < rowEndX[best] ? i : best, 0);
      }

      rowEndX[row] = labelEndX;

      g.append('text')
        .attr('transform', `translate(${cx + 3}, ${LABEL_ROWS[row]}) rotate(-40)`)
        .attr('text-anchor', 'start')
        .attr('fill', primary.color)
        .attr('font-size', 9.5)
        .attr('font-weight', primary.type === 'event' ? '600' : '500')
        .attr('opacity', 0.92)
        .text(displayLabel);
    });

    // ── Axes ─────────────────────────────────────────────────────────────────
    // X axis — integer ages every 5 years so no fractional labels
    const tickStart  = Math.ceil(ages[0] / 5) * 5;
    const xTickVals  = d3.range(tickStart, ages[ages.length - 1] + 1, 5);
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3.axisBottom(x)
          .tickValues(xTickVals)
          .tickFormat((d) => String(d)),
      );
    xAxis.select('.domain').attr('stroke', theme.palette.divider);
    xAxis.selectAll('text')
      .attr('fill', theme.palette.text.secondary)
      .attr('font-size', 11)
      .attr('dy', '1.1em');
    xAxis.selectAll('.tick line').attr('stroke', theme.palette.divider);

    // Y axis — clean $100k / $200k format, no trailing zeros
    const yAxisFmt = (d: d3.NumberValue) => {
      const n = d as number;
      if (n === 0) return '$0';
      if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
      if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
      return `$${n}`;
    };
    const yAxis = g.append('g').call(d3.axisLeft(y).tickValues(yTicks).tickFormat(yAxisFmt));
    yAxis.select('.domain').remove();
    yAxis.selectAll('.tick line').remove();
    yAxis.selectAll('text').attr('fill', theme.palette.text.secondary).attr('font-size', 11);

    // X-axis label — sits below tick labels inside the bottom margin
    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 42)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.palette.text.disabled).attr('font-size', 11)
      .text('Age');

    // Legend is rendered as HTML below the SVG — no D3 code needed here.

    // ── Hover tooltip ────────────────────────────────────────────────────────
    const TOOLTIP_W = 230;
    const tooltip   = d3.select(contRef.current).select<HTMLDivElement>('.ia-tooltip');
    const focus     = g.append('line')
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', theme.palette.primary.main).attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 3').attr('opacity', 0.5).style('display', 'none');

    svg.on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event, g.node()!);
      const age  = Math.round(x.invert(mx));
      const b    = bars.reduce((prev, curr) =>
        Math.abs(curr.age - age) < Math.abs(prev.age - age) ? curr : prev,
      );
      if (!b) return;

      const cx      = x(b.age);
      focus.style('display', null).attr('transform', `translate(${cx},0)`);

      // Flip tooltip to left side when near right edge
      const absX = cx + margin.left;
      const tipLeft = absX + TOOLTIP_W + 14 < width
        ? absX + 10
        : absX - TOOLTIP_W - 10;

      const fmt = (v: number) => `$${v.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;
      const unusedBit = b.unusedRrsp + b.unusedTfsa > 0
        ? `<div style="margin:5px 0 2px;border-top:1px solid rgba(128,128,128,0.25);padding-top:4px">`
          + (b.unusedRrsp > 0 ? `<span style="color:${ALLOC_COLORS.unusedRrsp}">◌ Unused RRSP room: ${fmt(b.unusedRrsp)}</span><br/>` : '')
          + (b.unusedTfsa > 0 ? `<span style="color:${ALLOC_COLORS.unusedTfsa}">◌ Unused TFSA room: ${fmt(b.unusedTfsa)}</span>` : '')
          + '</div>'
        : '';

      tooltip.style('display', 'block')
        .style('left', `${tipLeft}px`)
        .style('top',  `${margin.top + 4}px`)
        .html(
          `<strong style="font-size:12px">Age ${b.age} · ${b.year}</strong><br/>` +
          `<span style="color:${ALLOC_COLORS.expenses}">■</span> Expenses: ${fmt(b.expenses)}<br/>` +
          `<span style="color:${ALLOC_COLORS.tax}">■</span> Tax: ${fmt(b.tax)}<br/>` +
          (b.rrsp > 0 ? `<span style="color:${ALLOC_COLORS.rrsp}">■</span> RRSP: ${fmt(b.rrsp)}<br/>` : '') +
          (b.tfsa > 0 ? `<span style="color:${ALLOC_COLORS.tfsa}">■</span> TFSA: ${fmt(b.tfsa)}<br/>` : '') +
          (b.surplusNonReg > 0 ? `<span style="color:${ALLOC_COLORS.surplusNonReg}">■</span> Surplus → NonReg: ${fmt(b.surplusNonReg)}<br/>` : '') +
          (b.surplusCash   > 0 ? `<span style="color:${ALLOC_COLORS.surplusCash}">■</span> Surplus → Savings: ${fmt(b.surplusCash)}<br/>` : '') +
          unusedBit
        );
    }).on('mouseleave', () => {
      focus.style('display', 'none');
      tooltip.style('display', 'none');
    });

  }, [data, height, milestones, milestoneHeadroom, theme, containerWidth]);

  return (
    <Box ref={contRef} sx={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} style={{ overflow: 'visible', display: 'block' }} />

      {/* HTML legend — flex-wrap so it never overlaps the chart */}
      <Box sx={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 20px',
        pl: '68px', pr: '24px', pt: '2px', pb: '4px',
      }}>
        {LEGEND_ITEMS.map(({ label, color, dashed }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Box sx={{
              width: 10, height: 10, flexShrink: 0,
              bgcolor: color,
              opacity: dashed ? 0.45 : 0.88,
              border: dashed ? `1.5px dashed ${color}` : 'none',
              borderRadius: '2px',
            }} />
            <Box component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
              {label}
            </Box>
          </Box>
        ))}
      </Box>

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
