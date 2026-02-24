/**
 * RRSP/RRIF Meltdown Optimizer
 *
 * Calculates the optimal annual RRSP→taxable withdrawal amounts before
 * mandatory RRIF conversion age (71) to:
 *  - Level out annual income and minimize lifetime tax
 *  - Avoid (or reduce) OAS clawback zone (threshold ~$90,997 in 2024)
 *  - Minimize estate tax on RRSP/RRIF lump-sum deemed disposition
 */

import { calculateTotalTax } from '../tax/canadian-tax.js';

export interface MeltdownInput {
  /** Current age */
  currentAge: number;
  /** Age at which RRIF conversion is mandatory (default 71) */
  rrifConversionAge?: number;
  /** Current RRSP / RRIF balance */
  rrspBalance: number;
  /** Other annual taxable income outside of RRSP (pension, CPP, OAS, etc.) */
  otherAnnualIncome: number;
  /** Province of residence */
  province: string;
  /** Expected nominal annual return on RRSP investments */
  expectedReturn?: number;
  /** OAS clawback threshold (2024: $90,997) */
  oasClawbackThreshold?: number;
}

export interface MeltdownYear {
  age: number;
  rrspBalanceStart: number;
  optimalWithdrawal: number;
  totalTaxableIncome: number;
  totalTax: number;
  effectiveRate: number;
  rrspBalanceEnd: number;
}

export interface MeltdownResult {
  years: MeltdownYear[];
  totalTaxNoMeltdown: number;
  totalTaxWithMeltdown: number;
  taxSavings: number;
  strategy: string;
}

/**
 * Binary-search for the withdrawal amount that brings total income
 * just below `targetIncome`.
 */
function findWithdrawalToTargetIncome(
  otherIncome: number,
  targetIncome: number,
  maxWithdrawal: number,
): number {
  const room = Math.max(0, targetIncome - otherIncome);
  return Math.min(room, maxWithdrawal);
}

export function optimizeRrspMeltdown(input: MeltdownInput): MeltdownResult {
  const {
    currentAge,
    rrifConversionAge = 71,
    rrspBalance,
    otherAnnualIncome,
    province,
    expectedReturn = 0.06,
    oasClawbackThreshold = 90997,
  } = input;

  // Strategy: withdraw enough each year to fill up the income bracket
  // just below the OAS clawback threshold (if otherIncome < threshold)
  // OR to distribute RRSP over remaining years (if near/above threshold)
  const yearsUntilRrif = Math.max(0, rrifConversionAge - currentAge);
  const targetIncome = Math.min(oasClawbackThreshold * 0.98, otherAnnualIncome + 40000);

  const years: MeltdownYear[] = [];
  let balance = rrspBalance;

  for (let i = 0; i < yearsUntilRrif && balance > 0; i++) {
    const age = currentAge + i;
    const balanceStart = balance;
    const growth = balance * expectedReturn;
    const maxWithdrawal = balance + growth;

    const optimalWithdrawal = findWithdrawalToTargetIncome(
      otherAnnualIncome,
      targetIncome,
      maxWithdrawal,
    );

    const totalTaxableIncome = otherAnnualIncome + optimalWithdrawal;
    const taxResult = calculateTotalTax(totalTaxableIncome, province as any);
    const totalTax = taxResult.totalTax;
    const effectiveRate = totalTaxableIncome > 0 ? totalTax / totalTaxableIncome : 0;

    balance = (balance + growth - optimalWithdrawal);

    years.push({
      age,
      rrspBalanceStart: parseFloat(balanceStart.toFixed(2)),
      optimalWithdrawal: parseFloat(optimalWithdrawal.toFixed(2)),
      totalTaxableIncome: parseFloat(totalTaxableIncome.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      effectiveRate: parseFloat(effectiveRate.toFixed(4)),
      rrspBalanceEnd: parseFloat(Math.max(0, balance).toFixed(2)),
    });

    if (balance <= 0) break;
  }

  // Compare: no meltdown — RRSP grows until RRIF conversion, then drawn fully
  let noMeltdownTax = 0;
  let withMeltdownTax = 0;

  // Baseline: RRSP untouched until RRIF, then deemed disposition at age 91
  const rrspAtRrif = rrspBalance * Math.pow(1 + expectedReturn, yearsUntilRrif);
  const noMeltdownTaxResult = calculateTotalTax(
    otherAnnualIncome + rrspAtRrif,
    province as any,
  );
  noMeltdownTax = noMeltdownTaxResult.totalTax * yearsUntilRrif;

  // With meltdown: sum taxes from yearly strategy
  withMeltdownTax = years.reduce((s, y) => s + y.totalTax, 0);

  const taxSavings = Math.max(0, noMeltdownTax - withMeltdownTax);
  const strategy =
    taxSavings > 0
      ? `Withdraw $${(years[0]?.optimalWithdrawal ?? 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })} per year from RRSP to level income to ~$${targetIncome.toLocaleString('en-CA', { maximumFractionDigits: 0 })}/yr`
      : 'No meltdown beneficial — other income already near/above threshold';

  return {
    years,
    totalTaxNoMeltdown: parseFloat(noMeltdownTax.toFixed(2)),
    totalTaxWithMeltdown: parseFloat(withMeltdownTax.toFixed(2)),
    taxSavings: parseFloat(taxSavings.toFixed(2)),
    strategy,
  };
}
