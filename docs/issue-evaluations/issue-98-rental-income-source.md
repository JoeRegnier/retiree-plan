# Issue 98 Evaluation - Rental as an Income Source

- Source: https://github.com/JoeRegnier/retiree-plan/issues/98
- Author intent summary: rental modeling should be more realistic (income separate from property value, mortgage paydown effects, sale-value logic, and ownership split between spouses).

## 1) Current system state

### What exists now
- Real estate entities can be stored with property type, value, appreciation rate, and static rental income/expenses fields.
- Sale age exists as a simple trigger concept.
- UI supports adding rental properties and viewing them in planning flows.

### What is missing
- No explicit mortgage schedule in rental property model (balance, term, rate, amortization).
- No dynamic NOI trajectory tied to debt paydown.
- No ownership split model per member for rental income attribution.
- No robust disposition model for tax consequences and net proceeds across scenarios.

### Why the system behaves this way today
- The real-estate model was designed as a lightweight scenario input, not a full rental underwriting engine.
- This keeps setup simple but underfits users with multiple leveraged rental properties.

## 2) Evaluation of reported issue

### Strengths of the request
- Strong practical realism for many Canadian households with rental assets.
- Better tax and cash-flow accuracy over long-horizon retirement plans.
- Enables correct spouse allocation and future pension/tax planning interactions.

### Risks or weaknesses in the request
- Can quickly become a property-management system if scope is unconstrained.
- Too much detail can overwhelm average users.
- Incorrect tax assumptions around CCA, recapture, and principal residence edge cases can cause misleading outputs.

### Critical perspective
- The request identifies a real modeling gap, but should be delivered with tiered complexity.
- A minimal "finance-planning-grade" rental model is preferable to a maximal accounting model.

## 3) UX and product interview draft (ambiguities to resolve)

### Proposed discussion prompts for @McMike26
1. Do you need month-level mortgage amortization, or is annual approximation acceptable?
2. Should ownership be fixed percentages, or allow changes over time?
3. For sale modeling, do you need one-time capital-gain estimate only, or detailed CCA/recapture options?
4. Should rental inflation and expense inflation be configurable separately?
5. Should each property be attributable to one member, joint ownership, or legal-owner plus cashflow-sharing model?
6. Are short-term rentals in scope for this issue, or only long-term rentals?

## 4) Pros, cons, and alternatives

### Option A - Layered rental model (recommended)
Pros:
- Balances realism with usable defaults.
- Supports ownership split and mortgage-aware net cashflow.
- Keeps advanced tax detail optional.
Cons:
- Moderate schema and engine complexity.

### Option B - Keep static rental income, improve guidance only
Pros:
- Very low implementation effort.
- No migration complexity.
Cons:
- Continues material projection error for leveraged rentals.
- Weak fit for power users and credibility gap.

### Option C - Full tax-accounting rental engine
Pros:
- Highest possible fidelity.
Cons:
- High complexity, high maintenance, lower usability.
- Misaligned with simplicity-first product direction.

## 5) Perspective review

### General usability
- Current model is easy but insufficient for realistic rental planning.
- Joint ownership and debt are expected by many users.

### Opinionated design intent
- Product should remain planning-first, not become bookkeeping-first.
- Tiered controls (basic and advanced) match this intent.

### Security and privacy
- No major additional external attack surface.
- Ensure no sensitive tenant-level data is required or stored.

### Quality and correctness
- Add explicit assumptions around tax treatment, CCA use, and sale costs.
- Validate annual mortgage + cashflow math with deterministic tests.

### Simplicity over comprehensiveness
- Start with ownership split + mortgage schedule + sale proceeds estimate.
- Defer CCA/recapture details to advanced mode.

## 6) Priority and impact

- Priority: P1 (High)
- User impact: High for users with rentals; Medium overall
- Technical risk: Medium-High
- Product risk if ignored: Medium-High

Impact rating:
- Breadth: 3/5
- Depth: 5/5
- Confidence in need: 4/5

## 7) Recommended implementation plan

### Phase 1 - Data model extension
1. Add mortgage fields per property: starting balance, interest rate, amortization years, payment type.
2. Add ownership model: member A %, member B % (or generalized member shares).
3. Separate rental income assumptions: gross rent, vacancy %, opex %, rent growth.

### Phase 2 - Engine integration
1. Compute annual NOI and debt service.
2. Feed net rental cashflow into household/member income streams by ownership share.
3. Add sale event model with proceeds net of selling costs and remaining debt.

### Phase 3 - Tax-aware improvements (optional advanced)
1. Add optional CCA/recapture approximation mode.
2. Add warning text if advanced tax mode disabled.
3. Add validation to prevent impossible input combinations.

### Phase 4 - UX and migration
1. Migrate existing static rental fields into default assumptions.
2. Add concise advanced panel for mortgage and ownership.
3. Add scenario compare overlays for rental cashflow and sale sensitivity.

## 8) Acceptance criteria

1. User can model rental properties with debt and ownership splits.
2. Rental net income changes over time with debt paydown and assumptions.
3. Sale event updates both cashflow and net worth correctly.
4. Projection output shows per-member rental attribution.
5. Existing plans remain backward compatible.

## 9) References

1. CRA Guide T4036 - Rental Income (co-owners, ownership share reporting, mortgage interest treatment):
   https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/t4036/rental-income.html
