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

  it('produces per-member breakdown when member inputs are provided', () => {
    const result = runCashFlowProjection({
      ...baseInput,
      // Force retirement immediately so withdrawals/taxes are generated in first row.
      retirementAge: 55,
      employmentIncome: 0,
      annualExpenses: 90_000,
      members: [
        { id: 'm1', name: 'Alex', province: 'ON' as const },
        { id: 'm2', name: 'Sam', province: 'ON' as const },
      ],
      memberTypeShareTimeline: [
        {
          effectiveYear: new Date().getFullYear(),
          memberId: 'm1',
          rrspShare: 1,
          tfsaShare: 0,
          nonRegShare: 0.7,
          cashShare: 0.5,
        },
        {
          effectiveYear: new Date().getFullYear(),
          memberId: 'm2',
          rrspShare: 0,
          tfsaShare: 1,
          nonRegShare: 0.3,
          cashShare: 0.5,
        },
      ],
      memberIncomeSources: [
        { memberId: 'm1', annualAmount: 20_000, startAge: 55, endAge: 55 },
        { memberId: 'm2', annualAmount: 10_000, startAge: 55, endAge: 55 },
      ],
    });

    const firstYear = result[0];
    expect(firstYear.memberBreakdown).toBeDefined();
    expect(firstYear.memberBreakdown).toHaveLength(2);

    const memberTotalTax = (firstYear.memberBreakdown ?? []).reduce((sum, row) => sum + row.tax, 0);
    expect(Math.abs(memberTotalTax - firstYear.totalTax)).toBeLessThanOrEqual(0.5);

    const m1 = firstYear.memberBreakdown?.find((m) => m.memberId === 'm1');
    const m2 = firstYear.memberBreakdown?.find((m) => m.memberId === 'm2');
    expect(m1).toBeDefined();
    expect(m2).toBeDefined();
    // RRSP split is fully attributed to m1 in timeline above.
    expect(m1!.rrspWithdrawal).toBeGreaterThanOrEqual(m2!.rrspWithdrawal);
  });
});
