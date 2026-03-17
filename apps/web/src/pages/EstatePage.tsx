import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Alert,
  CircularProgress, TextField, MenuItem, Divider, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  LinearProgress, Tooltip,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CalculateIcon from '@mui/icons-material/Calculate';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';

interface EstateResult {
  grossEstate: number;
  rrspTaxOwed: number;
  nonRegCapGainsTax: number;
  otherAssetsTax: number;
  probateFees: number;
  totalTaxAndFees: number;
  netEstateToHeirs: number;
  effectiveTaxRate: number;
  breakdown: Array<{ label: string; grossValue: number; taxOrFee: number; netValue: number }>;
}

const PROVINCES = [
  { value: 'ON', label: 'Ontario' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'AB', label: 'Alberta' },
  { value: 'QC', label: 'Quebec' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'PE', label: 'PEI' },
  { value: 'NL', label: 'Newfoundland' },
];

function fmt(n: number) {
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

const defaultForm = {
  rrspBalance: 500000,
  tfsaBalance: 100000,
  nonRegBalance: 200000,
  nonRegACB: 150000,
  primaryResidenceValue: 800000,
  otherAssetsValue: 50000,
  otherAssetsACB: 30000,
  liabilities: 0,
  marginalTaxRateAtDeath: 0.50,
  capitalGainsTaxRate: 0.245,   // 50% inclusion × 49% marginal
  province: 'ON',
};

export function EstatePage() {
  const { apiFetch } = useApi();
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<EstateResult | null>(null);
  const [err, setErr] = useState('');

  function setField(k: keyof typeof defaultForm, v: string | number) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const calcMutation = useMutation({
    mutationFn: () =>
      apiFetch('/projections/estate', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: (res) => { setResult(res as EstateResult); setErr(''); },
    onError: () => setErr('Calculation failed. Please check your inputs.'),
  });

  const pct = (n: number, total: number) =>
    total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%';

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <AccountTreeIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>Estate Planning</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Estimate the tax consequences of your estate at death, including RRSP deemed disposition,
        capital gains on non-registered accounts, and provincial probate fees.
      </Typography>

      <Grid container spacing={3}>
        {/* Inputs */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>Asset Balances</Typography>
              <Grid container spacing={2}>
                {[
                  { key: 'rrspBalance', label: 'RRSP / RRIF Balance' },
                  { key: 'tfsaBalance', label: 'TFSA Balance' },
                  { key: 'nonRegBalance', label: 'Non-Reg Balance (FMV)' },
                  { key: 'nonRegACB', label: 'Non-Reg ACB (cost base)' },
                  { key: 'primaryResidenceValue', label: 'Primary Residence (FMV)' },
                  { key: 'otherAssetsValue', label: 'Other Assets (FMV)' },
                  { key: 'otherAssetsACB', label: 'Other Assets ACB' },
                  { key: 'liabilities', label: 'Total Liabilities' },
                ].map(({ key, label }) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={key}>
                    <TextField
                      label={label}
                      type="number"
                      size="small"
                      fullWidth
                      value={(form as any)[key]}
                      onChange={(e) => setField(key as keyof typeof defaultForm, Number(e.target.value))}
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" mb={2}>Tax Rates</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Marginal Rate at Death"
                    type="number"
                    size="small"
                    fullWidth
                    value={form.marginalTaxRateAtDeath}
                    onChange={(e) => setField('marginalTaxRateAtDeath', Number(e.target.value))}
                    inputProps={{ min: 0, max: 1, step: 0.01 }}
                    helperText="e.g. 0.50 for 50%"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Cap Gains Effective Rate"
                    type="number"
                    size="small"
                    fullWidth
                    value={form.capitalGainsTaxRate}
                    onChange={(e) => setField('capitalGainsTaxRate', Number(e.target.value))}
                    inputProps={{ min: 0, max: 1, step: 0.01 }}
                    helperText="e.g. 0.245 (50% incl × 49%)"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Province"
                    select fullWidth size="small"
                    value={form.province}
                    onChange={(e) => setField('province', e.target.value)}
                  >
                    {PROVINCES.map((p) => (
                      <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              {err && <Alert severity="error" sx={{ mt: 2 }}>{err}</Alert>}

              <Button
                fullWidth variant="contained" sx={{ mt: 2 }}
                startIcon={calcMutation.isPending ? <CircularProgress size={16} /> : <CalculateIcon />}
                disabled={calcMutation.isPending}
                onClick={() => calcMutation.mutate()}
              >
                Calculate Estate
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Results */}
        <Grid size={{ xs: 12, md: 7 }}>
          {!result && (
            <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <AccountTreeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography color="text.secondary">
                  Fill in your asset balances and click Calculate to see estate projections.
                </Typography>
              </CardContent>
            </Card>
          )}

          {result && (
            <>
              {/* Summary cards */}
              <Grid container spacing={2} mb={2}>
                {[
                  { label: 'Gross Estate', value: result.grossEstate, color: 'primary.main' },
                  { label: 'Total Tax & Fees', value: result.totalTaxAndFees, color: 'error.main' },
                  { label: 'Net to Heirs', value: result.netEstateToHeirs, color: 'success.main' },
                ].map(({ label, value, color }) => (
                  <Grid size={{ xs: 12, sm: 4 }} key={label}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="body2" color="text.secondary">{label}</Typography>
                        <Typography variant="h5" fontWeight={700} sx={{ color }}>
                          {fmt(value)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {/* Effective rate */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">
                      Effective estate tax rate: <strong>{(result.effectiveTaxRate * 100).toFixed(1)}%</strong>
                    </Typography>
                    <Chip
                      label={result.effectiveTaxRate < 0.2 ? 'Low' : result.effectiveTaxRate < 0.35 ? 'Moderate' : 'High'}
                      color={result.effectiveTaxRate < 0.2 ? 'success' : result.effectiveTaxRate < 0.35 ? 'warning' : 'error'}
                      size="small"
                    />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(result.effectiveTaxRate * 100, 100)}
                    color={result.effectiveTaxRate < 0.2 ? 'success' : result.effectiveTaxRate < 0.35 ? 'warning' : 'error'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </CardContent>
              </Card>

              {/* Breakdown table */}
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Typography variant="h6">Asset Breakdown</Typography>
                    <Tooltip title="Primary residence is exempt from capital gains via the Principal Residence Exemption. TFSA passes tax-free.">
                      <InfoOutlinedIcon fontSize="small" color="action" />
                    </Tooltip>
                  </Box>
                  <TableContainer component={Paper} elevation={0}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Asset</strong></TableCell>
                          <TableCell align="right"><strong>Gross Value</strong></TableCell>
                          <TableCell align="right"><strong>Tax / Fee</strong></TableCell>
                          <TableCell align="right"><strong>Net to Heirs</strong></TableCell>
                          <TableCell align="right"><strong>% of Total Tax</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.breakdown.filter(b => b.grossValue !== 0 || b.taxOrFee !== 0).map((b) => (
                          <TableRow key={b.label} hover>
                            <TableCell>{b.label}</TableCell>
                            <TableCell align="right">{b.grossValue !== 0 ? fmt(b.grossValue) : '—'}</TableCell>
                            <TableCell align="right" sx={{ color: b.taxOrFee > 0 ? 'error.main' : 'text.primary' }}>
                              {b.taxOrFee > 0 ? `-${fmt(b.taxOrFee)}` : '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ color: b.netValue < 0 ? 'error.main' : 'text.primary' }}>
                              {fmt(b.netValue)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'text.secondary' }}>
                              {b.taxOrFee > 0 ? pct(b.taxOrFee, result.totalTaxAndFees) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                          <TableCell><strong>Total</strong></TableCell>
                          <TableCell align="right"><strong>{fmt(result.grossEstate)}</strong></TableCell>
                          <TableCell align="right" sx={{ color: 'error.main' }}>
                            <strong>-{fmt(result.totalTaxAndFees)}</strong>
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>
                            <strong>{fmt(result.netEstateToHeirs)}</strong>
                          </TableCell>
                          <TableCell align="right"><strong>100%</strong></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
