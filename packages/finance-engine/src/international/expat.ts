/**
 * expat.ts — Worldwide / Expat retirement strategies for Canadian residents
 * or Canadians living abroad.
 *
 * Covers:
 *  1. Canadian departure tax (deemed disposition on emigration)
 *  2. T1135 foreign asset reporting thresholds
 *  3. RRSP while non-resident (2-year rule, withholding, reporting)
 *  4. Treaty withholding rates for key countries
 *  5. QROPS — UK pension portability for UK nationals in Canada
 *  6. Return-to-Canada repatriation planning
 *  7. Territorial vs worldwide tax regimes
 *
 * Dollar amounts in CAD unless noted. Rates are 2024 approximate figures.
 * Always verify with a tax professional familiar with both jurisdictions.
 */

// ── Departure Tax (Deemed Disposition on Emigration) ─────────────────────

export interface DepartureTaxInput {
  /** Fair market value of deemed-disposed assets (CAD) */
  fmvCad: number;
  /** Adjusted cost base of those assets (CAD) */
  acbCad: number;
  /** Marginal tax rate in Canada in the year of departure */
  marginalRate: number;
  /** Assets that are excluded from departure tax (see notes) */
  exclusions?: {
    /** RRSP/RRIF balances — exempt from departure tax but subject to withholding on withdrawal */
    rrspRrifCad?: number;
    /** Canadian real property — NOT subject to departure tax (taxable on actual disposition) */
    canadianRealPropertyCad?: number;
    /** TFSA — exempt from departure tax but loses tax shelter after departure */
    tfsaCad?: number;
  };
}

export interface DepartureTaxResult {
  /** Capital gain triggered on departure (CAD) */
  capitalGainCad: number;
  /** Taxable capital gain (50% inclusion) */
  taxableGainCad: number;
  /** Estimated departure tax owing (CAD) */
  estimatedTaxCad: number;
  /** Assets excluded from deemed disposition (CAD) */
  totalExclusionsCad: number;
  notes: string[];
}

/**
 * Estimate Canadian departure tax triggered by emigration.
 *
 * When a Canadian resident emigrates, they are deemed to have disposed of
 * most capital property at fair market value on the day before departure.
 * Excluded: Canadian real property, RRSPs/RRIFs, RPP interests, stock options (some).
 */
export function calcDepartureTax(input: DepartureTaxInput): DepartureTaxResult {
  const { fmvCad, acbCad, marginalRate, exclusions = {} } = input;
  const capitalGainCad = Math.max(0, fmvCad - acbCad);
  // 2024: capital gains inclusion rate is 50% for individuals (first $250K)
  const taxableGainCad = capitalGainCad * 0.5;
  const estimatedTaxCad = taxableGainCad * marginalRate;

  const totalExclusionsCad =
    (exclusions.rrspRrifCad ?? 0) +
    (exclusions.canadianRealPropertyCad ?? 0) +
    (exclusions.tfsaCad ?? 0);

  return {
    capitalGainCad,
    taxableGainCad,
    estimatedTaxCad,
    totalExclusionsCad,
    notes: [
      'Canadian real property is NOT subject to departure tax — it remains taxable in Canada on actual sale.',
      'RRSPs/RRIFs are excluded from departure tax but withdrawals after emigration are subject to CRA non-resident withholding (25% default, reduced by treaty).',
      exclusions.tfsaCad
        ? 'TFSA is excluded from departure tax but ceases to accumulate tax-free after you become non-resident. Contributions after departure are subject to 1%/month tax.'
        : '',
      'Consider a security in lieu of tax to defer payment on illiquid assets (Form T1161/T1244).',
    ].filter(Boolean),
  };
}

// ── T1135 Foreign Asset Reporting ────────────────────────────────────────

export interface T1135Input {
  /** Total cost amount of foreign assets held during the year (CAD) */
  totalForeignAssetsCostCad: number;
  /** Is the filer a trust, corporation, or partnership? */
  isEntity: boolean;
}

export interface T1135Result {
  requiresT1135: boolean;
  simplified: boolean;
  penaltyPerDayIfUnfiled: number;
  notes: string[];
}

/**
 * Determine T1135 filing obligation for Specified Foreign Property (SFP).
 * Threshold: $100,000 CAD cost amount of SFP held at any time during the year.
 * Simplified form available when total cost is $250,000 or under.
 */
export function checkT1135(input: T1135Input): T1135Result {
  const { totalForeignAssetsCostCad } = input;
  const requiresT1135 = totalForeignAssetsCostCad >= 100_000;
  const simplified = requiresT1135 && totalForeignAssetsCostCad <= 250_000;

  return {
    requiresT1135,
    simplified,
    penaltyPerDayIfUnfiled: requiresT1135 ? 25 : 0,
    notes: requiresT1135
      ? [
          'T1135 must be filed with your T1 return (or by the filing deadline).',
          simplified
            ? 'Simplified Form T1135 available (list by country/type rather than per-property detail).'
            : 'Detailed Form T1135 required — list each property individually.',
          'Penalty: $25/day for late filing up to $2,500, plus gross-negligence penalties up to $24,000.',
          'Foreign real property used personally (vacation home) is excluded from SFP.',
          'RRSPs/TFSAs/FHSAs holding foreign securities are excluded from T1135.',
        ]
      : ['Total foreign assets below $100,000 threshold — T1135 not required.'],
  };
}

// ── RRSP for Non-Residents ────────────────────────────────────────────────

export interface RrspNonResidentInput {
  /** RRSP balance (CAD) */
  balance: number;
  /** Country of current residence */
  residenceCountry: string;
  /** Years since Canadian residency was lost */
  yearsSinceDeparture: number;
  /** Treaty withholding rate for the residence country (0 = use default 25%) */
  treatyWithholdingRate?: number;
}

export interface RrspNonResidentResult {
  /** Can the holder still contribute to RRSP? */
  canContribute: boolean;
  /** CRA withholding rate on withdrawals */
  withholdingRate: number;
  /** Is the 2-year rule still in effect? */
  twoYearRuleActive: boolean;
  notes: string[];
}

/**
 * RRSP rules for non-residents of Canada.
 *
 * Non-residents CAN continue to hold and grow an RRSP/RRIF.
 * They cannot make new RRSP contributions unless they have Canadian earned income.
 * Withdrawals are subject to CRA non-resident withholding (25% default, reduced by treaty).
 * The "2-year rule" allows RRSP contributions for up to 2 years after departure if
 * earned income was reported on a Canadian return.
 */
export function analyzeRrspNonResident(input: RrspNonResidentInput): RrspNonResidentResult {
  const { yearsSinceDeparture, treatyWithholdingRate } = input;
  const twoYearRuleActive = yearsSinceDeparture <= 2;
  const withholdingRate = treatyWithholdingRate ?? 0.25;

  return {
    canContribute: twoYearRuleActive,
    withholdingRate,
    twoYearRuleActive,
    notes: [
      twoYearRuleActive
        ? 'You may still contribute to your RRSP within 2 years of departure if you have unused room and Canadian earned income.'
        : 'You can no longer contribute to an RRSP as a non-resident.',
      `Withdrawals are subject to ${(withholdingRate * 100).toFixed(0)}% CRA withholding${treatyWithholdingRate ? ' (treaty rate)' : ' (default rate — check if a tax treaty applies).'}.`,
      'Consider whether converting to a RRIF makes sense — provides structured withdrawals taxed at treaty rates.',
      'Growth inside the RRSP is tax-deferred in Canada regardless of residency.',
      'Report RRSP on FBAR/FATCA if you are a US person (see cross-border module).',
    ],
  };
}

// ── Treaty Withholding Rates by Country ──────────────────────────────────

/** Canada treaty withholding rates for pension income (2024, selected countries). */
export const TREATY_WITHHOLDING_RATES: Record<string, {
  pension: number;
  dividends: number;
  interest: number;
  country: string;
}> = {
  US:  { country: 'United States',   pension: 0.15, dividends: 0.15, interest: 0 },
  UK:  { country: 'United Kingdom',  pension: 0.25, dividends: 0.15, interest: 0.10 },
  AU:  { country: 'Australia',       pension: 0.25, dividends: 0.15, interest: 0.10 },
  DE:  { country: 'Germany',         pension: 0.15, dividends: 0.15, interest: 0.10 },
  FR:  { country: 'France',          pension: 0.25, dividends: 0.15, interest: 0.10 },
  ES:  { country: 'Spain',           pension: 0.25, dividends: 0.15, interest: 0.10 },
  PT:  { country: 'Portugal',        pension: 0.25, dividends: 0.15, interest: 0.10 },
  MX:  { country: 'Mexico',          pension: 0.25, dividends: 0.15, interest: 0.10 },
  NZ:  { country: 'New Zealand',     pension: 0.25, dividends: 0.15, interest: 0.10 },
  NL:  { country: 'Netherlands',     pension: 0.25, dividends: 0.15, interest: 0.10 },
  IT:  { country: 'Italy',           pension: 0.15, dividends: 0.15, interest: 0.10 },
  IE:  { country: 'Ireland',         pension: 0.25, dividends: 0.15, interest: 0 },
  SE:  { country: 'Sweden',          pension: 0.25, dividends: 0.15, interest: 0.10 },
  CH:  { country: 'Switzerland',     pension: 0.25, dividends: 0.15, interest: 0.10 },
  JP:  { country: 'Japan',           pension: 0.25, dividends: 0.15, interest: 0.10 },
  NONE: { country: 'Non-treaty country', pension: 0.25, dividends: 0.25, interest: 0.25 },
};

export function getTreatyRates(countryCode: string) {
  return TREATY_WITHHOLDING_RATES[countryCode.toUpperCase()] ?? TREATY_WITHHOLDING_RATES['NONE'];
}

// ── QROPS — UK Pension Portability ───────────────────────────────────────

export interface QropsInput {
  /** UK pension value (GBP) */
  ukPensionGbp: number;
  /** GBP/CAD exchange rate */
  gbpCadRate: number;
  /** Years of UK residence during pension accrual */
  ukResidenceYears: number;
  /** Is the transfer within 5 years of leaving UK tax residency? */
  withinFiveYears: boolean;
}

export interface QropsResult {
  /** Potential transferable value (CAD equivalent) */
  transferValueCad: number;
  /** UK Overseas Transfer Charge applicable? (25% if within 5 years and non-EEA) */
  overseasTransferCharge: boolean;
  /** Estimated OTC amount (CAD) */
  otcAmountCad: number;
  notes: string[];
}

/**
 * QROPS (Qualifying Recognised Overseas Pension Scheme) allows UK pension
 * transfers to arrangements in certain countries including Canada (via
 * approved QROPS providers).
 *
 * Since April 2017, a 25% Overseas Transfer Charge (OTC) applies to most
 * transfers outside the EEA, unless both the member and the receiving scheme
 * are in the same country.
 */
export function analyzeQrops(input: QropsInput): QropsResult {
  const { ukPensionGbp, gbpCadRate, withinFiveYears } = input;
  const transferValueCad = ukPensionGbp * gbpCadRate;
  const overseasTransferCharge = withinFiveYears;
  const otcAmountCad = overseasTransferCharge ? transferValueCad * 0.25 : 0;

  return {
    transferValueCad,
    overseasTransferCharge,
    otcAmountCad,
    notes: [
      withinFiveYears
        ? 'A 25% Overseas Transfer Charge (OTC) likely applies as the transfer is within 5 years of leaving UK tax residency. Consider waiting until the 5-year window passes.'
        : 'No OTC applies (> 5 years since UK departure).',
      'The receiving Canadian scheme must be a HMRC-approved QROPS provider.',
      'Canadian tax treatment of transferred UK pension may differ — consult a cross-border advisor.',
      'QROPS transfers cannot be made to Canadian RRSPs directly; a registered pension plan arrangement is required.',
      'UK State Pension (Basic or New State Pension) cannot be transferred — it must be claimed directly from the UK DWP.',
    ],
  };
}

// ── Repatriation Planning ─────────────────────────────────────────────────

export interface RepatriationInput {
  /** Total foreign assets to repatriate (CAD equivalent) */
  totalForeignAssetsCad: number;
  /** Unrealized gains in foreign assets (CAD) */
  unrealizedGainsCad: number;
  /** Country repatriating from */
  fromCountry: string;
  /** Marginal Canadian tax rate after return */
  canadianMarginalRate: number;
}

export interface RepatriationResult {
  /** Estimated Canadian tax on repatriated gains */
  estimatedCanadianTaxCad: number;
  /** Foreign tax credits available (estimate) */
  foreignTaxCreditCad: number;
  /** Net tax cost estimate (CAD) */
  netTaxCostCad: number;
  notes: string[];
}

/**
 * Estimate the tax cost of repatriating foreign assets on returning to Canada.
 * On return, Canada generally taxes residents on worldwide income. Foreign
 * tax credits help avoid double taxation.
 */
export function analyzeRepatriation(input: RepatriationInput): RepatriationResult {
  const { unrealizedGainsCad, fromCountry, canadianMarginalRate } = input;
  const treatyRates = getTreatyRates(fromCountry);

  // Simplified: assume gains taxed at treaty dividend rate in foreign country
  const foreignTaxPaidCad = unrealizedGainsCad * treatyRates.dividends;
  const canadianTaxCad = unrealizedGainsCad * 0.5 * canadianMarginalRate; // 50% inclusion
  const foreignTaxCreditCad = Math.min(foreignTaxPaidCad, canadianTaxCad);
  const netTaxCostCad = Math.max(0, canadianTaxCad - foreignTaxCreditCad);

  return {
    estimatedCanadianTaxCad: canadianTaxCad,
    foreignTaxCreditCad,
    netTaxCostCad,
    notes: [
      'On re-establishing Canadian residency, your adjusted cost base for foreign property is "stepped up" to fair market value on the date of return.',
      'Foreign tax credits (FTC) can offset Canadian tax on the same income — keep records of all foreign taxes paid.',
      'Consider crystallizing gains before returning if you are in a low-tax foreign jurisdiction.',
      fromCountry === 'US' ? 'US persons: ensure any US exit tax obligations are addressed before repatriating.' : '',
    ].filter(Boolean),
  };
}
