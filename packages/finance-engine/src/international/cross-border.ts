/**
 * cross-border.ts — Canada / United States cross-border retirement strategies
 *
 * Covers the key planning considerations for Canadians with US ties or Americans
 * living in Canada:
 *
 *  1. RRSP / RRIF treaty election (Article XVIII(7))
 *  2. US Social Security ↔ CPP/OAS equivalence & WEP/GPO
 *  3. PFIC exposure on Canadian mutual funds / ETFs
 *  4. US estate-tax exposure for non-resident aliens (NRA)
 *  5. Withholding tax on cross-border pension / RRSP payments
 *  6. Totalization Agreement credits
 *
 * All monetary values in CAD unless explicitly noted.
 * Tax rates are approximate 2024 figures — always verify with a cross-border
 * tax professional before acting.
 */

// ── Treaty Withholding Rates ────────────────────────────────────────────────

/** Canada-US treaty withholding rates (2024). */
export const CA_US_WITHHOLDING = {
  /** RRSP/RRIF periodic pension payments (Article XVIII(7) election) */
  rrspRrifPension: 0.15,
  /** RRSP/RRIF lump-sum withdrawals */
  rrspRrifLumpSum: 0.25,
  /** CPP/QPP payments to US residents */
  cppToUsResident: 0.15,
  /** OAS payments to US residents */
  oasToUsResident: 0.15,
  /** Canadian dividend to US resident (portfolio) */
  dividendPortfolio: 0.15,
  /** Canadian dividend to US resident (eligible — 10%+ stake) */
  dividendEligible: 0.05,
  /** Canadian interest to US resident */
  interest: 0,
  /** TFSA distributions to US resident (NOT treaty-exempt) */
  tfsaDistribution: 0.25,
} as const;

// ── RRSP / RRIF Treaty Election ───────────────────────────────────────────

export interface RrspTreatyInput {
  /** Current RRSP/RRIF balance (CAD) */
  balance: number;
  /** USD/CAD exchange rate (e.g. 0.74) */
  usdCadRate: number;
  /** US marginal income tax rate of the account holder */
  usMarginalRate: number;
  /** Annual withdrawal amount (CAD) */
  annualWithdrawal: number;
}

export interface RrspTreatyResult {
  netWithdrawalCad: number;
  netWithdrawalUsd: number;
  withheldAtSource: number;
  additionalUsaTax: number;
  requiresTreatyElection: boolean;
  notes: string[];
}

/**
 * Estimate after-tax withdrawal from a Canadian RRSP/RRIF for a US resident.
 * Periodic pension payments are withheld at 15%; lump sums at 25%.
 * The withheld amount is a foreign tax credit against US tax owing.
 */
export function calcRrspTreatyWithdrawal(input: RrspTreatyInput): RrspTreatyResult {
  const { balance, usdCadRate, usMarginalRate, annualWithdrawal } = input;
  const isPeriodic = annualWithdrawal < balance * 0.2;
  const withholdingRate = isPeriodic
    ? CA_US_WITHHOLDING.rrspRrifPension
    : CA_US_WITHHOLDING.rrspRrifLumpSum;

  const withheldAtSource = annualWithdrawal * withholdingRate;
  const netWithdrawalCad = annualWithdrawal - withheldAtSource;
  const grossUsd = annualWithdrawal * usdCadRate;
  const usTaxBeforeCredit = grossUsd * usMarginalRate;
  const foreignTaxCredit = withheldAtSource * usdCadRate;
  const additionalUsaTax = Math.max(0, usTaxBeforeCredit - foreignTaxCredit);
  const netWithdrawalUsd = grossUsd - additionalUsaTax;

  return {
    netWithdrawalCad,
    netWithdrawalUsd,
    withheldAtSource,
    additionalUsaTax,
    requiresTreatyElection: true,
    notes: [
      'Article XVIII(7) treaty election must be disclosed via FBAR/FATCA (PFSP superseded Form 8891).',
      isPeriodic
        ? '15% withholding applies (periodic pension payment).'
        : '25% withholding applies (lump-sum withdrawal).',
      balance > 100_000
        ? 'Balance > CAD $100,000 — T1135 Foreign Asset Reporting may apply if you are a Canadian resident.'
        : '',
    ].filter(Boolean),
  };
}

// ── Social Security / CPP Totalization ────────────────────────────────────

export interface TotalizationInput {
  cppContributionYears: number;
  cppAverageEarnings: number;
  ssCredits: number;
  ssAverageEarnings: number;
  usdCadRate: number;
}

export interface TotalizationResult {
  estimatedCppAnnual: number;
  estimatedSsAnnual: number;
  wepReduction: number;
  netSsAfterWep: number;
  combinedAnnualCad: number;
  notes: string[];
}

/**
 * Rough estimate of combined CPP + US Social Security income.
 * WEP may reduce SS benefits for workers who also receive CPP.
 */
export function calcTotalization(input: TotalizationInput): TotalizationResult {
  const { cppContributionYears, cppAverageEarnings, ssCredits, ssAverageEarnings, usdCadRate } = input;

  const maxCppAnnual = 16_375;
  const estimatedCppAnnual = Math.min(
    maxCppAnnual,
    (cppContributionYears / 39) * Math.min(cppAverageEarnings / 68_500, 1) * maxCppAnnual,
  );

  const aimeMonthly = ssAverageEarnings / 12;
  const rawSsMonthly =
    Math.min(aimeMonthly, 1_174) * 0.9 +
    Math.max(0, Math.min(aimeMonthly - 1_174, 7_078 - 1_174)) * 0.32 +
    Math.max(0, aimeMonthly - 7_078) * 0.15;
  const estimatedSsAnnual = rawSsMonthly * 12;

  const wepMaxMonthly = 587;
  const wepScaleFactor = ssCredits >= 30 ? 0 : ssCredits >= 20 ? (30 - ssCredits) / 10 : 1;
  const wepReduction = Math.min(rawSsMonthly * 0.5, wepMaxMonthly) * wepScaleFactor * 12;
  const netSsAfterWep = Math.max(0, estimatedSsAnnual - wepReduction);
  const combinedAnnualCad = estimatedCppAnnual + netSsAfterWep / usdCadRate;

  return {
    estimatedCppAnnual,
    estimatedSsAnnual,
    wepReduction,
    netSsAfterWep,
    combinedAnnualCad,
    notes: [
      ssCredits < 40 && cppContributionYears > 0
        ? 'Canada-US Totalization may help you qualify for SS benefits using combined credits.'
        : '',
      wepReduction > 0
        ? `WEP may reduce your SS benefit because you receive a pension (CPP) from non-covered employment.`
        : '',
      'OAS payments to US residents are subject to 15% Canadian withholding.',
    ].filter(Boolean),
  };
}

// ── PFIC Warning ──────────────────────────────────────────────────────────

export interface PficHolding {
  name: string;
  type: 'ETF' | 'MutualFund' | 'Stock' | 'GIC' | 'Other';
  valueCad: number;
}

export interface PficCheckResult {
  pficHoldings: { name: string; valueCad: number; risk: 'high' | 'medium' }[];
  safeHoldings: { name: string; valueCad: number }[];
  totalPficExposureCad: number;
  hasExposure: boolean;
  notes: string[];
}

/**
 * Identify likely PFIC holdings for a US person holding Canadian investments.
 * Canadian mutual funds and ETFs are generally PFICs — subject to punitive
 * tax rates unless a QEF or MTM election is filed (Form 8621).
 */
export function checkPficExposure(holdings: PficHolding[], isUSPerson: boolean): PficCheckResult {
  if (!isUSPerson) {
    return {
      pficHoldings: [],
      safeHoldings: holdings.map(h => ({ name: h.name, valueCad: h.valueCad })),
      totalPficExposureCad: 0,
      hasExposure: false,
      notes: ['PFIC rules only apply to US persons.'],
    };
  }

  const pficHoldings: PficCheckResult['pficHoldings'] = [];
  const safeHoldings: PficCheckResult['safeHoldings'] = [];

  for (const h of holdings) {
    if (h.type === 'ETF' || h.type === 'MutualFund') {
      pficHoldings.push({ name: h.name, valueCad: h.valueCad, risk: 'high' });
    } else if (h.type === 'Other') {
      pficHoldings.push({ name: h.name, valueCad: h.valueCad, risk: 'medium' });
    } else {
      safeHoldings.push({ name: h.name, valueCad: h.valueCad });
    }
  }

  return {
    pficHoldings,
    safeHoldings,
    totalPficExposureCad: pficHoldings.reduce((s, h) => s + h.valueCad, 0),
    hasExposure: pficHoldings.length > 0,
    notes: [
      'Canadian ETFs and mutual funds are typically PFICs. File Form 8621 with QEF or MTM elections to avoid excess distribution tax.',
      'TFSA is not tax-advantaged in the US — growth and withdrawals are fully taxable to US persons.',
    ],
  };
}

// ── US Estate Tax Exposure ────────────────────────────────────────────────

export interface UsEstateTaxInput {
  /** US-situs assets (USD): US real estate, US stocks */
  usSitusAssetsUsd: number;
  usdCadRate: number;
  isUsDomiciliary: boolean;
}

export interface UsEstateTaxResult {
  exemptionUsd: number;
  taxableEstateUsd: number;
  estimatedTaxUsd: number;
  estimatedTaxCad: number;
  notes: string[];
}

/**
 * Estimate US estate tax for a non-resident alien (NRA).
 * NRAs have a $60,000 exemption vs $13.61M for US domiciliaries (2024).
 * The Canada-US treaty provides a prorated unified credit.
 */
export function calcUsEstateTax(input: UsEstateTaxInput): UsEstateTaxResult {
  const { usSitusAssetsUsd, usdCadRate, isUsDomiciliary } = input;
  const exemptionUsd = isUsDomiciliary ? 13_610_000 : 60_000;
  const taxableEstateUsd = Math.max(0, usSitusAssetsUsd - exemptionUsd);

  const brackets: [number, number][] = [
    [10_000, 0.18], [10_000, 0.20], [20_000, 0.22], [20_000, 0.24],
    [40_000, 0.26], [40_000, 0.28], [60_000, 0.30], [60_000, 0.32],
    [160_000, 0.34], [160_000, 0.37], [500_000, 0.39], [Infinity, 0.40],
  ];

  let tax = 0;
  let remaining = taxableEstateUsd;
  for (const [size, rate] of brackets) {
    if (remaining <= 0) break;
    const chunk = Math.min(remaining, size);
    tax += chunk * rate;
    remaining -= chunk;
  }

  return {
    exemptionUsd,
    taxableEstateUsd,
    estimatedTaxUsd: tax,
    estimatedTaxCad: tax / usdCadRate,
    notes: [
      !isUsDomiciliary && usSitusAssetsUsd > 60_000
        ? 'As a non-resident alien, US estate-tax exemption is only USD $60,000. Consider a Canadian holding company structure.'
        : '',
      'US situs assets: US real estate, US stocks/ETFs (even held in Canada), US bonds.',
      'Canadian RRSPs are NOT US-situs assets for estate-tax purposes.',
      'The Canada-US estate treaty may provide a prorated unified credit.',
    ].filter(Boolean),
  };
}
