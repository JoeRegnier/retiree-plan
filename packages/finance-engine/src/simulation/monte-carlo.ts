import type { MonteCarloResult } from '@retiree-plan/shared';
import { DEFAULT_MONTE_CARLO_TRIALS } from '@retiree-plan/shared';
import { runCashFlowProjection, type CashFlowInput } from '../projection/cash-flow.js';

export interface MonteCarloInput extends CashFlowInput {
  /** Number of simulation trials */
  trials?: number;
  /** Mean annual return (decimal) */
  meanReturn?: number;
  /** Standard deviation of annual returns (decimal) */
  stdDevReturn?: number;
  /** Random seed for reproducibility (optional) */
  seed?: number;
}

/**
 * Simple seeded PRNG (Mulberry32).
 * Good enough for simulation; not cryptographic.
 */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform to generate normal random variates.
 */
function normalRandom(rand: () => number, mean: number, stdDev: number): number {
  const u1 = rand();
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}

/**
 * Run a Monte Carlo simulation over cash-flow projections.
 * Each trial uses a randomised return sequence drawn from a
 * normal distribution with the specified mean and standard deviation.
 */
export function runMonteCarloSimulation(input: MonteCarloInput): MonteCarloResult {
  const trials = input.trials ?? DEFAULT_MONTE_CARLO_TRIALS;
  const meanReturn = input.meanReturn ?? input.nominalReturnRate;
  const stdDev = input.stdDevReturn ?? 0.12;
  const rand = input.seed != null ? mulberry32(input.seed) : Math.random.bind(Math);

  const numYears = input.endAge - input.currentAge + 1;
  const allTrialNetWorth: number[][] = Array.from({ length: trials }, () =>
    new Array<number>(numYears).fill(0),
  );

  let successCount = 0;

  for (let t = 0; t < trials; t++) {
    // Generate a different random return for each year (correct MC)
    const yearlyReturnRates = Array.from({ length: numYears }, () =>
      normalRandom(rand, meanReturn, stdDev),
    );
    const trialInput: CashFlowInput = {
      ...input,
      yearlyReturnRates,
    };

    const projection = runCashFlowProjection(trialInput);

    for (let y = 0; y < projection.length; y++) {
      allTrialNetWorth[t][y] = projection[y].totalNetWorth;
    }

    // Success = net worth never goes negative
    const depleted = projection.some((yr) => yr.totalNetWorth < 0);
    if (!depleted) successCount++;
  }

  // Calculate percentiles by year
  const distributionByYear = [];
  for (let y = 0; y < numYears; y++) {
    const values = allTrialNetWorth.map((trial) => trial[y]).sort((a, b) => a - b);
    distributionByYear.push({
      year: new Date().getFullYear() + y,
      min: values[0],
      p5: percentile(values, 0.05),
      p25: percentile(values, 0.25),
      median: percentile(values, 0.5),
      p75: percentile(values, 0.75),
      p95: percentile(values, 0.95),
      max: values[values.length - 1],
    });
  }

  return {
    scenarioId: '',
    trials,
    successRate: Math.round((successCount / trials) * 10000) / 10000,
    percentiles: {
      p5: [],
      p25: [],
      p50: [],
      p75: [],
      p95: [],
    },
    distributionByYear,
  };
}

function percentile(sorted: number[], p: number): number {
  const index = Math.floor(p * (sorted.length - 1));
  return sorted[index];
}
