import { z } from 'zod';

// ─── Enumerations ─────────────────────────────────────────────────────────────

export const DECISION_STATUSES = [
  'PROPOSED',
  'DECIDED',
  'SUPERSEDED',
  'DEPRECATED',
  'REJECTED',
] as const;

export const DECISION_CATEGORIES = [
  'WITHDRAWAL_STRATEGY',
  'ASSET_ALLOCATION',
  'TAX_PLANNING',
  'CPP_OAS_TIMING',
  'HOUSING',
  'ESTATE',
  'INCOME',
  'INSURANCE',
  'GENERAL',
] as const;

export type DecisionStatus = (typeof DECISION_STATUSES)[number];
export type DecisionCategory = (typeof DECISION_CATEGORIES)[number];

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

export const alternativeOptionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  whyRejected: z.string().max(2000).optional(),
});

export type AlternativeOption = z.infer<typeof alternativeOptionSchema>;

// ─── CRUD schemas ─────────────────────────────────────────────────────────────

export const createDecisionRecordSchema = z.object({
  householdId: z.string().min(1),
  title: z.string().min(3).max(200),
  status: z.enum(DECISION_STATUSES).default('PROPOSED'),
  context: z.string().min(10).max(5000),
  decision: z.string().max(5000).optional(),
  rationale: z.string().max(5000).optional(),
  alternatives: z.array(alternativeOptionSchema).optional(),
  consequences: z.string().max(5000).optional(),
  category: z.enum(DECISION_CATEGORIES).default('GENERAL'),
  tags: z.array(z.string().max(50)).max(20).optional(),
  decisionDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
  supersededById: z.string().min(1).optional(),
  linkedScenarioIds: z.array(z.string().min(1)).optional(),
  linkedGoalIds: z.array(z.string().min(1)).optional(),
  relatedDecisionIds: z.array(z.string().min(1)).optional(),
});

export const updateDecisionRecordSchema = createDecisionRecordSchema
  .omit({ householdId: true })
  .partial();

export type CreateDecisionRecordInput = z.infer<typeof createDecisionRecordSchema>;
export type UpdateDecisionRecordInput = z.infer<typeof updateDecisionRecordSchema>;
