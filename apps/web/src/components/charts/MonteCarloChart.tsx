import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';
import type { ChartMilestone } from './CashFlowChart';

export interface MonteCarloPercentiles {
  age: number;
  year?: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

interface Props {
  data: MonteCarloPercentiles[];
  successRate?: number;
  height?: number;
  milestones?: ChartMilestone[];
}

export function MonteCarloChart({ data, successRate, height = 340, milestones = [] }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;

    const width = containerRef.current.clientWidth;
    const margin = { top: 30, right: 30, bottom: 50, left: 70 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const ages = data.map((d) => d.age);
    const allVals = data.flatMap((d) => [d.p5, d.p25, d.p50, d.p75, d.p95]);

    const x = d3.scaleLinear().domain(d3.extent(ages) as [number, number]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, (d3.max(allVals) ?? 1) * 1.05]).range([innerH, 0]).nice();

    const primary = '#6C63FF';

    // p5–p95 band (lightest)
    const area95 = d3.area<MonteCarloPercentiles>()
      .x((d) => x(d.age)).y0((d) => y(d.p5)).y1((d) => y(d.p95)).curve(d3.curveMonotoneX);
    g.append('path').datum(data).attr('fill', primary).attr('fill-opacity', 0.12).attr('d', area95);

    // p25–p75 band
    const area75 = d3.area<MonteCarloPercentiles>()
      .x((d) => x(d.age)).y0((d) => y(d.p25)).y1((d) => y(d.p75)).curve(d3.curveMonotoneX);
    g.append('path').datum(data).attr('fill', primary).attr('fill-opacity', 0.22).attr('d', area75);

    // Median line (p50)
    const medianLine = d3.line<MonteCarloPercentiles>()
      .x((d) => x(d.age)).y((d) => y(d.p50)).curve(d3.curveMonotoneX);
    g.append('path').datum(data).attr('fill', 'none').attr('stroke', primary)
      .attr('stroke-width', 2.5).attr('d', medianLine);

    // Zero line reference
    g.append('line')
      .attr('x1', 0).attr('x2', innerW).attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', theme.palette.error.main).attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,3').attr('opacity', 0.7);

    // Axes
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat((d) => `${d}`))
      .selectAll('text').attr('fill', theme.palette.text.secondary);

    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat((d) => `$${d3.format('.2s')(d as number)}`))
      .selectAll('text').attr('fill', theme.palette.text.secondary);

    // Grid
    g.append('g').call(d3.axisLeft(y).ticks(6).tickSize(-innerW).tickFormat(() => ''))
      .selectAll('line').attr('stroke', theme.palette.divider).attr('stroke-opacity', 0.4);
    g.select('.domain').remove();

    // ── Milestone markers ─────────────────────────────────────────────────────
    const byAge = new Map<number, ChartMilestone[]>();
    milestones.forEach((m) => {
      if (!byAge.has(m.age)) byAge.set(m.age, []);
      byAge.get(m.age)!.push(m);
    });
    byAge.forEach((ms, age) => {
      const cx = x(age);
      if (cx < 0 || cx > innerW) return;
      const primary = ms.find((m) => m.type === 'event') ?? ms[0];
      const isDashed = primary.type !== 'event';
      g.append('line')
        .attr('x1', cx).attr('x2', cx).attr('y1', 0).attr('y2', innerH)
        .attr('stroke', primary.color).attr('stroke-width', isDashed ? 1 : 1.5)
        .attr('stroke-dasharray', isDashed ? '3,4' : '4,3').attr('opacity', 0.7);
      ms.forEach((m, li) => {
        g.append('text')
          .attr('x', cx).attr('y', -6 - li * 11)
          .attr('text-anchor', 'middle')
          .attr('fill', m.color).attr('font-size', 9)
          .attr('font-weight', m.type === 'event' ? '600' : '400')
          .attr('opacity', 0.85)
          .text(m.label);
      });
    });

    // X-axis label
    g.append('text').attr('x', innerW / 2).attr('y', innerH + 40)
      .attr('text-anchor', 'middle').attr('fill', theme.palette.text.secondary)
      .attr('font-size', 12).text('Age');

    // Success rate annotation
    if (successRate !== undefined) {
      svg.append('text')
        .attr('x', margin.left + innerW)
        .attr('y', margin.top - 8)
        .attr('text-anchor', 'end')
        .attr('fill', successRate >= 90 ? theme.palette.success.main : successRate >= 75 ? theme.palette.warning.main : theme.palette.error.main)
        .attr('font-size', 13)
        .attr('font-weight', 700)
        .text(`${successRate.toFixed(1)}% success rate`);
    }

    // Legend
    const legendData = [
      { label: 'p5–p95 range', color: primary, opacity: 0.12, type: 'rect' },
      { label: 'p25–p75 range', color: primary, opacity: 0.3, type: 'rect' },
      { label: 'Median (p50)', color: primary, opacity: 1, type: 'line' },
    ];
    const legend = svg.append('g').attr('transform', `translate(${margin.left}, ${height - 8})`);
    legendData.forEach((item, i) => {
      const lx = i * 130;
      if (item.type === 'rect') {
        legend.append('rect').attr('x', lx).attr('y', -12).attr('width', 12).attr('height', 12)
          .attr('fill', item.color).attr('fill-opacity', item.opacity);
      } else {
        legend.append('line').attr('x1', lx).attr('x2', lx + 12).attr('y1', -6).attr('y2', -6)
          .attr('stroke', item.color).attr('stroke-width', 2.5);
      }
      legend.append('text').attr('x', lx + 16).attr('y', -2)
        .attr('fill', theme.palette.text.secondary).attr('font-size', 11).text(item.label);
    });

    // Hover tooltip
    const focus = g.append('g').style('display', 'none');
    focus.append('line').attr('class', 'hover-line').attr('y1', 0).attr('y2', innerH)
      .attr('stroke', theme.palette.text.disabled).attr('stroke-width', 1).attr('stroke-dasharray', '4');

    const tooltip = d3.select(containerRef.current).select<HTMLDivElement>('.mc-tooltip');
    svg.on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event, g.node()!);
      const age = Math.round(x.invert(mx));
      const d = data.reduce((prev, curr) => Math.abs(curr.age - age) < Math.abs(prev.age - age) ? curr : prev);
      focus.style('display', null);
      focus.select('.hover-line').attr('transform', `translate(${x(d.age)},0)`);
      tooltip.style('display', 'block')
        .style('left', `${x(d.age) + margin.left + 10}px`)
        .style('top', `${margin.top}px`)
        .html(`
          <strong>Age ${d.age} (${d.year})</strong><br/>
          95th: $${d.p95.toLocaleString('en-CA', { maximumFractionDigits: 0 })}<br/>
          75th: $${d.p75.toLocaleString('en-CA', { maximumFractionDigits: 0 })}<br/>
          <b>Median: $${d.p50.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</b><br/>
          25th: $${d.p25.toLocaleString('en-CA', { maximumFractionDigits: 0 })}<br/>
          5th: $${d.p5.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
        `);
    }).on('mouseleave', () => { focus.style('display', 'none'); tooltip.style('display', 'none'); });
  }, [data, height, milestones, successRate, theme]);

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} style={{ overflow: 'visible', display: 'block' }} />
      <Box
        className="mc-tooltip"
        sx={{
          display: 'none', position: 'absolute', bgcolor: 'background.paper',
          border: '1px solid', borderColor: 'divider', borderRadius: 1,
          p: 1.5, fontSize: 12, lineHeight: 1.6, pointerEvents: 'none',
          zIndex: 10, maxWidth: 210, boxShadow: 4,
        }}
      />
    </Box>
  );
}
