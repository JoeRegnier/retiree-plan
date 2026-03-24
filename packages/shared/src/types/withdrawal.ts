/**
 * Withdrawal strategy types shared between the finance engine and the API/frontend.
 */

export const ACCOUNT_BUCKETS = ['CASH', 'RRSP', 'TFSA', 'NON_REG'] as const;
export type AccountBucket = (typeof ACCOUNT_BUCKETS)[number];

export const WITHDRAWAL_STRATEGY_IDS = [
  'oas-optimized',   // Current default — draw RRSP below OAS threshold first
  'rrsp-first',      // RRSP Meltdown — aggressively empty RRSP before 71
  'tfsa-last',       // Estate Maximizer — preserve TFSA for heirs
  'non-reg-first',   // Capital Gains First — draw non-reg before shelter
  'proportional',    // Proportional — pro-rata across all balances
  'custom',          // User-defined ordering
] as const;
export type WithdrawalStrategyId = (typeof WITHDRAWAL_STRATEGY_IDS)[number];

export interface WithdrawalStrategy {
  id: WithdrawalStrategyId;
  name: string;
  description: string;
  /** Priority order, used for all strategies except 'proportional'. Ignored for 'custom'. */
  priority: AccountBucket[];
}

export interface WithdrawalStrategyResult {
  strategyId: WithdrawalStrategyId;
  strategyName: string;
  totalLifetimeTax: number;
  totalOasClawback: number;
  finalNetWorth: number;
  portfolioDepletionAge: number | null;
}

export interface WithdrawalComparisonResult {
  strategies: WithdrawalStrategyResult[];
  /** The strategy with the lowest total lifetime tax burden. */
  recommendedStrategyId: WithdrawalStrategyId;
  recommendationReason: string;
  /** Estimated savings vs. the worst strategy. */
  estimatedSavings: number;
}

// ─── Spousal RRSP Types ───────────────────────────────────────────────────────

export interface SpousalRrspInput {
  contributorIncome: number;
  annuitantIncome: number;
  proposedContribution: number;
  contributorProvince: string;
  annuitantProvince: string;
  /** Year the most recent contribution was made. Used for attribution rule check. */
  lastContributionYear: number;
  /** Year the annuitant plans to withdraw. */
  plannedWithdrawalYear: number;
  currentYear: number;
}

export interface SpousalRrspResult {
  contributorTaxSaved: number;
  annuitantTaxOwed: number;
  netAnnualSaving: number;
  attributionRisk: boolean;
  /** If attribution applies, the withdrawal is taxed at this rate in contributor's hands. */
  attributionRate: number;
  /** Year after which it is safe to withdraw without attribution. */
  safeLiftYear: number;
  recommendContribution: boolean;
  explanation: string;
}

// ─── Bucket Strategy Types ────────────────────────────────────────────────────

export interface BucketConfig {
  /** Number of years of expenses to keep in Bucket 1 (Cash Reserve). Default 2. */
  cashReserveYears: number;
  /** Number of years of expenses in Bucket 2 (Conservative). Default 7. */
  conservativeYears: number;
  /** Return rate assumption for Bucket 2 (Conservative). Default 0.04. */
  conservativeReturnRate: number;
  /** Return rate assumption for Bucket 3 (Growth). Default 0.07. */
  growthReturnRate: number;
  /** Refill rule: 'annual' = refill Bucket 1 at the start of each year. 'threshold' = refill when drops below N months. */
  refillRule: 'annual' | 'threshold';
  /** Months of expenses threshold to trigger Bucket 1 refill (used when refillRule = 'threshold'). Default 6. */
  refillThresholdMonths?: number;
}

export interface BucketYear {
  age: number;
  year: number;
  bucket1Balance: number;
  bucket2Balance: number;
  bucket3Balance: number;
  totalBalance: number;
  bucket1Target: number;
  bucket2Target: number;
  /** Amount moved from Bucket 2 → Bucket 1 this year. */
  bucket1Refill: number;
  /** Amount moved from Bucket 3 → Bucket 2 this year. */
  bucket2Refill: number;
  refillSource: 'bucket2' | 'bucket3' | 'both' | 'none';
  shortfall: number;
  expenses: number;
}

export interface BucketProjectionResult {
  years: BucketYear[];
  portfolioDepletionAge: number | null;
  portfolioSurvivesFullPeriod: boolean;
  initialBucket1: number;
  initialBucket2: number;
  initialBucket3: number;
}
