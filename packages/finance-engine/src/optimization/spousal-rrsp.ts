/**
 * Spousal RRSP Optimizer
 *
 * Calculates the annual tax benefit of contributing to a spousal RRSP and
 * evaluates the CRA attribution rule risk.
 *
 * Attribution rule (ITA s. 146(8.3)):
 *   If the annuitant withdraws from the spousal RRSP in the same calendar year
 *   as a contribution, OR in either of the two following calendar years, the
 *   withdrawn amount (up to the sum of contributions in those years) is taxed
 *   in the contributor's hands at the contributor's marginal rate.
 */

import type { SpousalRrspInput, SpousalRrspResult } from '@retiree-plan/shared';
import { calculateTotalTax } from '../tax/canadian-tax.js';

/**
 * Estimates the marginal tax rate on the next dollar of income for a given
 * province and current income level using a binary-search on the tax function.
 */
function estimateMarginalRate(income: number, province: string): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prov = province as any;
  const delta = 1_000;
  const base = calculateTotalTax(income, prov).totalTax;
  const upper = calculateTotalTax(income + delta, prov).totalTax;
  return (upper - base) / delta;
}

/**
 * Analyses whether contributing to a spousal RRSP is beneficial this year.
 */
export function analyzeSpousalRrsp(input: SpousalRrspInput): SpousalRrspResult {
  const {
    contributorIncome,
    annuitantIncome,
    proposedContribution,
    contributorProvince,
    annuitantProvince,
    lastContributionYear,
    plannedWithdrawalYear,
    currentYear,
  } = input;

  // Tax deduction at the contributor's marginal rate (refund on contribution)
  const contributorMarginalRate = estimateMarginalRate(contributorIncome, contributorProvince);
  const contributorTaxSaved = proposedContribution * contributorMarginalRate;

  // Tax owed by annuitant when they eventually withdraw (at their lower rate)
  const annuitantMarginalRate = estimateMarginalRate(annuitantIncome, annuitantProvince);
  const annuitantTaxOwed = proposedContribution * annuitantMarginalRate;

  const netAnnualSaving = contributorTaxSaved - annuitantTaxOwed;

  // Attribution rule: withdrawal taxed in contributor's hands if within 3 years of contribution
  // The 3-year window is: year of contribution + 2 following calendar years
  const safeWithdrawalYear = lastContributionYear + 3;
  const attributionRisk =
    plannedWithdrawalYear >= lastContributionYear &&
    plannedWithdrawalYear < safeWithdrawalYear;

  // If attribution applies the withdrawal is taxed at contributor's rate, not annuitant's
  const attributionRate = attributionRisk ? contributorMarginalRate : annuitantMarginalRate;

  const recommendContribution =
    netAnnualSaving > 0 &&
    (!attributionRisk || plannedWithdrawalYear >= safeWithdrawalYear);

  let explanation = '';
  if (attributionRisk) {
    explanation =
      `Attribution risk: the planned withdrawal in ${plannedWithdrawalYear} falls within ` +
      `the 3-year CRA attribution window (last contribution in ${lastContributionYear}). ` +
      `The withdrawal would be taxed at the contributor's rate (~${(contributorMarginalRate * 100).toFixed(0)}%). ` +
      `Wait until ${safeWithdrawalYear} to withdraw safely.`;
  } else if (netAnnualSaving <= 0) {
    explanation =
      `The annuitant's marginal rate (~${(annuitantMarginalRate * 100).toFixed(0)}%) is not ` +
      `meaningfully lower than the contributor's (~${(contributorMarginalRate * 100).toFixed(0)}%). ` +
      `A spousal RRSP contribution may not provide a tax advantage at current income levels.`;
  } else {
    explanation =
      `Contributing $${proposedContribution.toLocaleString()} saves ~$${Math.round(contributorTaxSaved).toLocaleString()} ` +
      `in taxes for the contributor and shifts the future withdrawal tax to the annuitant's ` +
      `lower bracket (~${(annuitantMarginalRate * 100).toFixed(0)}%). ` +
      `Net benefit: ~$${Math.round(netAnnualSaving).toLocaleString()} per year.`;
  }

  return {
    contributorTaxSaved,
    annuitantTaxOwed,
    netAnnualSaving,
    attributionRisk,
    attributionRate,
    safeLiftYear: safeWithdrawalYear,
    recommendContribution,
    explanation,
  };
}
