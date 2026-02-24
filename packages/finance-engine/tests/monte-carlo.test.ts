import { describe, it, expect } from 'vitest';
import { runMonteCarloSimulation } from '../src/simulation/monte-carlo.js';

describe('Monte Carlo Simulation', () => {
  const baseInput = {
    currentAge: 60,
    endAge: 90,
    province: 'ON' as const,
    employmentIncome: 0,
    retirementAge: 60,
    annualExpenses: 50_000,
    inflationRate: 0.02,
    nominalReturnRate: 0.06,
    cppStartAge: 65,
    oasStartAge: 65,
    rrspBalance: 500_000,
    tfsaBalance: 100_000,
    nonRegBalance: 200_000,
    trials: 100,
    seed: 42,
    meanReturn: 0.06,
    stdDevReturn: 0.12,
  };

  it('returns the correct number of trials', () => {
    const result = runMonteCarloSimulation(baseInput);
    expect(result.trials).toBe(100);
  });

  it('success rate is between 0 and 1', () => {
    const result = runMonteCarloSimulation(baseInput);
    expect(result.successRate).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeLessThanOrEqual(1);
  });

  it('produces distribution for each year', () => {
    const result = runMonteCarloSimulation(baseInput);
    expect(result.distributionByYear).toHaveLength(31); // 60 to 90 inclusive
  });

  it('median is between p25 and p75', () => {
    const result = runMonteCarloSimulation(baseInput);
    result.distributionByYear.forEach((yr) => {
      expect(yr.median).toBeGreaterThanOrEqual(yr.p25);
      expect(yr.median).toBeLessThanOrEqual(yr.p75);
    });
  });

  it('p5 <= p25 <= median <= p75 <= p95', () => {
    const result = runMonteCarloSimulation(baseInput);
    result.distributionByYear.forEach((yr) => {
      expect(yr.p5).toBeLessThanOrEqual(yr.p25);
      expect(yr.p25).toBeLessThanOrEqual(yr.median);
      expect(yr.median).toBeLessThanOrEqual(yr.p75);
      expect(yr.p75).toBeLessThanOrEqual(yr.p95);
    });
  });

  it('is deterministic with same seed', () => {
    const result1 = runMonteCarloSimulation(baseInput);
    const result2 = runMonteCarloSimulation(baseInput);
    expect(result1.successRate).toBe(result2.successRate);
    expect(result1.distributionByYear[10].median).toBe(result2.distributionByYear[10].median);
  });
});
