import { describe, it, expect } from 'vitest';
import { calculateReadinessScore } from '../src/scoring/readiness-score.js';

describe('Readiness Score', () => {
  it('returns a near-perfect score for ideal inputs', () => {
    const result = calculateReadinessScore({
      monteCarloSuccessRate: 1,
      preRetirementGrossIncome: 120_000,
      retirementYearGrossIncome: 120_000,
      actualEffectiveTaxRate: 0,
      optimalEffectiveTaxRate: 0,
      rrspBalance: 100_000,
      tfsaBalance: 100_000,
      nonRegBalance: 100_000,
    });

    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('returns a low score for weak retirement fundamentals', () => {
    const result = calculateReadinessScore({
      monteCarloSuccessRate: 0.3,
      preRetirementGrossIncome: 100_000,
      retirementYearGrossIncome: 30_000,
      actualEffectiveTaxRate: 0.2,
      optimalEffectiveTaxRate: 0,
      rrspBalance: 500_000,
      tfsaBalance: 0,
      nonRegBalance: 0,
    });

    expect(result.score).toBeLessThan(30);
  });

  it('sets diversification component to 0 when all balances are zero', () => {
    const result = calculateReadinessScore({
      monteCarloSuccessRate: 0.9,
      preRetirementGrossIncome: 90_000,
      retirementYearGrossIncome: 70_000,
      actualEffectiveTaxRate: 0.1,
      optimalEffectiveTaxRate: 0.08,
      rrspBalance: 0,
      tfsaBalance: 0,
      nonRegBalance: 0,
    });

    expect(result.diversificationComponent).toBe(0);
  });

  it('guards against division by zero when pre-retirement income is zero', () => {
    const result = calculateReadinessScore({
      monteCarloSuccessRate: 0.9,
      preRetirementGrossIncome: 0,
      retirementYearGrossIncome: 40_000,
      actualEffectiveTaxRate: 0.1,
      optimalEffectiveTaxRate: 0.05,
      rrspBalance: 100_000,
      tfsaBalance: 100_000,
      nonRegBalance: 100_000,
    });

    expect(result.incomeReplacementComponent).toBe(0);
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it('caps issues at three when all four components produce an issue', () => {
    const result = calculateReadinessScore({
      monteCarloSuccessRate: 0.2,
      preRetirementGrossIncome: 100_000,
      retirementYearGrossIncome: 20_000,
      actualEffectiveTaxRate: 0.2,
      optimalEffectiveTaxRate: 0,
      rrspBalance: 1_000_000,
      tfsaBalance: 0,
      nonRegBalance: 0,
    });

    expect(result.issues).toHaveLength(3);
  });

  it('sorts issues by impact with high before medium before low', () => {
    const result = calculateReadinessScore({
      monteCarloSuccessRate: 0.4,
      preRetirementGrossIncome: 100_000,
      retirementYearGrossIncome: 80_000,
      actualEffectiveTaxRate: 0.12,
      optimalEffectiveTaxRate: 0,
      rrspBalance: 850_000,
      tfsaBalance: 100_000,
      nonRegBalance: 50_000,
    });

    expect(result.issues).toHaveLength(3);
    expect(result.issues[0].impact).toBe('high');
    expect(result.issues[1].impact).toBe('medium');
    expect(result.issues[2].impact).toBe('low');
  });
});
