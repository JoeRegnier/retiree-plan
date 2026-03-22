/**
 * Withdrawal Order Optimizer
 *
 * Compares all built-in withdrawal strategies by running the cash-flow
 * projection engine once per strategy and summarising the results.
 */

import type { WithdrawalComparisonResult, WithdrawalStrategyResult, WithdrawalStrategyId } from '@retiree-plan/shared';
import { WITHDRAWAL_STRATEGY_IDS } from '@retiree-plan/shared';
import { runCashFlowProjection } from '../projection/cash-flow.js';
import type { CashFlowInput } from '../projection/cash-flow.js';

const STRATEGY_NAMES: Record<WithdrawalStrategyId, string> = {
  'oas-optimized': 'OAS Optimized',
  'rrsp-first':    'RRSP First (Meltdown)',
  'tfsa-last':     'TFSA Last (Estate)',
  'non-reg-first': 'Non-Reg First (Cap Gains)',
  'proportional':  'Proportional',
  'custom':        'Custom Order',
};

/**
 * Runs every built-in withdrawal strategy against `baseInput` and returns a
 * ranked comparison with a recommended strategy.
 *
 * The `custom` strategy is excluded unless the caller passes `includeCustom:
 * true` — it requires a `withdrawalOrder` to be set on the input.
 */
export function compareWithdrawalStrategies(
  baseInput: CashFlowInput,
  includeCustom = false,
): WithdrawalComparisonResult {
  const strategies = WITHDRAWAL_STRATEGY_IDS.filter(
    (id) => id !== 'custom' || includeCustom,
  ) as WithdrawalStrategyId[];

  const results: WithdrawalStrategyResult[] = strategies.map((strategyId) => {
    const years = runCashFlowProjection({ ...baseInput, withdrawalStrategy: strategyId });

    const totalLifetimeTax = years.reduce((sum, y) => sum + y.totalTax, 0);
    const totalOasClawback = years.reduce((sum, y) => sum + (y.oasClawback ?? 0), 0);
    const lastYear = years[years.length - 1];
    const finalNetWorth = lastYear?.totalNetWorth ?? 0;

    // Depletion: first year where all account balances reach zero
    const depletionYear = years.find(
      (y) => y.rrspBalance <= 0 && y.tfsaBalance <= 0 && y.nonRegBalance <= 0 && (y.cashBalance ?? 0) <= 0,
    );
    const portfolioDepletionAge = depletionYear?.age ?? null;

    return {
      strategyId,
      strategyName: STRATEGY_NAMES[strategyId],
      totalLifetimeTax,
      totalOasClawback,
      finalNetWorth,
      portfolioDepletionAge,
    };
  });

  // Recommend strategy with lowest total lifetime tax (breaks ties by highest final net worth)
  const sorted = [...results].sort((a, b) => {
    const taxDiff = a.totalLifetimeTax - b.totalLifetimeTax;
    if (Math.abs(taxDiff) > 100) return taxDiff;
    return b.finalNetWorth - a.finalNetWorth;
  });

  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const estimatedSavings = worst.totalLifetimeTax - best.totalLifetimeTax;

  const reasonParts: string[] = [];
  if (best.portfolioDepletionAge === null) {
    reasonParts.push('portfolio survives the full projection');
  }
  if (estimatedSavings > 1000) {
    reasonParts.push(`saves ~$${Math.round(estimatedSavings / 1000)}k in lifetime taxes vs the least efficient strategy`);
  }
  if (best.totalOasClawback < (results.find((r) => r.strategyId === 'rrsp-first')?.totalOasClawback ?? Infinity)) {
    reasonParts.push('minimises OAS clawback');
  }

  const recommendationReason =
    reasonParts.length > 0
      ? reasonParts.join('; ') + '.'
      : `Produces the lowest estimated lifetime tax burden of $${Math.round(best.totalLifetimeTax).toLocaleString()}.`;

  return {
    strategies: results,
    recommendedStrategyId: best.strategyId,
    recommendationReason,
    estimatedSavings: Math.max(0, estimatedSavings),
  };
}
