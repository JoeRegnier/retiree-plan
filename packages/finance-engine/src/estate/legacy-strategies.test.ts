/**
 * Unit tests for legacy-strategies.ts — Feature 7.3 Legacy & Estate Giving Planner
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSpouseTrust,
  calculateCharitableGiving,
  calculateLifeInsurance,
  calculatePRNomination,
  calculateLegacyStrategies,
} from './legacy-strategies.js';

// ─── 1. Spousal Trust ────────────────────────────────────────────────────────

describe('calculateSpouseTrust', () => {
  it('returns zero net benefit when rates and growth are equal', () => {
    const result = calculateSpouseTrust({
      rrspBalance: 400_000,
      marginalTaxRateAtDeath: 0.50,
      survivorMarginalRate: 0.50,
      deferralYears: 0,
      rrspGrowthRate: 0.0,
    });
    // No growth, same rate → no benefit from deferral
    expect(result.netBenefitVsNoRollover).toBeCloseTo(0, 2);
    expect(result.taxDeferredAtFirstDeath).toBeCloseTo(200_000, 2);
    expect(result.rrspValueAtSurvivorDeath).toBeCloseTo(400_000, 2);
    expect(result.eventualTaxAtSurvivorDeath).toBeCloseTo(200_000, 2);
  });

  it('rollover is beneficial when survivor is in a lower tax bracket', () => {
    const result = calculateSpouseTrust({
      rrspBalance: 500_000,
      marginalTaxRateAtDeath: 0.53,
      survivorMarginalRate: 0.43,
      deferralYears: 15,
      rrspGrowthRate: 0.05,
    });
    // Should be positive: RRSP grows AND is ultimately taxed at a lower rate
    expect(result.netBenefitVsNoRollover).toBeGreaterThan(0);
    expect(result.taxDeferredAtFirstDeath).toBeCloseTo(500_000 * 0.53, 2);
    expect(result.rrspValueAtSurvivorDeath).toBeCloseTo(
      500_000 * Math.pow(1.05, 15),
      2,
    );
    expect(result.explanation).toBeTruthy();
  });

  it('handles zero deferral years (same-year death)', () => {
    const result = calculateSpouseTrust({
      rrspBalance: 300_000,
      marginalTaxRateAtDeath: 0.50,
      survivorMarginalRate: 0.45,
      deferralYears: 0,
      rrspGrowthRate: 0.06,
    });
    expect(result.rrspValueAtSurvivorDeath).toBeCloseTo(300_000, 2);
    // With same balance and lower rate, net benefit is positive
    expect(result.netBenefitVsNoRollover).toBeGreaterThan(0);
  });
});

// ─── 2. Charitable Giving ────────────────────────────────────────────────────

describe('calculateCharitableGiving', () => {
  it('correctly calculates Ontario donation credit', () => {
    const result = calculateCharitableGiving({
      donationAmount: 10_000,
      province: 'ON',
      isDaf: false,
    });
    // Federal: $200 × 0.15 + $9,800 × 0.29 = $30 + $2,842 = $2,872
    expect(result.federalCredit).toBeCloseTo(200 * 0.15 + 9800 * 0.29, 2);
    // Provincial ON: $200 × 0.0505 + $9,800 × 0.1716
    expect(result.provincialCredit).toBeCloseTo(200 * 0.0505 + 9800 * 0.1716, 2);
    expect(result.totalCredit).toBeCloseTo(result.federalCredit + result.provincialCredit, 2);
    expect(result.netCostAfterCredit).toBeCloseTo(
      10_000 - result.totalCredit,
      2,
    );
    expect(result.effectiveDonationRate).toBeCloseTo(result.totalCredit / 10_000, 4);
    expect(result.dafAnnualGrant).toBeUndefined();
  });

  it('calculates DAF grant years correctly', () => {
    const result = calculateCharitableGiving({
      donationAmount: 50_000,
      province: 'BC',
      isDaf: true,
      dafGrantYears: 5,
    });
    expect(result.dafAnnualGrant).toBeCloseTo(10_000, 2);
    expect(result.explanation).toContain('Donor-Advised Fund');
  });

  it('handles donation of exactly $200', () => {
    const result = calculateCharitableGiving({
      donationAmount: 200,
      province: 'ON',
      isDaf: false,
    });
    expect(result.federalCredit).toBeCloseTo(200 * 0.15, 2);
    expect(result.provincialCredit).toBeCloseTo(200 * 0.0505, 2);
  });

  it('effective rate is higher for larger donations (over $200 tier)', () => {
    const small = calculateCharitableGiving({
      donationAmount: 200,
      province: 'ON',
      isDaf: false,
    });
    const large = calculateCharitableGiving({
      donationAmount: 5_000,
      province: 'ON',
      isDaf: false,
    });
    expect(large.effectiveDonationRate).toBeGreaterThan(small.effectiveDonationRate);
  });

  it('net cost is never negative', () => {
    const result = calculateCharitableGiving({
      donationAmount: 100,
      province: 'QC',
      isDaf: false,
    });
    expect(result.netCostAfterCredit).toBeGreaterThanOrEqual(0);
  });

  it('defaults to ON rates for unknown province', () => {
    const on = calculateCharitableGiving({
      donationAmount: 10_000,
      province: 'ON',
      isDaf: false,
    });
    const unknown = calculateCharitableGiving({
      donationAmount: 10_000,
      province: 'XX',
      isDaf: false,
    });
    expect(unknown.totalCredit).toBeCloseTo(on.totalCredit, 2);
  });
});

// ─── 3. Life Insurance ───────────────────────────────────────────────────────

describe('calculateLifeInsurance', () => {
  it('calculates RRSP tax bomb correctly', () => {
    const result = calculateLifeInsurance({
      rrspBalance: 600_000,
      marginalTaxRateAtDeath: 0.50,
      numberOfHeirs: 2,
      currentAge: 60,
    });
    expect(result.rrspTaxBomb).toBeCloseTo(300_000, 2);
    expect(result.deathBenefitNeeded).toBeCloseTo(300_000, 2);
  });

  it('estimates monthly premium as annual / 12', () => {
    const result = calculateLifeInsurance({
      rrspBalance: 500_000,
      marginalTaxRateAtDeath: 0.50,
      numberOfHeirs: 3,
      currentAge: 55,
    });
    expect(result.estimatedMonthlyPremium).toBeCloseTo(
      result.estimatedAnnualPremium / 12,
      4,
    );
  });

  it('smoker premium is higher than non-smoker', () => {
    const base = {
      rrspBalance: 400_000,
      marginalTaxRateAtDeath: 0.50,
      numberOfHeirs: 2,
      currentAge: 60,
    };
    const nonSmoker = calculateLifeInsurance({ ...base, isSmoker: false });
    const smoker = calculateLifeInsurance({ ...base, isSmoker: true });
    expect(smoker.estimatedAnnualPremium).toBeGreaterThan(nonSmoker.estimatedAnnualPremium);
  });

  it('with-insurance inheritance exceeds without-insurance per heir', () => {
    const result = calculateLifeInsurance({
      rrspBalance: 500_000,
      marginalTaxRateAtDeath: 0.50,
      numberOfHeirs: 2,
      currentAge: 60,
    });
    expect(result.inheritancePerHeirWithInsurance).toBeGreaterThan(
      result.inheritancePerHeirWithoutInsurance,
    );
    expect(
      result.inheritancePerHeirWithInsurance - result.inheritancePerHeirWithoutInsurance,
    ).toBeCloseTo(result.rrspTaxBomb / 2, 2);
  });

  it('returns sensible values for edge-case age 40', () => {
    const result = calculateLifeInsurance({
      rrspBalance: 200_000,
      marginalTaxRateAtDeath: 0.40,
      numberOfHeirs: 1,
      currentAge: 40,
    });
    expect(result.estimatedAnnualPremium).toBeGreaterThan(0);
    expect(result.estimatedMonthlyPremium).toBeGreaterThan(0);
  });
});

// ─── 4. Principal Residence Nomination ───────────────────────────────────────

describe('calculatePRNomination', () => {
  it('fully exempts higher-gain property when gains are unequal', () => {
    // Primary home: gain $500K over 20 years = $25K/yr
    // Cottage: gain $100K over 10 years = $10K/yr
    const result = calculatePRNomination({
      propertyAValue: 800_000,
      propertyAPurchasePrice: 300_000,
      propertyAYearsOwned: 20,
      propertyBValue: 300_000,
      propertyBPurchasePrice: 200_000,
      propertyBYearsOwned: 10,
      capitalGainsTaxRate: 0.245,
    });
    // Primary home has higher gain/year → should be (nearly) fully exempt
    expect(result.optimalTaxableGainA).toBeLessThan(result.optimalTaxableGainB + 1);
    expect(result.propertyAGain).toBeCloseTo(500_000, 2);
    expect(result.propertyBGain).toBeCloseTo(100_000, 2);
    expect(result.optimalTotalTax).toBeLessThanOrEqual(result.worstCaseTotalTax + 1);
  });

  it('returns zero tax savings when PRE fully covers both (tiny gains)', () => {
    // Both properties owned for 1 year only with tiny gains → +1 rule fully covers
    const result = calculatePRNomination({
      propertyAValue: 100_001,
      propertyAPurchasePrice: 100_000,
      propertyAYearsOwned: 1,
      propertyBValue: 200_001,
      propertyBPurchasePrice: 200_000,
      propertyBYearsOwned: 1,
      capitalGainsTaxRate: 0.245,
    });
    // With 1 year owned: (1+1)/1 = 2 which caps at 1.0 → both fully exempt
    expect(result.optimalTotalTax).toBeCloseTo(0, 2);
  });

  it('gains per year are calculated correctly', () => {
    const result = calculatePRNomination({
      propertyAValue: 600_000,
      propertyAPurchasePrice: 200_000,
      propertyAYearsOwned: 10,
      propertyBValue: 400_000,
      propertyBPurchasePrice: 100_000,
      propertyBYearsOwned: 15,
      capitalGainsTaxRate: 0.245,
    });
    expect(result.propertyAGainPerYear).toBeCloseTo(40_000, 2); // 400K / 10
    expect(result.propertyBGainPerYear).toBeCloseTo(20_000, 2); // 300K / 15
  });

  it('zero gain properties produce zero tax', () => {
    const result = calculatePRNomination({
      propertyAValue: 500_000,
      propertyAPurchasePrice: 500_000,
      propertyAYearsOwned: 10,
      propertyBValue: 300_000,
      propertyBPurchasePrice: 300_000,
      propertyBYearsOwned: 8,
      capitalGainsTaxRate: 0.245,
    });
    expect(result.optimalTotalTax).toBeCloseTo(0, 2);
    expect(result.worstCaseTotalTax).toBeCloseTo(0, 2);
    expect(result.taxSavings).toBeCloseTo(0, 2);
  });

  it('optimal tax is always ≤ worst-case tax', () => {
    const testCases = [
      { gainA: 500_000, gainB: 200_000, yA: 20, yB: 10 },
      { gainA: 100_000, gainB: 400_000, yA: 5, yB: 15 },
      { gainA: 300_000, gainB: 300_000, yA: 10, yB: 10 },
    ];
    for (const tc of testCases) {
      const result = calculatePRNomination({
        propertyAValue: 100_000 + tc.gainA,
        propertyAPurchasePrice: 100_000,
        propertyAYearsOwned: tc.yA,
        propertyBValue: 100_000 + tc.gainB,
        propertyBPurchasePrice: 100_000,
        propertyBYearsOwned: tc.yB,
        capitalGainsTaxRate: 0.245,
      });
      expect(result.optimalTotalTax).toBeLessThanOrEqual(result.worstCaseTotalTax + 0.01);
    }
  });
});

// ─── Combined entry point ─────────────────────────────────────────────────────

describe('calculateLegacyStrategies', () => {
  it('returns only the provided strategy results', () => {
    const result = calculateLegacyStrategies({
      charitableGiving: {
        donationAmount: 5_000,
        province: 'ON',
        isDaf: false,
      },
    });
    expect(result.charitableGiving).toBeDefined();
    expect(result.spouseTrust).toBeUndefined();
    expect(result.lifeInsurance).toBeUndefined();
    expect(result.prNomination).toBeUndefined();
  });

  it('returns all four strategies when all inputs provided', () => {
    const result = calculateLegacyStrategies({
      spouseTrust: {
        rrspBalance: 500_000,
        marginalTaxRateAtDeath: 0.50,
        survivorMarginalRate: 0.43,
        deferralYears: 15,
        rrspGrowthRate: 0.05,
      },
      charitableGiving: {
        donationAmount: 10_000,
        province: 'ON',
        isDaf: false,
      },
      lifeInsurance: {
        rrspBalance: 500_000,
        marginalTaxRateAtDeath: 0.50,
        numberOfHeirs: 2,
        currentAge: 60,
      },
      prNomination: {
        propertyAValue: 900_000,
        propertyAPurchasePrice: 300_000,
        propertyAYearsOwned: 20,
        propertyBValue: 500_000,
        propertyBPurchasePrice: 200_000,
        propertyBYearsOwned: 10,
        capitalGainsTaxRate: 0.245,
      },
    });
    expect(result.spouseTrust).toBeDefined();
    expect(result.charitableGiving).toBeDefined();
    expect(result.lifeInsurance).toBeDefined();
    expect(result.prNomination).toBeDefined();
  });
});
