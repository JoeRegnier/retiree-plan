import type { Province } from '@retiree-plan/shared';
import type { ProjectionYear } from '@retiree-plan/shared';
import { calculateTotalTax } from '../tax/canadian-tax.js';
import { calculateCppBenefit, calculateOasBenefit } from '../benefits/government.js';

export interface CashFlowInput {
  /** Current age of primary member */
  currentAge: number;
  /** Target end age for projection */
  endAge: number;
  /** Province of residence */
  province: Province;
  /** Annual employment income (pre-retirement) */
  employmentIncome: number;
  /** Age at which employment income stops */
  retirementAge: number;
  /** Annual living expenses (today's dollars) */
  annualExpenses: number;
  /** Inflation rate (decimal, e.g. 0.02) */
  inflationRate: number;
  /** Nominal return rate on investments (decimal) */
  nominalReturnRate: number;
  /** CPP start age */
  cppStartAge: number;
  /** CPP benefit fraction (0-1) */
  cppBenefitFraction?: number;
  /** OAS start age */
  oasStartAge: number;
  /** OAS residency years */
  oasResidencyYears?: number;
  /** Starting RRSP balance */
  rrspBalance: number;
  /** Starting TFSA balance */
  tfsaBalance: number;
  /** Starting non-registered balance */
  nonRegBalance: number;
  /** Annual RRSP contribution (pre-retirement) */
  rrspContribution?: number;
  /** Annual TFSA contribution (pre-retirement) */
  tfsaContribution?: number;
  /**
   * Optional per-year return sequence. When provided, index i is used for year i
   * instead of nominalReturnRate (enables historical bootstrap / block-bootstrap).
   */
  yearlyReturnRates?: number[];
}

/**
 * Run a deterministic year-by-year cash-flow projection.
 * This is the core projection engine — Monte Carlo wraps this
 * with randomised return sequences.
 */
export function runCashFlowProjection(input: CashFlowInput): ProjectionYear[] {
  const years: ProjectionYear[] = [];
  const currentYear = new Date().getFullYear();

  let rrsp = input.rrspBalance;
  let tfsa = input.tfsaBalance;
  let nonReg = input.nonRegBalance;

  for (let age = input.currentAge; age <= input.endAge; age++) {
    const yearIndex = age - input.currentAge;
    const year = currentYear + yearIndex;
    const returnRate =
      input.yearlyReturnRates != null && input.yearlyReturnRates[yearIndex] != null
        ? input.yearlyReturnRates[yearIndex]
        : input.nominalReturnRate;
    const inflationFactor = Math.pow(1 + input.inflationRate, yearIndex);

    // Income
    const isWorking = age < input.retirementAge;
    const employmentIncome = isWorking ? input.employmentIncome * inflationFactor : 0;
    const cppIncome = age >= input.cppStartAge
      ? calculateCppBenefit({
          startAge: input.cppStartAge,
          benefitFraction: input.cppBenefitFraction,
        }) * inflationFactor
      : 0;
    const oasIncome = age >= input.oasStartAge
      ? calculateOasBenefit({
          startAge: input.oasStartAge,
          yearsOfResidency: input.oasResidencyYears,
        }) * inflationFactor
      : 0;

    // Expenses (inflation-adjusted)
    const expenses = input.annualExpenses * inflationFactor;

    // Contributions (pre-retirement only)
    if (isWorking) {
      rrsp += input.rrspContribution ?? 0;
      tfsa += input.tfsaContribution ?? 0;
    }

    // Investment growth
    rrsp *= 1 + returnRate;
    tfsa *= 1 + returnRate;
    nonReg *= 1 + returnRate;

    // Calculate total known income
    const knownIncome = employmentIncome + cppIncome + oasIncome;

    // Determine withdrawal needs
    let rrspWithdrawal = 0;
    let tfsaWithdrawal = 0;
    let nonRegWithdrawal = 0;
    const shortfall = Math.max(0, expenses - knownIncome);

    if (shortfall > 0 && !isWorking) {
      // Draw down order: TFSA first (tax-free), then RRSP, then non-reg
      tfsaWithdrawal = Math.min(shortfall, tfsa);
      const remaining1 = shortfall - tfsaWithdrawal;

      rrspWithdrawal = Math.min(remaining1, rrsp);
      const remaining2 = remaining1 - rrspWithdrawal;

      nonRegWithdrawal = Math.min(remaining2, nonReg);
    }

    tfsa -= tfsaWithdrawal;
    rrsp -= rrspWithdrawal;
    nonReg -= nonRegWithdrawal;

    // Taxable income = employment + CPP + OAS + RRSP withdrawal
    const taxableIncome = employmentIncome + cppIncome + oasIncome + rrspWithdrawal;
    const totalIncome = taxableIncome + tfsaWithdrawal + nonRegWithdrawal;

    const taxResult = calculateTotalTax(taxableIncome, input.province);

    const netIncome = totalIncome - taxResult.totalTax;
    const netCashFlow = netIncome - expenses;

    years.push({
      year,
      age,
      grossIncome: round(totalIncome),
      employmentIncome: round(employmentIncome),
      cppIncome: round(cppIncome),
      oasIncome: round(oasIncome),
      rrspWithdrawal: round(rrspWithdrawal),
      tfsaWithdrawal: round(tfsaWithdrawal),
      nonRegWithdrawal: round(nonRegWithdrawal),
      otherIncome: 0,
      totalIncome: round(totalIncome),
      federalTax: taxResult.federalTax,
      provincialTax: taxResult.provincialTax,
      totalTax: taxResult.totalTax,
      netIncome: round(netIncome),
      expenses: round(expenses),
      netCashFlow: round(netCashFlow),
      rrspBalance: round(rrsp),
      tfsaBalance: round(tfsa),
      nonRegBalance: round(nonReg),
      totalNetWorth: round(rrsp + tfsa + nonReg),
    });
  }

  return years;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
