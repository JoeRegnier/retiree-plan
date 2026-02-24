/**
 * InternationalPage.tsx
 *
 * Retirement planning tools for cross-border and expat situations:
 *   Tab 0 — Canada-US Cross-Border
 *   Tab 1 — Worldwide / Expat
 */

import { useState, useMemo } from 'react';
import {
  Box, Typography, Tabs, Tab, Card, CardContent, Grid, TextField,
  InputAdornment, Alert, AlertTitle, Chip, Divider, MenuItem,
  Table, TableBody, TableCell, TableHead, TableRow, Paper,
  Accordion, AccordionSummary, AccordionDetails, Switch, FormControlLabel,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PublicIcon from '@mui/icons-material/Public';
import FlagIcon from '@mui/icons-material/Flag';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import {
  CA_US_WITHHOLDING,
  calcRrspTreatyWithdrawal,
  calcTotalization,
  checkPficExposure,
  calcUsEstateTax,
  calcDepartureTax,
  checkT1135,
  analyzeRrspNonResident,
  analyzeQrops,
  analyzeRepatriation,
  TREATY_WITHHOLDING_RATES,
} from '@retiree-plan/finance-engine';

// ── Helpers ───────────────────────────────────────────────────────────────

const fmt = (n: number, currency = 'CAD') =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ── Tab Panel ─────────────────────────────────────────────────────────────

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}
// ── Types ───────────────────────────────────────────────────────────────────
type TreatyInfo = { country: string; pension: number; dividends: number; interest: number };
const TREATY_ENTRIES = Object.entries(TREATY_WITHHOLDING_RATES) as [string, TreatyInfo][];
// ── Canada-US Tab ─────────────────────────────────────────────────────────

function CaUsTab() {
  // RRSP Treaty
  const [rrspBalance, setRrspBalance] = useState(500_000);
  const [usdCadRate, setUsdCadRate] = useState(0.74);
  const [usMarginalRate, setUsMarginalRate] = useState(0.24);
  const [rrspWithdrawal, setRrspWithdrawal] = useState(40_000);

  const rrspResult = useMemo(
    () => calcRrspTreatyWithdrawal({ balance: rrspBalance, usdCadRate, usMarginalRate, annualWithdrawal: rrspWithdrawal }),
    [rrspBalance, usdCadRate, usMarginalRate, rrspWithdrawal],
  );

  // Totalization
  const [cppYears, setCppYears] = useState(25);
  const [cppEarnings, setCppEarnings] = useState(60_000);
  const [ssCredits, setSsCredits] = useState(15);
  const [ssEarnings, setSsEarnings] = useState(50_000);

  const totResult = useMemo(
    () => calcTotalization({ cppContributionYears: cppYears, cppAverageEarnings: cppEarnings, ssCredits, ssAverageEarnings: ssEarnings, usdCadRate }),
    [cppYears, cppEarnings, ssCredits, ssEarnings, usdCadRate],
  );

  // US Estate Tax
  const [usSitusAssets, setUsSitusAssets] = useState(200_000);
  const [isUsDomiciliary, setIsUsDomiciliary] = useState(false);

  const estateResult = useMemo(
    () => calcUsEstateTax({ usSitusAssetsUsd: usSitusAssets, usdCadRate, isUsDomiciliary }),
    [usSitusAssets, usdCadRate, isUsDomiciliary],
  );

  // PFIC
  const [isUSPerson, setIsUSPerson] = useState(false);

  const pficResult = useMemo(
    () => checkPficExposure(
      [
        { name: 'Canadian Equity ETF', type: 'ETF', valueCad: 150_000 },
        { name: 'Canadian Bond Mutual Fund', type: 'MutualFund', valueCad: 100_000 },
        { name: 'Bank Stocks', type: 'Stock', valueCad: 80_000 },
        { name: 'GIC', type: 'GIC', valueCad: 50_000 },
      ],
      isUSPerson,
    ),
    [isUSPerson],
  );

  return (
    <Grid container spacing={3}>
      {/* Exchange Rate */}
      <Grid item xs={12}>
        <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 1 }}>
          <AlertTitle>USD/CAD Rate</AlertTitle>
          All calculations below use the exchange rate you set here.
          <TextField
            size="small"
            label="USD/CAD Rate"
            type="number"
            value={usdCadRate}
            onChange={e => setUsdCadRate(Number(e.target.value))}
            inputProps={{ step: 0.01, min: 0.5, max: 2 }}
            sx={{ ml: 2, width: 140, verticalAlign: 'middle' }}
          />
        </Alert>
      </Grid>

      {/* Withholding Rate Reference */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Canada-US Treaty Withholding Rates</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Payment Type</TableCell>
                  <TableCell align="right">Rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[
                  ['RRSP/RRIF — Periodic Pension', CA_US_WITHHOLDING.rrspRrifPension],
                  ['RRSP/RRIF — Lump Sum', CA_US_WITHHOLDING.rrspRrifLumpSum],
                  ['CPP/QPP to US Resident', CA_US_WITHHOLDING.cppToUsResident],
                  ['OAS to US Resident', CA_US_WITHHOLDING.oasToUsResident],
                  ['Canadian Dividends (Portfolio)', CA_US_WITHHOLDING.dividendPortfolio],
                  ['Canadian Dividends (Eligible)', CA_US_WITHHOLDING.dividendEligible],
                  ['Canadian Interest', CA_US_WITHHOLDING.interest],
                  ['TFSA Distributions', CA_US_WITHHOLDING.tfsaDistribution],
                ].map(([label, rate]) => (
                  <TableRow key={label as string}>
                    <TableCell>{label as string}</TableCell>
                    <TableCell align="right">
                      <Chip label={pct(rate as number)} size="small" color={(rate as number) > 0.2 ? 'warning' : 'default'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Grid>

      {/* RRSP Treaty Calculator */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>RRSP/RRIF Treaty Withdrawal Calculator</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Estimate after-tax RRSP/RRIF withdrawals for a US resident (Article XVIII(7) treaty election).
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="RRSP/RRIF Balance (CAD)" type="number"
                  value={rrspBalance} onChange={e => setRrspBalance(Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Annual Withdrawal (CAD)" type="number"
                  value={rrspWithdrawal} onChange={e => setRrspWithdrawal(Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="US Marginal Tax Rate" type="number"
                  value={usMarginalRate} onChange={e => setUsMarginalRate(Number(e.target.value))}
                  inputProps={{ step: 0.01, min: 0, max: 1 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={1}>
              {[
                ['Withholding at Source', fmt(rrspResult.withheldAtSource)],
                ['Net Received (CAD)', fmt(rrspResult.netWithdrawalCad)],
                ['Additional US Tax', fmt(rrspResult.additionalUsaTax, 'USD')],
                ['Net After-Tax (USD)', fmt(rrspResult.netWithdrawalUsd, 'USD')],
              ].map(([label, val]) => (
                <Grid item xs={6} key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="subtitle2">{val}</Typography>
                </Grid>
              ))}
            </Grid>
            {rrspResult.notes.map((n: string, i: number) => (
              <Alert key={i} severity="info" icon={<InfoOutlinedIcon fontSize="small" />} sx={{ mt: 1, py: 0 }}>
                <Typography variant="caption">{n}</Typography>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </Grid>

      {/* SS + CPP Totalization */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>CPP + Social Security Totalization</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Estimate combined retirement income from both countries. WEP reduction applied where applicable.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="CPP Contribution Years" type="number"
                  value={cppYears} onChange={e => setCppYears(Number(e.target.value))} inputProps={{ min: 0, max: 39 }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Avg CPP Earnings (CAD)" type="number"
                  value={cppEarnings} onChange={e => setCppEarnings(Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="SSA Credits (years)" type="number"
                  value={ssCredits} onChange={e => setSsCredits(Number(e.target.value))} inputProps={{ min: 0, max: 40 }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Avg SS Earnings (USD)" type="number"
                  value={ssEarnings} onChange={e => setSsEarnings(Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={1}>
              {[
                ['Est. CPP Annual', fmt(totResult.estimatedCppAnnual)],
                ['Est. SS Annual (USD)', fmt(totResult.estimatedSsAnnual, 'USD')],
                ['WEP Reduction', fmt(totResult.wepReduction, 'USD')],
                ['Net SS After WEP', fmt(totResult.netSsAfterWep, 'USD')],
                ['Combined (CAD)', fmt(totResult.combinedAnnualCad)],
              ].map(([label, val]) => (
                <Grid item xs={6} key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="subtitle2" color={label === 'WEP Reduction' ? 'error' : 'inherit'}>{val}</Typography>
                </Grid>
              ))}
            </Grid>
            {totResult.notes.map((n: string, i: number) => (
              <Alert key={i} severity={n.includes('WEP') ? 'warning' : 'info'} sx={{ mt: 1, py: 0 }}>
                <Typography variant="caption">{n}</Typography>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </Grid>

      {/* US Estate Tax */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>US Estate Tax Exposure</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Non-resident aliens have only a USD $60,000 exemption from US estate tax.
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={8}>
                <TextField fullWidth size="small" label="US-Situs Assets (USD)" type="number"
                  value={usSitusAssets} onChange={e => setUsSitusAssets(Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              </Grid>
              <Grid item xs={4}>
                <FormControlLabel
                  control={<Switch checked={isUsDomiciliary} onChange={e => setIsUsDomiciliary(e.target.checked)} />}
                  label="US Domiciliary"
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={1}>
              {[
                ['Exemption', fmt(estateResult.exemptionUsd, 'USD')],
                ['Taxable Estate', fmt(estateResult.taxableEstateUsd, 'USD')],
                ['Est. Estate Tax (USD)', fmt(estateResult.estimatedTaxUsd, 'USD')],
                ['Est. Estate Tax (CAD)', fmt(estateResult.estimatedTaxCad)],
              ].map(([label, val]) => (
                <Grid item xs={6} key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="subtitle2" color={label?.toString().includes('Tax') && estateResult.estimatedTaxUsd > 0 ? 'error' : 'inherit'}>{val}</Typography>
                </Grid>
              ))}
            </Grid>
            {estateResult.notes.map((n: string, i: number) => (
              <Alert key={i} severity={n.includes('only') ? 'warning' : 'info'} sx={{ mt: 1, py: 0 }}>
                <Typography variant="caption">{n}</Typography>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </Grid>

      {/* PFIC Advisory */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">PFIC Exposure Check</Typography>
              <FormControlLabel
                control={<Switch checked={isUSPerson} onChange={e => setIsUSPerson(e.target.checked)} />}
                label="I am a US Person (citizen / green card / substantial presence)"
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Canadian mutual funds and ETFs are typically PFICs — subject to punitive US tax treatment unless QEF/MTM elections are filed.
            </Typography>
            {pficResult.hasExposure ? (
              <Alert severity="error" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
                <AlertTitle>PFIC Exposure Detected</AlertTitle>
                {fmt(pficResult.totalPficExposureCad)} in likely PFIC holdings. Consider restructuring.
              </Alert>
            ) : (
              <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mb: 2 }}>
                {isUSPerson ? 'No PFIC holdings identified in sample portfolio.' : 'PFIC rules do not apply to non-US persons.'}
              </Alert>
            )}
            {pficResult.notes.map((n: string, i: number) => (
              <Alert key={i} severity="warning" sx={{ mb: 1, py: 0 }}>
                <Typography variant="caption">{n}</Typography>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

// ── Worldwide / Expat Tab ────────────────────────────────────────────────

function ExpatTab() {
  // Departure Tax
  const [deptFmv, setDeptFmv] = useState(800_000);
  const [deptAcb, setDeptAcb] = useState(400_000);
  const [deptMarginalRate, setDeptMarginalRate] = useState(0.43);

  const departureResult = useMemo(
    () => calcDepartureTax({ fmvCad: deptFmv, acbCad: deptAcb, marginalRate: deptMarginalRate }),
    [deptFmv, deptAcb, deptMarginalRate],
  );

  // T1135
  const [foreignAssets, setForeignAssets] = useState(120_000);
  const t1135Result = useMemo(() => checkT1135({ totalForeignAssetsCostCad: foreignAssets, isEntity: false }), [foreignAssets]);

  // RRSP Non-Resident
  const [rrspBalance, setRrspBalance] = useState(300_000);
  const [residenceCountry, setResidenceCountry] = useState('PT');
  const [yearsSince, setYearsSince] = useState(3);

  const rrspNrResult = useMemo(() => {
    const treatyRates = TREATY_WITHHOLDING_RATES[residenceCountry.toUpperCase()];
    return analyzeRrspNonResident({
      balance: rrspBalance,
      residenceCountry,
      yearsSinceDeparture: yearsSince,
      treatyWithholdingRate: treatyRates?.pension ?? 0.25,
    });
  }, [rrspBalance, residenceCountry, yearsSince]);

  // QROPS
  const [ukPension, setUkPension] = useState(100_000);
  const [gbpCadRate, setGbpCadRate] = useState(1.70);
  const [withinFiveYears, setWithinFiveYears] = useState(false);

  const qropsResult = useMemo(
    () => analyzeQrops({ ukPensionGbp: ukPension, gbpCadRate, ukResidenceYears: 10, withinFiveYears }),
    [ukPension, gbpCadRate, withinFiveYears],
  );

  // Repatriation
  const [repatAssets, setRepatAssets] = useState(500_000);
  const [repatGains, setRepatGains] = useState(150_000);
  const [repatCountry, setRepatCountry] = useState('PT');
  const [repatMarginalRate, setRepatMarginalRate] = useState(0.43);

  const repatResult = useMemo(
    () => analyzeRepatriation({
      totalForeignAssetsCad: repatAssets,
      unrealizedGainsCad: repatGains,
      fromCountry: repatCountry,
      canadianMarginalRate: repatMarginalRate,
    }),
    [repatAssets, repatGains, repatCountry, repatMarginalRate],
  );

  const countryOptions = TREATY_ENTRIES.filter(([k]) => k !== 'NONE');

  return (
    <Grid container spacing={3}>
      {/* Departure Tax */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Departure Tax Estimator</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              On emigration from Canada, you are deemed to have disposed of most capital property at FMV.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="FMV of Capital Property (CAD)" type="number"
                  value={deptFmv} onChange={e => setDeptFmv(Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Adjusted Cost Base (CAD)" type="number"
                  value={deptAcb} onChange={e => setDeptAcb(Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Marginal Tax Rate" type="number"
                  value={deptMarginalRate} onChange={e => setDeptMarginalRate(Number(e.target.value))}
                  inputProps={{ step: 0.01, min: 0, max: 1 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={1}>
              {[
                ['Capital Gain', fmt(departureResult.capitalGainCad)],
                ['Taxable Gain (50%)', fmt(departureResult.taxableGainCad)],
                ['Est. Departure Tax', fmt(departureResult.estimatedTaxCad)],
              ].map(([label, val]) => (
                <Grid item xs={6} key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="subtitle2" color={label === 'Est. Departure Tax' ? 'error' : 'inherit'}>{val}</Typography>
                </Grid>
              ))}
            </Grid>
            {departureResult.notes.map((n: string, i: number) => (
              <Alert key={i} severity="info" sx={{ mt: 1, py: 0 }}>
                <Typography variant="caption">{n}</Typography>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </Grid>

      {/* T1135 */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>T1135 — Foreign Asset Reporting</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Canadian residents holding Specified Foreign Property with cost ≥ CAD $100,000 must file T1135.
            </Typography>
            <TextField fullWidth size="small" label="Total Foreign Assets Cost (CAD)" type="number"
              value={foreignAssets} onChange={e => setForeignAssets(Number(e.target.value))}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              sx={{ mb: 2 }} />
            {t1135Result.requiresT1135 ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                <AlertTitle>T1135 Required</AlertTitle>
                {t1135Result.simplified ? 'Simplified form available.' : 'Detailed form required.'}
                &nbsp;Penalty if unfiled: ${t1135Result.penaltyPerDayIfUnfiled}/day.
              </Alert>
            ) : (
              <Alert severity="success"><AlertTitle>T1135 Not Required</AlertTitle>Below $100,000 threshold.</Alert>
            )}
            {t1135Result.notes.map((n: string, i: number) => (
              <Alert key={i} severity="info" sx={{ mt: 1, py: 0 }}>
                <Typography variant="caption">{n}</Typography>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </Grid>

      {/* RRSP Non-Resident */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>RRSP as Non-Resident</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Non-residents can keep their RRSP but face CRA withholding on withdrawals.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="RRSP Balance (CAD)" type="number"
                  value={rrspBalance} onChange={e => setRrspBalance(Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" select label="Country of Residence"
                  value={residenceCountry} onChange={e => setResidenceCountry(e.target.value)}>
                  {countryOptions.map(([code, info]) => (
                    <MenuItem key={code} value={code}>{info.country}</MenuItem>
                  ))}
                  <MenuItem value="NONE">Non-treaty Country</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Years Since Departure" type="number"
                  value={yearsSince} onChange={e => setYearsSince(Number(e.target.value))} inputProps={{ min: 0 }} />
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={1}>
              {[
                ['Can Contribute', rrspNrResult.canContribute ? 'Yes (2-yr rule)' : 'No'],
                ['Withholding Rate', pct(rrspNrResult.withholdingRate)],
              ].map(([label, val]) => (
                <Grid item xs={6} key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="subtitle2">{val}</Typography>
                </Grid>
              ))}
            </Grid>
            {rrspNrResult.notes.map((n: string, i: number) => (
              <Alert key={i} severity="info" sx={{ mt: 1, py: 0 }}>
                <Typography variant="caption">{n}</Typography>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </Grid>

      {/* Treaty Withholding Table */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Treaty Withholding Rates by Country</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              CRA withholding on pension, dividend, and interest payments to non-residents (selected countries).
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Country</TableCell>
                  <TableCell align="center">Pension</TableCell>
                  <TableCell align="center">Dividends</TableCell>
                  <TableCell align="center">Interest</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(TREATY_WITHHOLDING_RATES).filter(([k]) => k !== 'NONE').map(([code, rawInfo]) => {
                  const info = rawInfo as TreatyInfo;
                  return (
                  <TableRow key={code} hover>
                    <TableCell><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><FlagIcon fontSize="small" />{info.country}</Box></TableCell>
                    <TableCell align="center"><Chip label={pct(info.pension)} size="small" /></TableCell>
                    <TableCell align="center"><Chip label={pct(info.dividends)} size="small" /></TableCell>
                    <TableCell align="center"><Chip label={pct(info.interest)} size="small" color={info.interest === 0 ? 'success' : 'default'} /></TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Grid>

      {/* QROPS */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>QROPS — UK Pension Transfer</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Transfer a UK pension to Canada via a HMRC-approved QROPS scheme.
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="UK Pension Value (GBP)" type="number"
                  value={ukPension} onChange={e => setUkPension(Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">£</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="GBP/CAD Rate" type="number"
                  value={gbpCadRate} onChange={e => setGbpCadRate(Number(e.target.value))}
                  inputProps={{ step: 0.01, min: 1 }} />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch checked={withinFiveYears} onChange={e => setWithinFiveYears(e.target.checked)} />}
                  label="Transfer within 5 years of leaving UK tax residency"
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={1}>
              {[
                ['Transfer Value (CAD)', fmt(qropsResult.transferValueCad)],
                ['OTC Charge (CAD)', fmt(qropsResult.otcAmountCad)],
                ['Net Transfer (CAD)', fmt(qropsResult.transferValueCad - qropsResult.otcAmountCad)],
              ].map(([label, val]) => (
                <Grid item xs={6} key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="subtitle2" color={label === 'OTC Charge (CAD)' && qropsResult.otcAmountCad > 0 ? 'error' : 'inherit'}>{val}</Typography>
                </Grid>
              ))}
            </Grid>
            {qropsResult.notes.map((n: string, i: number) => (
              <Alert key={i} severity={n.includes('25%') ? 'warning' : 'info'} sx={{ mt: 1, py: 0 }}>
                <Typography variant="caption">{n}</Typography>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </Grid>

      {/* Repatriation */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Return-to-Canada Repatriation</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Estimate Canadian tax on re-entry with foreign assets.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Total Foreign Assets (CAD)" type="number"
                  value={repatAssets} onChange={e => setRepatAssets(Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Unrealized Gains (CAD)" type="number"
                  value={repatGains} onChange={e => setRepatGains(Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" select label="Coming From"
                  value={repatCountry} onChange={e => setRepatCountry(e.target.value)}>
                  {countryOptions.map(([code, info]) => (
                    <MenuItem key={code} value={code}>{info.country}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth size="small" label="Canadian Marginal Rate" type="number"
                  value={repatMarginalRate} onChange={e => setRepatMarginalRate(Number(e.target.value))}
                  inputProps={{ step: 0.01, min: 0, max: 1 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={1}>
              {[
                ['Canadian Tax', fmt(repatResult.estimatedCanadianTaxCad)],
                ['Foreign Tax Credit', fmt(repatResult.foreignTaxCreditCad)],
                ['Net Tax Cost', fmt(repatResult.netTaxCostCad)],
              ].map(([label, val]) => (
                <Grid item xs={6} key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="subtitle2" color={label === 'Net Tax Cost' ? 'error' : 'inherit'}>{val}</Typography>
                </Grid>
              ))}
            </Grid>
            {repatResult.notes.map((n: string, i: number) => (
              <Alert key={i} severity="info" sx={{ mt: 1, py: 0 }}>
                <Typography variant="caption">{n}</Typography>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </Grid>

      {/* Disclaimer */}
      <Grid item xs={12}>
        <Alert severity="warning" icon={<WarningAmberIcon />}>
          <AlertTitle>Important Disclaimer</AlertTitle>
          International tax rules are complex and change regularly. All calculations are estimates for planning purposes only.
          Always consult a qualified cross-border tax advisor or international retirement specialist before making financial decisions.
        </Alert>
      </Grid>
    </Grid>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export function InternationalPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
        <PublicIcon color="primary" fontSize="large" />
        <Typography variant="h3">International Planning</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Cross-border and expat retirement strategies — Canada-US and worldwide scenarios.
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="🇨🇦🇺🇸 Canada-US Cross-Border" />
        <Tab label="🌍 Worldwide / Expat" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <CaUsTab />
      </TabPanel>
      <TabPanel value={tab} index={1}>
        <ExpatTab />
      </TabPanel>
    </Box>
  );
}
