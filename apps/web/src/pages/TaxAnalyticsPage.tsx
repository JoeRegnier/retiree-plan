import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Grid, TextField, InputAdornment,
  MenuItem, Divider, Chip, Alert, Button, Tooltip,
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import { TaxBracketChart, EffectiveMarginalChart } from '../components/charts/TaxCharts';
import { PROVINCE_NAMES } from '@retiree-plan/shared';
import { useApi } from '../hooks/useApi';

interface IncomeSource { type: string; annualAmount: number; }
interface HouseholdMember { province?: string; incomeSources?: IncomeSource[]; }
interface Household { id: string; members?: HouseholdMember[]; }

// Types excluded from the taxable-income total (non-taxable or modelled separately)
const NON_TAXABLE_TYPES = new Set(['RRSP/RRIF']); // RRSP withdrawals taxable but handled separately

const PROVINCE_OPTIONS = Object.entries(PROVINCE_NAMES).map(([code, name]) => ({ code, name }));

// 2024 Federal brackets
const FEDERAL_BRACKETS = [
  { min: 0, max: 55_867, rate: 0.15, label: '15%' },
  { min: 55_867, max: 111_733, rate: 0.205, label: '20.5%' },
  { min: 111_733, max: 154_906, rate: 0.26, label: '26%' },
  { min: 154_906, max: 220_000, rate: 0.29, label: '29%' },
  { min: 220_000, max: Infinity, rate: 0.33, label: '33%' },
];

// Provincial brackets by province code
const PROV_BRACKETS: Record<string, { min: number; max: number; rate: number; label: string }[]> = {
  ON: [
    { min: 0, max: 51_446, rate: 0.0505, label: '5.05%' },
    { min: 51_446, max: 102_894, rate: 0.0915, label: '9.15%' },
    { min: 102_894, max: 150_000, rate: 0.1116, label: '11.16%' },
    { min: 150_000, max: 220_000, rate: 0.1216, label: '12.16%' },
    { min: 220_000, max: Infinity, rate: 0.1316, label: '13.16%' },
  ],
  BC: [
    { min: 0, max: 47_937, rate: 0.0506, label: '5.06%' },
    { min: 47_937, max: 95_875, rate: 0.077, label: '7.7%' },
    { min: 95_875, max: 110_076, rate: 0.105, label: '10.5%' },
    { min: 110_076, max: 133_664, rate: 0.1229, label: '12.29%' },
    { min: 133_664, max: 181_232, rate: 0.147, label: '14.7%' },
    { min: 181_232, max: 252_752, rate: 0.168, label: '16.8%' },
    { min: 252_752, max: Infinity, rate: 0.205, label: '20.5%' },
  ],
  AB: [
    { min: 0, max: 148_269, rate: 0.1, label: '10%' },
    { min: 148_269, max: 177_922, rate: 0.12, label: '12%' },
    { min: 177_922, max: 237_230, rate: 0.13, label: '13%' },
    { min: 237_230, max: 355_845, rate: 0.14, label: '14%' },
    { min: 355_845, max: Infinity, rate: 0.15, label: '15%' },
  ],
  QC: [
    { min: 0, max: 51_780, rate: 0.14, label: '14%' },
    { min: 51_780, max: 103_545, rate: 0.19, label: '19%' },
    { min: 103_545, max: 126_000, rate: 0.24, label: '24%' },
    { min: 126_000, max: Infinity, rate: 0.2575, label: '25.75%' },
  ],
};

// Basic personal credit amounts
const BASIC_PERSONAL: Record<string, number> = {
  ON: 11_865, BC: 12_580, AB: 21_003, QC: 17_183,
};

function calcFederalTax(income: number): number {
  let tax = 0;
  for (const b of FEDERAL_BRACKETS) {
    if (income <= b.min) break;
    tax += (Math.min(income, b.max === Infinity ? income : b.max) - b.min) * b.rate;
  }
  return Math.max(0, tax - 15_705 * 0.15);
}

function calcProvTax(income: number, province: string): number {
  const brackets = PROV_BRACKETS[province] ?? PROV_BRACKETS.ON;
  const bp = BASIC_PERSONAL[province] ?? BASIC_PERSONAL.ON;
  let tax = 0;
  for (const b of brackets) {
    if (income <= b.min) break;
    tax += (Math.min(income, b.max === Infinity ? income : b.max) - b.min) * b.rate;
  }
  const lowestRate = brackets[0]?.rate ?? 0.0505;
  return Math.max(0, tax - bp * lowestRate);
}

const OAS_CLAWBACK_START = 90_997;
const OAS_CLAWBACK_RATE = 0.15;
const OAS_MAX_ANNUAL = 8_618; // approx 2024

export function TaxAnalyticsPage() {
  const { apiFetch } = useApi();
  const [income, setIncome] = useState(100_000);
  const [province, setProvince] = useState('ON');
  const [customized, setCustomized] = useState(false);

  const { data: households } = useQuery<Household[]>({
    queryKey: ['households'],
    queryFn: () => apiFetch('/households'),
  });
  const members = households?.[0]?.members ?? [];

  const householdIncome = useMemo(() => {
    if (!members.length) return null;
    const total = members
      .flatMap((m) => m.incomeSources ?? [])
      .filter((s) => !NON_TAXABLE_TYPES.has(s.type))
      .reduce((sum, s) => sum + s.annualAmount, 0);
    return total > 0 ? total : null;
  }, [members]);

  // Use province from the member with the highest total income; fall back to first member
  const householdProvince = useMemo(() => {
    if (!members.length) return null;
    const withIncome = members
      .map((m) => ({
        province: m.province,
        total: (m.incomeSources ?? []).reduce((s, i) => s + i.annualAmount, 0),
      }))
      .filter((m) => m.province);
    if (!withIncome.length) return null;
    withIncome.sort((a, b) => b.total - a.total);
    return withIncome[0].province ?? null;
  }, [members]);

  useEffect(() => {
    if (customized) return;
    if (householdIncome !== null) setIncome(householdIncome);
    if (householdProvince) setProvince(householdProvince);
  }, [householdIncome, householdProvince, customized]);

  const resetToHousehold = () => {
    if (householdIncome !== null) setIncome(householdIncome);
    if (householdProvince) setProvince(householdProvince);
    setCustomized(false);
  };

  const fedTax = useMemo(() => calcFederalTax(income), [income]);
  const provTax = useMemo(() => calcProvTax(income, province), [income, province]);
  const totalTax = fedTax + provTax;
  const effectiveRate = income > 0 ? totalTax / income : 0;

  // Marginal rate at current income
  const fedTaxPlus1 = calcFederalTax(income + 1);
  const provTaxPlus1 = calcProvTax(income + 1, province);
  const marginalRate = (fedTaxPlus1 + provTaxPlus1) - totalTax;

  // OAS clawback
  const oasClawback = income > OAS_CLAWBACK_START
    ? Math.min((income - OAS_CLAWBACK_START) * OAS_CLAWBACK_RATE, OAS_MAX_ANNUAL)
    : 0;

  // Rate curve data points
  const rateCurveData = useMemo(() => {
    const points = [];
    for (let inc = 0; inc <= 300_000; inc += 5000) {
      const ft = calcFederalTax(inc);
      const pt = calcProvTax(inc, province);
      const tt = ft + pt;
      const eff = inc > 0 ? tt / inc : 0;
      const marg = inc > 0
        ? (calcFederalTax(inc + 1) + calcProvTax(inc + 1, province)) - tt
        : 0;
      points.push({ income: inc, effectiveRate: eff, marginalRate: marg });
    }
    return points;
  }, [province]);

  const provBrackets = PROV_BRACKETS[province] ?? PROV_BRACKETS.ON;

  const hasHouseholdDefaults = householdIncome !== null || householdProvince !== null;

  return (
    <Box>
      <Typography variant="h3" sx={{ mb: 1 }}>Tax Analytics</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Canadian federal & provincial tax bracket visualisation, effective vs marginal rates, OAS clawback.
      </Typography>

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">Scenario Inputs</Typography>
              {hasHouseholdDefaults && !customized && (
                <Tooltip title="Income and province are pre-filled from your household profile">
                  <Chip label="From household" size="small" color="info" variant="outlined" />
                </Tooltip>
              )}
              {customized && (
                <Chip label="Customized" size="small" color="warning" variant="outlined" />
              )}
            </Box>
            {customized && hasHouseholdDefaults && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<RestoreIcon />}
                onClick={resetToHousehold}
              >
                Reset to household
              </Button>
            )}
          </Box>
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label="Annual Income"
                type="number"
                fullWidth
                value={income}
                onChange={(e) => { setIncome(Number(e.target.value)); setCustomized(true); }}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                inputProps={{ min: 0, max: 1_000_000, step: 1000 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Province" select fullWidth value={province} onChange={(e) => { setProvince(e.target.value); setCustomized(true); }}>
                {PROVINCE_OPTIONS.map((p) => <MenuItem key={p.code} value={p.code}>{p.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">Effective Rate</Typography>
                  <Chip label={`${(effectiveRate * 100).toFixed(1)}%`} size="small" color="primary" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">Marginal Rate</Typography>
                  <Chip label={`${(marginalRate * 100).toFixed(1)}%`} size="small" />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tax Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">Federal Tax</Typography>
            <Typography variant="h5">${fedTax.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">Provincial Tax</Typography>
            <Typography variant="h5">${provTax.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">Total Tax</Typography>
            <Typography variant="h5">${totalTax.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">After-Tax Income</Typography>
            <Typography variant="h5">${(income - totalTax).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      {oasClawback > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>OAS Clawback:</strong> At income of ${income.toLocaleString()}, your OAS benefit will be reduced by approximately ${oasClawback.toLocaleString('en-CA', { maximumFractionDigits: 0 })}/yr. OAS clawback begins at ${OAS_CLAWBACK_START.toLocaleString()} and applies at 15¢ per dollar above that threshold.
        </Alert>
      )}

      {/* Tax Bracket Visualisation */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Tax Bracket Visualisation</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Federal (purple) and {PROVINCE_NAMES[province as keyof typeof PROVINCE_NAMES]} (teal) brackets. Red line = your income.
          </Typography>
          {!(provBrackets) ? (
            <Alert severity="info">Bracket data for {province} not yet available in the visualiser. Tax calculations are still applied correctly.</Alert>
          ) : (
            <TaxBracketChart income={income} federalBrackets={FEDERAL_BRACKETS} provincialBrackets={provBrackets} height={280} />
          )}
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      {/* Effective vs Marginal Rate Chart */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Effective vs Marginal Rate</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            How tax rates change as income increases for {PROVINCE_NAMES[province as keyof typeof PROVINCE_NAMES]}.
          </Typography>
          <EffectiveMarginalChart data={rateCurveData} currentIncome={income} height={260} />
        </CardContent>
      </Card>

      {/* OAS Clawback Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>OAS Clawback Reference</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">Clawback threshold</Typography>
              <Typography fontWeight={700}>${OAS_CLAWBACK_START.toLocaleString()}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">Clawback rate</Typography>
              <Typography fontWeight={700}>15¢ per $1 above threshold</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Typography variant="body2" color="text.secondary">Full clawback at</Typography>
              <Typography fontWeight={700}>~${(OAS_CLAWBACK_START + OAS_MAX_ANNUAL / OAS_CLAWBACK_RATE).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</Typography>
            </Grid>
          </Grid>
          {income > OAS_CLAWBACK_START && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              At your income of ${income.toLocaleString()}, estimated OAS repayment: <strong>${oasClawback.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</strong>
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
