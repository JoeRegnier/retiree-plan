/**
 * Spousal RRSP Calculator
 *
 * Form-based tool that analyses whether a spousal RRSP contribution is
 * beneficial and flags CRA attribution rule risk.
 */

import { useState } from 'react';
import {
  Box, Button, Card, CardContent, Typography, TextField, Grid,
  Alert, Divider, Chip, CircularProgress, MenuItem, Select,
  FormControl, InputLabel, InputAdornment,
} from '@mui/material';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useApi } from '../hooks/useApi';

const PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'PEI' },
  { code: 'QC', name: 'Québec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

interface SpousalResult {
  contributorTaxSaved: number;
  annuitantTaxOwed: number;
  netAnnualSaving: number;
  attributionRisk: boolean;
  attributionRate: number;
  safeLiftYear: number;
  recommendContribution: boolean;
  explanation: string;
}

const CURRENT_YEAR = new Date().getFullYear();

const fmt = (n: number) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function SpousalRrspCalculator() {
  const { apiFetch } = useApi();
  const [result, setResult] = useState<SpousalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    contributorIncome: 120_000,
    annuitantIncome: 40_000,
    proposedContribution: 15_000,
    contributorProvince: 'ON',
    annuitantProvince: 'ON',
    lastContributionYear: CURRENT_YEAR,
    plannedWithdrawalYear: CURRENT_YEAR + 5,
    currentYear: CURRENT_YEAR,
  });


  const handleAnalyse = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<SpousalResult>('/optimization/spousal-rrsp', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <FamilyRestroomIcon color="primary" />
          <Box>
            <Typography variant="h6">Spousal RRSP Analyser</Typography>
            <Typography variant="body2" color="text.secondary">
              Estimate the tax benefit and CRA attribution rule risk of contributing to a spousal RRSP.
            </Typography>
          </Box>
        </Box>

        {/* Form */}
        <Grid container spacing={2}>
          {/* Contributor side */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
              Contributor (higher earner)
            </Typography>
            <TextField fullWidth size="small" label="Annual Income"
              type="number" inputProps={{ min: 0, step: 1000 }}
              value={form.contributorIncome}
              onChange={(e) => setForm((f) => ({ ...f, contributorIncome: Number(e.target.value) }))}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              sx={{ mb: 1.5 }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Province</InputLabel>
              <Select label="Province" value={form.contributorProvince}
                onChange={(e) => setForm((f) => ({ ...f, contributorProvince: e.target.value }))}>
                {PROVINCES.map((p) => <MenuItem key={p.code} value={p.code}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          {/* Annuitant side */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" color="secondary" sx={{ mb: 1 }}>
              Annuitant (lower earner / spouse)
            </Typography>
            <TextField fullWidth size="small" label="Annual Income"
              type="number" inputProps={{ min: 0, step: 1000 }}
              value={form.annuitantIncome}
              onChange={(e) => setForm((f) => ({ ...f, annuitantIncome: Number(e.target.value) }))}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              sx={{ mb: 1.5 }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Province</InputLabel>
              <Select label="Province" value={form.annuitantProvince}
                onChange={(e) => setForm((f) => ({ ...f, annuitantProvince: e.target.value }))}>
                {PROVINCES.map((p) => <MenuItem key={p.code} value={p.code}>{p.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          {/* Contribution details */}
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" label="Proposed Contribution"
              type="number" inputProps={{ min: 0, step: 500 }}
              value={form.proposedContribution}
              onChange={(e) => setForm((f) => ({ ...f, proposedContribution: Number(e.target.value) }))}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" label="Last Contribution Year"
              type="number" inputProps={{ min: 2000, max: CURRENT_YEAR }}
              value={form.lastContributionYear}
              onChange={(e) => setForm((f) => ({ ...f, lastContributionYear: Number(e.target.value) }))}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" label="Planned Withdrawal Year"
              type="number" inputProps={{ min: CURRENT_YEAR, max: CURRENT_YEAR + 50 }}
              value={form.plannedWithdrawalYear}
              onChange={(e) => setForm((f) => ({ ...f, plannedWithdrawalYear: Number(e.target.value) }))}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2.5 }}>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <FamilyRestroomIcon />}
            onClick={handleAnalyse}
            disabled={loading}
          >
            Analyse Contribution
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        {/* Results */}
        {result && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />

            {/* Recommendation banner */}
            <Alert
              severity={result.recommendContribution ? 'success' : 'warning'}
              icon={result.recommendContribution
                ? <CheckCircleOutlineIcon fontSize="inherit" />
                : <WarningAmberIcon fontSize="inherit" />}
              sx={{ mb: 2 }}
            >
              <Typography variant="body2">{result.explanation}</Typography>
            </Alert>

            {/* Attribution risk badge */}
            {result.attributionRisk && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={600}>
                  CRA Attribution Rule Risk
                </Typography>
                <Typography variant="body2">
                  Withdrawals before {result.safeLiftYear} will be taxed at the{' '}
                  <strong>contributor's rate ({pct(result.attributionRate)})</strong>,
                  not the annuitant's lower rate. Safe withdrawal year: {result.safeLiftYear}.
                </Typography>
              </Alert>
            )}

            {/* Metrics grid */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Contributor Tax Saved
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {fmt(result.contributorTaxSaved)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    deduction at their marginal rate
                  </Typography>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Annuitant Tax Owed (on withdrawal)
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    {fmt(result.annuitantTaxOwed)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    withdrawal at their lower rate
                  </Typography>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 1.5, bgcolor: result.netAnnualSaving > 0 ? 'success.light' : 'error.light' }}>
                  <Typography variant="caption" color="text.secondary">
                    Net Annual Saving
                  </Typography>
                  <Typography variant="h6" color={result.netAnnualSaving > 0 ? 'success.dark' : 'error.dark'}>
                    {fmt(result.netAnnualSaving)}
                  </Typography>
                  <Chip
                    size="small"
                    label={result.recommendContribution ? 'Recommended' : 'Not Recommended'}
                    color={result.recommendContribution ? 'success' : 'default'}
                    sx={{ mt: 0.5 }}
                  />
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
