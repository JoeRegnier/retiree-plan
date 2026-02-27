import { z } from 'zod';

/** A single glide-path step: at `age`, switch the portfolio return rate to `returnRate`. */
const glidePathStepSchema = z.object({
  age: z.number().int().min(18).max(100),
  returnRate: z.number().min(-0.1).max(0.3),
});

/** A spending-phase multiplier: from `fromAge` onward, multiply household expenses by `factor`. */
const spendingPhaseSchema = z.object({
  fromAge: z.number().int().min(18).max(100),
  factor: z.number().min(0).max(2),
});

export const scenarioParametersSchema = z.object({
  retirementAge: z.number().int().min(50).max(80).optional(),
  lifeExpectancy: z.number().int().min(70).max(110).optional(),
  inflationRate: z.number().min(0).max(0.2).default(0.02),
  realReturnRate: z.number().min(-0.1).max(0.2).default(0.04),
  cppStartAge: z.number().int().min(60).max(70).default(65),
  oasStartAge: z.number().int().min(65).max(70).default(65),
  annualExpenses: z.number().min(0).optional(),
  flexSpendingEnabled: z.boolean().default(false),
  flexSpendingFloor: z.number().min(0).optional(),
  flexSpendingCeiling: z.number().min(0).optional(),
  /**
   * Age at which the RRSP is converted to a RRIF and mandatory minimum
   * withdrawals begin. CRA deadline is the end of the year the owner turns 71.
   * Voluntary early conversion is allowed at any age; the typical range is
   * retirement age to 71. Default: 71.
   */
  rrifConversionAge: z.number().int().min(40).max(71).default(71).optional(),
  /**
   * Annual effective tax rate applied to non-registered portfolio growth.
   * Models the ongoing income tax on interest, dividends, and realized gains.
   * E.g. 0.25 means 25% of each year's non-reg growth is withheld as tax.
   * Default: 0.0 (off — backwards compatible).
   */
  nonRegTaxDragRate: z.number().min(0).max(0.6).default(0).optional(),
  /**
   * Portfolio return-rate glide path. Steps are sorted by age; the most recent
   * step at or before the current age is used. Falls back to `expectedReturnRate`
   * when no step matches.
   */
  glidePathSteps: z.array(glidePathStepSchema).optional(),
  /**
   * Per-phase expense multipliers applied on top of inflation.
   * E.g. [{fromAge: 65, factor: 0.85}] reduces spending 15% at retirement.
   * Multiple phases are supported; the most recent matching phase wins.
   */
  spendingPhases: z.array(spendingPhaseSchema).optional(),
  /**
   * Annual return rate applied to the cash/savings bucket (bank accounts).
   * Models HISA or chequing interest. Default: 0.025 (2.5%).
   */
  cashSavingsRate: z.number().min(0).max(0.15).default(0.025).optional(),
  /**
   * When true, any income surplus after expenses is automatically reinvested
   * into the non-registered account. When false (default), surplus accumulates
   * in the cash savings bucket — a conservative, realistic assumption.
   */
  investSurplus: z.boolean().default(false).optional(),
});

export const createScenarioSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  householdId: z.string().min(1),
  parameters: scenarioParametersSchema,
});

export const updateScenarioSchema = createScenarioSchema.partial().omit({ householdId: true });

export type ScenarioParameters = z.infer<typeof scenarioParametersSchema>;
export type GlidePathStep = z.infer<typeof glidePathStepSchema>;
export type SpendingPhase = z.infer<typeof spendingPhaseSchema>;
export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;

