import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';

interface GlidePathStep {
  age: number;
  returnRate: number;
}

interface GlidePathChartProps {
  steps: GlidePathStep[];
  retirementAge?: number;
  width?: number;
  height?: number;
}

export function GlidePathChart({ steps, retirementAge, width = 400, height = 200 }: GlidePathChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!svgRef.current || steps.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 10, right: 20, bottom: 30, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(steps, (d) => d.age) as [number, number])
      .range([0, w]);

    const y = d3.scaleLinear()
      .domain([0, (d3.max(steps, (d) => d.returnRate) ?? 0) * 1.2])
      .range([h, 0]);

    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat((d) => String(d)))
      .selectAll('text')
      .attr('fill', theme.palette.text.secondary);

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${((d as number) * 100).toFixed(0)}%`))
      .selectAll('text')
      .attr('fill', theme.palette.text.secondary);

    const line = d3.line<GlidePathStep>()
      .x((d) => x(d.age))
      .y((d) => y(d.returnRate))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(steps)
      .attr('fill', 'none')
      .attr('stroke', theme.palette.primary.main)
      .attr('stroke-width', 2.5)
      .attr('d', line);

    if (retirementAge != null) {
      g.append('line')
        .attr('x1', x(retirementAge))
        .attr('x2', x(retirementAge))
        .attr('y1', 0)
        .attr('y2', h)
        .attr('stroke', theme.palette.warning.main)
        .attr('stroke-dasharray', '4 3')
        .attr('stroke-width', 1.5);

      g.append('text')
        .attr('x', x(retirementAge))
        .attr('y', -2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '0.7rem')
        .attr('fill', theme.palette.warning.main)
        .text('Retire');
    }

    g.append('text')
      .attr('x', w / 2)
      .attr('y', h + 28)
      .attr('text-anchor', 'middle')
      .attr('font-size', '0.75rem')
      .attr('fill', theme.palette.text.secondary)
      .text('Age');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -h / 2)
      .attr('y', -38)
      .attr('text-anchor', 'middle')
      .attr('font-size', '0.75rem')
      .attr('fill', theme.palette.text.secondary)
      .text('Expected Return');
  }, [steps, retirementAge, width, height, theme]);

  return (
    <Box sx={{ overflow: 'hidden' }}>
      <svg ref={svgRef} width={width} height={height} />
    </Box>
  );
}
