/**
 * Guyton-Klinger Guardrails Flex Spending Engine (WBS 4.4)
 *
 * Adjusts annual withdrawals based on portfolio performance:
 * - If current withdrawal rate is > upper guardrail: cut withdrawals by 10% (prosperity rule)
 * - If current withdrawal rate is < lower guardrail: increase withdrawals by 10% (floor rule)
 * - Withdrawals never drop below floor or exceed ceiling
 *
 * Reference: Guyton & Klinger (2006), "Decision Rules and Portfolio Management"
 */

export interface GKInput {
  /** Initial portfolio value */
  initialPortfolio: number;
  /** Initial annual withdrawal amount */
  initialWithdrawal: number;
  /** Expected nominal annual return */
  expectedReturn: number;
  /** Inflation rate for adjusting withdrawals annually */
  inflationRate: number;
  /** Volatility of returns (std dev) - for Guyton-Klinger Discretionary rules */
  stdDevReturn?: number;
  /** Upper guardrail: withdrawal rate threshold to trigger CUT */
  upperGuardrailRate?: number;
  /** Lower guardrail: withdrawal rate threshold to trigger INCREASE */
  lowerGuardrailRate?: number;
  /** Maximum cut per guardrail trigger (default 0.10 = 10%) */
  guardrailCutPct?: number;
  /** Maximum increase per guardrail trigger (default 0.10 = 10%) */
  guardrailIncreasePct?: number;
  /** Minimum withdrawal (floor) - never cut below this */
  withdrawalFloor?: number;
  /** Number of years to model */
  years: number;
  /** Optional PRNG seed for reproducibility */
  seed?: number;
}

export interface GKYear {
  year: number;
  age?: number;
  portfolioValue: number;
  withdrawal: number;
  withdrawalRate: number;
  guardrailAction: 'cut' | 'increase' | 'none';
  inflationAdjusted: number;
}

export interface GKResult {
  years: GKYear[];
  successfulYears: number;
  finalPortfolio: number;
  averageWithdrawal: number;
  totalWithdrawals: number;
  initialWithdrawalRate: number;
}

/** Mulberry32 PRNG seeded */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal sample */
function normalSample(rand: () => number, mean: number, stdDev: number): number {
  const u1 = rand();
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

export function runGuytonKlinger(input: GKInput): GKResult {
  const {
    initialPortfolio,
    initialWithdrawal,
    expectedReturn,
    inflationRate,
    stdDevReturn = 0.12,
    upperGuardrailRate = 0.07,
    lowerGuardrailRate = 0.04,
    guardrailCutPct = 0.1,
    guardrailIncreasePct = 0.1,
    withdrawalFloor,
    years,
    seed = 42,
  } = input;

  const rand = mulberry32(seed);
  const floor = withdrawalFloor ?? initialWithdrawal * 0.75;
  const initialRate = initialWithdrawal / initialPortfolio;

  const resultYears: GKYear[] = [];
  let portfolio = initialPortfolio;
  let withdrawal = initialWithdrawal;
  let totalWithdrawals = 0;
  let successfulYears = 0;

  for (let i = 0; i < years; i++) {
    if (portfolio <= 0) {
      resultYears.push({
        year: i + 1,
        portfolioValue: 0,
        withdrawal: 0,
        withdrawalRate: 0,
        guardrailAction: 'none',
        inflationAdjusted: withdrawal,
      });
      continue;
    }

    // Inflate withdrawal for this year
    const inflationAdjustedWithdrawal = withdrawal * Math.pow(1 + inflationRate, i);

    // Current withdrawal rate BEFORE this year's withdrawal (using prior end-balance)
    const currentRate = inflationAdjustedWithdrawal / portfolio;

    let guardrailAction: 'cut' | 'increase' | 'none' = 'none';
    let actualWithdrawal = inflationAdjustedWithdrawal;

    // Apply Guyton-Klinger rules
    if (currentRate > upperGuardrailRate && i > 0) {
      // Prosperity rule: cut withdrawal by guardrailCutPct
      actualWithdrawal = Math.max(floor, actualWithdrawal * (1 - guardrailCutPct));
      guardrailAction = 'cut';
    } else if (currentRate < lowerGuardrailRate && i > 0 && portfolio > initialPortfolio * 1.2) {
      // Capital preservation rule: increase withdrawal (only if portfolio is healthy)
      actualWithdrawal = actualWithdrawal * (1 + guardrailIncreasePct);
      guardrailAction = 'increase';
    }

    // Withdraw
    portfolio = Math.max(0, portfolio - actualWithdrawal);
    totalWithdrawals += actualWithdrawal;

    // Simulate return for this year
    const annualReturn = normalSample(rand, expectedReturn, stdDevReturn);
    portfolio *= 1 + annualReturn;

    const withdrawalRate = portfolio > 0 ? actualWithdrawal / portfolio : 0;

    resultYears.push({
      year: i + 1,
      portfolioValue: parseFloat(portfolio.toFixed(2)),
      withdrawal: parseFloat(actualWithdrawal.toFixed(2)),
      withdrawalRate: parseFloat(withdrawalRate.toFixed(4)),
      guardrailAction,
      inflationAdjusted: parseFloat(inflationAdjustedWithdrawal.toFixed(2)),
    });

    if (portfolio > 0) successfulYears++;
  }

  return {
    years: resultYears,
    successfulYears,
    finalPortfolio: parseFloat(Math.max(0, resultYears[resultYears.length - 1]?.portfolioValue ?? 0).toFixed(2)),
    averageWithdrawal: parseFloat((totalWithdrawals / years).toFixed(2)),
    totalWithdrawals: parseFloat(totalWithdrawals.toFixed(2)),
    initialWithdrawalRate: parseFloat(initialRate.toFixed(4)),
  };
}
