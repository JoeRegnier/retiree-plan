/**
 * Bucket Strategy Modeller
 *
 * Simulates a classic 3-bucket retirement income strategy:
 *
 *  Bucket 1 — Cash Reserve (0–2 years of expenses)
 *    High-liquidity: HISA, money-market.  Covers near-term spending.
 *
 *  Bucket 2 — Conservative Growth (3–10 years of expenses)
 *    Bonds / GICs / balanced funds.  Grows steadily; refills Bucket 1 annually.
 *
 *  Bucket 3 — Long-term Growth (remainder)
 *    Equities / global funds.  Highest volatility; refills Bucket 2 when depleted.
 *
 * The model uses deterministic (expected) return rates.  For stochastic
 * results combine with the Monte Carlo simulator.
 */

import type { BucketConfig, BucketProjectionResult, BucketYear } from '@retiree-plan/shared';

const DEFAULT_CONFIG: BucketConfig = {
  cashReserveYears: 2,
  conservativeYears: 7,
  conservativeReturnRate: 0.04,
  growthReturnRate: 0.07,
  refillRule: 'annual',
  refillThresholdMonths: 6,
};

export interface BucketProjectionInput {
  /** Current age of the retiree. */
  currentAge: number;
  /** Age through which to project. */
  lifeExpectancyAge: number;
  /** Total investable assets to split across buckets on day 1. */
  totalPortfolio: number;
  /** Annual inflation-adjusted expenses (today's dollars). */
  annualExpenses: number;
  /** Annual inflation rate — used to inflate expenses each year. Default 0.02. */
  inflationRate?: number;
  /** Bucket configuration. Falls back to defaults when omitted. */
  config?: Partial<BucketConfig>;
}

/**
 * Runs a deterministic bucket strategy projection.
 */
export function runBucketProjection(input: BucketProjectionInput): BucketProjectionResult {
  const {
    currentAge,
    lifeExpectancyAge,
    totalPortfolio,
    annualExpenses,
    inflationRate = 0.02,
  } = input;
  const cfg: BucketConfig = { ...DEFAULT_CONFIG, ...(input.config ?? {}) };

  // ─── Initial bucket allocation ────────────────────────────────────────────
  const initialBucket1Target = annualExpenses * cfg.cashReserveYears;
  const initialBucket2Target = annualExpenses * cfg.conservativeYears;

  let b1 = Math.min(initialBucket1Target, totalPortfolio);
  let remaining = totalPortfolio - b1;
  let b2 = Math.min(initialBucket2Target, remaining);
  let b3 = Math.max(0, remaining - b2);

  const initialBucket1 = b1;
  const initialBucket2 = b2;
  const initialBucket3 = b3;

  const years: BucketYear[] = [];
  let portfolioDepletionAge: number | null = null;
  let currentExpenses = annualExpenses;
  const currentYear = new Date().getFullYear();

  for (let age = currentAge; age <= lifeExpectancyAge; age++) {
    const year = currentYear + (age - currentAge);

    // ─── Growth phase (applied before spending for simplicity) ───────────────
    b2 *= 1 + cfg.conservativeReturnRate;
    b3 *= 1 + cfg.growthReturnRate;
    // Bucket 1 earns negligible returns (cash/HISA); model as 0 for simplicity

    // ─── Targets for this year ────────────────────────────────────────────────
    const b1Target = currentExpenses * cfg.cashReserveYears;
    const b2Target = currentExpenses * cfg.conservativeYears;

    let b1Refill = 0;
    let b2Refill = 0;
    let refillSource: BucketYear['refillSource'] = 'none';

    // ─── Annual refill logic ──────────────────────────────────────────────────
    const needsRefill =
      cfg.refillRule === 'annual' ||
      (cfg.refillRule === 'threshold' &&
        b1 < currentExpenses * ((cfg.refillThresholdMonths ?? 6) / 12));

    if (needsRefill && b1 < b1Target) {
      const deficit = b1Target - b1;

      if (b2 >= deficit) {
        // Refill from Bucket 2
        b1Refill = deficit;
        b2 -= b1Refill;
        b1 += b1Refill;
        refillSource = 'bucket2';
      } else if (b2 > 0) {
        // Partial from Bucket 2, rest from Bucket 3
        b1Refill = b2;
        b2 = 0;
        b1 += b1Refill;
        refillSource = 'both';

        const stillNeeded = b1Target - b1;
        if (b3 >= stillNeeded) {
          b1 += stillNeeded;
          b3 -= stillNeeded;
        } else {
          b1 += b3;
          b3 = 0;
        }
      } else if (b3 >= deficit) {
        // Bucket 2 empty — refill from Bucket 3
        b1Refill = deficit;
        b3 -= b1Refill;
        b1 += b1Refill;
        refillSource = 'bucket3';
      } else {
        // Both B2 and B3 depleted — take what's left
        b1Refill = b2 + b3;
        b1 += b1Refill;
        b2 = 0;
        b3 = 0;
        refillSource = b2Refill > 0 ? 'both' : 'bucket3';
      }
    }

    // Refill Bucket 2 from Bucket 3 when under target
    if (b2 < b2Target && b3 > 0) {
      const deficit2 = b2Target - b2;
      if (b3 >= deficit2) {
        b2Refill = deficit2;
        b3 -= b2Refill;
        b2 += b2Refill;
      } else {
        b2Refill = b3;
        b2 += b2Refill;
        b3 = 0;
      }
    }

    // ─── Spend from Bucket 1 ──────────────────────────────────────────────────
    let shortfall = 0;
    if (b1 >= currentExpenses) {
      b1 -= currentExpenses;
    } else {
      shortfall = currentExpenses - b1;
      b1 = 0;
    }

    const totalBalance = b1 + b2 + b3;

    if (totalBalance <= 0 && portfolioDepletionAge === null) {
      portfolioDepletionAge = age;
    }

    years.push({
      age,
      year,
      bucket1Balance: Math.max(0, b1),
      bucket2Balance: Math.max(0, b2),
      bucket3Balance: Math.max(0, b3),
      totalBalance: Math.max(0, totalBalance),
      bucket1Target: b1Target,
      bucket2Target: b2Target,
      bucket1Refill: b1Refill,
      bucket2Refill: b2Refill,
      refillSource,
      shortfall,
      expenses: currentExpenses,
    });

    // Inflate expenses for next year
    currentExpenses *= 1 + inflationRate;
  }

  return {
    years,
    portfolioDepletionAge,
    portfolioSurvivesFullPeriod: portfolioDepletionAge === null,
    initialBucket1,
    initialBucket2,
    initialBucket3,
  };
}
