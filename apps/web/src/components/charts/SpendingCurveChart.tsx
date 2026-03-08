import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';

interface SpendingPhase {
  fromAge: number;
  factor: number;
}

interface Props {
  phases: SpendingPhase[];
  retirementAge: number;
  endAge: number;
  baseExpenses: number;
  height?: number;
}

interface SpendingPoint {
  age: number;
  factor: number;
  spending: number;
}

function formatCompactCurrency(value: number): string {
  const formatted = d3.format('~s')(value);
  const normalized = formatted
    .replace('k', 'K')
    .replace('m', 'M')
    .replace('g', 'B');
  return `$${normalized}`;
}

function getActiveFactor(age: number, sortedPhases: SpendingPhase[]): number {
  let factor = 1;
  for (const phase of sortedPhases) {
    if (phase.fromAge <= age) {
      factor = phase.factor;
      continue;
    }
    break;
  }
  return factor;
}

export function SpendingCurveChart({
  phases,
  retirementAge,
  endAge,
  baseExpenses,
  height = 150,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);
  const theme = useTheme();

  const { points, boundaries } = useMemo(() => {
    if (endAge < retirementAge) {
      return { points: [] as SpendingPoint[], boundaries: [] as Array<{ age: number; factor: number }> };
    }

    const sorted = [...phases].sort((a, b) => a.fromAge - b.fromAge);
    const years = d3.range(retirementAge, endAge + 1, 1);
    const generatedPoints = years.map((age) => {
      const factor = getActiveFactor(age, sorted);
      return {
        age,
        factor,
        spending: baseExpenses * factor,
      };
    });

    // Keep one boundary per age; later entries win when phases share the same fromAge.
    const boundaryByAge = new Map<number, number>();
    sorted.forEach((phase) => {
      boundaryByAge.set(phase.fromAge, phase.factor);
    });

    const generatedBoundaries = Array.from(boundaryByAge.entries())
      .map(([age, factor]) => ({ age, factor }))
      .filter((boundary) => boundary.age >= retirementAge && boundary.age <= endAge)
      .sort((a, b) => a.age - b.age);

    return { points: generatedPoints, boundaries: generatedBoundaries };
  }, [baseExpenses, endAge, phases, retirementAge]);

  useEffect(() => {
    if (!containerRef.current) return;

    const element = containerRef.current;
    const updateWidth = () => {
      setWidth(Math.max(0, Math.floor(element.getBoundingClientRect().width)));
    };

    updateWidth();

    const ro = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? element.getBoundingClientRect().width;
      setWidth(Math.max(0, Math.floor(nextWidth)));
    });

    ro.observe(element);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || width < 10 || points.length === 0) return;

    const margin = { top: 10, right: 20, bottom: 25, left: 50 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    if (innerW <= 0 || innerH <= 0) return;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xEnd = endAge > retirementAge ? endAge : retirementAge + 1;
    const x = d3.scaleLinear()
      .domain([retirementAge, xEnd])
      .range([0, innerW]);

    const spendingValues = points.map((point) => point.spending);
    let yMin = Math.min(baseExpenses, ...spendingValues);
    let yMax = Math.max(baseExpenses, ...spendingValues);

    if (yMin === yMax) {
      const spread = Math.max(1, yMin * 0.1);
      yMin -= spread;
      yMax += spread;
    } else {
      const spread = (yMax - yMin) * 0.15;
      yMin -= spread;
      yMax += spread;
    }

    const y = d3.scaleLinear()
      .domain([yMin, yMax])
      .nice(3)
      .range([innerH, 0]);

    const xTicks = d3.range(retirementAge, endAge + 1, 5);
    if (xTicks.length === 0 || xTicks[0] !== retirementAge) {
      xTicks.unshift(retirementAge);
    }

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(xTicks).tickFormat((value) => `${value as number}`));

    g.append('g')
      .call(d3.axisLeft(y).ticks(3).tickFormat((value) => formatCompactCurrency(value as number)));

    g.selectAll('.domain').attr('stroke', theme.palette.divider);
    g.selectAll('.tick line').attr('stroke', theme.palette.divider);
    g.selectAll('.tick text')
      .attr('fill', theme.palette.text.secondary)
      .attr('font-size', 11);

    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(baseExpenses))
      .attr('y2', y(baseExpenses))
      .attr('stroke', theme.palette.text.disabled)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    const area = d3.area<SpendingPoint>()
      .x((point) => x(point.age))
      .y0(innerH)
      .y1((point) => y(point.spending))
      .curve(d3.curveMonotoneX);

    const line = d3.line<SpendingPoint>()
      .x((point) => x(point.age))
      .y((point) => y(point.spending))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(points)
      .attr('fill', alpha(theme.palette.primary.main, 0.15))
      .attr('d', area);

    g.append('path')
      .datum(points)
      .attr('fill', 'none')
      .attr('stroke', theme.palette.primary.main)
      .attr('stroke-width', 2)
      .attr('d', line);

    g.selectAll('.phase-dot')
      .data(boundaries)
      .join('circle')
      .attr('class', 'phase-dot')
      .attr('cx', (boundary) => x(boundary.age))
      .attr('cy', (boundary) => y(baseExpenses * boundary.factor))
      .attr('r', 3)
      .attr('fill', theme.palette.primary.main);

    g.selectAll('.phase-label')
      .data(boundaries)
      .join('text')
      .attr('class', 'phase-label')
      .attr('x', (boundary) => x(boundary.age))
      .attr('y', (boundary) => {
        const dotY = y(baseExpenses * boundary.factor);
        return dotY < 16 ? dotY + 12 : dotY - 8;
      })
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', theme.palette.text.secondary)
      .text((boundary) => `${Math.round(boundary.factor * 100)}%`);
  }, [baseExpenses, boundaries, endAge, height, points, retirementAge, theme, width]);

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
    </Box>
  );
}
