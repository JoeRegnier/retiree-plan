/**
 * Projections & Simulation Unit Tests
 *
 * Tests the ProjectionsService and the underlying finance-engine
 * functions directly. No real DB required — the backtest test
 * supplies inline historicalReturns rows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectionsService } from '../src/projections/projections.service';
import type { CashFlowInput } from '@retiree-plan/finance-engine';
import type { MonteCarloInput } from '@retiree-plan/finance-engine';
import type { EstateInput } from '@retiree-plan/finance-engine';
import type { GKInput } from '@retiree-plan/finance-engine';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

/** Minimal valid CashFlowInput for a 60-year-old retiring at 65 */
const baseCashFlowInput: CashFlowInput = {
  currentAge: 60,
  endAge: 90,
  province: 'ON',
  employmentIncome: 80_000,
  retirementAge: 65,
  annualExpenses: 50_000,
  inflationRate: 0.02,
  nominalReturnRate: 0.06,
  cppStartAge: 65,
  cppBenefitFraction: 0.8,
  oasStartAge: 65,
  oasResidencyYears: 40,
  rrspBalance: 300_000,
  tfsaBalance: 100_000,
  nonRegBalance: 50_000,
};

/** Prisma mock — only historicalReturn needed for backtest */
function makePrismaMock() {
  return {
    historicalReturn: {
      findMany: vi.fn(),
    },
  } as any;
}

// ─── ProjectionsService — cash flow ──────────────────────────────────────────
describe('ProjectionsService.runProjection', () => {
  let service: ProjectionsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ProjectionsService(prisma);
  });

  it('returns an array covering currentAge to endAge', () => {
    const result = service.runProjection(baseCashFlowInput);
    expect(Array.isArray(result)).toBe(true);
    const expectedYears = baseCashFlowInput.endAge - baseCashFlowInput.currentAge + 1;
    expect(result).toHaveLength(expectedYears);
  });

  it('first row has correct age and year', () => {
    const result = service.runProjection(baseCashFlowInput);
    expect(result[0].age).toBe(baseCashFlowInput.currentAge);
    expect(typeof result[0].year).toBe('number');
    expect(result[0].year).toBeGreaterThan(2020);
  });

  it('rows contain numeric financial fields', () => {
    const result = service.runProjection(baseCashFlowInput);
    const row = result[0];
    expect(typeof row.totalIncome).toBe('number');
    expect(typeof row.expenses).toBe('number');
    expect(typeof row.rrspBalance).toBe('number');
    expect(typeof row.tfsaBalance).toBe('number');
    expect(typeof row.nonRegBalance).toBe('number');
  });

  it('pre-retirement rows have employment income > 0', () => {
    const result = service.runProjection(baseCashFlowInput);
    const preRetirementRows = result.filter(r => r.age < baseCashFlowInput.retirementAge);
    const allHaveIncome = preRetirementRows.every(r => r.totalIncome > 0);
    expect(allHaveIncome).toBe(true);
  });

  it('portfolio balances are non-negative through retirement with sufficient assets', () => {
    const richInput: CashFlowInput = {
      ...baseCashFlowInput,
      rrspBalance: 2_000_000,
      tfsaBalance: 500_000,
      nonRegBalance: 500_000,
    };
    const result = service.runProjection(richInput);
    const totalBalances = result.map(r => r.rrspBalance + r.tfsaBalance + r.nonRegBalance);
    const allNonNegative = totalBalances.every(b => b >= 0);
    expect(allNonNegative).toBe(true);
  });

  it('retirement age row shows CPP income', () => {
    const result = service.runProjection(baseCashFlowInput);
    const retirementRow = result.find(r => r.age === baseCashFlowInput.cppStartAge);
    expect(retirementRow).toBeDefined();
    // CPP income should appear
    expect(retirementRow!.cppIncome).toBeGreaterThan(0);
  });
});

// ─── ProjectionsService — Monte Carlo ────────────────────────────────────────
describe('ProjectionsService.runMonteCarlo', () => {
  let service: ProjectionsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ProjectionsService(prisma);
  });

  const monteCarloInput: MonteCarloInput = {
    ...baseCashFlowInput,
    trials: 200,
    meanReturn: 0.06,
    stdDevReturn: 0.12,
    seed: 42,
  };

  it('returns successRate, trials, and percentilesByYear', () => {
    const result = service.runMonteCarlo(monteCarloInput);
    expect(typeof result.successRate).toBe('number');
    expect(typeof result.trials).toBe('number');
    expect(Array.isArray(result.percentilesByYear)).toBe(true);
  });

  it('successRate is between 0 and 100', () => {
    const result = service.runMonteCarlo(monteCarloInput);
    expect(result.successRate).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeLessThanOrEqual(100);
  });

  it('percentilesByYear has one entry per projection year', () => {
    const result = service.runMonteCarlo(monteCarloInput);
    const expectedYears = monteCarloInput.endAge - monteCarloInput.currentAge + 1;
    expect(result.percentilesByYear).toHaveLength(expectedYears);
  });

  it('percentile rows contain age, p5, p25, p50, p75, p95', () => {
    const result = service.runMonteCarlo(monteCarloInput);
    const row = result.percentilesByYear[0];
    expect(typeof row.age).toBe('number');
    expect(typeof row.p5).toBe('number');
    expect(typeof row.p25).toBe('number');
    expect(typeof row.p50).toBe('number');
    expect(typeof row.p75).toBe('number');
    expect(typeof row.p95).toBe('number');
  });

  it('p5 ≤ p25 ≤ p50 ≤ p75 ≤ p95 in first year', () => {
    const result = service.runMonteCarlo(monteCarloInput);
    const row = result.percentilesByYear[0];
    expect(row.p5).toBeLessThanOrEqual(row.p25);
    expect(row.p25).toBeLessThanOrEqual(row.p50);
    expect(row.p50).toBeLessThanOrEqual(row.p75);
    expect(row.p75).toBeLessThanOrEqual(row.p95);
  });

  it('seeded runs produce identical results', () => {
    const r1 = service.runMonteCarlo({ ...monteCarloInput, seed: 99 });
    const r2 = service.runMonteCarlo({ ...monteCarloInput, seed: 99 });
    expect(r1.successRate).toBe(r2.successRate);
    expect(r1.percentilesByYear[0].p50).toBe(r2.percentilesByYear[0].p50);
  });

  it('well-funded plan has high success rate', () => {
    const result = service.runMonteCarlo({
      ...monteCarloInput,
      rrspBalance: 3_000_000,
      tfsaBalance: 1_000_000,
      nonRegBalance: 500_000,
      seed: 1,
    });
    expect(result.successRate).toBeGreaterThan(80);
  });
});

// ─── ProjectionsService — Backtest ───────────────────────────────────────────
describe('ProjectionsService.runBacktest', () => {
  let service: ProjectionsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  /** Build minimal historical return rows for two assets over 30 years */
  function makeHistoricalRows() {
    const rows: { year: number; asset: string; returnRate: number }[] = [];
    for (let y = 1990; y <= 2024; y++) {
      rows.push({ year: y, asset: 'TSX', returnRate: 0.07 });
      rows.push({ year: y, asset: 'CA_BOND', returnRate: 0.04 });
    }
    return rows;
  }

  beforeEach(() => {
    prisma = makePrismaMock();
    prisma.historicalReturn.findMany.mockResolvedValue(makeHistoricalRows());
    service = new ProjectionsService(prisma);
  });

  const backtestInput = {
    currentAge: 60,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualExpensesInRetirement: 50_000,
    annualIncome: 80_000,
    rrspBalance: 500_000,
    tfsaBalance: 100_000,
    nonRegBalance: 50_000,
    annualSavings: 20_000,
    equityFraction: 0.6,
  };

  it('fetches historicalReturns from DB', async () => {
    await service.runBacktest(backtestInput);
    expect(prisma.historicalReturn.findMany).toHaveBeenCalledOnce();
  });

  it('returns successRate and numWindows', async () => {
    const result = await service.runBacktest(backtestInput);
    expect(typeof result.successRate).toBe('number');
    expect(typeof result.numWindows).toBe('number');
    expect(result.numWindows).toBeGreaterThan(0);
  });

  it('successRate is between 0 and 100', async () => {
    const result = await service.runBacktest(backtestInput);
    expect(result.successRate).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeLessThanOrEqual(100);
  });

  it('windows array is present and non-empty', async () => {
    const result = await service.runBacktest(backtestInput);
    expect(Array.isArray(result.windows)).toBe(true);
    expect(result.windows.length).toBeGreaterThan(0);
  });

  it('each window has startYear, endYear, survived fields', async () => {
    const result = await service.runBacktest(backtestInput);
    const w = result.windows[0];
    expect(typeof w.startYear).toBe('number');
    expect(typeof w.endYear).toBe('number');
    expect(typeof w.survived).toBe('boolean');
  });
});

// ─── ProjectionsService — Guyton-Klinger ─────────────────────────────────────
describe('ProjectionsService.runGKSimulation', () => {
  let service: ProjectionsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ProjectionsService(prisma);
  });

  const gkInput: GKInput = {
    initialPortfolio: 1_000_000,
    initialWithdrawal: 50_000,
    expectedReturn: 0.06,
    inflationRate: 0.02,
    stdDevReturn: 0.10,
    upperGuardrailRate: 0.06,
    lowerGuardrailRate: 0.04,
    years: 30,
    seed: 7,
  };

  it('returns a years array with correct length', () => {
    const result = service.runGKSimulation(gkInput);
    expect(Array.isArray(result.years)).toBe(true);
    expect(result.years).toHaveLength(gkInput.years);
  });

  it('each year row has portfolioValue, withdrawal, withdrawalRate', () => {
    const result = service.runGKSimulation(gkInput);
    const row = result.years[0];
    expect(typeof row.portfolioValue).toBe('number');
    expect(typeof row.withdrawal).toBe('number');
    expect(typeof row.withdrawalRate).toBe('number');
  });

  it('guardrailAction is one of cut | increase | none', () => {
    const result = service.runGKSimulation(gkInput);
    const validActions = new Set(['cut', 'increase', 'none']);
    result.years.forEach(r => {
      expect(validActions.has(r.guardrailAction)).toBe(true);
    });
  });

  it('seeded runs produce identical results', () => {
    const r1 = service.runGKSimulation({ ...gkInput, seed: 55 });
    const r2 = service.runGKSimulation({ ...gkInput, seed: 55 });
    expect(r1.years[0].portfolioValue).toBe(r2.years[0].portfolioValue);
  });
});

// ─── ProjectionsService — Estate calculation ─────────────────────────────────
describe('ProjectionsService.runEstateCalculation', () => {
  let service: ProjectionsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ProjectionsService(prisma);
  });

  const estateInput: EstateInput = {
    rrspBalance: 400_000,
    tfsaBalance: 150_000,
    nonRegBalance: 100_000,
    nonRegACB: 60_000,
    primaryResidenceValue: 800_000,
    otherAssetsValue: 50_000,
    otherAssetsACB: 30_000,
    liabilities: 50_000,
    marginalTaxRateAtDeath: 0.50,
    capitalGainsTaxRate: 0.25,
    province: 'ON',
  };

  it('returns grossEstate, netEstateToHeirs, and totalTaxAndFees', () => {
    const result = service.runEstateCalculation(estateInput);
    expect(typeof result.grossEstate).toBe('number');
    expect(typeof result.netEstateToHeirs).toBe('number');
    expect(typeof result.totalTaxAndFees).toBe('number');
  });

  it('grossEstate equals sum of assets minus liabilities', () => {
    const result = service.runEstateCalculation(estateInput);
    const expectedGross =
      estateInput.rrspBalance +
      estateInput.tfsaBalance +
      estateInput.nonRegBalance +
      estateInput.primaryResidenceValue +
      estateInput.otherAssetsValue -
      estateInput.liabilities;
    expect(result.grossEstate).toBeCloseTo(expectedGross, 0);
  });

  it('netEstateToHeirs = grossEstate - totalTaxAndFees', () => {
    const result = service.runEstateCalculation(estateInput);
    expect(result.netEstateToHeirs).toBeCloseTo(
      result.grossEstate - result.totalTaxAndFees, 0
    );
  });

  it('effectiveTaxRate is between 0 and 1', () => {
    const result = service.runEstateCalculation(estateInput);
    expect(result.effectiveTaxRate).toBeGreaterThanOrEqual(0);
    expect(result.effectiveTaxRate).toBeLessThanOrEqual(1);
  });

  it('breakdown array is non-empty and sums to totalTaxAndFees', () => {
    const result = service.runEstateCalculation(estateInput);
    expect(Array.isArray(result.breakdown)).toBe(true);
    expect(result.breakdown.length).toBeGreaterThan(0);
    const sumOfFees = result.breakdown.reduce((acc, item) => acc + item.taxOrFee, 0);
    expect(sumOfFees).toBeCloseTo(result.totalTaxAndFees, 0);
  });

  it('RRSP tax is positive when RRSP balance > 0', () => {
    const result = service.runEstateCalculation(estateInput);
    expect(result.rrspTaxOwed).toBeGreaterThan(0);
  });

  it('zero liabilities and zero RRSP gives lower tax bill', () => {
    const lowerTax = service.runEstateCalculation({
      ...estateInput,
      rrspBalance: 0,
      liabilities: 0,
      marginalTaxRateAtDeath: 0.20,
    });
    expect(lowerTax.totalTaxAndFees).toBeLessThan(
      service.runEstateCalculation(estateInput).totalTaxAndFees
    );
  });
});
