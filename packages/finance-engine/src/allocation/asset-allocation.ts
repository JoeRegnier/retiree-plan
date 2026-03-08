/**
 * Asset allocation modelling and glide-path builder.
 * Uses configurable capital market assumptions to derive expected returns.
 */

import type { GlidePathStep } from '../projection/cash-flow.js';

export interface AssetAllocation {
  equityPercent: number;
  fixedIncomePercent: number;
  alternativesPercent: number;
  cashPercent: number;
}

export interface MarketAssumptions {
  equityExpectedReturn: number;
  fixedIncomeExpectedReturn: number;
  alternativesExpectedReturn: number;
  cashExpectedReturn: number;
}

export interface GlidePathConfig {
  currentEquityPercent: number;
  equityAtRetirement: number;
  retirementAge: number;
  equityReductionPerYear: number; // annual % reduction after retirement
}

export const DEFAULT_MARKET_ASSUMPTIONS: MarketAssumptions = {
  equityExpectedReturn: 0.07,
  fixedIncomeExpectedReturn: 0.035,
  alternativesExpectedReturn: 0.055,
  cashExpectedReturn: 0.025,
};

/**
 * Calculate expected return from a weighted asset allocation.
 */
export function calculateExpectedReturn(
  allocation: AssetAllocation,
  assumptions: MarketAssumptions = DEFAULT_MARKET_ASSUMPTIONS,
): number {
  return (
    allocation.equityPercent * assumptions.equityExpectedReturn +
    allocation.fixedIncomePercent * assumptions.fixedIncomeExpectedReturn +
    allocation.alternativesPercent * assumptions.alternativesExpectedReturn +
    allocation.cashPercent * assumptions.cashExpectedReturn
  );
}

/**
 * Build a glide-path schedule as GlidePathStep[] compatible with
 * the cash-flow projection engine.
 *
 * Pre-retirement: linearly interpolate from current equity % to retirement equity %.
 * Post-retirement: reduce equity by `equityReductionPerYear` per year.
 */
export function buildGlidePath(
  config: GlidePathConfig,
  startAge: number,
  endAge: number,
  assumptions: MarketAssumptions = DEFAULT_MARKET_ASSUMPTIONS,
): GlidePathStep[] {
  const steps: GlidePathStep[] = [];
  const yearsToRetirement = config.retirementAge - startAge;

  for (let age = startAge; age <= endAge; age++) {
    let equityPct: number;

    if (age <= config.retirementAge) {
      // Linear interpolation from current to retirement target
      const progress = yearsToRetirement > 0
        ? (age - startAge) / yearsToRetirement
        : 1;
      equityPct = config.currentEquityPercent +
        (config.equityAtRetirement - config.currentEquityPercent) * progress;
    } else {
      // Post-retirement: reduce equity each year
      const yearsPostRetirement = age - config.retirementAge;
      equityPct = Math.max(
        0.1, // floor at 10% equity
        config.equityAtRetirement - config.equityReductionPerYear * yearsPostRetirement,
      );
    }

    const fixedIncomePct = 1 - equityPct;
    const allocation: AssetAllocation = {
      equityPercent: equityPct,
      fixedIncomePercent: fixedIncomePct,
      alternativesPercent: 0,
      cashPercent: 0,
    };

    steps.push({
      age,
      returnRate: calculateExpectedReturn(allocation, assumptions),
    });
  }

  return steps;
}

/**
 * Get asset allocation at a specific age given a glide-path config.
 */
export function allocationAtAge(
  config: GlidePathConfig,
  age: number,
  startAge: number,
): AssetAllocation {
  if (age >= config.retirementAge) {
    const yearsRetired = age - config.retirementAge;
    const equityPct = Math.max(
      config.equityAtRetirement - config.equityReductionPerYear * yearsRetired,
      0.1,
    );

    return {
      equityPercent: equityPct,
      fixedIncomePercent: 1 - equityPct,
      alternativesPercent: 0,
      cashPercent: 0,
    };
  }

  const totalYears = config.retirementAge - startAge;
  if (totalYears <= 0) {
    return {
      equityPercent: config.equityAtRetirement,
      fixedIncomePercent: 1 - config.equityAtRetirement,
      alternativesPercent: 0,
      cashPercent: 0,
    };
  }

  const elapsed = age - startAge;
  const t = Math.min(1, Math.max(0, elapsed / totalYears));
  const equityPct = config.currentEquityPercent +
    (config.equityAtRetirement - config.currentEquityPercent) * t;

  return {
    equityPercent: equityPct,
    fixedIncomePercent: 1 - equityPct,
    alternativesPercent: 0,
    cashPercent: 0,
  };
}

/**
 * Calculate household-level asset allocation from multiple accounts.
 * Weighted by account balance.
 */
export function calculateHouseholdAllocation(
  accounts: { balance: number; allocation: AssetAllocation }[],
): AssetAllocation {
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  if (totalBalance === 0) {
    return { equityPercent: 0, fixedIncomePercent: 0, alternativesPercent: 0, cashPercent: 0 };
  }

  const weighted = accounts.reduce(
    (acc, a) => {
      const weight = a.balance / totalBalance;
      return {
        equityPercent: acc.equityPercent + a.allocation.equityPercent * weight,
        fixedIncomePercent: acc.fixedIncomePercent + a.allocation.fixedIncomePercent * weight,
        alternativesPercent: acc.alternativesPercent + a.allocation.alternativesPercent * weight,
        cashPercent: acc.cashPercent + a.allocation.cashPercent * weight,
      };
    },
    { equityPercent: 0, fixedIncomePercent: 0, alternativesPercent: 0, cashPercent: 0 },
  );

  return weighted;
}
