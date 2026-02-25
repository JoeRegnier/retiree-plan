import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';

interface Props {
  successRate: number; // 0–100
  size?: number;
}

/**
 * Donut-style arc gauge showing the plan's overall success rate.
 * Styled to match the FP Alpha outcome visualization.
 */
export function OutcomeGauge({ successRate, size = 180 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!svgRef.current) return;

    const r = size / 2;
    const innerRadius = r * 0.62;
    const outerRadius = r * 0.88;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', size)
      .attr('height', size);

    const g = svg.append('g').attr('transform', `translate(${r},${r})`);

    const successColor =
      successRate >= 90
        ? theme.palette.success.main
        : successRate >= 75
        ? theme.palette.warning.main
        : theme.palette.error.main;

    // Track background (full circle)
    const bgArc = d3
      .arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(-Math.PI)
      .endAngle(Math.PI);
    g.append('path')
      .attr('d', bgArc as any)
      .attr('fill', theme.palette.action.hover);

    // Success arc
    const successAngle = -Math.PI + (2 * Math.PI * successRate) / 100;
    const successArc = d3
      .arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(-Math.PI)
      .endAngle(successAngle)
      .cornerRadius(4);
    g.append('path')
      .attr('d', successArc as any)
      .attr('fill', successColor);

    // Center text — percentage
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.15em')
      .attr('fill', theme.palette.text.primary)
      .attr('font-size', size * 0.175)
      .attr('font-weight', 700)
      .text(`${successRate.toFixed(1)}%`);

    // Sub-label
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', `${size * 0.175 * 0.07 + 18}px`)
      .attr('fill', theme.palette.text.secondary)
      .attr('font-size', size * 0.072)
      .text('Success Rate');
  }, [successRate, size, theme]);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <svg ref={svgRef} />
    </Box>
  );
}
