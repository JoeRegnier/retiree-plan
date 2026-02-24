import { bench, describe } from 'vitest';
import { runMonteCarloSimulation } from '../simulation/monte-carlo.js';
import { runBacktest } from '../simulation/backtesting.js';

const BASE_INPUT = {
  currentAge: 60,
  endAge: 90,
  province: 'ON' as const,
  employmentIncome: 0,
  retirementAge: 60,
  annualExpenses: 48_000,
  inflationRate: 0.02,
  nominalReturnRate: 0.06,
  cppStartAge: 65,
  oasStartAge: 65,
  rrspBalance: 600_000,
  tfsaBalance: 100_000,
  nonRegBalance: 200_000,
  rrspContribution: 0,
  tfsaContribution: 0,
};

const MC_INPUT = {
  ...BASE_INPUT,
  stdDevReturn: 0.12,
  trials: 1_000,
  seed: 42,
};

const MC_INPUT_5K = { ...MC_INPUT, trials: 5_000 };

const HISTORICAL_RETURNS = Array.from({ length: 50 }, (_, i) => [
  { asset: 'TSX', year: 1974 + i, returnRate: 0.04 + Math.sin(i) * 0.12 },
  { asset: 'CA_BOND', year: 1974 + i, returnRate: 0.02 + Math.cos(i) * 0.04 },
]).flat();

const BACKTEST_INPUT = {
  currentAge: 60,
  retirementAge: 60,
  lifeExpectancy: 90,
  annualExpensesInRetirement: 48_000,
  rrspBalance: 600_000,
  tfsaBalance: 100_000,
  nonRegBalance: 200_000,
  equityFraction: 0.6,
  historicalReturns: HISTORICAL_RETURNS,
};

describe('Monte Carlo performance', () => {
  bench('1 000 trials', () => {
    runMonteCarloSimulation(MC_INPUT);
  });

  bench('5 000 trials', () => {
    runMonteCarloSimulation(MC_INPUT_5K);
  });
});

describe('Historical Backtesting performance', () => {
  bench('50-year dataset', () => {
    runBacktest(BACKTEST_INPUT);
  });
});
