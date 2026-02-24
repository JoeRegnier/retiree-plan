import { z } from 'zod';

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
});

export const createScenarioSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  householdId: z.string().min(1),
  parameters: scenarioParametersSchema,
});

export const updateScenarioSchema = createScenarioSchema.partial().omit({ householdId: true });

export type ScenarioParameters = z.infer<typeof scenarioParametersSchema>;
export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;
