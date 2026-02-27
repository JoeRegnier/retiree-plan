import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { ChartMilestone } from './CashFlowChart';

export interface WaterfallYear {
  year: number;
  age?: number;
  netWorth?: number;
  netCashFlow: number;
  isHistorical?: boolean;
}

interface WaterfallChartProps {
  data: WaterfallYear[];
  milestones?: ChartMilestone[];
}

export function WaterfallChart({ data, milestones = [] }: WaterfallChartProps) {
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

        const margin = { top: 20, right: 30, bottom: 50, left: 80 };
        const width = containerWidth - margin.left - margin.right;
        const height = 320 - margin.top - margin.bottom;

        const svg = d3.select(el).append('g')
          .attr('transform', `translate(${margin.left},${margin.top})`);

        // Sample projected data to keep bar count reasonable, keep all historical
        const historical = data.filter((d) => d.isHistorical);
        const projected = data.filter((d) => !d.isHistorical);
        const projStep = Math.max(1, Math.floor(projected.length / 30));
        const sampledProjected = projected.filter((_, i) => i % projStep === 0);
        const sampled = [...historical, ...sampledProjected];

        interface WFBar { year: number; age: number | undefined; start: number; end: number; change: number; isHistorical: boolean; }
        const bars: WFBar[] = sampled.map((d, i) => {
          const nw = d.netWorth ?? 0;
          const prevNw = i === 0 ? nw - d.netCashFlow : (sampled[i - 1].netWorth ?? 0);
          return { year: d.year, age: d.age, start: Math.min(prevNw, nw), end: Math.max(prevNw, nw), change: nw - prevNw, isHistorical: d.isHistorical ?? false };
        });

        const allValues = bars.flatMap((b) => [b.start, b.end]);
        const yMin = Math.min(0, d3.min(allValues) as number);
        const yMax = (d3.max(allValues) as number) * 1.05;

        const xScale = d3.scaleBand().domain(bars.map((b) => String(b.year))).range([0, width]).padding(0.15);
        const yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

        svg.append('g')
          .call(d3.axisLeft(yScale).ticks(5).tickSize(-width).tickFormat(() => ''))
          .selectAll('line').attr('stroke', '#333').attr('stroke-dasharray', '3,3');
        svg.select('.domain').remove();

        if (yMin < 0) {
          svg.append('line').attr('x1', 0).attr('x2', width)
            .attr('y1', yScale(0)).attr('y2', yScale(0))
            .attr('stroke', '#999').attr('stroke-dasharray', '4,2');
        }

        // Bar colours: historical uses blue tones, projected uses green/red
        const barFill = (d: WFBar) => {
          if (d.isHistorical) return d.change >= 0 ? '#1976d2' : '#7b1fa2';
          return d.change >= 0 ? '#388e3c' : '#d32f2f';
        };

        svg.selectAll('.bar').data(bars).join('rect')
          .attr('class', 'bar')
          .attr('x', (d) => xScale(String(d.year)) ?? 0)
          .attr('y', (d) => yScale(d.end))
          .attr('width', xScale.bandwidth())
          .attr('height', (d) => Math.max(1, yScale(d.start) - yScale(d.end)))
          .attr('fill', barFill)
          .attr('opacity', (d) => d.isHistorical ? 0.7 : 0.85)
          .attr('rx', 2);

        // Connector lines between bars
        for (let i = 1; i < bars.length; i++) {
          const prev = bars[i - 1]; const curr = bars[i];
          svg.append('line')
            .attr('x1', (xScale(String(prev.year)) ?? 0) + xScale.bandwidth())
            .attr('x2', xScale(String(curr.year)) ?? 0)
            .attr('y1', yScale(prev.end)).attr('y2', yScale(prev.end))
            .attr('stroke', '#555').attr('stroke-width', 0.5).attr('stroke-dasharray', '2,2');
        }

        // "Today" divider — vertical line between last historical and first projected bar
        const lastHistIdx = bars.reduce((li, b, i) => b.isHistorical ? i : li, -1);
        if (lastHistIdx >= 0 && lastHistIdx < bars.length - 1) {
          const lhBar = bars[lastHistIdx];
          const x = (xScale(String(lhBar.year)) ?? 0) + xScale.bandwidth() + (xScale.step() * xScale.paddingInner()) / 2;
          svg.append('line')
            .attr('x1', x).attr('x2', x)
            .attr('y1', 0).attr('y2', height)
            .attr('stroke', '#f57c00').attr('stroke-width', 1.5).attr('stroke-dasharray', '5,3');
          svg.append('text')
            .attr('x', x + 4).attr('y', 10)
            .attr('fill', '#f57c00').attr('font-size', 10)
            .text('Today');
        }

        // ── Milestone markers ────────────────────────────────────────────────
        if (milestones.length > 0 && bars.some((b) => b.age != null)) {
          const byAge = new Map<number, ChartMilestone[]>();
          milestones.forEach((m) => {
            if (!byAge.has(m.age)) byAge.set(m.age, []);
            byAge.get(m.age)!.push(m);
          });
          byAge.forEach((ms, age) => {
            const nearest = bars.reduce((prev, curr) =>
              Math.abs((curr.age ?? 0) - age) < Math.abs((prev.age ?? 0) - age) ? curr : prev
            );
            if (Math.abs((nearest.age ?? 0) - age) > 3) return;
            const cx = (xScale(String(nearest.year)) ?? 0) + xScale.bandwidth() / 2;
            const primary = ms.find((m) => m.type === 'event') ?? ms[0];
            svg.append('line')
              .attr('x1', cx).attr('x2', cx).attr('y1', 0).attr('y2', height)
              .attr('stroke', primary.color).attr('stroke-width', 1.2)
              .attr('stroke-dasharray', primary.type === 'event' ? '4,3' : '2,4')
              .attr('opacity', 0.8);
            ms.forEach((m, li) => {
              svg.append('text')
                .attr('x', cx + 4).attr('y', 14 + li * 11)
                .attr('fill', m.color).attr('font-size', 9)
                .attr('font-weight', m.type === 'event' ? '600' : '400')
                .attr('opacity', 0.9)
                .text(m.label);
            });
          });
        }

        const tickFreq = Math.max(1, Math.floor(sampled.length / 10));
        svg.append('g').attr('transform', `translate(0,${height})`)
          .call(d3.axisBottom(xScale).tickValues(bars.filter((_, i) => i % tickFreq === 0).map((b) => String(b.year))))
          .selectAll('text').attr('fill', 'currentColor').attr('transform', 'rotate(-35)').style('text-anchor', 'end');

        svg.append('g').call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => {
          const v = d as number;
          if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
          if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
          return `$${v}`;
        })).selectAll('text').attr('fill', 'currentColor');

        const legend = [
          { label: 'Historical ↑', color: '#1976d2' },
          { label: 'Historical ↓', color: '#7b1fa2' },
          { label: 'Projected ↑', color: '#388e3c' },
          { label: 'Projected ↓', color: '#d32f2f' },
        ];
        legend.forEach(({ label, color }, i) => {
          const lx = width - legend.length * 90 + i * 90;
          svg.append('rect').attr('x', lx).attr('y', -15).attr('width', 12).attr('height', 12).attr('fill', color).attr('rx', 2);
          svg.append('text').attr('x', lx + 16).attr('y', -5).attr('font-size', 10).attr('fill', 'currentColor').text(label);
        });

        svg.append('text').attr('x', -height / 2).attr('y', -60)
          .attr('transform', 'rotate(-90)').attr('text-anchor', 'middle').attr('font-size', 12)
          .attr('fill', 'currentColor').text('Net Worth');
      });
    };

    const ro = new ResizeObserver(draw);
    ro.observe(el);
    draw();
    return () => { ro.disconnect(); cancelAnimationFrame(rafId); };
  }, [data, milestones]);

  return <svg ref={svgRef} width="100%" height={320} />;
}
