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
});

export const updateAccountSchema = createAccountSchema.partial().omit({ householdId: true });

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
