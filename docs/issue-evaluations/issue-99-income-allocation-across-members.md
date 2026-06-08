# Issue 99 Evaluation - Income Allocation Across Members

- Source: https://github.com/JoeRegnier/retiree-plan/issues/99
- Author intent summary: support spouse-specific RRSP/TFSA ownership and respect pre-65 vs post-65 pension splitting constraints.

## 1) Current system state

### What exists now
- Household members and income sources exist as entities.
- Some spousal metadata exists for spousal RRSP scenarios.
- Projection/tax pipeline is largely household-level with limited per-member attribution.

### What is missing
- General account ownership link for all account types (RRSP, TFSA, non-reg, etc.) is not consistently first-class in projections.
- Tax is not fully modeled as two individual returns plus household interactions.
- Pension splitting optimizer/rules engine is not implemented.

### Why the system behaves this way today
- The current architecture prioritizes single-stream household projection simplicity.
- Spousal complexity was introduced partially for targeted features, not as full dual-taxpayer modeling.

## 2) Evaluation of reported issue

### Strengths of the request
- High correctness value: Canada tax outcomes depend heavily on person-level attribution.
- Strong user trust impact: couples expect "my account vs spouse account" to be explicit.
- Required foundation for pension splitting and advanced optimization.

### Risks or weaknesses in the request
- Full dual-taxpayer modeling increases engine and UI complexity significantly.
- Poorly implemented attribution can create false precision.
- Migration for existing plans could be disruptive if mandatory fields are added abruptly.

### Critical perspective
- This issue is fundamental and should be treated as architecture-level, not a cosmetic enhancement.
- Implementing only UI ownership flags without tax-engine redesign would be misleading.

## 3) UX and product interview draft (ambiguities to resolve)

### Proposed discussion prompts for @McMike26
1. Should every account require an owner, or default to joint/unspecified with warnings?
2. For non-registered accounts, do you want legal ownership, contribution origin, or tax attribution ownership (they differ)?
3. Should pension splitting be modeled as manual user percentage, optimizer suggestion, or both?
4. Is Quebec-specific treatment in scope initially, or rest-of-Canada first?
5. Should attribution be historical (change by year), or current snapshot only for now?
6. Do you need output by member in all reports, or only tax-focused screens?

### Captured stakeholder answers (April 2026)
1. Account ownership default: `joint/unspecified` with visible indicators prompting owner assignment.
2. Non-registered attribution mode: use `tax attribution ownership` (not contribution origin).
3. Pension splitting UX: support both `manual user percentage` and `optimizer suggestion`.
4. Quebec-specific treatment: out of scope for initial release (rest-of-Canada first).
5. Attribution timeline: historical attribution is required for year-level accuracy.
6. Reporting requirement: per-member output in all reports is preferred.

## 4) Pros, cons, and alternatives

### Option A - Full member-attributed engine v2 (recommended)
Pros:
- Correct long-term foundation for tax accuracy and optimization.
- Enables pension splitting, GIS/OAS interactions, and better household analytics.
Cons:
- Larger refactor and migration complexity.

### Option B - UI ownership tags only, household tax unchanged
Pros:
- Fast delivery and visible progress.
Cons:
- Risk of user confusion and false confidence.
- Does not solve core tax allocation issue.

### Option C - Hybrid rollout (ownership first, then dual-tax engine)
Pros:
- Practical phased delivery.
- Allows safe migration and progressive hardening.
Cons:
- Interim period still has known limitations.

## 5) Perspective review

### General usability
- Couples need explicit ownership and member-level outputs to trust the plan.

### Opinionated design intent
- A planning tool can be opinionated and still transparent: show defaults, assumptions, and attribution logic clearly.

### Security and privacy
- No major external security change.
- Internal data integrity becomes more important due to richer member-level records.

### Quality and correctness
- Must move to person-level tax computation before claiming support for pension splitting optimization.
- Add test corpus for couples with asymmetric incomes and ages.

### Simplicity over comprehensiveness
- Start with account ownership + attribution display + dual-tax baseline.
- Defer advanced edge-case optimization until baseline is stable.

## 6) Priority and impact

- Priority: P0-P1 (Very High)
- User impact: Very High for couples
- Technical risk: High
- Product risk if ignored: Very High (core correctness and trust)

Impact rating:
- Breadth: 4/5
- Depth: 5/5
- Confidence in need: 5/5

## 7) Recommended implementation plan

### Phase 1 - Data model and migration
1. Add explicit account owner references for all account types.
2. Define ownership modes: single owner or joint with percentages.
3. Backfill existing records with safe defaults and migration warnings.

### Phase 2 - Projection and tax model upgrade
1. Split projection income/withdrawals by member.
2. Compute tax per member and aggregate household totals second.
3. Persist per-member annual outputs for UI/reporting.

### Phase 3 - Pension splitting baseline
1. Implement CRA-compliant split input up to 50% eligible pension income with age/rule checks.
2. Show before/after tax impact and warnings where ineligible.
3. Add manual split first; optimizer second.

### Phase 4 - UX and reporting
1. Add member attribution badges in accounts and projections.
2. Add couple-level tax panel with member columns.
3. Add explainability text for pre-65 vs post-65 treatment.

## 8) Acceptance criteria

1. Every account can default to `joint/unspecified`, with persistent visual indicators and warnings until explicit owner assignment is completed.
2. RRSP/TFSA/non-registered accounts support member assignment, and non-registered accounts use `tax attribution ownership` in projections and tax outputs.
3. Attribution history can be entered by effective year, and projections use the correct year-specific ownership/attribution record.
4. Projection outputs include per-member income, withdrawals, and tax in all reports, while household totals continue to reconcile exactly to member sums.
5. Pension splitting supports both manual split input and optimizer suggestions, with eligibility/limit validation for in-scope jurisdictions.
6. Initial implementation excludes Quebec-specific treatment and clearly labels this scope boundary in UI and documentation.
7. Existing plans migrate with explicit assumptions (`joint/unspecified` defaults where needed), no silent data loss, and user-visible migration notices.

## 9) References

1. CRA - Pension income splitting (joint election, up to 50%, eligibility details):
   https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/pension-income-splitting.html
2. CRA - General retirement tax context and pension income amount interactions:
   https://www.canada.ca/en/revenue-agency/services/tax/individuals/segments/changes-your-taxes-when-you-retire-turn-65-years-old.html
