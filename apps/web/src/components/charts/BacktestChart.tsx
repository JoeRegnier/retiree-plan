import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';

export interface BacktestWindowData {
  startYear: number;
  success: boolean;
  balanceByYear: { year: number; age: number; balance: number }[];
}

interface Props {
  windows: BacktestWindowData[];
  successRate: number;
  height?: number;
}

export function BacktestChart({ windows, successRate, height = 380 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || windows.length === 0) return;

    const width = containerRef.current.clientWidth;
    const margin = { top: 36, right: 30, bottom: 52, left: 74 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Determine x domain from retirement ages
    const allAges = windows.flatMap((w) => w.balanceByYear.map((b) => b.age));
    const allBalances = windows.flatMap((w) => w.balanceByYear.map((b) => b.balance));
    const xDomain = d3.extent(allAges) as [number, number];
    const yMax = (d3.max(allBalances) ?? 1) * 1.05;

    const x = d3.scaleLinear().domain(xDomain).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]).nice();

    const successColor = theme.palette.success.main;
    const failColor = theme.palette.error.main;

    // Draw success windows first (background), failures on top
    const sortedWindows = [...windows].sort((a, b) => (a.success ? -1 : 1) - (b.success ? -1 : 1));

    const line = d3
      .line<{ age: number; balance: number }>()
      .x((d) => x(d.age))
      .y((d) => y(d.balance))
      .curve(d3.curveMonotoneX);

    sortedWindows.forEach((w) => {
      if (w.balanceByYear.length < 2) return;
      g.append('path')
        .datum(w.balanceByYear)
        .attr('fill', 'none')
        .attr('stroke', w.success ? successColor : failColor)
        .attr('stroke-width', w.success ? 0.8 : 1.2)
        .attr('stroke-opacity', w.success ? 0.25 : 0.55)
        .attr('d', line);
    });

    // Compute median line (p50 across all windows by age-relative index)
    if (windows.length > 0 && windows[0].balanceByYear.length > 0) {
      const numYears = windows[0].balanceByYear.length;
      const medianPath = Array.from({ length: numYears }, (_, i) => {
        const balances = windows
          .filter((w) => w.balanceByYear.length > i)
          .map((w) => w.balanceByYear[i].balance)
          .sort((a, b) => a - b);
        const mid = Math.floor(balances.length / 2);
        return { age: windows[0].balanceByYear[i].age, balance: balances[mid] ?? 0 };
      });
      g.append('path')
        .datum(medianPath)
        .attr('fill', 'none')
        .attr('stroke', theme.palette.primary.main)
        .attr('stroke-width', 2.5)
        .attr('d', line);
    }

    // Zero reference line
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', failColor).attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,3').attr('opacity', 0.7);

    // Grid lines
    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickSize(-innerW).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', theme.palette.divider)
      .attr('stroke-opacity', 0.4);
    g.selectAll('.domain').remove();

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat((d) => `${d}`))
      .selectAll('text')
      .attr('fill', theme.palette.text.secondary);

    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat((d) => `$${d3.format('.2s')(d as number)}`))
      .selectAll('text')
      .attr('fill', theme.palette.text.secondary);

    // Axis labels
    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 42)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.palette.text.secondary)
      .attr('font-size', 12)
      .text('Age in retirement');

    // Success rate annotation
    const rateColor =
      successRate >= 90
        ? theme.palette.success.main
        : successRate >= 75
          ? theme.palette.warning.main
          : theme.palette.error.main;

    svg.append('text')
      .attr('x', margin.left + innerW)
      .attr('y', margin.top - 10)
      .attr('text-anchor', 'end')
      .attr('fill', rateColor)
      .attr('font-size', 13)
      .attr('font-weight', 700)
      .text(`${successRate.toFixed(1)}% historical success rate`);

    // Legend
    const legendItems = [
      { label: 'Successful window', color: successColor },
      { label: 'Failed window', color: failColor },
      { label: 'Median path', color: theme.palette.primary.main },
    ];
    const legend = svg.append('g').attr('transform', `translate(${margin.left}, ${height - 6})`);
    legendItems.forEach((item, i) => {
      const lx = i * 148;
      legend.append('line')
        .attr('x1', lx).attr('x2', lx + 14)
        .attr('y1', -6).attr('y2', -6)
        .attr('stroke', item.color)
        .attr('stroke-width', i === 2 ? 2.5 : 1.5);
      legend.append('text')
        .attr('x', lx + 18).attr('y', -2)
        .attr('fill', theme.palette.text.secondary)
        .attr('font-size', 11)
        .text(item.label);
    });
  }, [windows, successRate, height, theme]);

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
    </Box>
  );
}
