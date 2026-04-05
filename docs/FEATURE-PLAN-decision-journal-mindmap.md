# Feature Plan — Decision Journal & Mind Map

**Branch:** `feature/decision-journal-mindmap`  
**Created:** 2026-04-04  
**Status:** Draft

---

## 1. Motivation

Retirement planning is not a single calculation — it is a long sequence of consequential choices made over years. Scenarios and projections help *explore* possibilities, but once a decision is settled (e.g., "we will delay CPP to age 70", "we will sell the cottage at age 72", "we will draw RRSP first before non-reg") there is currently no place in the app to:

- Record **why** that decision was made and what alternatives were considered.
- Track the **status** of a decision over time (proposed → decided → superseded).
- Understand **what changed** and when (especially important if a decision is revisited after a market downturn, rule change, or life event).
- Visualise how decisions **relate to each other** — a mind map that shows the connective tissue between withdrawal strategy, tax planning, real estate, and estate decisions.

The Decision Journal + Mind Map fills this gap, inspired by the **Architectural Decision Record (ADR)** methodology used in software engineering.

---

## 2. Design Philosophy — ADR Applied to Financial Decisions

Software teams write ADRs to capture the *what*, *why*, and *trade-offs* of technical choices made at a point in time. The same discipline applied to retirement finance produces a durable, reviewable audit trail.

Each Decision Record (DR) captures:

| Field | ADR analogue | Purpose |
|---|---|---|
| Title | Title | Short human-readable label |
| Context | Context | What situation or question triggered this decision |
| Decision | Decision | The choice made, stated clearly |
| Rationale | Rationale | Why this option was selected |
| Alternatives | Alternatives Considered | Other options evaluated and why they were not chosen |
| Consequences | Consequences | Expected outcomes, trade-offs, and downstream impacts |
| Status | Status | `PROPOSED` → `DECIDED` → (optionally) `SUPERSEDED` / `DEPRECATED` |
| Review Date | — | When to revisit (e.g., annually, or if a trigger event occurs) |
| Linked Scenarios | — | Which scenario(s) encode this decision |
| Linked Goals | — | Which goals are affected |
| Related Decisions | — | Decisions that must be considered together (mind map edges) |

---

## 3. Feature Overview

### 3.1 Decision Journal
A structured list of all financial Decision Records for the household, filterable by status, category, and date. Each entry is viewed in a clean ADR-style detail card.

### 3.2 Mind Map Visualisation
A D3 force-directed graph where:
- **Nodes** = Decision Records (grouped/coloured by category)
- **Edges** = Relationships (supersedes, related-to, influences)
- **Clusters** = Goal or theme clusters (withdrawal, tax, housing, estate, income)
- Clicking a node opens the Decision Record detail panel

### 3.3 Decision Timeline
A vertical timeline (similar to a git log) showing decisions in chronological order, with status badges. Useful for a year-end review.

### 3.4 Review Reminders
Decisions with a `reviewDate` surface on the Dashboard Insights panel as "decisions due for review", similar to the existing Plan Completeness Checklist.

---

## 4. Data Model

### 4.1 New Prisma Model — `DecisionRecord`

Add to `prisma/schema.prisma`:

```prisma
/// A recorded financial decision following the ADR (Architectural Decision Record) pattern.
model DecisionRecord {
  id          String    @id @default(cuid())
  householdId String
  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  // Core ADR fields
  title        String
  status       String    @default("PROPOSED")
  // 'PROPOSED' | 'DECIDED' | 'SUPERSEDED' | 'DEPRECATED' | 'REJECTED'

  context      String    // Why this decision needed to be made
  decision     String?   // What was decided (null while PROPOSED)
  rationale    String?   // Why this option
  alternatives String?   // JSON: AlternativeOption[]
  consequences String?   // Expected outcomes and trade-offs

  // Classification
  category     String    @default("GENERAL")
  // 'WITHDRAWAL_STRATEGY' | 'ASSET_ALLOCATION' | 'TAX_PLANNING' |
  // 'CPP_OAS_TIMING' | 'HOUSING' | 'ESTATE' | 'INCOME' | 'INSURANCE' | 'GENERAL'
  tags         String?   // JSON: string[]

  // Dates
  decisionDate DateTime?   // When the decision was officially made
  reviewDate   DateTime?   // When to re-evaluate

  // Supersession chain
  supersededById String?
  supersededBy   DecisionRecord?  @relation("Supersession", fields: [supersededById], references: [id])
  supersedes     DecisionRecord[] @relation("Supersession")

  // Links to other app entities (stored as JSON arrays of IDs)
  linkedScenarioIds String?   // JSON: string[]
  linkedGoalIds     String?   // JSON: string[]

  // Mind map edges — many-to-many self-relation
  relatedTo    DecisionRecord[] @relation("DecisionRelations")
  relatedFrom  DecisionRecord[] @relation("DecisionRelations")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 4.2 Shared Zod Schema

New file: `packages/shared/src/schemas/decision-record.ts`

```typescript
import { z } from 'zod';

export const DecisionStatus = z.enum([
  'PROPOSED',
  'DECIDED',
  'SUPERSEDED',
  'DEPRECATED',
  'REJECTED',
]);

export const DecisionCategory = z.enum([
  'WITHDRAWAL_STRATEGY',
  'ASSET_ALLOCATION',
  'TAX_PLANNING',
  'CPP_OAS_TIMING',
  'HOUSING',
  'ESTATE',
  'INCOME',
  'INSURANCE',
  'GENERAL',
]);

export const AlternativeOptionSchema = z.object({
  title: z.string(),
  description: z.string(),
  whyRejected: z.string().optional(),
});

export const CreateDecisionRecordSchema = z.object({
  title: z.string().min(3).max(200),
  status: DecisionStatus.default('PROPOSED'),
  context: z.string().min(10),
  decision: z.string().optional(),
  rationale: z.string().optional(),
  alternatives: z.array(AlternativeOptionSchema).optional(),
  consequences: z.string().optional(),
  category: DecisionCategory.default('GENERAL'),
  tags: z.array(z.string()).optional(),
  decisionDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
  supersededById: z.string().cuid().optional(),
  linkedScenarioIds: z.array(z.string().cuid()).optional(),
  linkedGoalIds: z.array(z.string().cuid()).optional(),
  relatedDecisionIds: z.array(z.string().cuid()).optional(),
});

export const UpdateDecisionRecordSchema = CreateDecisionRecordSchema.partial();
```

---

## 5. API Layer

### 5.1 New NestJS Module: `apps/api/src/decision-records/`

Files:
```
apps/api/src/decision-records/
  decision-records.module.ts
  decision-records.controller.ts
  decision-records.service.ts
  dto/
    create-decision-record.dto.ts
    update-decision-record.dto.ts
```

### 5.2 Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/households/:householdId/decision-records` | List all DRs for a household (filterable by `status`, `category`, `tag`) |
| `POST` | `/households/:householdId/decision-records` | Create a new DR |
| `GET` | `/households/:householdId/decision-records/:id` | Get a single DR with `supersededBy`, `relatedTo` populated |
| `PATCH` | `/households/:householdId/decision-records/:id` | Update a DR (e.g., promote PROPOSED → DECIDED) |
| `DELETE` | `/households/:householdId/decision-records/:id` | Delete a DR |
| `POST` | `/households/:householdId/decision-records/:id/supersede` | Mark as SUPERSEDED, link to new DR |
| `GET` | `/households/:householdId/decision-records/graph` | Return adjacency list for mind map (nodes + edges) |
| `GET` | `/households/:householdId/decision-records/due-for-review` | All DRs where `reviewDate` <= today |

### 5.3 Mind Map Graph Response Shape

```typescript
interface DecisionGraphResponse {
  nodes: DecisionNode[];
  edges: DecisionEdge[];
}

interface DecisionNode {
  id: string;
  title: string;
  status: string;
  category: string;
  decisionDate?: string;
}

interface DecisionEdge {
  source: string;  // DR id
  target: string;  // DR id
  type: 'SUPERSEDES' | 'RELATED_TO' | 'INFLUENCES';
}
```

---

## 6. Frontend

### 6.1 New Page: `DecisionJournalPage`

**Route:** `/decisions`  
**File:** `apps/web/src/pages/DecisionJournalPage.tsx`

Layout:
```
┌─────────────────────────────────────────────────────────┐
│  Decision Journal                     [+ New Decision]  │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Filter: [All Status ▾] [All Categories ▾] [🔍]  │   │
│  │ View:   [List] [Timeline] [Mind Map]             │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌───────────────────┐ ┌─────────────────────────────┐  │
│  │  Decision List    │ │   Decision Detail Panel     │  │
│  │  (scrollable)     │ │   (ADR card)                │  │
│  │                   │ │                             │  │
│  └───────────────────┘ └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Decision List Item

Compact card showing:
- Status badge (`PROPOSED` amber, `DECIDED` green, `SUPERSEDED` grey, `REJECTED` red)
- Category chip
- Title
- `decisionDate` or "Not yet decided"
- `reviewDate` warning icon if overdue

### 6.3 ADR-Style Detail Card

When a decision is selected, the right panel renders a structured view:

```
DECISION #DR-2026-003                         [Edit] [Supersede]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: DECIDED  •  Category: CPP_OAS_TIMING  •  Date: 2026-03-12

Title
  Delay CPP to Age 70

Context
  Both spouses are healthy. CPP delay provides 42% more monthly
  income vs. taking at 65. Government benefit bridge can cover the
  gap from 65-70 using RRSP drawdown to keep income below OAS
  clawback threshold.

Decision
  Delay CPP benefits for both members to age 70.

Rationale
  Run-rate break-even is age 78. Life expectancy estimates
  exceed 85 for both spouses. The longevity protection outweighs
  the nominal cost of delaying.

Alternatives Considered
  • Take CPP at 65 — rejected because it leaves $180k in
    lifetime benefits on the table at median life expectancy.
  • Take CPP at 67 — partial improvement but doesn't max
    actuarial uplift.

Consequences
  - Requires ~$30,000/yr RRSP drawdown from ages 65-70 to
    bridge income.
  - Reduces RRSP balance by ~$150k at age 70, improving
    tax efficiency in later years.
  - Linked to Scenario: "RRSP Bridge + CPP Delay"

Linked Scenarios
  • [RRSP Bridge + CPP Delay] ↗

Linked Goals
  • [Maintain $8,000/mo net income in retirement] ↗

Related Decisions
  • DR-2026-001: RRSP Meltdown Strategy (influences)
  • DR-2026-005: OAS Clawback Management (related to)

Review Date: 2027-04-01
```

### 6.4 Mind Map View

**File:** `apps/web/src/components/decisions/DecisionMindMap.tsx`

Uses D3 force-directed simulation:
- Node radius encodes number of linked decisions (more connections = larger node)
- Node colour encodes `category` (uses existing MUI theme palette tokens)
- Node opacity encodes `status` (`PROPOSED` = 60%, `DECIDED` = 100%, `SUPERSEDED` = 30%)
- Edge colour encodes relationship type (`SUPERSEDES` = dashed orange, `RELATED_TO` = solid blue)
- Hover tooltip shows title + status
- Click opens detail panel
- Drag to reposition nodes (positions are NOT persisted — graph re-renders from data)
- Zoom + pan via D3 zoom behaviour

### 6.5 Timeline View

**File:** `apps/web/src/components/decisions/DecisionTimeline.tsx`

- Vertical timeline sorted by `decisionDate` descending
- Groups entries by year
- Each entry: status dot, title, category chip, one-line summary of `decision`
- Click expands inline to ADR detail

### 6.6 Create / Edit Form

**File:** `apps/web/src/components/decisions/DecisionRecordForm.tsx`

Multi-step form (MUI Stepper):
1. **Basic** — title, category, tags, status
2. **Context & Decision** — context (rich text or plain), decision text
3. **Rationale & Alternatives** — rationale text + dynamic list of alternatives (title + why rejected)
4. **Consequences & Links** — consequences, link scenarios (multi-select), link goals, link related decisions
5. **Dates** — decisionDate (date picker), reviewDate (date picker)

### 6.7 Dashboard Integration

Add a small "Decisions" card to the Dashboard right column:
- Count of `DECIDED` decisions
- Count `PROPOSED` (pending)
- Count overdue for review (reviewDate passed)
- Link to Decision Journal page

---

## 7. ADR Directory in Docs (Supplemental)

For decisions about the *app itself* (how we built the app), create an ADR directory:

```
docs/adr/
  0001-use-sqlite-for-local-first-storage.md
  0002-use-prisma-orm-as-data-layer.md
  0003-decision-journal-data-model.md
  ...
```

Each file follows the standard ADR template (see `docs/adr/TEMPLATE.md`).

This is separate from the in-app Decision Journal (which captures *the user's retirement decisions*), but the same mental model applies to both.

---

## 8. Implementation Phases

### Phase 1 — Schema & API Foundation (1 sprint)

| Task | Files |
|---|---|
| Add `DecisionRecord` model to Prisma schema | `prisma/schema.prisma` |
| Run `prisma migrate dev` to create migration | `prisma/migrations/` |
| Add Zod schemas to shared package | `packages/shared/src/schemas/decision-record.ts` |
| Export from shared index | `packages/shared/src/index.ts` |
| Scaffold NestJS module, controller, service | `apps/api/src/decision-records/` |
| Register module in AppModule | `apps/api/src/app.module.ts` |
| Add `/graph` and `/due-for-review` endpoints | `apps/api/src/decision-records/decision-records.service.ts` |
| Unit tests for service (CRUD + supersession chain) | `apps/api/tests/decision-records.spec.ts` |

### Phase 2 — Journal UI: List & Detail (1 sprint)

| Task | Files |
|---|---|
| Add TanStack Query hooks | `apps/web/src/lib/api/decision-records.ts` |
| `DecisionJournalPage` with list + detail panel | `apps/web/src/pages/DecisionJournalPage.tsx` |
| `DecisionListItem` card component | `apps/web/src/components/decisions/DecisionListItem.tsx` |
| `DecisionDetailCard` (ADR layout) | `apps/web/src/components/decisions/DecisionDetailCard.tsx` |
| `DecisionRecordForm` multi-step | `apps/web/src/components/decisions/DecisionRecordForm.tsx` |
| Route registration | `apps/web/src/App.tsx` |
| Sidebar nav entry | `apps/web/src/components/layout/Sidebar.tsx` |

### Phase 3 — Mind Map Visualisation (1 sprint)

| Task | Files |
|---|---|
| D3 force-directed `DecisionMindMap` component | `apps/web/src/components/decisions/DecisionMindMap.tsx` |
| Graph data hook (`/graph` endpoint) | `apps/web/src/lib/api/decision-records.ts` |
| Category legend + filter overlays | (within component) |
| Zoom/pan/drag interactions | (within component, follows existing D3 patterns) |

### Phase 4 — Timeline & Review Reminders (0.5 sprint)

| Task | Files |
|---|---|
| `DecisionTimeline` component | `apps/web/src/components/decisions/DecisionTimeline.tsx` |
| Dashboard "Decisions due for review" card | `apps/web/src/components/dashboard/DecisionReviewCard.tsx` |
| Insights engine rule: overdue decision review | `packages/finance-engine/src/insights/rules.ts` |

### Phase 5 — ADR Docs & Polish (0.5 sprint)

| Task | Files |
|---|---|
| Create `docs/adr/` directory with template | `docs/adr/TEMPLATE.md` |
| Author seed ADRs for major app decisions | `docs/adr/0001-*.md` … |
| E2E test: create decision, link scenario, view mind map | `e2e/tests/decisions.spec.ts` |

---

## 9. Open Questions

1. **Rich Text vs. Plain Text** — Should context/rationale fields support Markdown (rendered in the detail view)? Simplest approach first: plain textarea, render with `<pre>` or a simple Markdown viewer.

2. **Versioning** — Should editing a `DECIDED` record automatically create a supersession record, or allow in-place edits? ADR convention is to create a new record and mark the old one superseded. We should enforce this for `status = DECIDED`.

3. **Sharing / Export** — Should decision records be exportable to PDF alongside the existing financial reports? Including a "Decision History" appendix in the PDF export would add significant value.

4. **AI Integration** — The existing AI assistant has context from household data. Extending it to query decision records ("Summarise all my pending decisions" or "What was our rationale for delaying CPP?") would be a natural extension.

5. **Mind Map layout persistence** — D3 positions are ephemeral by default. If users pin nodes manually, should those positions be persisted? Initial implementation: no persistence; re-evaluate after user feedback.

6. **Multi-household** — Decision records are scoped to a single household. Cross-household scenarios (e.g., in advisor mode) are out of scope for this phase.

---

## 10. Success Criteria

- A user can create a Decision Record in the ADR format in < 2 minutes.
- All DECIDED decisions are visible in a filterable, searchable list.
- The Mind Map renders all decisions and their relationships within 2 seconds for up to 50 nodes.
- Decisions can be linked to existing Scenarios and Goals.
- The Dashboard surfaces decisions overdue for review.
- A `DECIDED` record can be superseded by a new record with one action, automatically linking the two.
