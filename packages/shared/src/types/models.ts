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
  createdAt: string;
  updatedAt: string;
}

/** Represents a member of a household */
export interface HouseholdMember {
  id: string;
  name: string;
  dateOfBirth: string;
  province: string;
  householdId: string;
}

/** Represents a financial account */
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
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
