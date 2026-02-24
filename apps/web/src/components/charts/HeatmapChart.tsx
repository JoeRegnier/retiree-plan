import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

export interface HeatmapData {
  xLabel: string;   // e.g. withdrawal rate "3.5%"
  yLabel: string;   // e.g. equity fraction "60%"
  value: number;    // success rate 0-100
}

interface HeatmapChartProps {
  data: HeatmapData[];
  xTitle?: string;
  yTitle?: string;
  xValues: string[];
  yValues: string[];
}

export function HeatmapChart({ data, xTitle = 'Withdrawal Rate', yTitle = 'Equity Fraction', xValues, yValues }: HeatmapChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;
    const el = svgRef.current;
    let rafId: number;

    const draw = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const containerWidth = el.getBoundingClientRect().width || el.parentElement?.clientWidth || 0;
        if (containerWidth < 10) return;

        d3.select(el).selectAll('*').remove();

        const margin = { top: 30, right: 120, bottom: 60, left: 80 };
        const cellSize = Math.min(54, Math.floor((containerWidth - margin.left - margin.right) / xValues.length));
        const width = cellSize * xValues.length;
        const height = cellSize * yValues.length;

        const svg = d3.select(el).append('g')
          .attr('transform', `translate(${margin.left},${margin.top})`);

        const xScale = d3.scaleBand().domain(xValues).range([0, width]).padding(0.04);
        const yScale = d3.scaleBand().domain([...yValues].reverse()).range([0, height]).padding(0.04);
        const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([0, 100]);

        svg.selectAll('.hcell').data(data).join('rect')
          .attr('class', 'hcell')
          .attr('x', (d) => xScale(d.xLabel) ?? 0)
          .attr('y', (d) => yScale(d.yLabel) ?? 0)
          .attr('width', xScale.bandwidth()).attr('height', yScale.bandwidth())
          .attr('fill', (d) => colorScale(d.value)).attr('rx', 3);

        svg.selectAll('.htext').data(data).join('text')
          .attr('class', 'htext')
          .attr('x', (d) => (xScale(d.xLabel) ?? 0) + xScale.bandwidth() / 2)
          .attr('y', (d) => (yScale(d.yLabel) ?? 0) + yScale.bandwidth() / 2)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
          .attr('font-size', Math.min(11, cellSize * 0.28))
          .attr('fill', (d) => d.value > 50 ? '#333' : '#fff')
          .text((d) => `${d.value.toFixed(0)}%`);

        svg.append('g').attr('transform', `translate(0,${height})`).call(d3.axisBottom(xScale));
        svg.append('g').call(d3.axisLeft(yScale));

        svg.append('text').attr('x', width / 2).attr('y', height + 48)
          .attr('text-anchor', 'middle').attr('font-size', 12).text(xTitle);
        svg.append('text').attr('transform', 'rotate(-90)')
          .attr('x', -height / 2).attr('y', -60)
          .attr('text-anchor', 'middle').attr('font-size', 12).text(yTitle);

        const legendH = 120;
        const legendAxis = d3.axisRight(d3.scaleLinear().domain([0, 100]).range([legendH, 0])).ticks(5).tickFormat((d) => `${d}%`);

        const defs = d3.select(el.closest('svg') ?? el).append('defs');
        const gradId = 'heatmap-grad';
        const grad = defs.append('linearGradient').attr('id', gradId).attr('x1', '0%').attr('x2', '0%').attr('y1', '100%').attr('y2', '0%');
        [0, 25, 50, 75, 100].forEach((v) => { grad.append('stop').attr('offset', `${v}%`).attr('stop-color', colorScale(v)); });

        const lg = svg.append('g').attr('transform', `translate(${width + 20},${(height - legendH) / 2})`);
        lg.append('rect').attr('width', 14).attr('height', legendH).attr('fill', `url(#${gradId})`).attr('rx', 2);
        lg.append('g').attr('transform', 'translate(14,0)').call(legendAxis);
        lg.append('text').attr('x', 7).attr('y', -8).attr('text-anchor', 'middle').attr('font-size', 11).text('Success');
      });
    };

    const ro = new ResizeObserver(draw);
    ro.observe(el);
    draw();
    return () => { ro.disconnect(); cancelAnimationFrame(rafId); };
  }, [data, xTitle, yTitle, xValues, yValues]);

  const svgHeight = Math.min(54, 54) * yValues.length + 90;

  return <svg ref={svgRef} width="100%" height={svgHeight} />;
}
