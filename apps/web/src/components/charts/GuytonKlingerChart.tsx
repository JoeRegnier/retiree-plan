import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';

export interface GKYearData {
  year: number;
  age: number;
  portfolioBalance: number;
  withdrawal: number;
  withdrawalRate: number;
  guardrailAction: 'cut' | 'increase' | 'none';
}

interface Props {
  years: GKYearData[];
  initialWithdrawal: number;
  height?: number;
}

export function GuytonKlingerChart({ years, initialWithdrawal, height = 380 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || years.length === 0) return;

    const width = containerRef.current.clientWidth;
    const margin = { top: 36, right: 70, bottom: 52, left: 74 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const ages = years.map((d) => d.age);
    const balances = years.map((d) => d.portfolioBalance);
    const withdrawals = years.map((d) => d.withdrawal);

    const xDomain = d3.extent(ages) as [number, number];
    const x = d3.scaleLinear().domain(xDomain).range([0, innerW]);

    // Dual y-axes
    const yLeft = d3.scaleLinear().domain([0, (d3.max(balances) ?? 1) * 1.05]).range([innerH, 0]).nice();
    const yRight = d3.scaleLinear()
      .domain([0, (d3.max(withdrawals) ?? 1) * 1.3])
      .range([innerH, 0])
      .nice();

    const primaryColor = theme.palette.primary.main;
    const accentColor = theme.palette.secondary.main;

    // Portfolio balance area
    const area = d3.area<GKYearData>()
      .x((d) => x(d.age))
      .y0(innerH)
      .y1((d) => yLeft(d.portfolioBalance))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(years)
      .attr('fill', primaryColor).attr('fill-opacity', 0.12).attr('d', area);

    // Portfolio balance line
    const balanceLine = d3.line<GKYearData>()
      .x((d) => x(d.age)).y((d) => yLeft(d.portfolioBalance))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(years)
      .attr('fill', 'none').attr('stroke', primaryColor)
      .attr('stroke-width', 2).attr('d', balanceLine);

    // Withdrawal line (right axis)
    const withdrawalLine = d3.line<GKYearData>()
      .x((d) => x(d.age)).y((d) => yRight(d.withdrawal))
      .curve(d3.curveStepAfter);
    g.append('path').datum(years)
      .attr('fill', 'none').attr('stroke', accentColor)
      .attr('stroke-width', 2).attr('stroke-dasharray', '6,3').attr('d', withdrawalLine);

    // Reference line: initial withdrawal
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', yRight(initialWithdrawal)).attr('y2', yRight(initialWithdrawal))
      .attr('stroke', accentColor).attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3').attr('opacity', 0.5);

    // Guardrail markers
    years.forEach((d) => {
      if (d.guardrailAction === 'cut') {
        g.append('circle')
          .attr('cx', x(d.age)).attr('cy', yRight(d.withdrawal))
          .attr('r', 5).attr('fill', theme.palette.error.main).attr('opacity', 0.8);
      } else if (d.guardrailAction === 'increase') {
        g.append('circle')
          .attr('cx', x(d.age)).attr('cy', yRight(d.withdrawal))
          .attr('r', 5).attr('fill', theme.palette.success.main).attr('opacity', 0.8);
      }
    });

    // Grid
    g.append('g')
      .call(d3.axisLeft(yLeft).ticks(6).tickSize(-innerW).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', theme.palette.divider).attr('stroke-opacity', 0.4);
    g.selectAll('.domain').remove();

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat((d) => `${d}`))
      .selectAll('text').attr('fill', theme.palette.text.secondary);

    g.append('g')
      .call(d3.axisLeft(yLeft).ticks(6).tickFormat((d) => `$${d3.format('.2s')(d as number)}`))
      .selectAll('text').attr('fill', theme.palette.text.secondary);

    g.append('g')
      .attr('transform', `translate(${innerW},0)`)
      .call(d3.axisRight(yRight).ticks(6).tickFormat((d) => `$${d3.format('.2s')(d as number)}`))
      .selectAll('text').attr('fill', accentColor);

    // Axis labels
    g.append('text').attr('x', innerW / 2).attr('y', innerH + 42)
      .attr('text-anchor', 'middle').attr('fill', theme.palette.text.secondary)
      .attr('font-size', 12).text('Age');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -56)
      .attr('text-anchor', 'middle').attr('fill', theme.palette.text.secondary)
      .attr('font-size', 11).text('Portfolio Balance');

    g.append('text')
      .attr('transform', 'rotate(90)')
      .attr('x', innerH / 2).attr('y', -innerW - 52)
      .attr('text-anchor', 'middle').attr('fill', accentColor)
      .attr('font-size', 11).text('Annual Withdrawal');

    // Legend
    const legendItems = [
      { label: 'Portfolio balance', color: primaryColor, dash: '' },
      { label: 'Annual withdrawal', color: accentColor, dash: '6,3' },
      { label: 'Cut triggered', color: theme.palette.error.main, dot: true },
      { label: 'Increase triggered', color: theme.palette.success.main, dot: true },
    ];
    const legend = svg.append('g').attr('transform', `translate(${margin.left}, ${height - 6})`);
    legendItems.forEach((item, i) => {
      const lx = i * 140;
      if ((item as any).dot) {
        legend.append('circle').attr('cx', lx + 7).attr('cy', -7).attr('r', 5).attr('fill', item.color);
      } else {
        legend.append('line')
          .attr('x1', lx).attr('x2', lx + 14).attr('y1', -6).attr('y2', -6)
          .attr('stroke', item.color).attr('stroke-width', 2)
          .attr('stroke-dasharray', item.dash ?? '');
      }
      legend.append('text').attr('x', lx + 18).attr('y', -2)
        .attr('fill', theme.palette.text.secondary).attr('font-size', 11).text(item.label);
    });
  }, [years, initialWithdrawal, height, theme]);

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
    </Box>
  );
}
