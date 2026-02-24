import { CPP_2024, OAS_2024 } from '@retiree-plan/shared';

export interface CppBenefitInput {
  startAge: number;
  /** Fraction of max benefit earned (0-1). Default 1.0 (maximum). */
  benefitFraction?: number;
}

export interface OasBenefitInput {
  startAge: number;
  /** Years of Canadian residency (10-40). Default 40 (full). */
  yearsOfResidency?: number;
  /** Net income for clawback calculation */
  netIncome?: number;
}

/**
 * Calculate annual CPP benefit based on start age.
 * Early: reduced by 0.6%/month before 65.
 * Deferred: increased by 0.7%/month after 65.
 */
export function calculateCppBenefit(input: CppBenefitInput): number {
  const { startAge, benefitFraction = 1.0 } = input;
  const maxAnnual = CPP_2024.maxMonthlyBenefitAt65 * 12;
  const monthsFromSixtyFive = (startAge - 65) * 12;

  let adjustmentFactor: number;
  if (monthsFromSixtyFive < 0) {
    // Early — reduce
    adjustmentFactor = 1 + monthsFromSixtyFive * CPP_2024.earlyReductionPerMonth;
  } else {
    // Deferred — increase
    adjustmentFactor = 1 + monthsFromSixtyFive * CPP_2024.deferralIncreasePerMonth;
  }

  return Math.round(maxAnnual * benefitFraction * adjustmentFactor * 100) / 100;
}

/**
 * Calculate annual OAS benefit based on start age, residency, and income.
 * Includes clawback (recovery tax) calculation.
 */
export function calculateOasBenefit(input: OasBenefitInput): number {
  const { startAge, yearsOfResidency = 40, netIncome = 0 } = input;

  // Residency proration
  const residencyFraction = Math.min(
    1,
    Math.max(0, yearsOfResidency) / OAS_2024.yearsForFullOAS,
  );

  if (yearsOfResidency < OAS_2024.minimumYearsForOAS) return 0;

  // Deferral adjustment
  const monthsDeferred = Math.max(0, (startAge - 65) * 12);
  const deferralFactor = 1 + monthsDeferred * OAS_2024.deferralIncreasePerMonth;

  const annualBenefit = OAS_2024.maxMonthlyBenefit * 12 * residencyFraction * deferralFactor;

  // Clawback
  const clawbackAmount =
    netIncome > OAS_2024.clawbackThreshold
      ? (netIncome - OAS_2024.clawbackThreshold) * OAS_2024.clawbackRate
      : 0;

  return Math.round(Math.max(0, annualBenefit - clawbackAmount) * 100) / 100;
}
