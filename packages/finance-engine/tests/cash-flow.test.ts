import { describe, it, expect } from 'vitest';
import { runCashFlowProjection } from '../src/projection/cash-flow.js';

describe('Cash Flow Projection', () => {
  const baseInput = {
    currentAge: 55,
    endAge: 90,
    province: 'ON' as const,
    employmentIncome: 100_000,
    retirementAge: 65,
    annualExpenses: 60_000,
    inflationRate: 0.02,
    nominalReturnRate: 0.06,
    cppStartAge: 65,
    oasStartAge: 65,
    rrspBalance: 500_000,
    tfsaBalance: 80_000,
    nonRegBalance: 100_000,
    rrspContribution: 15_000,
    tfsaContribution: 7_000,
  };

  it('produces correct number of years', () => {
    const result = runCashFlowProjection(baseInput);
    expect(result).toHaveLength(36); // 55 to 90 inclusive
  });

  it('first year age matches input', () => {
    const result = runCashFlowProjection(baseInput);
    expect(result[0].age).toBe(55);
  });

  it('has employment income before retirement', () => {
    const result = runCashFlowProjection(baseInput);
    const preRetirement = result.filter((y) => y.age < 65);
    preRetirement.forEach((y) => {
      expect(y.employmentIncome).toBeGreaterThan(0);
    });
  });

  it('has zero employment income after retirement', () => {
    const result = runCashFlowProjection(baseInput);
    const postRetirement = result.filter((y) => y.age >= 65);
    postRetirement.forEach((y) => {
      expect(y.employmentIncome).toBe(0);
    });
  });

  it('has CPP income starting at cppStartAge', () => {
    const result = runCashFlowProjection(baseInput);
    const atAge65 = result.find((y) => y.age === 65);
    expect(atAge65?.cppIncome).toBeGreaterThan(0);
  });

  it('has OAS income starting at oasStartAge', () => {
    const result = runCashFlowProjection(baseInput);
    const atAge65 = result.find((y) => y.age === 65);
    expect(atAge65?.oasIncome).toBeGreaterThan(0);
  });

  it('total tax is always non-negative', () => {
    const result = runCashFlowProjection(baseInput);
    result.forEach((y) => {
      expect(y.totalTax).toBeGreaterThanOrEqual(0);
    });
  });

  it('balances grow during accumulation', () => {
    const result = runCashFlowProjection(baseInput);
    // After a few years of contributions + growth, RRSP should be higher
    expect(result[5].rrspBalance).toBeGreaterThan(baseInput.rrspBalance);
  });

  it('net worth starts positive', () => {
    const result = runCashFlowProjection(baseInput);
    expect(result[0].totalNetWorth).toBeGreaterThan(0);
  });
});
