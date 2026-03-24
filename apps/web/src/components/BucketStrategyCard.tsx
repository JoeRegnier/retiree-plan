/**
 * Bucket Strategy Card
 *
 * Displays a deterministic 3-bucket projection by calling the API and renders
 * a stacked bar chart showing bucket balances over time.
 */

import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Alert, CircularProgress,
  Grid, Slider, FormControlLabel, Switch, Chip, useTheme,
} from '@mui/material';
import { useApi } from '../hooks/useApi';

interface BucketYear {
  age: number;
  year: number;
  bucket1Balance: number;
  bucket2Balance: number;
  bucket3Balance: number;
  totalBalance: number;
  shortfall: number;
  expenses: number;
}

interface BucketResult {
  years: BucketYear[];
  portfolioDepletionAge: number | null;
  portfolioSurvivesFullPeriod: boolean;
  initialBucket1: number;
  initialBucket2: number;
  initialBucket3: number;
}

interface BucketStrategyCardProps {
  currentAge: number;
  lifeExpectancyAge: number;
  totalPortfolio: number;
  annualExpenses: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

import type { Theme } from '@mui/material';

/** Simple inline SVG stacked bar chart for the 3 buckets. */
function BucketChart({ years, theme }: { years: BucketYear[]; theme: Theme }) {
  const W = 720;
  const H = 260;
  const PAD = { top: 10, right: 10, bottom: 30, left: 60 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxBalance = Math.max(...years.map((y) => y.totalBalance), 1);
  const barW = Math.max(2, innerW / years.length - 1);

  const colors = {
    growth:       theme.palette.primary.main,
    conservative: theme.palette.success.main,
    cash:         theme.palette.warning.main,
  };

  const yTick = (v: number) => `$${(v / 1_000).toFixed(0)}k`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    label: yTick(maxBalance * f),
    y: PAD.top + innerH * (1 - f),
  }));

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
        {/* Y-axis ticks */}
        {yTicks.map((t) => (
          <g key={t.label}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={t.y} y2={t.y} stroke="#eee" />
            <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize={10} fill="#888">{t.label}</text>
          </g>
        ))}

        {/* Stacked bars */}
        {years.map((y, i) => {
          const x = PAD.left + i * (innerW / years.length);
          const scale = innerH / maxBalance;
          const h3 = y.bucket3Balance * scale;
          const h2 = y.bucket2Balance * scale;
          const h1 = y.bucket1Balance * scale;
          const bottom = PAD.top + innerH;
          return (
            <g key={y.age}>
              <rect x={x} y={bottom - h3 - h2 - h1} width={barW} height={h3} fill={colors.growth} opacity={0.8} />
              <rect x={x} y={bottom - h2 - h1} width={barW} height={h2} fill={colors.conservative} opacity={0.8} />
              <rect x={x} y={bottom - h1} width={barW} height={h1} fill={colors.cash} opacity={0.9} />
              {i % Math.ceil(years.length / 10) === 0 && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#888">{y.age}</text>
              )}
            </g>
          );
        })}

        {/* Legend */}
        {[
          { label: 'Growth', color: colors.growth },
          { label: 'Conservative', color: colors.conservative },
          { label: 'Cash Reserve', color: colors.cash },
        ].map((item, i) => (
          <g key={item.label} transform={`translate(${PAD.left + 10 + i * 110}, ${PAD.top + 6})`}>
            <rect width={12} height={12} fill={item.color} rx={2} />
            <text x={16} y={10} fontSize={11} fill={theme.palette.text.secondary}>{item.label}</text>
          </g>
        ))}

        <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={11} fill="#aaa">Age</text>
      </svg>
    </Box>
  );
}

export function BucketStrategyCard({
  currentAge,
  lifeExpectancyAge,
  totalPortfolio,
  annualExpenses,
}: BucketStrategyCardProps) {
  const theme = useTheme();
  const { apiFetch } = useApi();
  const [result, setResult] = useState<BucketResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [annualRefill, setAnnualRefill] = useState(true);
  const [cashYears, setCashYears] = useState(2);
  const [conservativeYears, setConservativeYears] = useState(7);

  useEffect(() => {
    if (!totalPortfolio || !annualExpenses) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<BucketResult>('/optimization/bucket-strategy', {
          method: 'POST',
          body: JSON.stringify({
            currentAge,
            lifeExpectancyAge,
            totalPortfolio,
            annualExpenses,
            inflationRate: 0.02,
            config: {
              cashReserveYears: cashYears,
              conservativeYears,
              refillRule: annualRefill ? 'annual' : 'threshold',
              refillThresholdMonths: 6,
            },
          }),
        });
        if (!cancelled) setResult(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Bucket projection failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAge, lifeExpectancyAge, totalPortfolio, annualExpenses, cashYears, conservativeYears, annualRefill]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>3-Bucket Strategy</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Bucket 1 — Cash Reserve (near-term expenses), Bucket 2 — Conservative bonds/GICs (4% return),
          Bucket 3 — Growth equities (7% return). Buckets refill from right to left.
        </Typography>

        {/* Controls */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="body2" gutterBottom>
              Cash Reserve: <strong>{cashYears} yr</strong>
            </Typography>
            <Slider
              value={cashYears} min={1} max={5} step={1}
              onChange={(_, v) => setCashYears(v as number)}
              marks valueLabelDisplay="auto"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="body2" gutterBottom>
              Conservative: <strong>{conservativeYears} yr</strong>
            </Typography>
            <Slider
              value={conservativeYears} min={3} max={15} step={1}
              onChange={(_, v) => setConservativeYears(v as number)}
              marks valueLabelDisplay="auto"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControlLabel
              control={<Switch checked={annualRefill} onChange={(e) => setAnnualRefill(e.target.checked)} />}
              label={
                <Box>
                  <Typography variant="body2">Annual refill</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {annualRefill ? 'Refill each year' : 'Refill at 6-mo threshold'}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start' }}
            />
          </Grid>
        </Grid>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {result && !loading && (
          <>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip
                label={result.portfolioSurvivesFullPeriod ? 'Portfolio survives full period' : `Depletes at age ${result.portfolioDepletionAge}`}
                color={result.portfolioSurvivesFullPeriod ? 'success' : 'error'}
                size="small"
              />
              <Chip label={`Cash: ${fmt(result.initialBucket1)}`} size="small" color="warning" variant="outlined" />
              <Chip label={`Conservative: ${fmt(result.initialBucket2)}`} size="small" color="success" variant="outlined" />
              <Chip label={`Growth: ${fmt(result.initialBucket3)}`} size="small" color="primary" variant="outlined" />
            </Box>
            <BucketChart years={result.years} theme={theme} />
          </>
        )}

        {!totalPortfolio && (
          <Alert severity="info">
            Run a projection first to populate portfolio data for the bucket strategy model.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

