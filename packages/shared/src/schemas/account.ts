import { z } from 'zod';

export const ACCOUNT_TYPES = [
  'RRSP',
  'TFSA',
  'RESP',
  'LIRA',
  'LIF',
  'RRIF',
  'NON_REGISTERED',
  'CORPORATE',
  'CASH',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const createAccountSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(ACCOUNT_TYPES),
  balance: z.number().min(0),
  currency: z.string().default('CAD'),
  equityPercent: z.number().min(0).max(1).nullable().default(null),
  fixedIncomePercent: z.number().min(0).max(1).nullable().default(null),
  alternativesPercent: z.number().min(0).max(1).nullable().default(null),
  cashPercent: z.number().min(0).max(1).nullable().default(null),
  householdId: z.string().min(1),
  /** Adjusted cost basis for non-registered accounts (purchase price of holdings). */
  costBasis: z.number().min(0).nullable().default(null),
  /** True if this RRSP was opened as a spousal RRSP. Only valid for RRSP type. */
  isSpousalRrsp: z.boolean().default(false),
  /** Member ID of the contributing spouse (claimant of the tax deduction). */
  contributorMemberId: z.string().nullable().default(null),
  /** Member ID of the annuitant spouse (plan holder; withdraws in retirement). */
  annuitantMemberId: z.string().nullable().default(null),
  /** Tax year of the most recent spousal contribution — used for 3-year attribution rule. */
  lastContributionYear: z.number().int().min(1990).max(2100).nullable().default(null),
});

export const updateAccountSchema = createAccountSchema.partial().omit({ householdId: true });

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
