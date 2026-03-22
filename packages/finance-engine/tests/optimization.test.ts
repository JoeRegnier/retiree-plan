import { describe, it, expect } from 'vitest';
import { compareWithdrawalStrategies } from '../src/optimization/withdrawal-optimizer.js';
import { analyzeSpousalRrsp } from '../src/optimization/spousal-rrsp.js';
import { runBucketProjection } from '../src/optimization/bucket-strategy.js';

const BASE_INPUT = {
  currentAge: 65,
  endAge: 90,
  province: 'ON' as const,
  employmentIncome: 0,
  retirementAge: 65,
  annualExpenses: 60_000,
  inflationRate: 0.02,
  nominalReturnRate: 0.06,
  cppStartAge: 65,
  oasStartAge: 65,
  rrspBalance: 500_000,
  tfsaBalance: 100_000,
  nonRegBalance: 150_000,
  rrspContribution: 0,
  tfsaContribution: 0,
};

// ─── Withdrawal Optimizer Tests ───────────────────────────────────────────────

describe('compareWithdrawalStrategies', () => {
  it('returns results for all 5 built-in strategies', () => {
    const result = compareWithdrawalStrategies(BASE_INPUT);
    expect(result.strategies).toHaveLength(5);
    const ids = result.strategies.map((s) => s.strategyId);
    expect(ids).toContain('oas-optimized');
    expect(ids).toContain('rrsp-first');
    expect(ids).toContain('tfsa-last');
    expect(ids).toContain('non-reg-first');
    expect(ids).toContain('proportional');
  });

  it('custom strategy is excluded by default', () => {
    const result = compareWithdrawalStrategies(BASE_INPUT);
    const ids = result.strategies.map((s) => s.strategyId);
    expect(ids).not.toContain('custom');
  });

  it('names a recommended strategy', () => {
    const result = compareWithdrawalStrategies(BASE_INPUT);
    expect(result.recommendedStrategyId).toBeTruthy();
    expect(result.strategies.map((s) => s.strategyId)).toContain(result.recommendedStrategyId);
  });

  it('estimated savings is non-negative', () => {
    const result = compareWithdrawalStrategies(BASE_INPUT);
    expect(result.estimatedSavings).toBeGreaterThanOrEqual(0);
  });

  it('all strategies have valid lifetime tax values', () => {
    const result = compareWithdrawalStrategies(BASE_INPUT);
    for (const s of result.strategies) {
      expect(s.totalLifetimeTax).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(s.totalLifetimeTax)).toBe(true);
    }
  });

  it('recommended strategy has lower or equal tax than others', () => {
    const result = compareWithdrawalStrategies(BASE_INPUT);
    const bestTax = result.strategies.find((s) => s.strategyId === result.recommendedStrategyId)!.totalLifetimeTax;
    for (const s of result.strategies) {
      // Allow ≤ $100 rounding tolerance
      expect(s.totalLifetimeTax + 100).toBeGreaterThanOrEqual(bestTax);
    }
  });
});

// ─── Spousal RRSP Tests ───────────────────────────────────────────────────────

describe('analyzeSpousalRrsp', () => {
  const BASE_SPOUSAL = {
    contributorIncome: 120_000,
    annuitantIncome: 30_000,
    proposedContribution: 10_000,
    contributorProvince: 'ON',
    annuitantProvince: 'ON',
    lastContributionYear: 2022,
    plannedWithdrawalYear: 2030,
    currentYear: 2024,
  };

  it('returns a positive net saving when incomes differ significantly', () => {
    const result = analyzeSpousalRrsp(BASE_SPOUSAL);
    expect(result.netAnnualSaving).toBeGreaterThan(0);
  });

  it('recommends contribution when saving is positive and no attribution risk', () => {
    const result = analyzeSpousalRrsp(BASE_SPOUSAL);
    expect(result.attributionRisk).toBe(false);
    expect(result.recommendContribution).toBe(true);
  });

  it('detects attribution risk when withdrawal is within 3 years of contribution', () => {
    const result = analyzeSpousalRrsp({
      ...BASE_SPOUSAL,
      lastContributionYear: 2024,
      plannedWithdrawalYear: 2025, // Only 1 year later — attribution applies
    });
    expect(result.attributionRisk).toBe(true);
  });

  it('does not recommend when attribution risk is present and withdrawal is soon', () => {
    const result = analyzeSpousalRrsp({
      ...BASE_SPOUSAL,
      lastContributionYear: 2024,
      plannedWithdrawalYear: 2024, // Same year — attribution applies
    });
    expect(result.attributionRisk).toBe(true);
    expect(result.recommendContribution).toBe(false);
  });

  it('safeLiftYear is 3 years after last contribution', () => {
    const result = analyzeSpousalRrsp({ ...BASE_SPOUSAL, lastContributionYear: 2023 });
    expect(result.safeLiftYear).toBe(2026);
  });

  it('contributor tax saved is greater than annuitant tax owed for high-income contributor', () => {
    const result = analyzeSpousalRrsp(BASE_SPOUSAL);
    expect(result.contributorTaxSaved).toBeGreaterThan(result.annuitantTaxOwed);
  });
});

// ─── Bucket Strategy Tests ────────────────────────────────────────────────────

describe('runBucketProjection', () => {
  const BASE_BUCKET = {
    currentAge: 65,
    lifeExpectancyAge: 90,
    totalPortfolio: 1_000_000,
    annualExpenses: 50_000,
    inflationRate: 0.02,
  };

  it('produces the correct number of projection years', () => {
    const result = runBucketProjection(BASE_BUCKET);
    expect(result.years).toHaveLength(90 - 65 + 1); // 65 to 90 inclusive
  });

  it('first year age matches currentAge', () => {
    const result = runBucketProjection(BASE_BUCKET);
    expect(result.years[0].age).toBe(65);
  });

  it('initial bucket allocations sum to totalPortfolio', () => {
    const result = runBucketProjection(BASE_BUCKET);
    // The initial split is done before the simulation starts; use initialBucket* fields
    const total = result.initialBucket1 + result.initialBucket2 + result.initialBucket3;
    // Allow $1 rounding
    expect(Math.abs(total - BASE_BUCKET.totalPortfolio)).toBeLessThan(2);
  });

  it('survives full period with $1M portfolio at $50k/yr expenses', () => {
    const result = runBucketProjection(BASE_BUCKET);
    expect(result.portfolioSurvivesFullPeriod).toBe(true);
    expect(result.portfolioDepletionAge).toBeNull();
  });

  it('depletes with very low portfolio', () => {
    const result = runBucketProjection({
      ...BASE_BUCKET,
      totalPortfolio: 200_000,
      annualExpenses: 80_000,
    });
    // 200k at 80k/yr with inflation — will run out
    expect(result.portfolioSurvivesFullPeriod).toBe(false);
    expect(result.portfolioDepletionAge).not.toBeNull();
  });

  it('all bucket balances are non-negative', () => {
    const result = runBucketProjection(BASE_BUCKET);
    for (const y of result.years) {
      expect(y.bucket1Balance).toBeGreaterThanOrEqual(0);
      expect(y.bucket2Balance).toBeGreaterThanOrEqual(0);
      expect(y.bucket3Balance).toBeGreaterThanOrEqual(0);
    }
  });

  it('expenses increase with inflation each year', () => {
    const result = runBucketProjection({ ...BASE_BUCKET, inflationRate: 0.03 });
    const firstExpenses = result.years[0].expenses;
    const lastExpenses = result.years[result.years.length - 1].expenses;
    expect(lastExpenses).toBeGreaterThan(firstExpenses);
  });
});
