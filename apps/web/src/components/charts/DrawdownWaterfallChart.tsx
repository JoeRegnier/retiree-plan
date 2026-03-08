import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Box, Chip, Slider, IconButton, Typography, Stack, useTheme } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

interface DrawdownYear {
  age: number;
  rrsp: number;
  tfsa: number;
  nonReg: number;
  cash: number;
}

type AccountKey = keyof Omit<DrawdownYear, 'age'>;

interface DrawdownWaterfallChartProps {
  data: DrawdownYear[];
  retirementAge?: number;
}

const ACCOUNT_KEYS: AccountKey[] = ['rrsp', 'tfsa', 'nonReg', 'cash'];
const ACCOUNT_COLORS: Record<AccountKey, string> = {
  rrsp: '#2196f3',
  tfsa: '#4caf50',
  nonReg: '#ff9800',
  cash: '#9e9e9e',
};
const ACCOUNT_LABELS: Record<AccountKey, string> = {
  rrsp: 'RRSP/RRIF',
  tfsa: 'TFSA',
  nonReg: 'Non-Registered',
  cash: 'Cash',
};

function getAccountValue(d: DrawdownYear, key: string): number {
  switch (key) {
    case 'rrsp':
      return d.rrsp;
    case 'tfsa':
      return d.tfsa;
    case 'nonReg':
      return d.nonReg;
    case 'cash':
      return d.cash;
    default:
      return 0;
  }
}

function getAccountColor(key: string): string {
  switch (key) {
    case 'rrsp':
      return ACCOUNT_COLORS.rrsp;
    case 'tfsa':
      return ACCOUNT_COLORS.tfsa;
    case 'nonReg':
      return ACCOUNT_COLORS.nonReg;
    case 'cash':
      return ACCOUNT_COLORS.cash;
    default:
      return '#9e9e9e';
  }
}

function formatDollar(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function DrawdownWaterfallChart({ data, retirementAge }: DrawdownWaterfallChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const theme = useTheme();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const [tooltip, setTooltip] = useState<{
    clientX: number;
    clientY: number;
    key: AccountKey;
    balance: number;
    total: number;
    pct: number;
    age: number;
  } | null>(null);

  const retireData = useMemo(() => {
    const source = retirementAge != null ? data.filter((d) => d.age >= retirementAge) : data;
    return source.map((d) => ({
      ...d,
      rrsp: Math.max(0, d.rrsp),
      tfsa: Math.max(0, d.tfsa),
      nonReg: Math.max(0, d.nonReg),
      cash: Math.max(0, d.cash),
    }));
  }, [data, retirementAge]);

  const insights = useMemo(() => {
    if (retireData.length === 0) return [];
    const result: Array<{ label: string; color: string }> = [];

    // Peak total portfolio value
    let peakTotal = 0;
    let peakAge = retireData[0].age;
    for (const d of retireData) {
      const t = ACCOUNT_KEYS.reduce((s, k) => s + d[k], 0);
      if (t > peakTotal) { peakTotal = t; peakAge = d.age; }
    }
    result.push({ label: `Peak ${formatDollar(peakTotal)} at age ${peakAge}`, color: '#2196f3' });

    // First year where net portfolio total starts declining
    let declineAge: number | null = null;
    for (let i = 1; i < retireData.length; i++) {
      const tPrev = ACCOUNT_KEYS.reduce((s, k) => s + retireData[i - 1][k], 0);
      const tCurr = ACCOUNT_KEYS.reduce((s, k) => s + retireData[i][k], 0);
      if (tCurr < tPrev) { declineAge = retireData[i].age; break; }
    }
    if (declineAge != null) {
      result.push({ label: `Net drawdown begins age ${declineAge}`, color: '#ff9800' });
    }

    // RRSP → RRIF conversion (Canadian rule: required by end of year you turn 71)
    if (retireData[0].age < 71 && retireData.some((d) => d.rrsp > 0 && d.age <= 71)) {
      result.push({ label: 'RRSP → RRIF conversion at age 71', color: '#9c27b0' });
    }

    // Non-Registered account depletion
    const firstNonZeroNonReg = retireData.find((d) => d.nonReg > 0);
    if (!firstNonZeroNonReg) {
      result.push({ label: 'Non-Reg: no balance at retirement', color: '#9e9e9e' });
    } else {
      const depleted = retireData.find((d) => d.age > firstNonZeroNonReg.age && d.nonReg === 0);
      if (depleted) result.push({ label: `Non-Reg depleted at age ${depleted.age}`, color: '#ff9800' });
    }

    // Sustainability verdict at end of projection
    const last = retireData[retireData.length - 1];
    const lastTotal = ACCOUNT_KEYS.reduce((s, k) => s + last[k], 0);
    result.push(
      lastTotal > 0
        ? { label: `Sustained to age ${last.age} · ${formatDollar(lastTotal)} remaining`, color: '#4caf50' }
        : { label: `Portfolio depleted before age ${last.age}`, color: '#f44336' },
    );

    return result;
  }, [retireData]);

  const stopPlay = useCallback(() => {
    setPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (retireData.length === 0) return;
    if (playing) {
      stopPlay();
      return;
    }

    setPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrentIdx((prev) => {
        if (prev >= retireData.length - 1) {
          stopPlay();
          return prev;
        }
        return prev + 1;
      });
    }, 400);
  }, [playing, retireData.length, stopPlay]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (retireData.length === 0) {
      setCurrentIdx(0);
      stopPlay();
      return;
    }

    if (currentIdx > retireData.length - 1) {
      setCurrentIdx(retireData.length - 1);
    }
  }, [currentIdx, retireData.length, stopPlay]);

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const syncWidth = () => setChartWidth(el.clientWidth || 0);
    syncWidth();

    const observer = new ResizeObserver(syncWidth);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || chartWidth <= 0 || retireData.length === 0) return;

    const height = 360;
    const margin = { top: 20, right: 30, bottom: 40, left: 68 };
    const innerWidth = Math.max(0, chartWidth - margin.left - margin.right);
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);

    const svg = d3.select(svgRef.current)
      .attr('width', chartWidth)
      .attr('height', height);

    const root = svg
      .selectAll<SVGGElement, null>('g.drawdown-root')
      .data([null])
      .join('g')
      .attr('class', 'drawdown-root')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxTotal = d3.max(retireData, (d) =>
      ACCOUNT_KEYS.reduce((sum, key) => sum + d[key], 0)
    ) ?? 1;

    const x = d3.scaleLinear()
      .domain([0, maxTotal])
      .nice()
      .range([0, innerWidth]);

    const y = d3.scaleBand<string>()
      .domain(retireData.map((d) => String(d.age)))
      .range([0, innerHeight])
      .padding(0.18);

    const ageTickStep = Math.max(1, Math.ceil(retireData.length / 12));
    const yTickAges = retireData
      .filter((_, idx) => idx % ageTickStep === 0)
      .map((d) => String(d.age));

    const xAxis = d3.axisBottom(x)
      .ticks(6)
      .tickFormat((d) => formatDollar(d as number));

    const yAxis = d3.axisLeft(y)
      .tickValues(yTickAges);

    root
      .selectAll<SVGGElement, null>('g.x-axis')
      .data([null])
      .join('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call((sel) => {
        sel.selectAll('text')
          .attr('fill', theme.palette.text.secondary)
          .attr('font-size', '0.72rem');
        sel.selectAll('line,path').attr('stroke', theme.palette.divider);
      });

    root
      .selectAll<SVGGElement, null>('g.y-axis')
      .data([null])
      .join('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .call((sel) => {
        sel.selectAll('text')
          .attr('fill', theme.palette.text.secondary)
          .attr('font-size', '0.72rem');
        sel.selectAll('line,path').attr('stroke', theme.palette.divider);
      });

    root
      .selectAll<SVGTextElement, null>('text.x-axis-label')
      .data([null])
      .join('text')
      .attr('class', 'x-axis-label')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 34)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.palette.text.secondary)
      .attr('font-size', '0.75rem')
      .text('Portfolio Balance');

    const stack = d3.stack<DrawdownYear>()
      .keys(ACCOUNT_KEYS)
      .value((d, key) => getAccountValue(d, key));

    const stackedSeries = stack(retireData);
    const currentAge = retireData[Math.min(currentIdx, retireData.length - 1)]?.age ?? retireData[0].age;

    const layerGroups = root
      .selectAll<SVGGElement, d3.Series<DrawdownYear, AccountKey>>('g.account-layer')
      .data(stackedSeries, (d) => d.key)
      .join('g')
      .attr('class', 'account-layer');

    layerGroups.each(function eachLayer(series) {
      const group = d3.select(this);

      group
        .selectAll<SVGRectElement, d3.SeriesPoint<DrawdownYear>>('rect')
        .data(series, (d) => String(d.data.age))
        .join(
          (enter) => enter
            .append('rect')
            .attr('x', (d) => x(d[0]))
            .attr('y', (d) => y(String(d.data.age)) ?? 0)
            .attr('height', y.bandwidth())
            .attr('width', 0)
            .attr('fill', getAccountColor(series.key))
            .attr('opacity', (d) => d.data.age <= currentAge ? 0.92 : 0.15)
            .attr('rx', 2)
            .call((sel) =>
              sel
                .transition()
                .duration(300)
                .attr('width', (d) => Math.max(0, x(d[1]) - x(d[0])))
            ),
          (update) => update.call((sel) =>
            sel
              .transition()
              .duration(300)
              .attr('x', (d) => x(d[0]))
              .attr('y', (d) => y(String(d.data.age)) ?? 0)
              .attr('height', y.bandwidth())
              .attr('width', (d) => Math.max(0, x(d[1]) - x(d[0])))
              .attr('opacity', (d) => d.data.age <= currentAge ? 0.92 : 0.15)
          ),
          (exit) => exit.call((sel) =>
            sel
              .transition()
              .duration(200)
              .attr('width', 0)
              .remove()
          )
        );

      // Attach hover events to all rects in this layer after join settles
      group
        .selectAll<SVGRectElement, d3.SeriesPoint<DrawdownYear>>('rect')
        .attr('cursor', 'crosshair')
        .on('mouseenter', function (event, d) {
          const me = event as MouseEvent;
          const total = ACCOUNT_KEYS.reduce((s, k) => s + d.data[k], 0);
          const balance = getAccountValue(d.data, series.key);
          setTooltip({
            clientX: me.clientX,
            clientY: me.clientY,
            key: series.key as AccountKey,
            balance,
            total,
            pct: total > 0 ? (balance / total) * 100 : 0,
            age: d.data.age,
          });
        })
        .on('mousemove', function (event) {
          const me = event as MouseEvent;
          setTooltip((prev) =>
            prev ? { ...prev, clientX: me.clientX, clientY: me.clientY } : null,
          );
        })
        .on('mouseleave', () => setTooltip(null));
    });

    root
      .selectAll<SVGRectElement, number>('rect.current-age-highlight')
      .data([currentAge])
      .join('rect')
      .attr('class', 'current-age-highlight')
      .attr('x', -2)
      .attr('y', (age) => (y(String(age)) ?? 0) - 2)
      .attr('width', innerWidth + 4)
      .attr('height', y.bandwidth() + 4)
      .attr('fill', 'none')
      .attr('stroke', theme.palette.primary.main)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4 2')
      .attr('rx', 4)
      .lower();
  }, [retireData, currentIdx, chartWidth, theme]);

  if (retireData.length === 0) {
    return <Typography color="text.secondary">No retirement data available for drawdown visualization.</Typography>;
  }

  const currentYear = retireData[Math.min(currentIdx, retireData.length - 1)];

  return (
    <Box ref={containerRef} sx={{ position: 'relative' }}>
      {currentYear && (
        <Stack direction="row" spacing={3} sx={{ mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Age {currentYear.age}
          </Typography>
          {ACCOUNT_KEYS.map((key) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: ACCOUNT_COLORS[key] }} />
              <Typography variant="caption">
                {ACCOUNT_LABELS[key]}: {formatDollar(currentYear[key])}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}

      <svg ref={svgRef} onMouseLeave={() => setTooltip(null)} />

      <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 1, px: 1 }}>
        <IconButton onClick={togglePlay} size="small" color="primary">
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <Slider
          value={currentIdx}
          min={0}
          max={retireData.length - 1}
          step={1}
          onChange={(_, value) => {
            stopPlay();
            setCurrentIdx(value as number);
          }}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => retireData[value] ? `Age ${retireData[value].age}` : ''}
          sx={{ flex: 1 }}
        />
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mt: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
        {ACCOUNT_KEYS.map((key) => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: ACCOUNT_COLORS[key] }} />
            <Typography variant="caption">{ACCOUNT_LABELS[key]}</Typography>
          </Box>
        ))}
      </Stack>

      {insights.length > 0 && (
        <Box sx={{ mt: 2, px: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 0.75, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.65rem' }}
          >
            Key Insights
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            {insights.map((ins) => (
              <Chip
                key={ins.label}
                label={ins.label}
                size="small"
                sx={{
                  fontSize: '0.7rem',
                  height: 22,
                  bgcolor: `${ins.color}1a`,
                  color: ins.color,
                  border: `1px solid ${ins.color}55`,
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {tooltip && (
        <Box
          sx={{
            position: 'fixed',
            left: tooltip.clientX + 14,
            top: tooltip.clientY - 40,
            pointerEvents: 'none',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            px: 1.5,
            py: 1,
            boxShadow: 4,
            zIndex: 9999,
            minWidth: 160,
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 0.25 }}>
            Age {tooltip.age} · {ACCOUNT_LABELS[tooltip.key]}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: ACCOUNT_COLORS[tooltip.key] }}>
            {formatDollar(tooltip.balance)}{' '}
            <Typography component="span" variant="caption" color="text.secondary">
              ({tooltip.pct.toFixed(0)}% of portfolio)
            </Typography>
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.25 }}>
            Total: {formatDollar(tooltip.total)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
