import { useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Alert,
  CircularProgress, TextField, MenuItem, Divider, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  LinearProgress, Tooltip, Tabs, Tab, Accordion, AccordionSummary,
  AccordionDetails, FormControlLabel, Switch, Stack,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CalculateIcon from '@mui/icons-material/Calculate';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FavoriteIcon from '@mui/icons-material/Favorite';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import SecurityIcon from '@mui/icons-material/Security';
import HomeIcon from '@mui/icons-material/Home';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import {
  calculateSpouseTrust,
  calculateCharitableGiving,
  calculateLifeInsurance,
  calculatePRNomination,
} from '@retiree-plan/finance-engine';
import type {
  SpouseTrustResult,
  CharitableGivingResult,
  LifeInsuranceResult,
  PRNominationResult,
} from '@retiree-plan/finance-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

// ─── Default forms ────────────────────────────────────────────────────────────

const defaultEstateForm = {
  rrspBalance: 500000,
  tfsaBalance: 100000,
  nonRegBalance: 200000,
  nonRegACB: 150000,
  primaryResidenceValue: 800000,
  otherAssetsValue: 50000,
  otherAssetsACB: 30000,
  liabilities: 0,
  marginalTaxRateAtDeath: 0.50,
  capitalGainsTaxRate: 0.245,
  province: 'ON',
};

const defaultSpouseTrustForm = {
  rrspBalance: 500000,
  marginalTaxRateAtDeath: 0.50,
  survivorMarginalRate: 0.43,
  deferralYears: 15,
  rrspGrowthRate: 0.05,
};

const defaultCharitableForm = {
  donationAmount: 20000,
  province: 'ON',
  isDaf: false,
  dafGrantYears: 5,
};

const defaultInsuranceForm = {
  rrspBalance: 500000,
  marginalTaxRateAtDeath: 0.50,
  numberOfHeirs: 2,
  currentAge: 60,
  isSmoker: false,
};

const defaultPRForm = {
  propertyAValue: 900000,
  propertyAPurchasePrice: 350000,
  propertyAYearsOwned: 20,
  propertyBValue: 450000,
  propertyBPurchasePrice: 200000,
  propertyBYearsOwned: 10,
  capitalGainsTaxRate: 0.245,
};

// ─── Result stat card helper ──────────────────────────────────────────────────

function StatCard({ label, value, color = 'text.primary', sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
        <Typography variant="h6" fontWeight={700} sx={{ color }}>{value}</Typography>
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function EstatePage() {
  const { apiFetch } = useApi();
  const [activeTab, setActiveTab] = useState(0);

  // ── Estate Calculator state ────────────────────────────────────────────────
  const [estateForm, setEstateForm] = useState(defaultEstateForm);
  const [estateResult, setEstateResult] = useState<EstateResult | null>(null);
  const [estateErr, setEstateErr] = useState('');

  function setEstateField(k: keyof typeof defaultEstateForm, v: string | number) {
    setEstateForm((f) => ({ ...f, [k]: v }));
  }

  const calcMutation = useMutation({
    mutationFn: () =>
      apiFetch('/projections/estate', { method: 'POST', body: JSON.stringify(estateForm) }),
    onSuccess: (res) => { setEstateResult(res as EstateResult); setEstateErr(''); },
    onError: () => setEstateErr('Calculation failed. Please check your inputs.'),
  });

  const pct = (n: number, total: number) =>
    total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%';

  // ── Legacy Strategies state ────────────────────────────────────────────────
  const [spouseTrustForm, setSpouseTrustForm] = useState(defaultSpouseTrustForm);
  const [charitableForm, setCharitableForm] = useState(defaultCharitableForm);
  const [insuranceForm, setInsuranceForm] = useState(defaultInsuranceForm);
  const [prForm, setPRForm] = useState(defaultPRForm);

  // Computed live (client-side, instant feedback)
  const spouseTrustResult = useMemo<SpouseTrustResult>(
    () => calculateSpouseTrust(spouseTrustForm),
    [spouseTrustForm],
  );
  const charitableResult = useMemo<CharitableGivingResult>(
    () => calculateCharitableGiving(charitableForm),
    [charitableForm],
  );
  const insuranceResult = useMemo<LifeInsuranceResult>(
    () => calculateLifeInsurance(insuranceForm),
    [insuranceForm],
  );
  const prResult = useMemo<PRNominationResult>(
    () => calculatePRNomination(prForm),
    [prForm],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <AccountTreeIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>Estate Planning</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" mb={2}>
        Understand the tax impact of your estate and model proactive strategies to protect your legacy.
      </Typography>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab label="Estate Calculator" />
        <Tab label="Legacy Strategies" />
      </Tabs>

      {/* ════════════════════ TAB 0: Estate Calculator ════════════════════ */}
      {activeTab === 0 && (
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
                        value={(estateForm as Record<string, unknown>)[key] as number}
                        onChange={(e) =>
                          setEstateField(key as keyof typeof defaultEstateForm, Number(e.target.value))
                        }
                        slotProps={{ htmlInput: { min: 0 } }}
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
                      value={estateForm.marginalTaxRateAtDeath}
                      onChange={(e) => setEstateField('marginalTaxRateAtDeath', Number(e.target.value))}
                      slotProps={{ htmlInput: { min: 0, max: 1, step: 0.01 } }}
                      helperText="e.g. 0.50 for 50%"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Cap Gains Effective Rate"
                      type="number"
                      size="small"
                      fullWidth
                      value={estateForm.capitalGainsTaxRate}
                      onChange={(e) => setEstateField('capitalGainsTaxRate', Number(e.target.value))}
                      slotProps={{ htmlInput: { min: 0, max: 1, step: 0.01 } }}
                      helperText="e.g. 0.245 (50% incl × 49%)"
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Province"
                      select fullWidth size="small"
                      value={estateForm.province}
                      onChange={(e) => setEstateField('province', e.target.value)}
                    >
                      {PROVINCES.map((p) => (
                        <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </Grid>

                {estateErr && <Alert severity="error" sx={{ mt: 2 }}>{estateErr}</Alert>}

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
            {!estateResult && (
              <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <AccountTreeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography color="text.secondary">
                    Fill in your asset balances and click Calculate to see estate projections.
                  </Typography>
                </CardContent>
              </Card>
            )}

            {estateResult && (
              <>
                <Grid container spacing={2} mb={2}>
                  {[
                    { label: 'Gross Estate', value: estateResult.grossEstate, color: 'primary.main' },
                    { label: 'Total Tax & Fees', value: estateResult.totalTaxAndFees, color: 'error.main' },
                    { label: 'Net to Heirs', value: estateResult.netEstateToHeirs, color: 'success.main' },
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

                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">
                        Effective estate tax rate:{' '}
                        <strong>{(estateResult.effectiveTaxRate * 100).toFixed(1)}%</strong>
                      </Typography>
                      <Chip
                        label={
                          estateResult.effectiveTaxRate < 0.2
                            ? 'Low'
                            : estateResult.effectiveTaxRate < 0.35
                            ? 'Moderate'
                            : 'High'
                        }
                        color={
                          estateResult.effectiveTaxRate < 0.2
                            ? 'success'
                            : estateResult.effectiveTaxRate < 0.35
                            ? 'warning'
                            : 'error'
                        }
                        size="small"
                      />
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(estateResult.effectiveTaxRate * 100, 100)}
                      color={
                        estateResult.effectiveTaxRate < 0.2
                          ? 'success'
                          : estateResult.effectiveTaxRate < 0.35
                          ? 'warning'
                          : 'error'
                      }
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </CardContent>
                </Card>

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
                            <TableCell align="right"><strong>% of Tax</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {estateResult.breakdown
                            .filter((b) => b.grossValue !== 0 || b.taxOrFee !== 0)
                            .map((b) => (
                              <TableRow key={b.label} hover>
                                <TableCell>{b.label}</TableCell>
                                <TableCell align="right">
                                  {b.grossValue !== 0 ? fmt(b.grossValue) : '—'}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ color: b.taxOrFee > 0 ? 'error.main' : 'text.primary' }}
                                >
                                  {b.taxOrFee > 0 ? `-${fmt(b.taxOrFee)}` : '—'}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ color: b.netValue < 0 ? 'error.main' : 'text.primary' }}
                                >
                                  {fmt(b.netValue)}
                                </TableCell>
                                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                                  {b.taxOrFee > 0
                                    ? pct(b.taxOrFee, estateResult.totalTaxAndFees)
                                    : '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell><strong>Total</strong></TableCell>
                            <TableCell align="right">
                              <strong>{fmt(estateResult.grossEstate)}</strong>
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>
                              <strong>-{fmt(estateResult.totalTaxAndFees)}</strong>
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'success.main' }}>
                              <strong>{fmt(estateResult.netEstateToHeirs)}</strong>
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
      )}

      {/* ═══════════════════ TAB 1: Legacy Strategies ═════════════════════ */}
      {activeTab === 1 && (
        <Box>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Model proactive strategies to protect your estate, reduce taxes, and ensure equal
            inheritances. Results update instantly as you adjust the inputs.
          </Typography>

          {/* ── 1. Spousal RRSP Rollover & Testamentary Trust ── */}
          <Accordion defaultExpanded data-testid="accordion-spouse-trust">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                <FavoriteIcon color="error" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={600}>
                  1. Spousal RRSP Rollover & Testamentary Trust
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 2 }}>
                When the first spouse dies, their RRSP can roll over to the surviving spouse
                tax-free — deferring what would otherwise be a large tax bill. The RRSP
                continues to compound until the survivor dies.
              </Alert>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Typography variant="subtitle2" mb={1}>Inputs</Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="RRSP / RRIF Balance at First Death"
                      type="number"
                      size="small"
                      fullWidth
                      value={spouseTrustForm.rrspBalance}
                      onChange={(e) =>
                        setSpouseTrustForm((f) => ({ ...f, rrspBalance: Number(e.target.value) }))
                      }
                      slotProps={{ htmlInput: { min: 0 } }}
                    />
                    <TextField
                      label="First-to-Die Marginal Rate"
                      type="number"
                      size="small"
                      fullWidth
                      value={spouseTrustForm.marginalTaxRateAtDeath}
                      onChange={(e) =>
                        setSpouseTrustForm((f) => ({
                          ...f,
                          marginalTaxRateAtDeath: Number(e.target.value),
                        }))
                      }
                      slotProps={{ htmlInput: { min: 0, max: 1, step: 0.01 } }}
                      helperText="e.g. 0.50 for 50%"
                    />
                    <TextField
                      label="Surviving Spouse's Marginal Rate"
                      type="number"
                      size="small"
                      fullWidth
                      value={spouseTrustForm.survivorMarginalRate}
                      onChange={(e) =>
                        setSpouseTrustForm((f) => ({
                          ...f,
                          survivorMarginalRate: Number(e.target.value),
                        }))
                      }
                      slotProps={{ htmlInput: { min: 0, max: 1, step: 0.01 } }}
                      helperText="Rate at which RRSP will ultimately be taxed"
                    />
                    <TextField
                      label="Deferral Years (to Survivor's Death)"
                      type="number"
                      size="small"
                      fullWidth
                      value={spouseTrustForm.deferralYears}
                      onChange={(e) =>
                        setSpouseTrustForm((f) => ({
                          ...f,
                          deferralYears: Number(e.target.value),
                        }))
                      }
                      slotProps={{ htmlInput: { min: 1, max: 40 } }}
                    />
                    <TextField
                      label="RRSP Annual Growth Rate"
                      type="number"
                      size="small"
                      fullWidth
                      value={spouseTrustForm.rrspGrowthRate}
                      onChange={(e) =>
                        setSpouseTrustForm((f) => ({
                          ...f,
                          rrspGrowthRate: Number(e.target.value),
                        }))
                      }
                      slotProps={{ htmlInput: { min: 0, max: 0.2, step: 0.01 } }}
                      helperText="e.g. 0.05 for 5%"
                    />
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 7 }}>
                  <Typography variant="subtitle2" mb={1}>Results</Typography>
                  <Grid container spacing={2} mb={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Tax Avoided at First Death"
                        value={fmt(spouseTrustResult.taxDeferredAtFirstDeath)}
                        color="success.main"
                        sub="Tax deferred by spousal rollover"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="RRSP at Survivor's Death"
                        value={fmt(spouseTrustResult.rrspValueAtSurvivorDeath)}
                        color="primary.main"
                        sub={`After ${spouseTrustForm.deferralYears} yrs @ ${fmtPct(spouseTrustForm.rrspGrowthRate)}`}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Eventual Tax at Survivor's Death"
                        value={fmt(spouseTrustResult.eventualTaxAtSurvivorDeath)}
                        color="warning.main"
                        sub="Taxed at survivor's marginal rate"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Net Benefit to Heirs"
                        value={fmt(spouseTrustResult.netBenefitVsNoRollover)}
                        color={
                          spouseTrustResult.netBenefitVsNoRollover >= 0
                            ? 'success.main'
                            : 'error.main'
                        }
                        sub="vs. immediate full taxation"
                      />
                    </Grid>
                  </Grid>
                  <Alert
                    severity={
                      spouseTrustResult.netBenefitVsNoRollover >= 0 ? 'success' : 'warning'
                    }
                  >
                    {spouseTrustResult.explanation}
                  </Alert>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* ── 2. Charitable Giving ── */}
          <Accordion data-testid="accordion-charitable">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                <VolunteerActivismIcon color="secondary" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={600}>
                  2. Charitable Giving & Donor-Advised Fund (DAF)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 2 }}>
                Canadian donation tax credits are among the most generous available — up to
                ~46% combined federal + Ontario credit on amounts over $200. A Donor-Advised
                Fund lets you claim the full credit today and direct grants to charities over
                multiple years.
              </Alert>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Typography variant="subtitle2" mb={1}>Inputs</Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="Donation Amount"
                      type="number"
                      size="small"
                      fullWidth
                      value={charitableForm.donationAmount}
                      onChange={(e) =>
                        setCharitableForm((f) => ({
                          ...f,
                          donationAmount: Number(e.target.value),
                        }))
                      }
                      slotProps={{ htmlInput: { min: 0 } }}
                    />
                    <TextField
                      label="Province"
                      select fullWidth size="small"
                      value={charitableForm.province}
                      onChange={(e) =>
                        setCharitableForm((f) => ({ ...f, province: e.target.value }))
                      }
                    >
                      {PROVINCES.map((p) => (
                        <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                      ))}
                    </TextField>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={charitableForm.isDaf}
                          onChange={(e) =>
                            setCharitableForm((f) => ({ ...f, isDaf: e.target.checked }))
                          }
                        />
                      }
                      label="Model as Donor-Advised Fund (DAF)"
                    />
                    {charitableForm.isDaf && (
                      <TextField
                        label="DAF Grant Years"
                        type="number"
                        size="small"
                        fullWidth
                        value={charitableForm.dafGrantYears}
                        onChange={(e) =>
                          setCharitableForm((f) => ({
                            ...f,
                            dafGrantYears: Number(e.target.value),
                          }))
                        }
                        slotProps={{ htmlInput: { min: 1, max: 30 } }}
                        helperText="Years over which to distribute grants"
                      />
                    )}
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 7 }}>
                  <Typography variant="subtitle2" mb={1}>Results</Typography>
                  <Grid container spacing={2} mb={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Federal Tax Credit"
                        value={fmt(charitableResult.federalCredit)}
                        color="primary.main"
                        sub="15% on first $200; 29% on remainder"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Provincial Tax Credit"
                        value={fmt(charitableResult.provincialCredit)}
                        color="primary.main"
                        sub={`Provincial credit (${charitableForm.province})`}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Total Credit"
                        value={fmt(charitableResult.totalCredit)}
                        color="success.main"
                        sub={`${fmtPct(charitableResult.effectiveDonationRate)} of donation`}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Net Out-of-Pocket Cost"
                        value={fmt(charitableResult.netCostAfterCredit)}
                        color="warning.main"
                        sub="After applying the tax credit"
                      />
                    </Grid>
                    {charitableResult.dafAnnualGrant != null && (
                      <Grid size={{ xs: 12 }}>
                        <StatCard
                          label="Annual DAF Grant"
                          value={fmt(charitableResult.dafAnnualGrant)}
                          color="secondary.main"
                          sub={`Distributed over ${charitableForm.dafGrantYears} years`}
                        />
                      </Grid>
                    )}
                  </Grid>
                  <Alert severity="success">{charitableResult.explanation}</Alert>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* ── 3. Life Insurance Equalization ── */}
          <Accordion data-testid="accordion-insurance">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                <SecurityIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={600}>
                  3. Life Insurance for Estate Equalization
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 2 }}>
                A large RRSP creates a "tax bomb" at death — the full balance is added to
                income. Life insurance can cover this tax so all heirs receive equal
                inheritances, regardless of which account they inherit.
              </Alert>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Typography variant="subtitle2" mb={1}>Inputs</Typography>
                  <Stack spacing={2}>
                    <TextField
                      label="RRSP / RRIF Balance"
                      type="number"
                      size="small"
                      fullWidth
                      value={insuranceForm.rrspBalance}
                      onChange={(e) =>
                        setInsuranceForm((f) => ({ ...f, rrspBalance: Number(e.target.value) }))
                      }
                      slotProps={{ htmlInput: { min: 0 } }}
                    />
                    <TextField
                      label="Marginal Rate at Death"
                      type="number"
                      size="small"
                      fullWidth
                      value={insuranceForm.marginalTaxRateAtDeath}
                      onChange={(e) =>
                        setInsuranceForm((f) => ({
                          ...f,
                          marginalTaxRateAtDeath: Number(e.target.value),
                        }))
                      }
                      slotProps={{ htmlInput: { min: 0, max: 1, step: 0.01 } }}
                      helperText="e.g. 0.53 for Ontario top bracket"
                    />
                    <TextField
                      label="Number of Heirs"
                      type="number"
                      size="small"
                      fullWidth
                      value={insuranceForm.numberOfHeirs}
                      onChange={(e) =>
                        setInsuranceForm((f) => ({
                          ...f,
                          numberOfHeirs: Number(e.target.value),
                        }))
                      }
                      slotProps={{ htmlInput: { min: 1, max: 20 } }}
                    />
                    <TextField
                      label="Current Age (insured)"
                      type="number"
                      size="small"
                      fullWidth
                      value={insuranceForm.currentAge}
                      onChange={(e) =>
                        setInsuranceForm((f) => ({
                          ...f,
                          currentAge: Number(e.target.value),
                        }))
                      }
                      slotProps={{ htmlInput: { min: 40, max: 80 } }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={insuranceForm.isSmoker}
                          onChange={(e) =>
                            setInsuranceForm((f) => ({ ...f, isSmoker: e.target.checked }))
                          }
                        />
                      }
                      label="Smoker (premiums ~2.5× higher)"
                    />
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 7 }}>
                  <Typography variant="subtitle2" mb={1}>Results</Typography>
                  <Grid container spacing={2} mb={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="RRSP Tax Bomb"
                        value={fmt(insuranceResult.rrspTaxBomb)}
                        color="error.main"
                        sub="Tax triggered by RRSP at death"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Death Benefit Needed"
                        value={fmt(insuranceResult.deathBenefitNeeded)}
                        color="primary.main"
                        sub="Coverage needed to neutralize the tax"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Est. Monthly Premium"
                        value={`$${Math.round(insuranceResult.estimatedMonthlyPremium).toLocaleString()}`}
                        color="warning.main"
                        sub="Term-20, simplified industry rates"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Per-Heir Gain (with insurance)"
                        value={fmt(
                          insuranceResult.inheritancePerHeirWithInsurance -
                            insuranceResult.inheritancePerHeirWithoutInsurance,
                        )}
                        color="success.main"
                        sub="Additional inheritance per heir"
                      />
                    </Grid>
                  </Grid>
                  <Alert severity="warning">{insuranceResult.explanation}</Alert>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* ── 4. Principal Residence Nomination ── */}
          <Accordion data-testid="accordion-pr-nomination">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center" gap={1}>
                <HomeIcon color="success" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={600}>
                  4. Principal Residence Nomination Optimizer
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ mb: 2 }}>
                If your household owns two properties (e.g. a primary home and a cottage),
                you can designate each calendar year to one property for the Principal Residence
                Exemption (PRE). The "+1" rule means you only need N−1 designations to fully
                exempt a property owned for N years — freeing up designations for the other.
              </Alert>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Typography variant="subtitle2" mb={1}>Property A — Primary Home</Typography>
                  <Stack spacing={2} mb={2}>
                    <TextField
                      label="Current Market Value"
                      type="number"
                      size="small"
                      fullWidth
                      value={prForm.propertyAValue}
                      onChange={(e) =>
                        setPRForm((f) => ({ ...f, propertyAValue: Number(e.target.value) }))
                      }
                      slotProps={{ htmlInput: { min: 0 } }}
                    />
                    <TextField
                      label="Original Purchase Price"
                      type="number"
                      size="small"
                      fullWidth
                      value={prForm.propertyAPurchasePrice}
                      onChange={(e) =>
                        setPRForm((f) => ({
                          ...f,
                          propertyAPurchasePrice: Number(e.target.value),
                        }))
                      }
                      slotProps={{ htmlInput: { min: 0 } }}
                    />
                    <TextField
                      label="Years Owned"
                      type="number"
                      size="small"
                      fullWidth
                      value={prForm.propertyAYearsOwned}
                      onChange={(e) =>
                        setPRForm((f) => ({
                          ...f,
                          propertyAYearsOwned: Number(e.target.value),
                        }))
                      }
                      slotProps={{ htmlInput: { min: 1, max: 50 } }}
                    />
                  </Stack>
                  <Typography variant="subtitle2" mb={1}>Property B — Cottage / Vacation</Typography>
                  <Stack spacing={2} mb={2}>
                    <TextField
                      label="Current Market Value"
                      type="number"
                      size="small"
                      fullWidth
                      value={prForm.propertyBValue}
                      onChange={(e) =>
                        setPRForm((f) => ({ ...f, propertyBValue: Number(e.target.value) }))
                      }
                      slotProps={{ htmlInput: { min: 0 } }}
                    />
                    <TextField
                      label="Original Purchase Price"
                      type="number"
                      size="small"
                      fullWidth
                      value={prForm.propertyBPurchasePrice}
                      onChange={(e) =>
                        setPRForm((f) => ({
                          ...f,
                          propertyBPurchasePrice: Number(e.target.value),
                        }))
                      }
                      slotProps={{ htmlInput: { min: 0 } }}
                    />
                    <TextField
                      label="Years Owned"
                      type="number"
                      size="small"
                      fullWidth
                      value={prForm.propertyBYearsOwned}
                      onChange={(e) =>
                        setPRForm((f) => ({
                          ...f,
                          propertyBYearsOwned: Number(e.target.value),
                        }))
                      }
                      slotProps={{ htmlInput: { min: 1, max: 50 } }}
                    />
                  </Stack>
                  <TextField
                    label="Cap Gains Effective Rate"
                    type="number"
                    size="small"
                    fullWidth
                    value={prForm.capitalGainsTaxRate}
                    onChange={(e) =>
                      setPRForm((f) => ({
                        ...f,
                        capitalGainsTaxRate: Number(e.target.value),
                      }))
                    }
                    slotProps={{ htmlInput: { min: 0, max: 1, step: 0.01 } }}
                    helperText="50% inclusion × marginal rate, e.g. 0.245"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 7 }}>
                  <Typography variant="subtitle2" mb={1}>Optimal Strategy</Typography>
                  <Grid container spacing={2} mb={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Primary Home Gain"
                        value={fmt(prResult.propertyAGain)}
                        sub={`${fmt(prResult.propertyAGainPerYear)}/yr gain rate`}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Cottage Gain"
                        value={fmt(prResult.propertyBGain)}
                        sub={`${fmt(prResult.propertyBGainPerYear)}/yr gain rate`}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Designate to Primary Home"
                        value={`${prResult.optimalYearsDesignatedA} yr${prResult.optimalYearsDesignatedA !== 1 ? 's' : ''}`}
                        color="primary.main"
                        sub={`Taxable gain: ${fmt(prResult.optimalTaxableGainA)}`}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <StatCard
                        label="Designate to Cottage"
                        value={`${prResult.optimalYearsDesignatedB} yr${prResult.optimalYearsDesignatedB !== 1 ? 's' : ''}`}
                        color="secondary.main"
                        sub={`Taxable gain: ${fmt(prResult.optimalTaxableGainB)}`}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                      <StatCard
                        label="Optimal Tax"
                        value={fmt(prResult.optimalTotalTax)}
                        color="success.main"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                      <StatCard
                        label="Worst-Case Tax"
                        value={fmt(prResult.worstCaseTotalTax)}
                        color="error.main"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 12, md: 4 }}>
                      <StatCard
                        label="Tax Savings"
                        value={fmt(prResult.taxSavings)}
                        color="success.main"
                        sub="By using optimal designation"
                      />
                    </Grid>
                  </Grid>
                  <Alert severity={prResult.taxSavings > 100 ? 'success' : 'info'}>
                    {prResult.explanation}
                  </Alert>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
    </Box>
  );
}

