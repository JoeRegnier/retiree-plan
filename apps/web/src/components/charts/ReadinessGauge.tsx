import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';

interface Props {
  score: number; // 0-100
  size?: number;
}

export function ReadinessGauge({ score, size = 200 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!svgRef.current) return;

    const clampedScore = Math.max(0, Math.min(100, score));
    const width = size;
    const height = size * 0.68;
    const r = size / 2;
    const innerRadius = r * 0.62;
    const outerRadius = r * 0.88;
    const startAngle = -Math.PI / 2;
    const targetAngle = startAngle + (Math.PI * clampedScore) / 100;
    const scoreColor =
      clampedScore >= 70
        ? theme.palette.success.main
        : clampedScore >= 40
        ? theme.palette.warning.main
        : theme.palette.error.main;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const centerX = width / 2;
    const centerY = outerRadius + size * 0.06;
    const g = svg
      .append('g')
      .attr('transform', `translate(${centerX},${centerY})`);

    const bgArc = d3
      .arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(startAngle)
      .endAngle(Math.PI / 2);

    g.append('path')
      .attr('d', bgArc as any)
      .attr('fill', theme.palette.action.hover);

    const fgArc = d3
      .arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(startAngle)
      .endAngle(startAngle)
      .cornerRadius(4);

    const fgPath = g.append('path').attr('fill', scoreColor);

    fgPath
      .attr('d', fgArc as any)
      .transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .attrTween('d', () => {
        const interpolateAngle = d3.interpolateNumber(startAngle, targetAngle);
        return (t) => {
          fgArc.endAngle(interpolateAngle(t));
          return fgArc(null as any) as string;
        };
      });

    // Score number — centred in the lower arc hole, clear of the arc curve
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'auto')
      .attr('y', -size * 0.10)
      .attr('fill', theme.palette.text.primary)
      .attr('font-size', size * 0.20)
      .attr('font-weight', 700)
      .text(Math.round(clampedScore));

    // /100 label — just below the arc's flat chord
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'hanging')
      .attr('y', size * 0.01)
      .attr('fill', theme.palette.text.secondary)
      .attr('font-size', size * 0.09)
      .text('/ 100');

    return () => {
      d3.select(svgRef.current).selectAll('*').interrupt().remove();
    };
  }, [score, size, theme]);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <svg ref={svgRef} />
    </Box>
  );
}