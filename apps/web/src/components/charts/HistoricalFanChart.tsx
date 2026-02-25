import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Box, useTheme, ToggleButtonGroup, ToggleButton } from '@mui/material';

export interface FanChartYear {
  age: number;
  year: number;
  p1: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface FanChartSeries {
  /** Display label shown in legend and tooltip */
  label: string;
  /** Base hex colour for this series, e.g. '#1565c0' */
  color: string;
  data: FanChartYear[];
  successRate?: number;
}

interface Props {
  series: FanChartSeries[];
  height?: number;
}

const TIME_WINDOWS = ['5Y', '10Y', '20Y', '30Y', '40Y', 'ALL'] as const;
type TimeWindow = (typeof TIME_WINDOWS)[number];

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;
}

function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function HistoricalFanChart({ series, height = 400 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('ALL');

  const filterData = useCallback(
    (data: FanChartYear[], tw: TimeWindow): FanChartYear[] => {
      if (tw === 'ALL' || data.length === 0) return data;
      const yrs = parseInt(tw);
      const maxAge = data[0].age + yrs;
      return data.filter((d) => d.age <= maxAge);
    },
    [],
  );

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || series.length === 0) return;

    const filteredSeries = series.map((s) => ({ ...s, data: filterData(s.data, timeWindow) }));
    const nonEmpty = filteredSeries.filter((s) => s.data.length > 0);
    if (nonEmpty.length === 0) return;

    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 28, right: 24, bottom: 54, left: 74 };
    const innerW = containerWidth - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current).attr('width', containerWidth).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // ── Scales ──────────────────────────────────────────────────────────────
    const allAges = nonEmpty.flatMap((s) => s.data.map((d) => d.age));
    const allVals = nonEmpty.flatMap((s) =>
      s.data.flatMap((d) => [d.p1, d.p5, d.p25, d.p50, d.p75, d.p95]),
    );

    const xDomain = d3.extent(allAges) as [number, number];
    const yMin = Math.min(0, (d3.min(allVals) ?? 0) * 1.05);
    const yMax = (d3.max(allVals) ?? 1) * 1.05;

    const x = d3.scaleLinear().domain(xDomain).range([0, innerW]);
    const y = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]).nice();

    type D = FanChartYear;

    // ── Grid & Axes ──────────────────────────────────────────────────────────
    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickSize(-innerW).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', theme.palette.divider)
      .attr('stroke-opacity', 0.4);
    g.selectAll('.domain').remove();

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat((d) => `${d}`))
      .selectAll('text')
      .attr('fill', theme.palette.text.secondary)
      .attr('font-size', 11);

    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat((d) => `$${d3.format('.2s')(d as number)}`))
      .selectAll('text')
      .attr('fill', theme.palette.text.secondary)
      .attr('font-size', 11);

    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 42)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.palette.text.secondary)
      .attr('font-size', 12)
      .text('Age');

    // Zero line
    if (yMin < 0) {
      g.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', y(0)).attr('y2', y(0))
        .attr('stroke', theme.palette.error.main)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5,3')
        .attr('opacity', 0.7);
    }

    // ── Bands (drawn first so lines render on top) ───────────────────────────
    function makeBand(key0: keyof D, key1: keyof D) {
      return d3.area<D>()
        .x((d) => x(d.age))
        .y0((d) => y(d[key0] as number))
        .y1((d) => y(d[key1] as number))
        .curve(d3.curveMonotoneX);
    }
    const outerBand = makeBand('p5', 'p95');
    const innerBand = makeBand('p25', 'p75');

    for (const s of filteredSeries) {
      if (s.data.length === 0) continue;
      g.append('path').datum(s.data).attr('fill', hexAlpha(s.color, 0.09)).attr('d', outerBand as any);
      g.append('path').datum(s.data).attr('fill', hexAlpha(s.color, 0.20)).attr('d', innerBand as any);
    }

    // ── Median lines ─────────────────────────────────────────────────────────
    const medLine = d3.line<D>()
      .x((d) => x(d.age)).y((d) => y(d.p50)).curve(d3.curveMonotoneX);

    for (const s of filteredSeries) {
      if (s.data.length === 0) continue;
      g.append('path').datum(s.data)
        .attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', 2.5)
        .attr('d', medLine as any);
    }

    // ── Legend ───────────────────────────────────────────────────────────────
    const legend = svg.append('g').attr('transform', `translate(${margin.left},${height - 8})`);
    const itemW = Math.min(200, (containerWidth - margin.left - margin.right) / Math.max(series.length, 1));
    filteredSeries.forEach((s, i) => {
      const lx = i * itemW;
      legend.append('rect').attr('x', lx).attr('y', -14).attr('width', 14).attr('height', 14)
        .attr('fill', s.color).attr('rx', 2);
      const rateLabel = s.successRate != null ? ` (${s.successRate.toFixed(1)}%)` : '';
      legend.append('text').attr('x', lx + 18).attr('y', -2)
        .attr('fill', theme.palette.text.secondary).attr('font-size', 11)
        .text(`${s.label}${rateLabel}`);
    });

    // ── Hover tooltip ─────────────────────────────────────────────────────────
    const focusLine = g.append('line')
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', theme.palette.text.disabled).attr('stroke-width', 1)
      .attr('stroke-dasharray', '4').style('display', 'none');

    const tooltip = d3.select(containerRef.current).select<HTMLDivElement>('.fan-tooltip');

    function nearest(data: FanChartYear[], age: number) {
      return data.reduce((prev, curr) =>
        Math.abs(curr.age - age) < Math.abs(prev.age - age) ? curr : prev,
      );
    }

    svg.on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event, g.node()!);
      const age = Math.round(x.invert(mx));
      focusLine.style('display', null).attr('transform', `translate(${x(age)},0)`);

      const rows = filteredSeries
        .filter((s) => s.data.length > 0)
        .map((s) => {
          const d = nearest(s.data, age);
          return `<tr>
            <td style="padding:2px 6px">
              <span style="display:inline-block;width:10px;height:10px;background:${s.color};border-radius:2px;margin-right:4px;vertical-align:middle"></span>
              ${s.label}
            </td>
            <td style="padding:2px 6px;text-align:right"><b>${fmt(d.p50)}</b></td>
            <td style="padding:2px 6px;text-align:right;color:#888;font-size:11px">${fmt(d.p25)}–${fmt(d.p75)}</td>
          </tr>`;
        })
        .join('');

      tooltip
        .style('display', 'block')
        .style('left', `${x(age) + margin.left + 10}px`)
        .style('top', `${margin.top + 4}px`)
        .html(
          `<strong>Age ${age}</strong>` +
          `<table style="border-collapse:collapse;margin-top:4px">${rows}</table>` +
          `<div style="font-size:10px;color:#999;margin-top:4px">Median · (p25–p75 range)</div>`,
        );
    });

    svg.on('mouseleave', () => {
      focusLine.style('display', 'none');
      tooltip.style('display', 'none');
    });
  }, [series, timeWindow, height, theme, filterData]);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <ToggleButtonGroup value={timeWindow} exclusive onChange={(_, v) => v && setTimeWindow(v)} size="small">
          {TIME_WINDOWS.map((tw) => (
            <ToggleButton key={tw} value={tw} sx={{ px: 1.5, py: 0.4, fontSize: 12 }}>{tw}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
        <svg ref={svgRef} style={{ overflow: 'visible', display: 'block' }} />
        <Box
          className="fan-tooltip"
          sx={{
            display: 'none', position: 'absolute', bgcolor: 'background.paper',
            border: '1px solid', borderColor: 'divider', borderRadius: 1,
            p: 1.5, fontSize: 12, lineHeight: 1.6, pointerEvents: 'none',
            zIndex: 10, maxWidth: 320, boxShadow: 4,
          }}
        />
      </Box>
    </Box>
  );
}

