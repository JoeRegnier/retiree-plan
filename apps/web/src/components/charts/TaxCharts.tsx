import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';

interface TaxBracketDatum {
  min: number;
  max: number;
  rate: number;
  label: string;
  color?: string;
}

interface Props {
  income: number;
  federalBrackets: TaxBracketDatum[];
  provincialBrackets: TaxBracketDatum[];
  height?: number;
}

export function TaxBracketChart({ income, federalBrackets, provincialBrackets, height = 300 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const margin = { top: 20, right: 20, bottom: 50, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();
    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const allBrackets = [...federalBrackets, ...provincialBrackets];
    const maxRate = d3.max(allBrackets, (b) => b.rate) ?? 0.4;
    const maxIncome = Math.max(income * 1.2, 200_000);

    const x = d3.scaleLinear().domain([0, maxIncome]).range([0, innerW]).nice();
    const y = d3.scaleLinear().domain([0, maxRate * 1.1]).range([innerH, 0]);

    const drawBrackets = (brackets: TaxBracketDatum[], color: string, yOffset = 0) => {
      brackets.forEach((b) => {
        const x1 = x(b.min);
        const x2 = x(Math.min(b.max === Infinity ? maxIncome : b.max, maxIncome));
        g.append('rect')
          .attr('x', x1).attr('y', y(b.rate) + yOffset).attr('width', Math.max(0, x2 - x1))
          .attr('height', innerH - y(b.rate))
          .attr('fill', color).attr('fill-opacity', 0.35).attr('stroke', color).attr('stroke-width', 0.5);
      });
    };

    drawBrackets(federalBrackets, '#6C63FF');
    drawBrackets(provincialBrackets, '#00D9A6');

    // Income marker
    g.append('line')
      .attr('x1', x(income)).attr('x2', x(income)).attr('y1', 0).attr('y2', innerH)
      .attr('stroke', theme.palette.error.main).attr('stroke-width', 2).attr('stroke-dasharray', '6,3');
    g.append('text')
      .attr('x', x(income) + 4).attr('y', 14).attr('fill', theme.palette.error.main)
      .attr('font-size', 11).text(`$${income.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`);

    // Axes
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat((d) => `$${d3.format('.2s')(d as number)}`))
      .selectAll('text').attr('fill', theme.palette.text.secondary);

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${((d as number) * 100).toFixed(0)}%`))
      .selectAll('text').attr('fill', theme.palette.text.secondary);

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${margin.left}, ${height - 8})`);
    [['Federal', '#6C63FF'], ['Provincial', '#00D9A6'], ['Your Income', theme.palette.error.main]].forEach(([label, color], i) => {
      const lx = i * 130;
      if (i < 2) {
        legend.append('rect').attr('x', lx).attr('y', -12).attr('width', 12).attr('height', 12)
          .attr('fill', color).attr('fill-opacity', 0.5);
      } else {
        legend.append('line').attr('x1', lx).attr('x2', lx + 12).attr('y1', -6).attr('y2', -6)
          .attr('stroke', color).attr('stroke-width', 2).attr('stroke-dasharray', '4,2');
      }
      legend.append('text').attr('x', lx + 16).attr('y', -2)
        .attr('fill', theme.palette.text.secondary).attr('font-size', 11).text(label);
    });
  }, [income, federalBrackets, provincialBrackets, height, theme]);

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <svg ref={svgRef} style={{ overflow: 'visible', display: 'block' }} />
    </Box>
  );
}

// ─── Effective vs Marginal Rate Chart ────────────────────────────────────────

interface RatePoint { income: number; effectiveRate: number; marginalRate: number; }

interface RateChartProps {
  data: RatePoint[];
  currentIncome: number;
  height?: number;
}

export function EffectiveMarginalChart({ data, currentIncome, height = 280 }: RateChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;
    const width = containerRef.current.clientWidth;
    const margin = { top: 20, right: 20, bottom: 50, left: 55 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();
    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.income) ?? 300_000]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.marginalRate) ?? 0.6]).range([innerH, 0]).nice();

    const effLine = d3.line<RatePoint>().x((d) => x(d.income)).y((d) => y(d.effectiveRate)).curve(d3.curveMonotoneX);
    const margLine = d3.line<RatePoint>().x((d) => x(d.income)).y((d) => y(d.marginalRate)).curve(d3.curveStepAfter);

    g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#00D9A6').attr('stroke-width', 2).attr('d', effLine);
    g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#6C63FF').attr('stroke-width', 2).attr('stroke-dasharray', '6,2').attr('d', margLine);

    // Current income marker
    g.append('line').attr('x1', x(currentIncome)).attr('x2', x(currentIncome))
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', theme.palette.warning.main).attr('stroke-width', 2).attr('stroke-dasharray', '4,2');

    // Axes
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat((d) => `$${d3.format('.0s')(d as number)}`))
      .selectAll('text').attr('fill', theme.palette.text.secondary);
    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat((d) => `${((d as number) * 100).toFixed(0)}%`))
      .selectAll('text').attr('fill', theme.palette.text.secondary);

    // Grid
    g.append('g').call(d3.axisLeft(y).ticks(6).tickSize(-innerW).tickFormat(() => ''))
      .selectAll('line').attr('stroke', theme.palette.divider).attr('stroke-opacity', 0.4);

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${margin.left}, ${height - 8})`);
    [['Effective Rate', '#00D9A6', ''], ['Marginal Rate', '#6C63FF', '6,2'], ['Your Income', theme.palette.warning.main, '4,2']].forEach(([label, color, dash], i) => {
      const lx = i * 130;
      legend.append('line').attr('x1', lx).attr('x2', lx + 12).attr('y1', -6).attr('y2', -6)
        .attr('stroke', color as string).attr('stroke-width', 2).attr('stroke-dasharray', dash as string);
      legend.append('text').attr('x', lx + 16).attr('y', -2)
        .attr('fill', theme.palette.text.secondary).attr('font-size', 11).text(label as string);
    });
  }, [data, currentIncome, height, theme]);

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <svg ref={svgRef} style={{ overflow: 'visible', display: 'block' }} />
    </Box>
  );
}
