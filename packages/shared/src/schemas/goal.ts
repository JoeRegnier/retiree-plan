import { z } from 'zod';

export const GOAL_PRIORITIES = ['essential', 'discretionary'] as const;
export const GOAL_CATEGORIES = ['retirement', 'legacy', 'purchase', 'lifestyle'] as const;

export type GoalPriority = (typeof GOAL_PRIORITIES)[number];
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export const createGoalSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().default(null),
  targetAmount: z.number().min(0),
  targetAge: z.number().int().min(18).max(110).nullable().default(null),
  priority: z.enum(GOAL_PRIORITIES).default('essential'),
  category: z.enum(GOAL_CATEGORIES).default('retirement'),
  householdId: z.string().min(1),
});

export const updateGoalSchema = createGoalSchema.partial().omit({ householdId: true });

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
