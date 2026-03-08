import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box, Typography, useTheme } from '@mui/material';

interface AssetAllocation {
  equityPercent: number;
  fixedIncomePercent: number;
  alternativesPercent: number;
  cashPercent: number;
}

interface AllocationDonutProps {
  allocation: AssetAllocation;
  size?: number;
}

const SEGMENTS = [
  { key: 'equityPercent' as const, label: 'Equity', color: '#2196f3' },
  { key: 'fixedIncomePercent' as const, label: 'Fixed Income', color: '#4caf50' },
  { key: 'alternativesPercent' as const, label: 'Alternatives', color: '#ff9800' },
  { key: 'cashPercent' as const, label: 'Cash', color: '#9e9e9e' },
];

export function AllocationDonut({ allocation, size = 200 }: AllocationDonutProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const radius = size / 2;
    const innerRadius = radius * 0.6;

    const data = SEGMENTS.map((s) => ({
      ...s,
      value: allocation[s.key],
    })).filter((d) => d.value > 0);

    if (data.length === 0) return;

    const pie = d3.pie<(typeof data)[0]>()
      .value((d) => d.value)
      .sort(null)
      .padAngle(0.02);

    const arc = d3.arc<d3.PieArcDatum<(typeof data)[0]>>()
      .innerRadius(innerRadius)
      .outerRadius(radius - 4)
      .cornerRadius(3);

    const g = svg
      .append('g')
      .attr('transform', `translate(${radius}, ${radius})`);

    g.selectAll('path')
      .data(pie(data))
      .join('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color)
      .attr('stroke', theme.palette.background.paper)
      .attr('stroke-width', 2);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('font-size', '0.85rem')
      .attr('fill', theme.palette.text.secondary)
      .text('Allocation');
  }, [allocation, size, theme]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <svg ref={svgRef} width={size} height={size} />
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        {SEGMENTS.map((s) => {
          const value = allocation[s.key];
          if (value <= 0) return null;
          return (
            <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: s.color }} />
              <Typography variant="caption">
                {s.label} {Math.round(value * 100)}%
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
