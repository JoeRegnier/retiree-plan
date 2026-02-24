import { describe, it, expect } from 'vitest';
import { optimizeRrspMeltdown } from '@retiree-plan/finance-engine';

describe('RRSP Meltdown Optimizer', () => {
  it('returns a result with at least 1 year', () => {
    const result = optimizeRrspMeltdown({
      currentAge: 55,
      rrspBalance: 500_000,
      otherAnnualIncome: 40_000,
      province: 'ON',
      expectedReturn: 0.06,
    });
    expect(result.years.length).toBeGreaterThan(0);
    expect(result.taxSavings).toBeGreaterThanOrEqual(0);
    expect(result.strategy).toBeTruthy();
  });

  it('provides correct shape per year', () => {
    const result = optimizeRrspMeltdown({
      currentAge: 60,
      rrifConversionAge: 71,
      rrspBalance: 300_000,
      otherAnnualIncome: 30_000,
      province: 'BC',
      expectedReturn: 0.05,
    });
    const year = result.years[0];
    expect(typeof year.age).toBe('number');
    expect(typeof year.optimalWithdrawal).toBe('number');
    expect(typeof year.rrspBalanceEnd).toBe('number');
    expect(typeof year.effectiveRate).toBe('number');
  });

  it('balance declines when withdrawals exceed growth', () => {
    const result = optimizeRrspMeltdown({
      currentAge: 65,
      rrifConversionAge: 71,
      rrspBalance: 100_000,
      otherAnnualIncome: 70_000,
      province: 'AB',
      expectedReturn: 0.04,
    });
    // With high other income, any withdrawal will reduce balance faster
    if (result.years.length >= 2) {
      expect(result.years[result.years.length - 1].rrspBalanceEnd)
        .toBeLessThanOrEqual(result.years[0].rrspBalanceStart);
    }
  });
});

describe('API smoke tests', () => {
  it('OptimizationModule exists', async () => {
    const { OptimizationModule } = await import('../src/optimization/optimization.module');
    expect(OptimizationModule).toBeDefined();
  });

  it('HistoricalReturnsModule exists', async () => {
    const { HistoricalReturnsModule } = await import('../src/historical-returns/historical-returns.module');
    expect(HistoricalReturnsModule).toBeDefined();
  });
});
