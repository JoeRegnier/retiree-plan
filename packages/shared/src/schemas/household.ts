import { z } from 'zod';
import { PROVINCES } from '../constants/canada.js';

export const householdMemberSchema = z.object({
  name: z.string().min(1).max(100),
  dateOfBirth: z.string().date(),
  province: z.enum(PROVINCES),
});

export const createHouseholdSchema = z.object({
  name: z.string().min(1).max(200),
  members: z.array(householdMemberSchema).min(1).max(10),
});

export const updateHouseholdSchema = createHouseholdSchema.partial();

export type HouseholdMemberInput = z.infer<typeof householdMemberSchema>;
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;
