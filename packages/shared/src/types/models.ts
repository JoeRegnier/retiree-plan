import type { AccountType, ScenarioParameters } from '../schemas/index.js';

/** Represents a user in the system */
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

/** Represents a household */
export interface Household {
  id: string;
  name: string;
  userId: string;
  members: HouseholdMember[];
  accounts: Account[];
  scenarios: Scenario[];
  realEstateProperties?: RealEstate[];
  goals?: Goal[];
  createdAt: string;
  updatedAt: string;
}

/** Represents a member of a household */
export interface HouseholdMember {
  id: string;
  name: string;
  dateOfBirth: string;
  province: string;
  rrspContributionRoom?: number | null;
  tfsaContributionRoom?: number | null;
  priorYearIncome?: number | null;
  cppExpectedBenefit?: number | null;
  householdId: string;
}

/** Represents a financial account */
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  annualContribution: number;
  /**
   * Optional per-account annual return/interest rate.
   * When set, the projection engine uses this rate for this account's growth
   * instead of the scenario's base expected return rate.
   * Null = use the scenario default.
   */
  estimatedReturnRate: number | null;
  equityPercent: number | null;
  fixedIncomePercent: number | null;
  alternativesPercent: number | null;
  cashPercent: number | null;
  /** Adjusted cost basis for non-registered accounts — used for ACB tracking and capital gains on withdrawal. */
  costBasis: number | null;
  /** True if this RRSP account was opened as a spousal RRSP. */
  isSpousalRrsp: boolean;
  /** Member ID of the spouse who makes contributions (claimant of the deduction). */
  contributorMemberId: string | null;
  /** Member ID of the spouse who holds and withdraws from the plan (annuitant). */
  annuitantMemberId: string | null;
  /** Tax year of the most recent spousal RRSP contribution — needed for 3-year attribution rule. */
  lastContributionYear: number | null;
  householdId: string;
  createdAt: string;
  updatedAt: string;
}

/** Represents a planning scenario */
export interface Scenario {
  id: string;
  name: string;
  description?: string;
  parameters: ScenarioParameters;
  householdId: string;
  createdAt: string;
  updatedAt: string;
}

/** A single year in a cash-flow projection */
export interface ProjectionYear {
  year: number;
  age: number;
  grossIncome: number;
  employmentIncome: number;
  cppIncome: number;
  oasIncome: number;
  rrspWithdrawal: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  otherIncome: number;
  totalIncome: number;
  federalTax: number;
  provincialTax: number;
  totalTax: number;
  netIncome: number;
  expenses: number;
  netCashFlow: number;
  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  totalNetWorth: number;
  /** Mandatory RRIF minimum withdrawal applied this year (0 before age 71) */
  rrifMinimum?: number;
  /** OAS clawback (recovery tax) deducted from OAS this year */
  oasClawback?: number;
  /** Annual tax drag applied to non-registered account growth */
  nonRegTaxDrag?: number;
  /** Nominal portfolio return rate actually used this year (glide path aware) */
  appliedReturnRate?: number;
  /** Spending step-down factor in effect this year */
  spendingFactor?: number;
  /** RRSP contribution made this year (0 during retirement) */
  rrspContributionYear?: number;
  /** TFSA contribution made this year (0 during retirement) */
  tfsaContributionYear?: number;
  /** After-expenses surplus reinvested to non-reg this year */
  surplusToNonReg?: number;
  /** RRSP room generated this year that was not used (0 during retirement) */
  unusedRrspRoom?: number;
  /** TFSA annual room not used this year (0 during retirement) */
  unusedTfsaRoom?: number;
  /** Balance in the cash/savings bucket (bank accounts not actively invested) */
  cashBalance?: number;
  /** Cash withdrawn from savings bucket to cover shortfall this year */
  cashWithdrawal?: number;
  /** Surplus directed to the cash savings bucket (when investSurplus=false) */
  surplusToCash?: number;
  /** Running adjusted cost basis of the non-registered account at end of this year. */
  nonRegAcb?: number;
  /** Capital gain included in income this year from non-reg withdrawal (50% inclusion rate already applied). */
  nonRegCapitalGain?: number;
  /** Withdrawal strategy id in effect this year. */
  withdrawalStrategy?: string;
}

/** Result of a cash-flow projection */
export interface ProjectionResult {
  scenarioId: string;
  scenarioName: string;
  years: ProjectionYear[];
  summary: {
    totalLifetimeTax: number;
    totalLifetimeIncome: number;
    portfolioDepletionAge: number | null;
    finalNetWorth: number;
  };
}

/** Result of a Monte Carlo simulation */
export interface MonteCarloResult {
  scenarioId: string;
  trials: number;
  successRate: number;
  percentiles: {
    p5: ProjectionYear[];
    p25: ProjectionYear[];
    p50: ProjectionYear[];
    p75: ProjectionYear[];
    p95: ProjectionYear[];
  };
  distributionByYear: {
    year: number;
    min: number;
    p5: number;
    p25: number;
    median: number;
    p75: number;
    p95: number;
    max: number;
  }[];
}

/** Represents a real estate property */
export interface RealEstate {
  id: string;
  name: string;
  propertyType: string;
  currentValue: number;
  purchasePrice: number;
  annualAppreciation: number;
  grossRentalIncome: number | null;
  rentalExpenses: number | null;
  sellAtAge: number | null;
  netProceedsPercent: number;
  householdId: string;
  createdAt: string;
  updatedAt: string;
}

/** Represents a retirement goal */
export interface Goal {
  id: string;
  name: string;
  description: string | null;
  targetAmount: number;
  targetAge: number | null;
  priority: string;
  category: string;
  householdId: string;
  createdAt: string;
  updatedAt: string;
}

/** A contextual retirement insight/recommendation */
export interface Insight {
  id: string;
  title: string;
  description: string;
  dollarImpact: number;
  priority: 'high' | 'medium' | 'low';
  linkTo: string;
  category: 'tax' | 'benefits' | 'investment' | 'estate';
}
