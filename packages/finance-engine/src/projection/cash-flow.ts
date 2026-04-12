import type { Province } from '@retiree-plan/shared';
import type { ProjectionYear } from '@retiree-plan/shared';
import { RRIF_MINIMUM_WITHDRAWAL, RRSP_2024, TFSA_ANNUAL_LIMIT_2024 } from '@retiree-plan/shared';
import { calculateTotalTax } from '../tax/canadian-tax.js';
import { calculateCppBenefit, calculateOasBenefit } from '../benefits/government.js';
import type { WithdrawalStrategyId, AccountBucket } from '@retiree-plan/shared';

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

export interface MemberDescriptor {
  id: string;
  name: string;
  province: Province;
}

export interface MemberIncomeSourceEntry extends IncomeSourceEntry {
  memberId: string;
}

export interface MemberTypeShareTimelineEntry {
  effectiveYear: number;
  memberId: string;
  memberName?: string;
  province?: Province;
  rrspShare: number;
  tfsaShare: number;
  nonRegShare: number;
  cashShare: number;
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
  /** Member-level income sources for per-member reporting and taxation. */
  memberIncomeSources?: MemberIncomeSourceEntry[];
  /** Optional member list for per-member output. */
  members?: MemberDescriptor[];
  /** Historical per-member account-type attribution shares by effective year. */
  memberTypeShareTimeline?: MemberTypeShareTimelineEntry[];
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
  /**
   * Withdrawal strategy to apply. Default: 'oas-optimized' (existing behaviour).
   * 'rrsp-first' aggressively draws RRSP before 71. 'tfsa-last' preserves TFSA for estate.
   * 'non-reg-first' draws non-reg ahead of shelter. 'proportional' draws pro-rata.
   * 'custom' uses withdrawalOrder.
   */
  withdrawalStrategy?: WithdrawalStrategyId;
  /** Only used when withdrawalStrategy = 'custom'. Priority list of account buckets. */
  withdrawalOrder?: AccountBucket[];
  /**
   * Adjusted cost basis of the non-registered account at the start of the projection.
   * When omitted, cost basis is assumed equal to the opening balance (no embedded gain).
   */
  nonRegInitialAcb?: number;
  /**
   * Enable flexible spending guardrails (Guyton-Klinger style).
   * Annual expenses are clamped within [floor, ceiling] × previous-year real expenses.
   */
  flexSpendingEnabled?: boolean;
  /** Spending floor fraction (e.g. 0.90). Default 0.90. */
  flexSpendingFloor?: number;
  /** Spending ceiling fraction (e.g. 1.10). Default 1.10. */
  flexSpendingCeiling?: number;
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

function resolveMemberTypeShares(
  members: MemberDescriptor[],
  timeline: MemberTypeShareTimelineEntry[] | undefined,
  year: number,
  key: 'rrspShare' | 'tfsaShare' | 'nonRegShare' | 'cashShare',
): Record<string, number> {
  const ids = members.map((m) => m.id);
  if (!ids.length) return {};

  const equal = 1 / ids.length;
  if (!timeline || timeline.length === 0) {
    return Object.fromEntries(ids.map((id) => [id, equal]));
  }

  const byMember: Record<string, MemberTypeShareTimelineEntry | undefined> = {};
  for (const id of ids) {
    byMember[id] = timeline
      .filter((t) => t.memberId === id && t.effectiveYear <= year)
      .sort((a, b) => b.effectiveYear - a.effectiveYear)[0];
  }

  const raw: Record<string, number> = Object.fromEntries(
    ids.map((id) => [id, Math.max(0, byMember[id]?.[key] ?? 0)]),
  );
  const total = Object.values(raw).reduce((s, v) => s + v, 0);
  if (total <= 0) {
    return Object.fromEntries(ids.map((id) => [id, equal]));
  }
  for (const id of ids) raw[id] = raw[id] / total;
  return raw;
}

function resolveMemberOtherIncome(
  members: MemberDescriptor[],
  memberIncomeSources: MemberIncomeSourceEntry[] | undefined,
  age: number,
  inflationFactor: number,
  retirementAge: number,
): Record<string, number> {
  const base = Object.fromEntries(members.map((m) => [m.id, 0])) as Record<string, number>;
  if (!memberIncomeSources || memberIncomeSources.length === 0) return base;

  for (const src of memberIncomeSources) {
    const start = src.startAge ?? 0;
    const end = src.endAge ?? (retirementAge - 1);
    if (age < start || age > end) continue;
    const amount = src.indexToInflation !== false
      ? src.annualAmount * inflationFactor
      : src.annualAmount;
    if (base[src.memberId] == null) base[src.memberId] = 0;
    base[src.memberId] += amount;
  }

  return base;
}

// ---------------------------------------------------------------------------
// Withdrawal strategy dispatch helpers
// ---------------------------------------------------------------------------

interface WithdrawalInputs {
  shortfall: number;
  cash: number; rrsp: number; tfsa: number; nonReg: number;
  forcedRrspWithdrawal: number;
  rrspHeadroom: number;
  isWorking: boolean;
  strategy: WithdrawalStrategyId;
  customOrder?: AccountBucket[];
}

interface WithdrawalAmounts {
  cashW: number; rrspW: number; tfsaW: number; nonRegW: number;
}

function applyWithdrawalStrategy(inputs: WithdrawalInputs): WithdrawalAmounts {
  const { shortfall, cash, rrsp, tfsa, nonReg, forcedRrspWithdrawal, rrspHeadroom, isWorking, strategy, customOrder } = inputs;
  if (isWorking) {
    // Allow cash to cover any expense shortfall during pre-retirement; only RRIF
    // forced withdrawals come from RRSP.
    const cashW = Math.min(shortfall, cash);
    return { cashW, rrspW: forcedRrspWithdrawal, tfsaW: 0, nonRegW: 0 };
  }
  const availRrsp = Math.max(0, rrsp - forcedRrspWithdrawal);
  switch (strategy) {
    case 'oas-optimized': return _oasOptimized(shortfall, cash, availRrsp, tfsa, nonReg, rrspHeadroom, forcedRrspWithdrawal);
    case 'rrsp-first':    return _rrspFirst(shortfall, cash, availRrsp, tfsa, nonReg, forcedRrspWithdrawal);
    case 'tfsa-last':     return _tfsaLast(shortfall, cash, availRrsp, tfsa, nonReg, rrspHeadroom, forcedRrspWithdrawal);
    case 'non-reg-first': return _nonRegFirst(shortfall, cash, availRrsp, tfsa, nonReg, rrspHeadroom, forcedRrspWithdrawal);
    case 'proportional':  return _proportional(shortfall, cash, availRrsp, tfsa, nonReg, forcedRrspWithdrawal);
    case 'custom':        return _customOrder(shortfall, cash, availRrsp, tfsa, nonReg, forcedRrspWithdrawal, customOrder ?? ['CASH', 'RRSP', 'TFSA', 'NON_REG']);
    default:              return _oasOptimized(shortfall, cash, availRrsp, tfsa, nonReg, rrspHeadroom, forcedRrspWithdrawal);
  }
}

/** OAS-optimized (default): Cash → RRSP≤threshold → TFSA → Non-Reg → RRSP>threshold */
function _oasOptimized(sh: number, cash: number, availRrsp: number, tfsa: number, nonReg: number, headroom: number, forced: number): WithdrawalAmounts {
  const cashW      = Math.min(sh, cash);
  const rem1       = sh - cashW;
  const rrspBelowW = Math.min(rem1, availRrsp, headroom);
  const rem2       = rem1 - rrspBelowW;
  const tfsaW      = Math.min(rem2, tfsa);
  const rem3       = rem2 - tfsaW;
  const nonRegW    = Math.min(rem3, nonReg);
  const rem4       = rem3 - nonRegW;
  const rrspAboveW = Math.min(rem4, Math.max(0, availRrsp - rrspBelowW));
  return { cashW, rrspW: forced + rrspBelowW + rrspAboveW, tfsaW, nonRegW };
}

/** RRSP-first (meltdown): Cash → RRSP → Non-Reg → TFSA */
function _rrspFirst(sh: number, cash: number, availRrsp: number, tfsa: number, nonReg: number, forced: number): WithdrawalAmounts {
  const cashW   = Math.min(sh, cash);
  const rem1    = sh - cashW;
  const rrspW   = Math.min(rem1, availRrsp);
  const rem2    = rem1 - rrspW;
  const nonRegW = Math.min(rem2, nonReg);
  const rem3    = rem2 - nonRegW;
  const tfsaW   = Math.min(rem3, tfsa);
  return { cashW, rrspW: forced + rrspW, tfsaW, nonRegW };
}

/** TFSA-last (estate): Cash → RRSP≤threshold → Non-Reg → RRSP>threshold → TFSA */
function _tfsaLast(sh: number, cash: number, availRrsp: number, tfsa: number, nonReg: number, headroom: number, forced: number): WithdrawalAmounts {
  const cashW      = Math.min(sh, cash);
  const rem1       = sh - cashW;
  const rrspBelowW = Math.min(rem1, availRrsp, headroom);
  const rem2       = rem1 - rrspBelowW;
  const nonRegW    = Math.min(rem2, nonReg);
  const rem3       = rem2 - nonRegW;
  const rrspAboveW = Math.min(rem3, Math.max(0, availRrsp - rrspBelowW));
  const rem4       = rem3 - rrspAboveW;
  const tfsaW      = Math.min(rem4, tfsa);
  return { cashW, rrspW: forced + rrspBelowW + rrspAboveW, tfsaW, nonRegW };
}

/** Non-reg first (capital gains): Cash → Non-Reg → RRSP≤threshold → TFSA → RRSP>threshold */
function _nonRegFirst(sh: number, cash: number, availRrsp: number, tfsa: number, nonReg: number, headroom: number, forced: number): WithdrawalAmounts {
  const cashW      = Math.min(sh, cash);
  const rem1       = sh - cashW;
  const nonRegW    = Math.min(rem1, nonReg);
  const rem2       = rem1 - nonRegW;
  const rrspBelowW = Math.min(rem2, availRrsp, headroom);
  const rem3       = rem2 - rrspBelowW;
  const tfsaW      = Math.min(rem3, tfsa);
  const rem4       = rem3 - tfsaW;
  const rrspAboveW = Math.min(rem4, Math.max(0, availRrsp - rrspBelowW));
  return { cashW, rrspW: forced + rrspBelowW + rrspAboveW, tfsaW, nonRegW };
}

/** Proportional: draw pro-rata from all non-zero accounts. */
function _proportional(sh: number, cash: number, availRrsp: number, tfsa: number, nonReg: number, forced: number): WithdrawalAmounts {
  const total = cash + availRrsp + tfsa + nonReg;
  if (total <= 0) return { cashW: 0, rrspW: forced, tfsaW: 0, nonRegW: 0 };
  const scale = Math.min(sh, total) / total;
  return { cashW: round(cash * scale), rrspW: round(forced + availRrsp * scale), tfsaW: round(tfsa * scale), nonRegW: round(nonReg * scale) };
}

/** Custom order: user-defined priority array, cascades until shortfall met. */
function _customOrder(sh: number, cash: number, availRrsp: number, tfsa: number, nonReg: number, forced: number, order: AccountBucket[]): WithdrawalAmounts {
  let rem = sh;
  let cashW = 0, rrspW = forced, tfsaW = 0, nonRegW = 0;
  const avail: Record<AccountBucket, number> = { CASH: cash, RRSP: availRrsp, TFSA: tfsa, NON_REG: nonReg };
  for (const bucket of order) {
    if (rem <= 0) break;
    const take = Math.min(rem, avail[bucket]);
    avail[bucket] -= take;
    rem -= take;
    if (bucket === 'CASH')    cashW   += take;
    if (bucket === 'RRSP')    rrspW   += take;
    if (bucket === 'TFSA')    tfsaW   += take;
    if (bucket === 'NON_REG') nonRegW += take;
  }
  return { cashW, rrspW, tfsaW, nonRegW };
}

/**
 * Run a deterministic year-by-year cash-flow projection.
 * This is the core projection engine — Monte Carlo wraps this
 * with randomised return sequences.
 */
export function runCashFlowProjection(input: CashFlowInput): ProjectionYear[] {
  const years: ProjectionYear[] = [];
  const currentYear = new Date().getFullYear();
  const members = input.members ?? [];

  const rrifConversionAge = input.rrifConversionAge ?? 71;
  const nonRegTaxDragRate = input.nonRegTaxDragRate ?? 0;
  const cashSavingsRate   = input.cashSavingsRate ?? 0.025;
  const investSurplus     = input.investSurplus ?? false;
  const strategy          = input.withdrawalStrategy ?? 'oas-optimized';

  // Flex spending guardrail settings
  const flexEnabled  = input.flexSpendingEnabled ?? false;
  const flexFloor    = input.flexSpendingFloor    ?? 0.90;
  const flexCeiling  = input.flexSpendingCeiling  ?? 1.10;

  let rrsp   = input.rrspBalance;
  let tfsa   = input.tfsaBalance;
  let nonReg = input.nonRegBalance;
  let cash   = input.cashBalance ?? 0;

  // ACB tracking: if no initial ACB provided, assume no embedded gain
  let nonRegAcb = input.nonRegInitialAcb ?? nonReg;

  // Flex spending: track previous year's real expense level for clamping
  let prevBaseExpenses: number | null = null;

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
    // Market value grows; ACB does not (unrealised gains accumulate)
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

    const memberOtherIncome = resolveMemberOtherIncome(
      members,
      input.memberIncomeSources,
      age,
      inflationFactor,
      input.retirementAge,
    );

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
    let expenses = baseExpenses * spendingFactor;

    // ── Flex spending guardrails (Guyton-Klinger style) ───────────────────────
    // Clamps expenses within [floor, ceiling] × last-year's real spend level.
    // Only applied in retirement when we have a meaningful prior-year base.
    if (flexEnabled && !isWorking && prevBaseExpenses !== null) {
      const floor   = prevBaseExpenses * (1 + input.inflationRate) * flexFloor;
      const ceiling = prevBaseExpenses * (1 + input.inflationRate) * flexCeiling;
      expenses = Math.max(floor, Math.min(ceiling, expenses));
    }
    prevBaseExpenses = baseExpenses * spendingFactor;

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
    // Dispatches to the configured withdrawal strategy. RRIF minimums are always
    // honoured first; the strategy determines voluntary draw ordering.
    const OAS_CLAWBACK_THRESHOLD_2024 = 90_997;
    const rrspHeadroom = !isWorking
      ? Math.max(
          0,
          OAS_CLAWBACK_THRESHOLD_2024 * inflationFactor
            - cppIncome
            - oasBenefitGross
            - forcedRrspWithdrawal,
        )
      : 0;

    const { cashW: cashWithdrawal, rrspW: rrspWithdrawal, tfsaW: tfsaWithdrawal, nonRegW: nonRegWithdrawal } =
      applyWithdrawalStrategy({
        shortfall: estimatedShortfall,
        cash, rrsp, tfsa, nonReg,
        forcedRrspWithdrawal, rrspHeadroom,
        isWorking, strategy,
        customOrder: input.withdrawalOrder,
      });

    // ── ACB tracking for non-registered withdrawal ────────────────────────────
    // ACB reduces proportionally to the fraction of market value withdrawn.
    // Capital gains (50% inclusion) are added to taxable income.
    let nonRegCapitalGain = 0;
    if (nonRegWithdrawal > 0 && nonReg > 0) {
      const acbReductionRatio = Math.min(nonRegWithdrawal / nonReg, 1);
      const acbReduced = nonRegAcb * acbReductionRatio;
      const grossGain  = nonRegWithdrawal - acbReduced;
      nonRegCapitalGain = Math.max(0, grossGain) * 0.5; // 50% inclusion rate
      nonRegAcb -= acbReduced;
      if (nonRegAcb < 0) nonRegAcb = 0;
    }

    tfsa   -= tfsaWithdrawal;
    cash   -= cashWithdrawal;
    rrsp   -= rrspWithdrawal;
    nonReg -= nonRegWithdrawal;
    if (nonReg < 0) nonReg = 0;

    // ── OAS clawback (second pass with full income picture) ───────────────────
    // Clawback is based on total net income including RRIF withdrawals.
    // Deflate to 2024 dollars so the comparison uses the published threshold.
    const taxableIncomeForClawback =
      employmentIncome + cppIncome + rrspWithdrawal + nonRegTaxDrag + nonRegCapitalGain;
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
    // Taxable income includes capital gains from non-reg withdrawals (50% inclusion already applied).
    const taxableIncome =
      employmentIncome - rrspDeduction + cppIncome + oasIncome + rrspWithdrawal + nonRegTaxDrag + nonRegCapitalGain;

    // Total gross cash received (for display / charting) — does NOT include the RRSP
    // redirect since that money flowed directly to the RRSP account, never the wallet.
    // Cash withdrawal is included: it is post-tax savings being spent down.
    const totalIncome =
      employmentIncome + cppIncome + oasIncome + rrspWithdrawal + tfsaWithdrawal + cashWithdrawal + nonRegWithdrawal;

    let taxResult = calculateTotalTax(taxableIncome, input.province);
    let memberBreakdown: ProjectionYear['memberBreakdown'] = undefined;

    if (members.length > 0) {
      const rrspShares = resolveMemberTypeShares(members, input.memberTypeShareTimeline, year, 'rrspShare');
      const tfsaShares = resolveMemberTypeShares(members, input.memberTypeShareTimeline, year, 'tfsaShare');
      const nonRegShares = resolveMemberTypeShares(members, input.memberTypeShareTimeline, year, 'nonRegShare');
      const cashShares = resolveMemberTypeShares(members, input.memberTypeShareTimeline, year, 'cashShare');

      memberBreakdown = members.map((m, idx) => {
        const rrspW = rrspWithdrawal * (rrspShares[m.id] ?? 0);
        const tfsaW = tfsaWithdrawal * (tfsaShares[m.id] ?? 0);
        const nonRegW = nonRegWithdrawal * (nonRegShares[m.id] ?? 0);
        const cashW = cashWithdrawal * (cashShares[m.id] ?? 0);
        const memberCpp = idx === 0 ? cppIncome : 0;
        const memberOas = idx === 0 ? oasIncome : 0;
        const memberNonRegGain = nonRegCapitalGain * (nonRegShares[m.id] ?? 0);
        const memberTaxable =
          (memberOtherIncome[m.id] ?? 0) +
          memberCpp +
          memberOas +
          rrspW +
          memberNonRegGain;
        const memberTaxResult = calculateTotalTax(memberTaxable, m.province ?? input.province);
        const memberIncome =
          (memberOtherIncome[m.id] ?? 0) +
          memberCpp +
          memberOas +
          rrspW +
          tfsaW +
          nonRegW +
          cashW;

        return {
          memberId: m.id,
          memberName: m.name,
          province: m.province,
          income: round(memberIncome),
          rrspWithdrawal: round(rrspW),
          tfsaWithdrawal: round(tfsaW),
          nonRegWithdrawal: round(nonRegW),
          cashWithdrawal: round(cashW),
          tax: round(memberTaxResult.totalTax),
        };
      });

      const totalMemberTax = memberBreakdown.reduce((sum, m) => sum + m.tax, 0);
      const federalApprox = members.reduce((sum, m, idx) => {
        const rrspW = rrspWithdrawal * (rrspShares[m.id] ?? 0);
        const memberCpp = idx === 0 ? cppIncome : 0;
        const memberOas = idx === 0 ? oasIncome : 0;
        const memberNonRegGain = nonRegCapitalGain * (nonRegShares[m.id] ?? 0);
        const memberTaxable =
          (memberOtherIncome[m.id] ?? 0) +
          memberCpp +
          memberOas +
          rrspW +
          memberNonRegGain;
        return sum + calculateTotalTax(memberTaxable, m.province ?? input.province).federalTax;
      }, 0);

      taxResult = {
        ...taxResult,
        totalTax: totalMemberTax,
        federalTax: federalApprox,
        provincialTax: totalMemberTax - federalApprox,
      };
    }

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
    if (surplusToNonReg > 0) {
      nonRegAcb += surplusToNonReg; // new money enters non-reg at cost basis
      nonReg    += surplusToNonReg;
    }
    if (surplusToCash > 0) cash += surplusToCash;

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
      otherIncome: round(employmentIncome),
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
      // ACB / capital gains fields
      nonRegAcb: round(nonRegAcb),
      nonRegCapitalGain: round(nonRegCapitalGain),
      withdrawalStrategy: strategy,
      memberBreakdown,
    });
  }

  return years;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

