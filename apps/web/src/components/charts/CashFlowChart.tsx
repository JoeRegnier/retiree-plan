import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';

export interface ProjectionYear {
  year: number;
  age: number;
  rrspBalance?: number;
  tfsaBalance?: number;
  nonRegBalance?: number;
  totalNetWorth: number;
  // aliases accepted
  netWorth?: number;
  totalIncome: number;
  totalExpenses?: number;
  expenses?: number;
  netCashFlow: number;
  taxPaid?: number;
  totalTax?: number;
}

interface Props {
  data: ProjectionYear[];
  height?: number;
}

const COLORS = {
  RRSP: '#6C63FF',
  TFSA: '#00D9A6',
  NON_REG: '#FFB347',
  income: '#4CAF50',
  expenses: '#F44336',
  netWorth: '#2196F3',
};

export function CashFlowChart({ data, height = 340 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const margin = { top: 20, right: 30, bottom: 50, left: 70 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleLinear()
      .domain(d3.extent(data, (d) => d.age) as [number, number])
      .range([0, innerW]);

    const nw = (d: ProjectionYear) => d.totalNetWorth ?? d.netWorth ?? 0;
    const exp = (d: ProjectionYear) => d.expenses ?? d.totalExpenses ?? 0;

    const maxNetWorth = d3.max(data, nw) ?? 0;
    const y = d3.scaleLinear()
      .domain([0, maxNetWorth * 1.05])
      .range([innerH, 0])
      .nice();

    // Stacked area data
    const stackKeys = ['rrspBalance', 'tfsaBalance', 'nonRegBalance'] as const;
    const stackColors = [COLORS.RRSP, COLORS.TFSA, COLORS.NON_REG];
    const stackLabels = ['RRSP/RRIF', 'TFSA', 'Non-Reg'];

    // Draw stacked areas
    let prevBaseline = data.map(() => 0);
    stackKeys.forEach((key, idx) => {
      const area = d3.area<ProjectionYear>()
        .x((d) => x(d.age))
        .y0((d, i) => y(prevBaseline[i]))
        .y1((d, i) => y(prevBaseline[i] + (d[key] ?? 0)))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', stackColors[idx])
        .attr('fill-opacity', 0.55)
        .attr('d', area);

      prevBaseline = data.map((d, i) => prevBaseline[i] + (d[key] ?? 0));
    });

    // Net worth line
    const netWorthLine = d3.line<ProjectionYear>()
      .x((d) => x(d.age))
      .y((d) => y(nw(d)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', COLORS.netWorth)
      .attr('stroke-width', 2.5)
      .attr('d', netWorthLine);

    // Axes
    const xAxis = d3.axisBottom(x).ticks(10).tickFormat((d) => `${d}`);
    const yAxis = d3.axisLeft(y).ticks(6).tickFormat((d) => `$${d3.format('.2s')(d as number)}`);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', theme.palette.text.secondary);

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', theme.palette.text.secondary);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y).ticks(6).tickSize(-innerW).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', theme.palette.divider)
      .attr('stroke-opacity', 0.5);

    g.select('.grid .domain').remove();

    // X-axis label
    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.palette.text.secondary)
      .attr('font-size', 12)
      .text('Age');

    // Legend
    const legendData = [
      ...stackLabels.map((label, i) => ({ label, color: stackColors[i], type: 'area' })),
      { label: 'Net Worth', color: COLORS.netWorth, type: 'line' },
    ];
    const legend = svg.append('g').attr('transform', `translate(${margin.left}, ${height - 8})`);
    legendData.forEach((item, i) => {
      const lx = i * 115;
      if (item.type === 'area') {
        legend.append('rect').attr('x', lx).attr('y', -12).attr('width', 12).attr('height', 12)
          .attr('fill', item.color).attr('fill-opacity', 0.7);
      } else {
        legend.append('line').attr('x1', lx).attr('x2', lx + 12).attr('y1', -6).attr('y2', -6)
          .attr('stroke', item.color).attr('stroke-width', 2.5);
      }
      legend.append('text').attr('x', lx + 16).attr('y', -2)
        .attr('fill', theme.palette.text.secondary).attr('font-size', 11).text(item.label);
    });

    // Tooltip crosshair
    const focus = g.append('g').style('display', 'none');
    focus.append('line').attr('class', 'x-hover-line').attr('y1', 0).attr('y2', innerH)
      .attr('stroke', theme.palette.text.disabled).attr('stroke-width', 1).attr('stroke-dasharray', '4');

    const tooltip = d3.select(container).select<HTMLDivElement>('.cf-tooltip');

    svg.on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event, g.node()!);
      const age = Math.round(x.invert(mx));
      const d = data.find((p) => p.age === age) ?? data[data.findIndex((p) => p.age >= age) ?? 0];
      if (!d) return;
      focus.style('display', null);
      focus.select('.x-hover-line').attr('transform', `translate(${x(d.age)},0)`);
      tooltip
        .style('display', 'block')
        .style('left', `${x(d.age) + margin.left + 10}px`)
        .style('top', `${margin.top}px`)
        .html(`
          <strong>Age ${d.age} (${d.year})</strong><br/>
          Net Worth: <b>$${nw(d).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</b><br/>
          RRSP/RRIF: $${(d.rrspBalance ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}<br/>
          TFSA: $${(d.tfsaBalance ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}<br/>
          Non-Reg: $${(d.nonRegBalance ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}<br/>
          Income: $${d.totalIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}<br/>
          Expenses: $${exp(d).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
        `);
    }).on('mouseleave', () => { focus.style('display', 'none'); tooltip.style('display', 'none'); });
  }, [data, height, theme]);

  // Resize observer
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (svgRef.current && containerRef.current && data.length > 0) {
        // Re-trigger effect by forcing a dummy setState is complex; just re-run
        const event = new Event('resize');
        window.dispatchEvent(event);
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [data]);

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} style={{ overflow: 'visible', display: 'block' }} />
      <Box
        className="cf-tooltip"
        sx={{
          display: 'none',
          position: 'absolute',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 1.5,
          fontSize: 12,
          lineHeight: 1.6,
          pointerEvents: 'none',
          zIndex: 10,
          maxWidth: 200,
          boxShadow: 4,
        }}
      />
    </Box>
  );
}
