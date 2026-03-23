/**
 * Legacy & Estate Giving Planner — Feature 7.3
 *
 * Four proactive estate planning strategies for Canadian retirees:
 *   1. Spousal Testamentary Trust  — RRSP/RRIF rollover tax deferral
 *   2. Charitable Giving           — Donation tax credit + DAF modelling
 *   3. Life Insurance              — Estate equalization (RRSP tax bomb)
 *   4. Principal Residence         — Nomination optimizer for 2-property households
 */

// ─── 1. Spousal Testamentary Trust ───────────────────────────────────────────

export interface SpouseTrustInput {
  /** RRSP/RRIF balance at first spouse's death */
  rrspBalance: number;
  /** First-to-die marginal tax rate (e.g. 0.53 for Ontario top bracket) */
  marginalTaxRateAtDeath: number;
  /** Surviving spouse's expected average marginal rate during drawdown */
  survivorMarginalRate: number;
  /** Estimated years the RRSP will continue to compound before the survivor dies */
  deferralYears: number;
  /** Annual expected return on the RRSP during deferral (e.g. 0.05) */
  rrspGrowthRate: number;
}

export interface SpouseTrustResult {
  /** Tax if RRSP was fully included in income at first death (no rollover) */
  taxWithoutRollover: number;
  /** Tax avoided at first death due to spousal rollover */
  taxDeferredAtFirstDeath: number;
  /** Projected RRSP balance when the surviving spouse eventually dies */
  rrspValueAtSurvivorDeath: number;
  /** Tax payable on the RRSP at the survivor's death */
  eventualTaxAtSurvivorDeath: number;
  /**
   * Net change in what heirs receive vs. NOT doing the rollover.
   * Positive = rollover benefits heirs (RRSP growth exceeds the rate differential).
   */
  netBenefitVsNoRollover: number;
  explanation: string;
}

export function calculateSpouseTrust(input: SpouseTrustInput): SpouseTrustResult {
  const {
    rrspBalance,
    marginalTaxRateAtDeath,
    survivorMarginalRate,
    deferralYears,
    rrspGrowthRate,
  } = input;

  // Without rollover: full RRSP taxed as income in the year of first death
  const taxWithoutRollover = rrspBalance * marginalTaxRateAtDeath;

  // With spousal rollover: RRSP passes tax-free; continues growing at rrspGrowthRate
  const rrspValueAtSurvivorDeath =
    rrspBalance * Math.pow(1 + rrspGrowthRate, Math.max(0, deferralYears));

  // Tax at survivor's death (deemed disposition — full balance taxed as income)
  const eventualTaxAtSurvivorDeath = rrspValueAtSurvivorDeath * survivorMarginalRate;

  // Tax deferred = full tax that would have hit at first death
  const taxDeferredAtFirstDeath = taxWithoutRollover;

  // Net benefit to heirs (compared to no-rollover scenario):
  //   Without rollover → heirs receive: (rrspBalance - taxWithoutRollover)
  //   With rollover    → heirs receive: (rrspValueAtSurvivorDeath - eventualTaxAtSurvivorDeath)
  const estateWithoutRollover = rrspBalance - taxWithoutRollover;
  const estateWithRollover = rrspValueAtSurvivorDeath - eventualTaxAtSurvivorDeath;
  const netBenefitVsNoRollover = estateWithRollover - estateWithoutRollover;

  const explanation =
    netBenefitVsNoRollover > 0
      ? `The spousal rollover is projected to increase the estate passing to heirs by $${Math.round(netBenefitVsNoRollover).toLocaleString()}, primarily because the RRSP continues to compound over ${deferralYears} year${deferralYears !== 1 ? 's' : ''}.`
      : `The spousal rollover defers $${Math.round(taxDeferredAtFirstDeath).toLocaleString()} in tax at first death. The RRSP will ultimately be taxed at ${(survivorMarginalRate * 100).toFixed(0)}% when the surviving spouse dies, but the deferral itself is still valuable.`;

  return {
    taxWithoutRollover,
    taxDeferredAtFirstDeath,
    rrspValueAtSurvivorDeath,
    eventualTaxAtSurvivorDeath,
    netBenefitVsNoRollover,
    explanation,
  };
}

// ─── 2. Charitable Giving + DAF ───────────────────────────────────────────────

export interface CharitableGivingInput {
  /** Total donation amount */
  donationAmount: number;
  /** Province code (e.g. 'ON') — affects provincial credit rate */
  province: string;
  /** If true, model this as a Donor-Advised Fund (DAF) contribution */
  isDaf: boolean;
  /** Years over which the DAF distributes grants (default: 5) */
  dafGrantYears?: number;
}

export interface CharitableGivingResult {
  donationAmount: number;
  federalCredit: number;
  provincialCredit: number;
  totalCredit: number;
  /** Actual out-of-pocket cost after the tax credit */
  netCostAfterCredit: number;
  /** totalCredit / donationAmount */
  effectiveDonationRate: number;
  /** Assets removed from taxable estate by this donation */
  estateReduction: number;
  /** Annual grant amount (only when isDaf = true) */
  dafAnnualGrant?: number;
  explanation: string;
}

/**
 * Canadian donation tax credit (federal + provincial).
 *
 * Federal:     15% on first $200; 29% on the remainder (post-2016).
 * Provincial:  varies by province; two-tier matching federal structure.
 */
function donationCredit(
  amount: number,
  province: string,
): { federal: number; provincial: number } {
  const firstTier = Math.min(amount, 200);
  const overTier = Math.max(0, amount - 200);

  const federal = firstTier * 0.15 + overTier * 0.29;

  // [rate on first $200, rate over $200] — approximate combined rates
  const provRates: Record<string, [number, number]> = {
    ON: [0.0505, 0.1716],
    BC: [0.0506, 0.1618],
    AB: [0.10, 0.10],
    QC: [0.20, 0.24],
    MB: [0.108, 0.174],
    SK: [0.105, 0.145],
    NS: [0.0879, 0.21],
    NB: [0.094, 0.19],
    PE: [0.098, 0.167],
    NL: [0.0872, 0.219],
    NT: [0.059, 0.1405],
    NU: [0.04, 0.1195],
    YT: [0.064, 0.1290],
  };
  const [r1, r2] = provRates[province] ?? provRates['ON'];
  const provincial = firstTier * r1 + overTier * r2;

  return { federal, provincial };
}

export function calculateCharitableGiving(
  input: CharitableGivingInput,
): CharitableGivingResult {
  const { donationAmount, province, isDaf, dafGrantYears = 5 } = input;

  const { federal, provincial } = donationCredit(donationAmount, province);
  const totalCredit = federal + provincial;
  const netCost = Math.max(0, donationAmount - totalCredit);
  const effectiveRate = donationAmount > 0 ? totalCredit / donationAmount : 0;
  const annualGrant = isDaf ? donationAmount / Math.max(1, dafGrantYears) : undefined;

  const explanation = isDaf
    ? `By donating $${donationAmount.toLocaleString()} to a Donor-Advised Fund (DAF) this year, ` +
      `you receive a $${Math.round(totalCredit).toLocaleString()} tax credit immediately and ` +
      `direct $${Math.round(annualGrant!).toLocaleString()}/year in grants over ${dafGrantYears} year${dafGrantYears !== 1 ? 's' : ''}. ` +
      `Your actual out-of-pocket cost is $${Math.round(netCost).toLocaleString()}.`
    : `A $${donationAmount.toLocaleString()} charitable donation generates a ` +
      `$${Math.round(totalCredit).toLocaleString()} tax credit (${(effectiveRate * 100).toFixed(0)}% effective rate), ` +
      `reducing your actual cost to $${Math.round(netCost).toLocaleString()}.`;

  return {
    donationAmount,
    federalCredit: federal,
    provincialCredit: provincial,
    totalCredit,
    netCostAfterCredit: netCost,
    effectiveDonationRate: effectiveRate,
    estateReduction: donationAmount,
    dafAnnualGrant: annualGrant,
    explanation,
  };
}

// ─── 3. Life Insurance for Estate Equalization ───────────────────────────────

export interface LifeInsuranceInput {
  /** RRSP/RRIF balance expected at death — this creates the tax bill */
  rrspBalance: number;
  /** Marginal rate applied to RRSP at death */
  marginalTaxRateAtDeath: number;
  /** Number of heirs who should receive equal inheritances */
  numberOfHeirs: number;
  /** Insured person's current age — used to estimate premiums */
  currentAge: number;
  /** Whether the insured is a smoker (raises premiums ~2.5×) */
  isSmoker?: boolean;
}

export interface LifeInsuranceResult {
  /** Estimated tax triggered by the RRSP at death ("tax bomb") */
  rrspTaxBomb: number;
  /** Life insurance death benefit needed to cover the tax bomb */
  deathBenefitNeeded: number;
  /** Approximate annual term-20 premium (non-indexed, simplified rates) */
  estimatedAnnualPremium: number;
  estimatedMonthlyPremium: number;
  /**
   * What each heir would inherit from the RRSP (net of tax) WITHOUT insurance,
   * divided by numberOfHeirs as a simple per-heir share.
   */
  inheritancePerHeirWithoutInsurance: number;
  /**
   * What each heir would inherit (gross RRSP) if insurance covers the tax,
   * divided by numberOfHeirs.
   */
  inheritancePerHeirWithInsurance: number;
  explanation: string;
}

/**
 * Approximate annual term-20 premium per $1,000 of coverage.
 * Source: industry tables (simplified non-smoker rates, preferred health).
 */
function termPremiumPerThousand(age: number, isSmoker: boolean): number {
  const nonSmokerTable: Record<number, number> = {
    40: 1.40,
    45: 1.80,
    50: 2.80,
    55: 4.50,
    60: 7.60,
    65: 13.0,
    70: 22.0,
    75: 38.0,
  };
  // Round age to nearest bracket (floor to nearest 5)
  const bracket = Math.min(75, Math.max(40, Math.floor(age / 5) * 5));
  const baseRate = nonSmokerTable[bracket] ?? 10.0;
  return isSmoker ? baseRate * 2.5 : baseRate;
}

export function calculateLifeInsurance(input: LifeInsuranceInput): LifeInsuranceResult {
  const {
    rrspBalance,
    marginalTaxRateAtDeath,
    numberOfHeirs,
    currentAge,
    isSmoker = false,
  } = input;

  const rrspTaxBomb = rrspBalance * marginalTaxRateAtDeath;
  const deathBenefitNeeded = rrspTaxBomb;

  const ratePerThousand = termPremiumPerThousand(currentAge, isSmoker);
  const estimatedAnnualPremium = (deathBenefitNeeded / 1000) * ratePerThousand;
  const estimatedMonthlyPremium = estimatedAnnualPremium / 12;

  const safeHeirs = Math.max(1, numberOfHeirs);
  const inheritancePerHeirWithoutInsurance = (rrspBalance - rrspTaxBomb) / safeHeirs;
  const inheritancePerHeirWithInsurance = rrspBalance / safeHeirs;

  const perHeirGain = Math.round(rrspTaxBomb / safeHeirs).toLocaleString();
  const explanation =
    `Your RRSP will trigger approximately $${Math.round(rrspTaxBomb).toLocaleString()} in tax at death. ` +
    `A $${Math.round(deathBenefitNeeded).toLocaleString()} life insurance policy ` +
    `(est. $${Math.round(estimatedMonthlyPremium).toLocaleString()}/month) would cover this tax, ` +
    `increasing each of your ${safeHeirs} heir${safeHeirs !== 1 ? 's' : ''}'s ` +
    `share by approximately $${perHeirGain}.`;

  return {
    rrspTaxBomb,
    deathBenefitNeeded,
    estimatedAnnualPremium,
    estimatedMonthlyPremium,
    inheritancePerHeirWithoutInsurance,
    inheritancePerHeirWithInsurance,
    explanation,
  };
}

// ─── 4. Principal Residence Nomination Optimizer ─────────────────────────────

export interface PRNominationInput {
  /** Property A — primary home */
  propertyAValue: number;
  propertyAPurchasePrice: number;
  propertyAYearsOwned: number;
  /** Property B — cottage / vacation home */
  propertyBValue: number;
  propertyBPurchasePrice: number;
  propertyBYearsOwned: number;
  /** Effective capital-gains tax rate (50% inclusion × marginal rate, e.g. 0.245) */
  capitalGainsTaxRate: number;
}

export interface PRNominationResult {
  propertyAGain: number;
  propertyBGain: number;
  /** Average annual gain for A (gain ÷ years owned) */
  propertyAGainPerYear: number;
  /** Average annual gain for B */
  propertyBGainPerYear: number;
  /** Optimal PRE designation years for A */
  optimalYearsDesignatedA: number;
  /** Optimal PRE designation years for B */
  optimalYearsDesignatedB: number;
  /** Taxable capital gain remaining for A after optimal PRE */
  optimalTaxableGainA: number;
  /** Taxable capital gain remaining for B after optimal PRE */
  optimalTaxableGainB: number;
  /** Total capital-gains tax with optimal designation */
  optimalTotalTax: number;
  /** Total capital-gains tax using a naive single-property designation */
  worstCaseTotalTax: number;
  /** Tax savings from optimal designation vs. worst case */
  taxSavings: number;
  explanation: string;
}

/**
 * Calculate optimal Principal Residence Exemption (PRE) designation
 * for a household with two properties.
 *
 * Canadian PRE formula:
 *   Exempt gain = gain × (1 + years designated) / years owned    (capped at gain)
 *
 * The "+1" bonus means you can fully exempt a property after only (years_owned − 1)
 * designations, freeing one designation for the other property.
 *
 * Constraint: for each calendar year where BOTH properties are owned simultaneously,
 * only one may be designated as the principal residence.
 */
export function calculatePRNomination(input: PRNominationInput): PRNominationResult {
  const {
    propertyAValue,
    propertyAPurchasePrice,
    propertyAYearsOwned: Y_A,
    propertyBValue,
    propertyBPurchasePrice,
    propertyBYearsOwned: Y_B,
    capitalGainsTaxRate,
  } = input;

  const gainA = Math.max(0, propertyAValue - propertyAPurchasePrice);
  const gainB = Math.max(0, propertyBValue - propertyBPurchasePrice);

  const gpyA = Y_A > 0 ? gainA / Y_A : 0; // gain per year for A
  const gpyB = Y_B > 0 ? gainB / Y_B : 0;

  // "Shared years" = years both properties were owned simultaneously
  // (simplified: assume ownership periods overlap for min(Y_A, Y_B) years)
  const sharedYears = Math.min(Y_A, Y_B);
  const uniqueA = Y_A - sharedYears; // years only A was owned (pre-B)
  const uniqueB = Y_B - sharedYears; // years only B was owned (post-A)

  // Full PRE on a property requires: (1 + d) / years_owned ≥ 1
  // i.e. d ≥ years_owned − 1.
  // For the shared years: we can designate them to A or B.
  // To fully exempt A using shared years: need sharedDesignatedToA ≥ (Y_A − 1) − uniqueA
  //   = (Y_A − 1) − (Y_A − sharedYears) = sharedYears − 1

  const sharedNeededForFullExemptA = Math.max(0, sharedYears - 1);
  const sharedNeededForFullExemptB = Math.max(0, sharedYears - 1);

  let sharedToA: number;
  let sharedToB: number;

  if (gpyA >= gpyB) {
    // Prioritise fully exempting A — use minimum shared years needed, give rest to B
    sharedToA = Math.min(sharedYears, sharedNeededForFullExemptA);
    sharedToB = sharedYears - sharedToA;
  } else {
    // Prioritise fully exempting B
    sharedToB = Math.min(sharedYears, sharedNeededForFullExemptB);
    sharedToA = sharedYears - sharedToB;
  }

  const optimalDesignatedA = uniqueA + sharedToA;
  const optimalDesignatedB = uniqueB + sharedToB;

  const exemptFracA = Y_A > 0 ? Math.min(1, (1 + optimalDesignatedA) / Y_A) : 0;
  const exemptFracB = Y_B > 0 ? Math.min(1, (1 + optimalDesignatedB) / Y_B) : 0;

  const optimalTaxableGainA = gainA * (1 - exemptFracA);
  const optimalTaxableGainB = gainB * (1 - exemptFracB);
  const optimalTotalTax = (optimalTaxableGainA + optimalTaxableGainB) * capitalGainsTaxRate;

  // Worst case: all shared years go to whichever is worse for the other property
  // Option 1 — designate all to A only
  const exemptFracA_only = Y_A > 0 ? Math.min(1, (1 + Y_A) / Y_A) : 0; // ≈ 1.0
  const taxGainA_only = gainA * (1 - exemptFracA_only);
  // B gets no shared designations (only unique years)
  const exemptFracB_no_shared = Y_B > 0 ? Math.min(1, (1 + uniqueB) / Y_B) : 0;
  const taxGainB_only_A = gainB * (1 - exemptFracB_no_shared);
  const taxOption_AllA = (taxGainA_only + taxGainB_only_A) * capitalGainsTaxRate;

  // Option 2 — designate all to B only
  const exemptFracB_only = Y_B > 0 ? Math.min(1, (1 + Y_B) / Y_B) : 0;
  const taxGainB_only = gainB * (1 - exemptFracB_only);
  const exemptFracA_no_shared = Y_A > 0 ? Math.min(1, (1 + uniqueA) / Y_A) : 0;
  const taxGainA_only_B = gainA * (1 - exemptFracA_no_shared);
  const taxOption_AllB = (taxGainA_only_B + taxGainB_only) * capitalGainsTaxRate;

  const worstCaseTotalTax = Math.max(taxOption_AllA, taxOption_AllB);
  const taxSavings = Math.max(0, worstCaseTotalTax - optimalTotalTax);

  const higherGainProperty = gpyA >= gpyB ? 'primary home' : 'cottage';
  const lowerGainProperty = gpyA >= gpyB ? 'cottage' : 'primary home';

  const explanation =
    taxSavings > 100
      ? `Designating ${optimalDesignatedA} year${optimalDesignatedA !== 1 ? 's' : ''} to your primary home ` +
        `and ${optimalDesignatedB} year${optimalDesignatedB !== 1 ? 's' : ''} to your cottage ` +
        `saves $${Math.round(taxSavings).toLocaleString()} in capital gains tax vs. the worst-case single-property strategy. ` +
        `Your ${higherGainProperty} appreciates at $${Math.round(gpyA >= gpyB ? gpyA : gpyB).toLocaleString()}/year, ` +
        `so it earns the most from each PRE designation. ` +
        `The ${lowerGainProperty} still receives ${optimalDesignatedA < optimalDesignatedB ? optimalDesignatedA : optimalDesignatedB} designation${(optimalDesignatedA < optimalDesignatedB ? optimalDesignatedA : optimalDesignatedB) !== 1 ? 's' : ''} via the +1 rule.`
      : `Both properties are nearly fully covered by the principal residence exemption with the current ownership structure. No significant reallocation benefit identified.`;

  return {
    propertyAGain: gainA,
    propertyBGain: gainB,
    propertyAGainPerYear: gpyA,
    propertyBGainPerYear: gpyB,
    optimalYearsDesignatedA: optimalDesignatedA,
    optimalYearsDesignatedB: optimalDesignatedB,
    optimalTaxableGainA,
    optimalTaxableGainB,
    optimalTotalTax,
    worstCaseTotalTax,
    taxSavings,
    explanation,
  };
}

// ─── Combined entry point ─────────────────────────────────────────────────────

export interface LegacyStrategiesInput {
  spouseTrust?: SpouseTrustInput;
  charitableGiving?: CharitableGivingInput;
  lifeInsurance?: LifeInsuranceInput;
  prNomination?: PRNominationInput;
}

export interface LegacyStrategiesResult {
  spouseTrust?: SpouseTrustResult;
  charitableGiving?: CharitableGivingResult;
  lifeInsurance?: LifeInsuranceResult;
  prNomination?: PRNominationResult;
}

export function calculateLegacyStrategies(
  input: LegacyStrategiesInput,
): LegacyStrategiesResult {
  return {
    spouseTrust: input.spouseTrust
      ? calculateSpouseTrust(input.spouseTrust)
      : undefined,
    charitableGiving: input.charitableGiving
      ? calculateCharitableGiving(input.charitableGiving)
      : undefined,
    lifeInsurance: input.lifeInsurance
      ? calculateLifeInsurance(input.lifeInsurance)
      : undefined,
    prNomination: input.prNomination
      ? calculatePRNomination(input.prNomination)
      : undefined,
  };
}
