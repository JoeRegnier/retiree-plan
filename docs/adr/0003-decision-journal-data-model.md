# ADR-0003 — Decision Journal Data Model: ADR-Style Records Scoped to Household

**Date:** 2026-04-04  
**Status:** Accepted

---

## Context

Users make many consequential financial decisions during retirement planning (CPP timing, withdrawal sequencing, real estate sale age, etc.). Once a decision is settled, there is no structured place to record the reasoning, the alternatives rejected, or when to review it. The need is for an auditable, reviewable log of decisions that can also be visualised as a mind map of relationships.

## Decision

Model financial decisions as **`DecisionRecord`** entities:
- Scoped to a `Household` (not a `User`) so both spouses share the same decision log.
- Follow the ADR pattern: `context`, `decision`, `rationale`, `alternatives` (JSON), `consequences`, `status`.
- Support a supersession chain (`supersededById` self-relation) so changed decisions trace back to originals.
- Support a many-to-many self-relation (`relatedTo` / `relatedFrom`) for the mind map edge set.
- Store `linkedScenarioIds` and `linkedGoalIds` as JSON string arrays (denormalised) rather than join tables, to keep the schema lightweight for v1.

## Rationale

- Denormalised JSON IDs for scenario/goal links avoids two extra join tables for a feature that is append-heavy and rarely queried in aggregate.
- Self-referential supersession is a single foreign key — sufficient for a linear chain; branching hierarchies are not needed for retirement decisions.
- Many-to-many self-relation for `relatedTo` uses Prisma's named relation syntax — the mind map edge query is a single `findMany` with `include`.
- Scoping to `Household` mirrors the existing pattern for `Goal`, `Scenario`, `MilestoneEvent`.

## Alternatives Considered

| Option | Why Rejected |
|---|---|
| Store decisions as extended `Scenario` metadata | Conflates two different concerns; scenarios are calculation parameters, not decision rationale |
| External document store (e.g., markdown files) | No query capability; cannot link to other app entities |
| Normalised join tables for scenario/goal links | Over-engineered for v1 — three extra tables for relationships that are read-only in most queries |
| User-scoped (not household-scoped) records | Two spouses making joint decisions need a shared log |

## Consequences

- When linked scenarios or goals are deleted, the JSON ID arrays may contain stale references. The detail view must handle missing entities gracefully (show "Deleted scenario").
- The supersession chain is linear. If a decision is superseded multiple times, each intermediate record is preserved in the chain — this is intentional.
- The many-to-many self-relation requires a Prisma implicit join table (`_DecisionRelations`). This is auto-managed by Prisma and requires no explicit migration SQL.

## Review Date

Re-evaluate denormalised JSON links if a reporting feature needs to query "all decisions linked to a given scenario" frequently — at that point, promote to a proper join table.
