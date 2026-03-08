import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Slider,
  Typography,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import * as d3 from 'd3';
import type { CashFlowInput } from '@retiree-plan/finance-engine';
import { useProjectionWorker } from '../hooks/useProjectionWorker';

interface WhatIfDrawerProps {
  open: boolean;
  onClose: () => void;
  baselineInput: CashFlowInput | null;
  baselineData: { age: number; totalNetWorth: number }[] | null;
}

interface NetWorthPoint {
  age: number;
  totalNetWorth: number;
}

const DRAWER_WIDTH = 380;
const CHART_WIDTH = 340;
const CHART_HEIGHT = 200;

const currencyFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat('en-CA', {
  maximumFractionDigits: 0,
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatSignedPercent(value: number): string {
  const rounded = Number(value.toFixed(2));
  if (rounded > 0) return `+${rounded}%`;
  if (rounded < 0) return `${rounded}%`;
  return '0%';
}

function formatSignedYears(value: number): string {
  if (value > 0) return `+${value} years`;
  if (value < 0) return `${value} years`;
  return '0 years';
}

function formatSignedCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${currencyFormatter.format(abs)}`;
}

function findNetWorthAtAge(points: NetWorthPoint[], targetAge: number): number | null {
  if (points.length === 0) return null;

  const exact = points.find((point) => point.age === targetAge);
  if (exact) return exact.totalNetWorth;

  let closest = points[0];
  let smallestDistance = Math.abs(points[0].age - targetAge);

  for (let i = 1; i < points.length; i += 1) {
    const candidate = points[i];
    const distance = Math.abs(candidate.age - targetAge);
    if (distance < smallestDistance) {
      closest = candidate;
      smallestDistance = distance;
    }
  }

  return closest.totalNetWorth;
}

export function WhatIfDrawer({ open, onClose, baselineInput, baselineData }: WhatIfDrawerProps) {
  const theme = useTheme();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [extraMonthlySavings, setExtraMonthlySavings] = useState(0);
  const [returnRateDeltaPct, setReturnRateDeltaPct] = useState(0);
  const [retirementAgeShift, setRetirementAgeShift] = useState(0);
  const [lifeExpectancy, setLifeExpectancy] = useState(90);

  const { data, isRunning, run } = useProjectionWorker(300);

  useEffect(() => {
    if (!open) return;

    setExtraMonthlySavings(0);
    setReturnRateDeltaPct(0);
    setRetirementAgeShift(0);
    setLifeExpectancy(baselineInput?.endAge ?? 90);
  }, [open, baselineInput?.endAge]);

  const baselineSeries = useMemo<NetWorthPoint[]>(() => {
    if (!baselineData || baselineData.length === 0) return [];
    return baselineData
      .map((point) => ({ age: point.age, totalNetWorth: point.totalNetWorth }))
      .sort((a, b) => a.age - b.age);
  }, [baselineData]);

  const modifiedInput = useMemo<CashFlowInput | null>(() => {
    if (!baselineInput) return null;

    const adjustedEndAge = Math.max(lifeExpectancy, baselineInput.currentAge);
    const adjustedRetirementAge = clamp(
      baselineInput.retirementAge + retirementAgeShift,
      baselineInput.currentAge,
      adjustedEndAge,
    );

    const annualExtraContribution = extraMonthlySavings * 12;
    const splitContribution = annualExtraContribution / 2;

    return {
      ...baselineInput,
      endAge: adjustedEndAge,
      retirementAge: adjustedRetirementAge,
      nominalReturnRate: baselineInput.nominalReturnRate + returnRateDeltaPct / 100,
      rrspContribution: (baselineInput.rrspContribution ?? 0) + splitContribution,
      tfsaContribution: (baselineInput.tfsaContribution ?? 0) + splitContribution,
    };
  }, [baselineInput, extraMonthlySavings, returnRateDeltaPct, retirementAgeShift, lifeExpectancy]);

  useEffect(() => {
    if (!open || !modifiedInput) return;
    run(modifiedInput);
  }, [open, modifiedInput, run]);

  const whatIfSeries = useMemo<NetWorthPoint[]>(() => {
    if (!Array.isArray(data) || data.length === 0) return [];

    return data
      .map((year) => ({ age: year.age, totalNetWorth: year.totalNetWorth }))
      .sort((a, b) => a.age - b.age);
  }, [data]);

  const chartReady = baselineSeries.length > 0;

  const effectiveRetirementAge = modifiedInput?.retirementAge ?? baselineInput?.retirementAge ?? null;
  // Always compare at the ORIGINAL planned retirement age so the delta accumulates
  // all missed contribution years and early/late drawdown — not just a single year of divergence.
  const baselineRetirementAge = baselineInput?.retirementAge ?? null;

  const deltaAtRetirement = useMemo<number | null>(() => {
    if (!baselineRetirementAge || baselineSeries.length === 0 || whatIfSeries.length === 0) {
      return null;
    }

    const baselineAtRetirement = findNetWorthAtAge(baselineSeries, baselineRetirementAge);
    const whatIfAtRetirement = findNetWorthAtAge(whatIfSeries, baselineRetirementAge);

    if (baselineAtRetirement == null || whatIfAtRetirement == null) return null;
    return whatIfAtRetirement - baselineAtRetirement;
  }, [baselineRetirementAge, baselineSeries, whatIfSeries]);

  const lifeExpectancyMarks = useMemo(() => {
    const defaultEndAge = baselineInput?.endAge ?? 90;
    const unique = Array.from(new Set([75, defaultEndAge, 105])).sort((a, b) => a - b);
    return unique.map((value) => ({ value, label: `${value}` }));
  }, [baselineInput?.endAge]);

  useEffect(() => {
    if (!svgRef.current || !chartReady) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const allPoints = [...baselineSeries, ...whatIfSeries];
    if (allPoints.length === 0) return;

    const ages = allPoints.map((point) => point.age);
    const netWorthValues = allPoints.map((point) => point.totalNetWorth);

    const ageExtent = d3.extent(ages) as [number, number];
    const valueExtent = d3.extent(netWorthValues) as [number, number];

    if (ageExtent[0] == null || ageExtent[1] == null || valueExtent[0] == null || valueExtent[1] == null) {
      return;
    }

    const minAge = ageExtent[0] === ageExtent[1] ? ageExtent[0] - 1 : ageExtent[0];
    const maxAge = ageExtent[0] === ageExtent[1] ? ageExtent[1] + 1 : ageExtent[1];

    const minValue = valueExtent[0];
    const maxValue = valueExtent[1];
    const spread = maxValue - minValue;
    const padding = spread > 0 ? spread * 0.08 : Math.max(Math.abs(maxValue) * 0.08, 1_000);

    const margin = { top: 12, right: 8, bottom: 10, left: 8 };
    const innerWidth = CHART_WIDTH - margin.left - margin.right;
    const innerHeight = CHART_HEIGHT - margin.top - margin.bottom;

    const x = d3.scaleLinear().domain([minAge, maxAge]).range([0, innerWidth]);
    const y = d3
      .scaleLinear()
      .domain([minValue - padding, maxValue + padding])
      .range([innerHeight, 0])
      .nice();

    const line = d3
      .line<NetWorthPoint>()
      .x((point) => x(point.age))
      .y((point) => y(point.totalNetWorth))
      .curve(d3.curveMonotoneX);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    if (baselineSeries.length > 0) {
      g.append('path')
        .datum(baselineSeries)
        .attr('fill', 'none')
        .attr('stroke', theme.palette.grey[500])
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '6,4')
        .attr('d', line);
    }

    if (whatIfSeries.length > 0) {
      g.append('path')
        .datum(whatIfSeries)
        .attr('fill', 'none')
        .attr('stroke', theme.palette.primary.main)
        .attr('stroke-width', 2.5)
        .attr('d', line);
    }

    return () => {
      d3.select(svgRef.current).selectAll('*').interrupt().remove();
    };
  }, [baselineSeries, whatIfSeries, chartReady, theme.palette.grey, theme.palette.primary.main]);

  const slidersDisabled = !baselineInput;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          maxWidth: '95vw',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" fontWeight={600}>What-If Calculator</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close what-if calculator">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1 }}>
        {!baselineInput && (
          <Typography variant="body2" color="text.secondary">
            Set up a scenario first
          </Typography>
        )}

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Extra Monthly Savings
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            +${integerFormatter.format(extraMonthlySavings)}/mo
          </Typography>
          <Slider
            value={extraMonthlySavings}
            onChange={(_, value) => setExtraMonthlySavings(value as number)}
            min={0}
            max={5000}
            step={100}
            marks={[
              { value: 0, label: '$0' },
              { value: 2500, label: '$2.5k' },
              { value: 5000, label: '$5k' },
            ]}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `$${integerFormatter.format(value as number)}`}
            disabled={slidersDisabled}
            aria-label="Extra monthly savings"
          />
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Return Rate Change
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {formatSignedPercent(returnRateDeltaPct)}
          </Typography>
          <Slider
            value={returnRateDeltaPct}
            onChange={(_, value) => setReturnRateDeltaPct(value as number)}
            min={-3}
            max={3}
            step={0.25}
            marks={[
              { value: -3, label: '-3%' },
              { value: 0, label: '0%' },
              { value: 3, label: '+3%' },
            ]}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => formatSignedPercent(value as number)}
            disabled={slidersDisabled}
            aria-label="Return rate change"
          />
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Retirement Age Shift
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {formatSignedYears(retirementAgeShift)}
            {effectiveRetirementAge != null && (
              <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                (retire at age {effectiveRetirementAge})
              </Typography>
            )}
          </Typography>
          <Slider
            value={retirementAgeShift}
            onChange={(_, value) => setRetirementAgeShift(value as number)}
            min={-5}
            max={5}
            step={1}
            marks={[
              { value: -5, label: '-5' },
              { value: 0, label: '0' },
              { value: 5, label: '+5' },
            ]}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => formatSignedYears(value as number)}
            disabled={slidersDisabled}
            aria-label="Retirement age shift"
          />
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Life Expectancy
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Age {lifeExpectancy}
          </Typography>
          <Slider
            value={lifeExpectancy}
            onChange={(_, value) => setLifeExpectancy(value as number)}
            min={75}
            max={105}
            step={1}
            marks={lifeExpectancyMarks}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `Age ${value as number}`}
            disabled={slidersDisabled}
            aria-label="Life expectancy"
          />
        </Box>

        {chartReady && (
          <>
            <Divider />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="subtitle2">
                Net Worth Delta @ Age {baselineRetirementAge}
              </Typography>
              {isRunning && <CircularProgress size={16} />}
            </Box>

            {deltaAtRetirement != null && (
              <Chip
                label={formatSignedCurrency(deltaAtRetirement)}
                color={deltaAtRetirement >= 0 ? 'success' : 'error'}
                size="small"
                sx={{ alignSelf: 'flex-start', mb: 1 }}
              />
            )}

            <Box
              sx={{
                width: CHART_WIDTH,
                maxWidth: '100%',
                mx: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 0.5,
              }}
            >
              <svg ref={svgRef} width={CHART_WIDTH} height={CHART_HEIGHT} />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 20,
                    borderTop: '2px dashed',
                    borderColor: 'grey.500',
                  }}
                />
                <Typography variant="caption" color="text.secondary">Baseline</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 20,
                    borderTop: '2.5px solid',
                    borderColor: 'primary.main',
                  }}
                />
                <Typography variant="caption" color="text.secondary">What-If</Typography>
              </Box>
            </Box>
          </>
        )}

        <Box sx={{ mt: 'auto', pt: 1 }}>
          <Chip label="Exploratory — not saved" variant="outlined" size="small" />
        </Box>
      </Box>
    </Drawer>
  );
}
