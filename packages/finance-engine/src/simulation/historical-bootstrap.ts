import { runCashFlowProjection, type CashFlowInput } from '../projection/cash-flow.js';

export interface HistoricalBootstrapInput extends CashFlowInput {
  /** Historical annual return series for each asset class (blended before passing, or pass raw) */
  historicalReturns: number[];
  /** Number of bootstrap trials (default: 500) */
  trials?: number;
  /** Random seed for reproducibility */
  seed?: number;
}

export interface OutcomeCategory {
  count: number;
  pct: number;
}

export interface HistoricalBootstrapResult {
  successRate: number;
  trials: number;
  initialNetWorth: number;
  percentilesByYear: Array<{
    age: number;
    year: number;
    p1: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  }>;
  /** Paths for each trial – net worth by year index */
  trialPaths: number[][];
  outcomeCategories: {
    largeSurplus: OutcomeCategory;
    comfortable: OutcomeCategory;
    barelyMadeIt: OutcomeCategory;
    almostMadeIt: OutcomeCategory;
    failedInTheMiddle: OutcomeCategory;
  };
}

/** Simple seeded PRNG (Mulberry32) */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(Math.floor(p * sorted.length), sorted.length - 1);
  return sorted[index];
}

/**
 * Run a historical bootstrap simulation.
 *
 * For each trial we draw `numYears` returns WITH REPLACEMENT from the
 * supplied historical return series — a technique known as "block bootstrap"
 * that preserves empirical fat tails and avoids parametric assumptions.
 */
export function runHistoricalBootstrapSimulation(
  input: HistoricalBootstrapInput,
): HistoricalBootstrapResult {
  const trials = input.trials ?? 500;
  const rand = input.seed != null ? mulberry32(input.seed) : Math.random.bind(Math);
  const hist = input.historicalReturns;
  const numYears = input.endAge - input.currentAge + 1;

  const initialNetWorth = input.rrspBalance + input.tfsaBalance + input.nonRegBalance;

  // Collect per-trial net-worth paths
  const trialPaths: number[][] = [];
  let successCount = 0;

  for (let t = 0; t < trials; t++) {
    // Sample numYears returns with replacement from historical data
    const yearlyReturnRates = Array.from({ length: numYears }, () => {
      const idx = Math.floor(rand() * hist.length);
      return hist[idx];
    });

    const trialInput: CashFlowInput = { ...input, yearlyReturnRates };
    const projection = runCashFlowProjection(trialInput);

    const path = projection.map((yr) => yr.totalNetWorth);
    trialPaths.push(path);

    const depleted = projection.some((yr) => yr.totalNetWorth < 0);
    if (!depleted) successCount++;
  }

  // --- Percentiles by year ---
  const percentilesByYear = [];
  for (let y = 0; y < numYears; y++) {
    const values = trialPaths.map((p) => p[y]).sort((a, b) => a - b);
    percentilesByYear.push({
      age: input.currentAge + y,
      year: new Date().getFullYear() + y,
      p1: percentile(values, 0.01),
      p5: percentile(values, 0.05),
      p25: percentile(values, 0.25),
      p50: percentile(values, 0.5),
      p75: percentile(values, 0.75),
      p95: percentile(values, 0.95),
    });
  }

  // --- Outcome categorisation ---
  // Based on final net worth vs initial portfolio
  let largeSurplus = 0;  // final >= 150% of initial
  let comfortable = 0;   // final >= 5% of initial (and < 150%)
  let barelyMadeIt = 0;  // final >= 0 but < 5% of initial
  let almostMadeIt = 0;  // depleted in last 25% of years
  let failedInMiddle = 0; // depleted before last 25% of years

  const lateDepletionThreshold = Math.floor(numYears * 0.75);

  for (const path of trialPaths) {
    const finalNW = path[path.length - 1];
    if (finalNW >= 1.5 * initialNetWorth) {
      largeSurplus++;
    } else if (finalNW >= 0.05 * initialNetWorth) {
      comfortable++;
    } else if (finalNW >= 0) {
      barelyMadeIt++;
    } else {
      // Find depletion year
      const depletionIdx = path.findIndex((v) => v < 0);
      if (depletionIdx >= lateDepletionThreshold) {
        almostMadeIt++;
      } else {
        failedInMiddle++;
      }
    }
  }

  const pct = (n: number) => Math.round((n / trials) * 10000) / 100;

  return {
    successRate: Math.round((successCount / trials) * 10000) / 100,
    trials,
    initialNetWorth,
    percentilesByYear,
    trialPaths,
    outcomeCategories: {
      largeSurplus: { count: largeSurplus, pct: pct(largeSurplus) },
      comfortable: { count: comfortable, pct: pct(comfortable) },
      barelyMadeIt: { count: barelyMadeIt, pct: pct(barelyMadeIt) },
      almostMadeIt: { count: almostMadeIt, pct: pct(almostMadeIt) },
      failedInTheMiddle: { count: failedInMiddle, pct: pct(failedInMiddle) },
    },
  };
}
