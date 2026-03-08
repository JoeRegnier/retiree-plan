import type { Province } from '@retiree-plan/shared';
import type { ProjectionYear } from '@retiree-plan/shared';
import { RRIF_MINIMUM_WITHDRAWAL, RRSP_2024, TFSA_ANNUAL_LIMIT_2024 } from '@retiree-plan/shared';
import { calculateTotalTax } from '../tax/canadian-tax.js';
import { calculateCppBenefit, calculateOasBenefit } from '../benefits/government.js';

/**
 * A single income source with optional age-range bounds.
 * When startAge / endAge are omitted the source is active for
 * every year up to (and including) retirementAge - 1.
 */
export interface IncomeSourceEntry {
  annualAmount: number;
  /** First age at which this income is active (inclusive). */
  startAge?: number;
  /** Last age at which this income is active (inclusive). */
  endAge?: number;
  /** Whether to inflate the amount year-over-year. Defaults to true. */
  indexToInflation?: boolean;
}

/**
 * A single expense entry with optional age-range bounds.
 * When startAge / endAge are omitted the expense is active for the
 * entire projection (all ages).
 */
export interface ExpenseEntry {
  annualAmount: number;
  /** First age at which this expense is active (inclusive). Defaults to 0. */
  startAge?: number;
  /** Last age at which this expense ends (inclusive). Defaults to endAge of projection. */
  endAge?: number;
  /** Whether to inflate the amount year-over-year. Defaults to true. */
  indexToInflation?: boolean;
}

/**
 * A portfolio glide-path step. At the given age the nominal return rate
 * shifts to `returnRate`. Steps are applied in ascending age order; the
 * most-recent step at or before the current simulation age is used.
 */
export interface GlidePathStep {
  age: number;
  returnRate: number;
}

/**
 * An expense-phase multiplier. From `fromAge` onward, all expenses are
 * multiplied by `factor` (on top of inflation). Supports step-down at
 * retirement, step-up for late-life healthcare, etc.
 */
export interface SpendingPhase {
  fromAge: number;
  /** Multiplier applied to inflation-adjusted expenses (e.g. 0.85 = -15%). */
  factor: number;
}

export interface CashFlowInput {
  /** Current age of primary member */
  currentAge: number;
  /** Target end age for projection */
  endAge: number;
  /** Province of residence */
  province: Province;
  /**
   * Flat annual employment income pre-retirement (legacy scalar).
   * Ignored when `incomeSources` is supplied.
   */
  employmentIncome: number;
  /** Age at which employment income stops */
  retirementAge: number;
  /**
   * Detailed income sources with per-source age ranges.
   * When provided this replaces the flat `employmentIncome` scalar.
   */
  incomeSources?: IncomeSourceEntry[];
  /** Annual living expenses (today's dollars) — used when expenseEntries is not provided. */
  annualExpenses: number;
  /**
   * Detailed expense entries with per-expense age ranges.
   * When provided the per-age sum replaces the flat `annualExpenses` scalar.
   */
  expenseEntries?: ExpenseEntry[];
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
   * Age at which RRSP converts to RRIF with mandatory minimum withdrawals.
   * CRA requires conversion by end of the year the owner turns 71.
   * Default: 71.
   */
  rrifConversionAge?: number;
  /**
   * Annual effective tax rate applied to non-registered account growth.
   * Models ongoing income tax on interest, dividends, and realised gains.
   * E.g. 0.25 means 25 % of each year's non-reg growth is treated as
   * taxable income. Default: 0 (no drag — backwards compatible).
   */
  nonRegTaxDragRate?: number;
  /**
   * Portfolio return-rate glide path. Each step overrides `nominalReturnRate`
   * starting from the given age. Falls back to `nominalReturnRate` when no
   * step applies.
   */
  glidePathSteps?: GlidePathStep[];
  /**
   * Per-phase expense multipliers applied on top of inflation-adjustment.
   * E.g. [{fromAge: 65, factor: 0.85}] reduces spending 15 % at retirement.
   */
  spendingPhases?: SpendingPhase[];
  /**
   * Optional per-year return sequence. When provided, index i is used for year i
   * instead of nominalReturnRate / glide path (enables historical bootstrap).
   */
  yearlyReturnRates?: number[];
  // ─── Cash / savings bucket ───────────────────────────────────────────────
  /**
   * Starting balance of cash / savings accounts (chequing, HISA, etc.).
   * These accounts are NOT invested at the portfolio return rate — they earn
   * the much lower `cashSavingsRate` instead. Default: 0.
   */
  cashBalance?: number;
  /**
   * Annual growth rate applied to the cash/savings bucket.
   * Models HISA or chequing interest. Default: 0.025 (2.5%).
   */
  cashSavingsRate?: number;
  /**
   * When true, any income surplus after expenses is automatically reinvested
   * into the non-registered investment account.
   * When false (default), surplus stays in the cash/savings bucket — the
   * conservative assumption that money not explicitly scheduled for investment
   * is not invested.
   */
  investSurplus?: boolean;
  // ─── Per-account return rate overrides ───────────────────────────────────
  /**
   * Optional annual return rate for the RRSP account specifically.
   * Falls back to `nominalReturnRate` / glide-path when omitted.
   */
  rrspReturnRate?: number;
  /** Optional annual return rate for the TFSA account. */
  tfsaReturnRate?: number;
  /** Optional annual return rate for the non-registered account. */
  nonRegReturnRate?: number;
}

/** Returns the RRIF minimum withdrawal rate for the given age (CRA schedule). */
function getRRIFMinRate(age: number): number {
  if (age < 71) return 0;
  // CRA table caps at 95+ at 20 %
  const cappedAge = Math.min(age, 95);
  return RRIF_MINIMUM_WITHDRAWAL[cappedAge] ?? 0.2;
}

/**
 * Resolve the return rate for a given age from the glide path, falling back
 * to the base nominal return rate if no step applies.
 */
function resolveReturnRate(
  age: number,
  nominalReturnRate: number,
  glidePathSteps?: GlidePathStep[],
): number {
  if (!glidePathSteps || glidePathSteps.length === 0) return nominalReturnRate;
  // Walk steps in descending age to find the most-recent applicable one
  const sorted = [...glidePathSteps].sort((a, b) => b.age - a.age);
  const match = sorted.find((s) => s.age <= age);
  return match ? match.returnRate : nominalReturnRate;
}

/**
 * Resolve the spending multiplier for a given age from the spending phases.
 * Returns 1.0 if no phase applies.
 */
function resolveSpendingFactor(age: number, spendingPhases?: SpendingPhase[]): number {
  if (!spendingPhases || spendingPhases.length === 0) return 1;
  const sorted = [...spendingPhases].sort((a, b) => b.fromAge - a.fromAge);
  const match = sorted.find((s) => s.fromAge <= age);
  return match ? match.factor : 1;
}

/**
 * Run a deterministic year-by-year cash-flow projection.
 * This is the core projection engine — Monte Carlo wraps this
 * with randomised return sequences.
 */
export function runCashFlowProjection(input: CashFlowInput): ProjectionYear[] {
  const years: ProjectionYear[] = [];
  const currentYear = new Date().getFullYear();

  const rrifConversionAge = input.rrifConversionAge ?? 71;
  const nonRegTaxDragRate = input.nonRegTaxDragRate ?? 0;
  const cashSavingsRate   = input.cashSavingsRate ?? 0.025;
  const investSurplus     = input.investSurplus ?? false;

  let rrsp   = input.rrspBalance;
  let tfsa   = input.tfsaBalance;
  let nonReg = input.nonRegBalance;
  let cash   = input.cashBalance ?? 0;  // savings / chequing bucket

  for (let age = input.currentAge; age <= input.endAge; age++) {
    const yearIndex = age - input.currentAge;
    const year = currentYear + yearIndex;

    // ── Return rate (glide path or per-year sequence) ─────────────────────────
    const returnRate =
      input.yearlyReturnRates != null && input.yearlyReturnRates[yearIndex] != null
        ? input.yearlyReturnRates[yearIndex]
        : resolveReturnRate(age, input.nominalReturnRate, input.glidePathSteps);

    const inflationFactor = Math.pow(1 + input.inflationRate, yearIndex);

    // ── Contributions (pre-retirement only) ───────────────────────────────────
    const isWorking = age < input.retirementAge;
    if (isWorking) {
      rrsp += input.rrspContribution ?? 0;
      tfsa += input.tfsaContribution ?? 0;
    }

    // ── Pre-retirement deductions ─────────────────────────────────────────────
    // RRSP contributions reduce taxable income (CRA deduction).
    // TFSA contributions come from after-tax take-home pay — they are a cash
    // cost that reduces the amount available for expenses and non-reg savings.
    // Both are zero during retirement (no new contributions made).
    const rrspDeduction = isWorking ? (input.rrspContribution ?? 0) : 0;
    const tfsaCashCost  = isWorking ? (input.tfsaContribution ?? 0) : 0;

    // ── Investment growth (before withdrawals) ────────────────────────────────
    // Each account can use its own return rate. When a per-account rate is not
    // supplied the glide-path-aware `returnRate` is used as the default.
    // The cash/savings bucket grows at the lower `cashSavingsRate`.
    const rrspRate   = input.rrspReturnRate   ?? returnRate;
    const tfsaRate   = input.tfsaReturnRate   ?? returnRate;
    const nonRegRate = input.nonRegReturnRate ?? returnRate;
    rrsp   *= 1 + rrspRate;
    tfsa   *= 1 + tfsaRate;
    nonReg *= 1 + nonRegRate;
    cash   *= 1 + cashSavingsRate;

    // ── Non-registered annual tax drag ────────────────────────────────────────
    // Tax on interest/dividends/realised gains accrued during the year. The drag
    // is charged against the non-reg balance and added to taxable income below.
    const nonRegGrowth = nonReg - nonReg / (1 + returnRate); // growth this year
    const nonRegTaxDrag = nonRegGrowth > 0 ? nonRegGrowth * nonRegTaxDragRate : 0;
    if (nonRegTaxDrag > 0) {
      nonReg -= nonRegTaxDrag;
    }

    // ── Income ────────────────────────────────────────────────────────────────
    let employmentIncome: number;
    if (input.incomeSources && input.incomeSources.length > 0) {
      employmentIncome = input.incomeSources
        .filter((src) => {
          const start = src.startAge ?? 0;
          const end = src.endAge ?? (input.retirementAge - 1);
          return age >= start && age <= end;
        })
        .reduce((sum, src) => {
          const amount =
            src.indexToInflation !== false
              ? src.annualAmount * inflationFactor
              : src.annualAmount;
          return sum + amount;
        }, 0);
    } else {
      employmentIncome = isWorking ? input.employmentIncome * inflationFactor : 0;
    }

    // ── CPP ───────────────────────────────────────────────────────────────────
    const cppIncome = age >= input.cppStartAge
      ? calculateCppBenefit({
          startAge: input.cppStartAge,
          benefitFraction: input.cppBenefitFraction,
        }) * inflationFactor
      : 0;

    // ── OAS (first pass — no clawback yet; clawback applied after total income known) ──
    const oasBenefitGross = age >= input.oasStartAge
      ? calculateOasBenefit({
          startAge: input.oasStartAge,
          yearsOfResidency: input.oasResidencyYears,
        }) * inflationFactor
      : 0;

    // ── Expenses ──────────────────────────────────────────────────────────────
    const spendingFactor = resolveSpendingFactor(age, input.spendingPhases);
    let baseExpenses: number;
    if (input.expenseEntries && input.expenseEntries.length > 0) {
      baseExpenses = input.expenseEntries
        .filter((exp) => {
          const start = exp.startAge ?? 0;
          const end   = exp.endAge   ?? input.endAge;
          return age >= start && age <= end;
        })
        .reduce((sum, exp) => {
          const amount =
            exp.indexToInflation !== false
              ? exp.annualAmount * inflationFactor
              : exp.annualAmount;
          return sum + amount;
        }, 0);
    } else {
      baseExpenses = input.annualExpenses * inflationFactor;
    }
    const expenses = baseExpenses * spendingFactor;

    // ── RRIF mandatory minimum ────────────────────────────────────────────────
    // Once the RRSP is converted to a RRIF (default age 71), CRA requires a
    // minimum annual withdrawal whether or not income is needed.
    let rrifMinimum = 0;
    let forcedRrspWithdrawal = 0;
    if (age >= rrifConversionAge && rrsp > 0) {
      rrifMinimum = round(rrsp * getRRIFMinRate(age));
      forcedRrspWithdrawal = Math.min(rrifMinimum, rrsp);
    }

    // ── Estimate shortfall to determine additional withdrawals ────────────────
    // First-pass: estimate tax on known income (excl. any shortfall withdrawals)
    // to determine how much more we need to draw down.
    //
    // Pre-retirement: taxable income is reduced by the RRSP deduction.
    // Estimated available cash = gross income − RRSP redirect − TFSA cash cost − tax.
    const knownTaxableIncome = employmentIncome - rrspDeduction + cppIncome + oasBenefitGross + forcedRrspWithdrawal + nonRegTaxDrag;
    const estimatedTaxOnKnown = calculateTotalTax(knownTaxableIncome, input.province).totalTax;
    // Net spendable cash from known income sources (after tax and redirected amounts).
    // Shortfall = gap between expenses and what income alone can cover; withdrawals make up the rest.
    const estimatedGrossKnown = employmentIncome + cppIncome + oasBenefitGross + forcedRrspWithdrawal;
    const estimatedNetKnown = estimatedGrossKnown - estimatedTaxOnKnown - rrspDeduction - tfsaCashCost;
    const estimatedShortfall = Math.max(0, expenses - estimatedNetKnown);

    // ── Discretionary withdrawals (shortfall above RRIF minimum) ─────────────
    // Pre-retirement: investment accounts are locked — only the cash bucket
    // bridges gaps.
    //
    // Post-retirement: OAS-clawback-aware drawdown order.
    //
    // The CRA OAS recovery tax claws back $0.15 for every $1 of net income
    // above the threshold (~$90,997 in 2024). To minimise this:
    //   1. Cash bucket — no withdrawal tax
    //   2. RRSP/RRIF up to the OAS clawback threshold (taxable but optimal
    //      when room is available — the "RRSP meltdown" zone)
    //   3. TFSA — supplements RRSP when drawing more RRSP would push income
    //      above the threshold; withdrawals are tax-free and don't affect OAS
    //   4. Non-registered — capital gains treatment
    //   5. RRSP/RRIF beyond threshold — last resort to avoid running out of money
    //
    // This blended RRSP + TFSA approach minimises lifetime tax by keeping
    // annual taxable income just below the clawback zone.

    // OAS clawback threshold, inflation-adjusted from the 2024 base value.
    const OAS_CLAWBACK_THRESHOLD_2024 = 90_997;
    // Headroom = how much more RRSP we can draw this year before tipping into
    // the OAS clawback zone (forced RRIF minimum is already committed).
    const rrspHeadroom = !isWorking
      ? Math.max(
          0,
          OAS_CLAWBACK_THRESHOLD_2024 * inflationFactor
            - cppIncome
            - oasBenefitGross
            - forcedRrspWithdrawal,
        )
      : 0;

    // 1. Cash bucket — no tax on withdrawal
    const cashWithdrawal = Math.min(estimatedShortfall, cash);
    const rem1 = estimatedShortfall - cashWithdrawal;

    // 2. RRSP voluntary draw, capped at OAS headroom
    const additionalRrspBelowThreshold = isWorking
      ? 0
      : Math.min(rem1, Math.max(0, rrsp - forcedRrspWithdrawal), rrspHeadroom);
    const rem2 = rem1 - additionalRrspBelowThreshold;

    // 3. TFSA — tax-free, no clawback impact; use when RRSP headroom is
    //    exhausted but shortfall still remains
    const tfsaWithdrawal = isWorking ? 0 : Math.min(rem2, tfsa);
    const rem3 = rem2 - tfsaWithdrawal;

    // 4. Non-registered
    const nonRegWithdrawal = isWorking ? 0 : Math.min(rem3, nonReg);
    const rem4 = rem3 - nonRegWithdrawal;

    // 5. RRSP beyond clawback threshold — last resort
    const additionalRrspBeyondThreshold = isWorking
      ? 0
      : Math.min(
          rem4,
          Math.max(
            0,
            rrsp - forcedRrspWithdrawal - additionalRrspBelowThreshold,
          ),
        );

    const additionalRrsp = additionalRrspBelowThreshold + additionalRrspBeyondThreshold;
    const rrspWithdrawal = forcedRrspWithdrawal + additionalRrsp;

    tfsa   -= tfsaWithdrawal;
    cash   -= cashWithdrawal;
    rrsp   -= rrspWithdrawal;
    nonReg -= nonRegWithdrawal;

    // ── OAS clawback (second pass with full income picture) ───────────────────
    // Clawback is based on total net income including RRIF withdrawals.
    // Deflate to 2024 dollars so the comparison uses the published threshold.
    const taxableIncomeForClawback =
      employmentIncome + cppIncome + rrspWithdrawal + nonRegTaxDrag;
    const taxableIncomeIn2024Dollars = taxableIncomeForClawback / inflationFactor;

    // Recalculate OAS with actual clawback applied
    const oasIncome = age >= input.oasStartAge
      ? calculateOasBenefit({
          startAge: input.oasStartAge,
          yearsOfResidency: input.oasResidencyYears,
          netIncome: taxableIncomeIn2024Dollars,
        }) * inflationFactor
      : 0;
    const oasClawback = round(Math.max(0, oasBenefitGross - oasIncome));

    // ── Final tax (all taxable sources) ───────────────────────────────────────
    // Taxable income:
    //   Pre-retirement: employment income reduced by RRSP deduction + CPP + OAS + non-reg drag
    //   Retirement:     rrspDeduction=0, so this equals employment(0) + CPP + OAS + RRIF withdrawal + drag
    const taxableIncome =
      employmentIncome - rrspDeduction + cppIncome + oasIncome + rrspWithdrawal + nonRegTaxDrag;

    // Total gross cash received (for display / charting) — does NOT include the RRSP
    // redirect since that money flowed directly to the RRSP account, never the wallet.
    // Cash withdrawal is included: it is post-tax savings being spent down.
    const totalIncome =
      employmentIncome + cppIncome + oasIncome + rrspWithdrawal + tfsaWithdrawal + cashWithdrawal + nonRegWithdrawal;

    const taxResult = calculateTotalTax(taxableIncome, input.province);

    // Net cash available for spending:
    //   Pre-retirement: gross received − tax − RRSP redirect − TFSA contribution cost
    //   Retirement:     rrspDeduction=tfsaCashCost=0, so same as totalIncome − tax
    const netIncome = totalIncome - taxResult.totalTax - rrspDeduction - tfsaCashCost;
    const netCashFlow = netIncome - expenses;

    // ── Reinvest surplus ──────────────────────────────────────────────────────
    // By default surplus accumulates in the cash/savings bucket (conservative).
    // When `investSurplus: true` the surplus is directly invested in non-reg.
    const surplusAmount = Math.max(0, netCashFlow);
    const surplusToNonReg = investSurplus ? surplusAmount : 0;
    const surplusToCash   = investSurplus ? 0 : surplusAmount;
    if (surplusToNonReg > 0) nonReg += surplusToNonReg;
    if (surplusToCash   > 0) cash   += surplusToCash;

    // ── Contribution room diagnostics ─────────────────────────────────────────
    const rrspContributionYear = isWorking ? (input.rrspContribution ?? 0) : 0;
    const tfsaContributionYear = isWorking ? (input.tfsaContribution ?? 0) : 0;
    // RRSP room generated this year ≈ 18 % of employment income, capped at indexed annual limit
    const rrspRoomThisYear = isWorking
      ? Math.min(
          employmentIncome * RRSP_2024.contributionRateOfEarnedIncome,
          RRSP_2024.maxContribution * inflationFactor,
        )
      : 0;
    const unusedRrspRoom = round(Math.max(0, rrspRoomThisYear - rrspContributionYear));
    const unusedTfsaRoom = isWorking
      ? round(Math.max(0, TFSA_ANNUAL_LIMIT_2024 - tfsaContributionYear))
      : 0;

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
      federalTax: round(taxResult.federalTax),
      provincialTax: round(taxResult.provincialTax),
      totalTax: round(taxResult.totalTax),
      netIncome: round(netIncome),
      expenses: round(expenses),
      netCashFlow: round(netCashFlow),
      rrspBalance: round(rrsp),
      tfsaBalance: round(tfsa),
      nonRegBalance: round(nonReg),
      cashBalance: round(cash),
      totalNetWorth: round(rrsp + tfsa + nonReg + cash),
      // Diagnostic / allocation fields
      rrifMinimum: round(rrifMinimum),
      oasClawback: round(oasClawback),
      nonRegTaxDrag: round(nonRegTaxDrag),
      appliedReturnRate: returnRate,
      spendingFactor,
      rrspContributionYear: round(rrspContributionYear),
      tfsaContributionYear: round(tfsaContributionYear),
      surplusToNonReg: round(surplusToNonReg),
      surplusToCash: round(surplusToCash),
      cashWithdrawal: round(cashWithdrawal),
      unusedRrspRoom: round(unusedRrspRoom),
      unusedTfsaRoom: round(unusedTfsaRoom),
    });
  }

  return years;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

