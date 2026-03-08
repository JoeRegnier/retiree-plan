import { z } from 'zod';

export const REAL_ESTATE_PROPERTY_TYPES = [
  'PRIMARY_RESIDENCE',
  'RENTAL',
  'VACATION',
] as const;

export type RealEstatePropertyType = (typeof REAL_ESTATE_PROPERTY_TYPES)[number];

export const createRealEstateSchema = z.object({
  name: z.string().min(1).max(200),
  propertyType: z.enum(REAL_ESTATE_PROPERTY_TYPES),
  currentValue: z.number().min(0),
  purchasePrice: z.number().min(0).default(0),
  annualAppreciation: z.number().min(-0.1).max(0.2).default(0.03),
  grossRentalIncome: z.number().min(0).nullable().default(null),
  rentalExpenses: z.number().min(0).nullable().default(null),
  sellAtAge: z.number().int().min(18).max(110).nullable().default(null),
  netProceedsPercent: z.number().min(0).max(1).default(0.95),
  householdId: z.string().min(1),
});

export const updateRealEstateSchema = createRealEstateSchema.partial().omit({ householdId: true });

export type CreateRealEstateInput = z.infer<typeof createRealEstateSchema>;
export type UpdateRealEstateInput = z.infer<typeof updateRealEstateSchema>;
