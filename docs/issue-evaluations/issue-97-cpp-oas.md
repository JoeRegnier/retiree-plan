# Issue 97 Evaluation - CPP and OAS

- Source: https://github.com/JoeRegnier/retiree-plan/issues/97
- Author intent summary: simplify and normalize government benefits by using CPP at-65 estimate as anchor, make start age configurable, assume max OAS with clawback, and include GIS.

## 1) Current system state

### What exists now
- CPP estimate input exists per household member in the Household page and is persisted as member data.
- Scenario-level start ages for CPP and OAS exist.
- Finance engine implements actuarial style age adjustments for CPP and OAS deferral, and OAS clawback logic.

### What is missing or inconsistent
- The member CPP estimate input is not consistently used as the projection source of truth in all paths.
- CPP and OAS are not modeled as first-class per-member benefit streams end-to-end in projections/tax outputs.
- GIS is not implemented.

### Why the system behaves this way today
- The engine appears optimized for a household-level projection path with a primary-earner-centered tax pipeline.
- Government benefits were added incrementally as scenario parameters and formulas, but data flow from member-level data to engine payload remains incomplete.

## 2) Evaluation of reported issue

### Strengths of the request
- High usability value: users understand "my estimated CPP at 65" better than abstract benefit fractions.
- Reduces double entry and contradictory setup screens.
- Better alignment with Service Canada/OAS estimator mental models.

### Risks or weaknesses in the request
- "Assume max OAS" is simple but can be wrong for partial-residency users, immigrants, and edge cases.
- Removing CPP/OAS from all generic income-source surfaces may reduce flexibility for uncommon scenarios (for example, legacy migration records).
- GIS implementation without proper means-testing by marital status can produce misleading plans.

### Critical perspective (not biased by current implementation)
- The issue is directionally correct for mainstream users, but should not over-simplify policy-sensitive cases.
- A robust model should keep an "advanced override" mode to preserve accuracy and user trust.

## 3) UX and product interview draft (ambiguities to resolve)

### Proposed discussion prompts for @McMike26
1. Should CPP/OAS be completely removed from "Income Sources", or hidden by default with an advanced toggle?
2. For CPP, do you want one input only (estimated monthly at 65), or optional actual statement detail (contribution years) later?
3. For OAS, should default be "max assumed" with residency override, or mandatory residency years input up front?
4. For couples, should CPP/OAS always be configured separately per member?
5. For GIS, is your expectation eligibility approximation or full official estimate behavior?
6. If government policy values change yearly, are annual automatic updates acceptable, or should values be fixed by scenario tax year pack?

## 4) Pros, cons, and alternatives

### Option A - Normalize to member-centric CPP/OAS setup (recommended)
Pros:
- Cleaner UX and less contradictory input.
- Aligns with user mental model and government estimator outputs.
- Good foundation for GIS and pension splitting later.
Cons:
- Requires data model + payload mapping + projection/tax changes.
- Migration work for existing plans.

### Option B - Keep current mixed model, improve validation only
Pros:
- Lower implementation cost.
- Minimal migration risk.
Cons:
- Continues conceptual duplication and user confusion.
- Harder to implement GIS correctly later.

### Option C - Replace with external estimator import only
Pros:
- Potentially more accurate user-specific CPP/OAS assumptions.
Cons:
- Depends on integration complexity and credentials.
- Poor offline-first simplicity if import is required.

## 5) Perspective review

### General usability
- Current behavior is confusing due to duplicate conceptual entry points.
- Strong case to centralize in household member profile.

### Opinionated design intent
- RetireePlan appears to favor guided, practical setup. Centralizing CPP/OAS is consistent with that philosophy.

### Security and privacy
- No new high-risk surface if values remain user-entered.
- If future import is added, explicitly avoid storing full external credentials; prefer tokenized flows.

### Quality and correctness
- Government benefit modeling is sensitive; partial implementation can harm trust.
- Need explicit assumptions and explainability text in UI.

### Simplicity over comprehensiveness
- Default simple mode: CPP at-65 estimate + start age; OAS residency + start age.
- Advanced overrides optional, not primary.

## 6) Priority and impact

- Priority: P1 (High)
- User impact: High
- Technical risk: Medium
- Product risk if ignored: High (core retirement-income credibility)

Impact rating:
- Breadth: 5/5
- Depth: 4/5
- Confidence in need: 5/5

## 7) Recommended implementation plan

### Phase 1 - Data flow correction and UX consolidation
1. Make member-level CPP input the canonical source for CPP base at 65.
2. Keep CPP/OAS start ages at scenario-level but clearly linked per member.
3. Remove CPP/OAS from generic income-source creation UI (or hide behind advanced mode).
4. Add migration to map any existing CPP/OAS generic income entries into member benefit settings.

### Phase 2 - Per-member projection and tax attribution
1. Emit per-member government benefit streams in engine input.
2. Preserve household totals while exposing per-member breakdown in output.
3. Add tests for single, couple, and staggered retirement cases.

### Phase 3 - GIS minimum viable support
1. Implement GIS eligibility gate and high-level estimate with explicit assumption banner.
2. Add calibration tests against published examples where available.
3. Add "confidence" and "assumption" notes in UI output.

### Phase 4 - Hardening
1. Snapshot tests against policy-year constants.
2. Regression tests for OAS clawback interactions.
3. Changelog and user-facing migration notes.

## 8) Acceptance criteria

1. A user can configure CPP/OAS only in member financial details (default path).
2. Projection uses member CPP estimate at 65 plus start-age adjustment.
3. OAS uses residency/start-age with clawback reflected in tax outputs.
4. GIS appears as optional modeled benefit with transparent assumptions.
5. Existing plans migrate without data loss.

## 9) References

1. Government of Canada, CPP amount and estimation:
   https://www.canada.ca/en/services/benefits/publicpensions/cpp/cpp-benefit/amount.html
2. Government of Canada, OAS amount and clawback context:
   https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/benefit-amount.html
3. Government of Canada, GIS overview and eligibility context:
   https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/guaranteed-income-supplement.html
