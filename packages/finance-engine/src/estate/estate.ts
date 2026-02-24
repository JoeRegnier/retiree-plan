/**
 * Estate planning calculations for Canadian retirees.
 *
 * Key concepts:
 * - RRSP/RRIF deemed disposition at death: treated as income in year of death
 * - TFSA: passes tax-free to beneficiary
 * - Non-reg: deemed disposition at FMV (capital gains)
 * - Probate fees vary by province (simplified here)
 */

export interface EstateInput {
  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  nonRegACB: number;          // adjusted cost base of non-reg portfolio
  primaryResidenceValue: number;
  otherAssetsValue: number;   // e.g., cottage, collectibles
  otherAssetsACB: number;
  liabilities: number;
  marginalTaxRateAtDeath: number;    // decimal, e.g. 0.50
  capitalGainsTaxRate: number;       // decimal, e.g. 0.25 (after 50% inclusion)
  province?: string;
}

export interface EstateResult {
  grossEstate: number;
  rrspTaxOwed: number;
  nonRegCapGainsTax: number;
  otherAssetsTax: number;
  probateFees: number;
  totalTaxAndFees: number;
  netEstateToHeirs: number;
  effectiveTaxRate: number;
  breakdown: EstateBreakdownItem[];
}

export interface EstateBreakdownItem {
  label: string;
  grossValue: number;
  taxOrFee: number;
  netValue: number;
}

/** Approximate probate fees by province (simplified flat schedule). */
function probateFees(grossEstate: number, province = 'ON'): number {
  // Ontario: first $50k @ 0.5%, remainder @ 1.5%
  if (province === 'ON') {
    const base = Math.min(grossEstate, 50_000) * 0.005;
    const excess = Math.max(0, grossEstate - 50_000) * 0.015;
    return base + excess;
  }
  // BC: first $25k free, $25k-$50k @ 0.6%, >$50k @ 1.4%
  if (province === 'BC') {
    if (grossEstate <= 25_000) return 0;
    const tier1 = Math.min(grossEstate - 25_000, 25_000) * 0.006;
    const tier2 = Math.max(0, grossEstate - 50_000) * 0.014;
    return tier1 + tier2;
  }
  // Alberta: flat $525 max
  if (province === 'AB') return Math.min(grossEstate * 0.003, 525);
  // Quebec: no probate (notarial wills)
  if (province === 'QC') return 0;
  // Default: 1.5% of estate
  return grossEstate * 0.015;
}

export function calculateEstate(input: EstateInput): EstateResult {
  const {
    rrspBalance, tfsaBalance, nonRegBalance, nonRegACB,
    primaryResidenceValue, otherAssetsValue, otherAssetsACB,
    liabilities, marginalTaxRateAtDeath, capitalGainsTaxRate, province,
  } = input;

  // RRSP/RRIF: deemed disposition — full balance taxed as ordinary income
  const rrspTaxOwed = rrspBalance * marginalTaxRateAtDeath;

  // Non-reg: capital gains on accrued gain (50% inclusion × marginal rate)
  const nonRegGain = Math.max(0, nonRegBalance - nonRegACB);
  const nonRegCapGainsTax = nonRegGain * capitalGainsTaxRate;

  // Other assets (e.g., cottage): capital gains
  const otherGain = Math.max(0, otherAssetsValue - otherAssetsACB);
  const otherAssetsTax = otherGain * capitalGainsTaxRate;

  // Primary residence: principal residence exemption → $0 tax
  const primaryResidenceTax = 0;
  void primaryResidenceTax;

  const grossEstate =
    rrspBalance + tfsaBalance + nonRegBalance +
    primaryResidenceValue + otherAssetsValue - liabilities;

  const fees = probateFees(grossEstate, province ?? 'ON');

  const totalTaxAndFees = rrspTaxOwed + nonRegCapGainsTax + otherAssetsTax + fees;
  const netEstateToHeirs = grossEstate - totalTaxAndFees;
  const effectiveTaxRate = grossEstate > 0 ? totalTaxAndFees / grossEstate : 0;

  const breakdown: EstateBreakdownItem[] = [
    {
      label: 'RRSP / RRIF',
      grossValue: rrspBalance,
      taxOrFee: rrspTaxOwed,
      netValue: rrspBalance - rrspTaxOwed,
    },
    {
      label: 'TFSA',
      grossValue: tfsaBalance,
      taxOrFee: 0,
      netValue: tfsaBalance,
    },
    {
      label: 'Non-Registered',
      grossValue: nonRegBalance,
      taxOrFee: nonRegCapGainsTax,
      netValue: nonRegBalance - nonRegCapGainsTax,
    },
    {
      label: 'Primary Residence',
      grossValue: primaryResidenceValue,
      taxOrFee: 0,
      netValue: primaryResidenceValue,
    },
    {
      label: 'Other Assets',
      grossValue: otherAssetsValue,
      taxOrFee: otherAssetsTax,
      netValue: otherAssetsValue - otherAssetsTax,
    },
    {
      label: 'Liabilities',
      grossValue: -liabilities,
      taxOrFee: 0,
      netValue: -liabilities,
    },
    {
      label: 'Probate Fees',
      grossValue: 0,
      taxOrFee: fees,
      netValue: -fees,
    },
  ];

  return {
    grossEstate,
    rrspTaxOwed,
    nonRegCapGainsTax,
    otherAssetsTax,
    probateFees: fees,
    totalTaxAndFees,
    netEstateToHeirs,
    effectiveTaxRate,
    breakdown,
  };
}
