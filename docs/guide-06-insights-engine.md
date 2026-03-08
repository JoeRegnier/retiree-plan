# Plan Health Score and Insights Engine

## Purpose and Role

The Plan Health system transforms a raw projection into actionable guidance. Instead of leaving the user to interpret a spreadsheet of numbers, it surfaces the most important things they could do right now to improve their retirement outcome — with dollar amounts attached to each recommendation.

There are two related but distinct components:
1. **Retirement Readiness Score** — A single 0–100 number summarising overall plan health
2. **Insights Engine** — A set of rules that identify specific opportunities and flag them with estimated dollar impact

**Engine files:**
- `packages/finance-engine/src/scoring/readiness-score.ts` — Readiness score calculation
- `packages/finance-engine/src/insights/insights-engine.ts` — Rule-based insight generation
- **API:** `apps/api/src/projections/projections.controller.ts` (`POST /projections/insights`)
- **Frontend:** `apps/web/src/pages/DashboardPage.tsx` (InsightsCard, ReadinessScoreCard)

---

## Retirement Readiness Score

### What it measures

The score is a composite index from 0 to 100 built from five component scores:

| Component | Weight | What it measures |
|---|---|---|
| Longevity Coverage | 30% | Does the plan cover expenses to the target end age? |
| Income Replacement | 25% | Is retirement income ≥ 70% of pre-retirement income? |
| Healthcare Buffer | 20% | Is there enough cushion for unexpected healthcare costs? |
| Debt Clearance | 15% | Is all major debt paid off before retirement? |
| Emergency Fund | 10% | Is there 3–6 months of expenses in liquid savings? |

**Engine function:** `calculateReadinessScore(input: ReadinessScoreInput): ReadinessScoreResult`

### Score interpretation

| Score | Label | Color |
|---|---|---|
| 80–100 | On Track | Green |
| 60–79 | Needs Attention | Yellow/Amber |
| 0–59 | At Risk | Red |

The score is displayed prominently on the Dashboard as the primary "plan health" indicator. It is recalculated every time a new projection is run.

### What the score is NOT

The score is a simplified heuristic, not a guarantee. It deliberately does not account for every edge case in the projection. It is designed to be immediately understandable to a non-financial user. For detailed analysis, the user should look at the projection charts and Monte Carlo success rate.

---

## Plan Completeness Checklist

A related feature on the Dashboard shows how complete the household's data entry is — separate from plan health. The checklist answers: "Have you filled in enough information to get a reliable projection?"

Items checked:
- ✅ Both spouses' income entered
- ✅ At least one registered account (RRSP or TFSA) entered
- ✅ Retirement age set
- ✅ Annual expenses entered
- ✅ CPP estimate entered
- ✅ OAS residency years entered (if near retirement)

This prevents the common case of a user getting a "great score" because they haven't entered their expenses yet.

---

## Insights Engine

### Approach

The insights engine is a **rule-based system**, not machine learning. Each insight is a hard-coded rule that checks specific conditions in the projection data and household profile. If a condition is met, an insight is emitted with a title, description, estimated dollar impact, category tag, and a navigation link.

This approach was chosen deliberately over an LLM or ML approach because:
- The rules are auditable — a financial advisor can review exactly what conditions trigger each rule
- The dollar impacts are calculable, not hallucinated
- The rules can be unit tested with known inputs

### Insight structure

```typescript
interface Insight {
  id: string               // Unique stable ID (used for navigation anchor)
  title: string            // Short action phrase, e.g. "Consider RRSP Meltdown"
  description: string      // 1–2 sentence explanation in plain English
  dollarImpact: string     // Formatted dollar amount, e.g. "$47,000"
  category: 'tax' | 'benefits' | 'investment' | 'estate' | 'spending'
  priority: 'high' | 'medium' | 'low'
  linkTo: string           // Route to navigate to for action, e.g. "/scenarios"
}
```

### The seven current rules

**1. RRSP Meltdown Opportunity**
- **Trigger:** Household has a large RRSP balance AND a significant gap between current RRSP income and the OAS clawback threshold, AND is within 10 years of RRIF conversion age  
- **Dollar impact:** Estimated tax saved by drawing RRSP voluntarily at lower marginal rates before RRIF forces draws at higher rates  
- **Estimate formula:** `rrspBalance × 0.08` (simplified proxy — the engine uses `meltdownSavings` if the full meltdown optimizer has been run)
- **Action link:** `/scenarios` (add a spending phase or review retirement age)

**2. OAS Clawback Risk**
- **Trigger:** Projected RRIF income pushes total retirement income above the clawback threshold ($90,997, 2024) for 3 or more years  
- **Dollar impact:** `clawbackYears × $4,000` (approximate annual OAS clawback loss)
- **Action link:** `/projections` (review income sources)

**3. TFSA Underutilization**
- **Trigger:** The household has unused TFSA room AND non-registered savings. Moving money into TFSA eliminates ongoing tax drag on growth.  
- **Dollar impact:** `min(unusedTfsaRoom, nonRegBalance) × 0.02` (modelling 2% annual tax drag elimination over time)
- **Action link:** `/accounts`

**4. RRIF Conversion Soon**
- **Trigger:** The primary member is within 5 years of age 71 and has an RRSP balance over $200,000  
- **Dollar impact:** *Informational* — describes the mandatory minimum at age 71 given the projected RRSP balance
- **Action link:** `/projections` (review drawdown waterfall)

**5. CPP Timing Opportunity**
- **Trigger:** The CPP start age is set to 65 (the default) AND the household is healthy with no income shortage before 65  
- **Dollar impact:** `$3,000/year` (approximate annual gain from deferring CPP to 70 — a rough estimate)
- **Action link:** `/household` (adjust CPP start age)

**6. Pension Income Splitting**
- **Trigger:** This is a couple AND one spouse has significantly higher projected retirement income (>$30,000 gap) AND the higher-income spouse has RRIF or DB pension income  
- **Dollar impact:** `incomeGap × 0.10` (approximate marginal rate difference)
- **Action link:** `/household`

**7. RRSP Contribution Room Waste**
- **Trigger:** The household has unused RRSP room AND available non-registered cash that could be contributed  
- **Dollar impact:** `unusedRrspRoom × 0.30` (approximate marginal tax benefit at 30% marginal rate)
- **Action link:** `/accounts`

### Generating insights

```typescript
import { generateInsights } from '../insights/insights-engine.js';

const insights = generateInsights({
  rrspBalance: 850_000,
  tfsaBalance: 87_000,
  currentAge: 62,
  rrifConversionAge: 71,
  cppStartAge: 65,
  oasStartAge: 65,
  annualIncome: 180_000,
  spouseIncome: 45_000,
  unusedTfsaRoom: 25_000,
  nonRegBalance: 50_000,
  unusedRrspRoom: 15_000,
  oasClawbackYears: [72, 73, 74, 75],  // ages where clawback is projected
  meltdownSavings: 47_000,             // from rrsp-meltdown optimizer if run
});
```

The function returns `Insight[]` sorted by `priority` (high first).

---

## Dashboard Integration

### InsightsCard component

The InsightsCard on the Dashboard shows the top 5 insights. Each insight renders as an expandable list item with:
- Category icon (tax = dollar sign, benefits = government building, investment = trending up, estate = house)
- Title in bold
- Description in subdued text
- Dollar impact chip (green)
- Arrow button navigating to `linkTo`

### Bell badge in AppBar

The AppBar shows a `NotificationsIcon` with a `Badge` showing the count of active insights. Clicking it navigates to the Dashboard insights section.

### Market Data Refresh Alert

When assumptions are potentially stale (the `market-data` module detects a new calendar year), the Dashboard shows an amber Alert: "CRA may have updated limits for [year]. Review your assumptions?" with a dismiss option stored in `localStorage`.

---

## AI-Assisted Coding Quick Reference

**When adding a new insight rule:**
1. Open `packages/finance-engine/src/insights/insights-engine.ts`
2. Add the condition check inside `generateInsights` following the existing pattern
3. Push a new `Insight` object to the `insights` array
4. Add a unit test in the insights tests file with a household profile that triggers the rule

**When changing dollar impact estimates:**
- The estimates in the current rules are approximations, not exact calculations. For more accuracy, you can call a specific engine function (e.g. `optimizeRrspMeltdown`) from within the insight rule and use its output
- Always show amounts as rounded whole dollars, not cents

**When adding a new insight category:**
1. Add the category string to the `Insight.category` union type in `packages/finance-engine/src/insights/insights-engine.ts`
2. Add a corresponding icon mapping in the InsightsCard component on DashboardPage
3. Add a color mapping for the category chip

**What NOT to do:**
- Do not make the insight rules dependent on specific account names or IDs — they must work with aggregated balances
- Do not hard-code thresholds in insight rules without noting which CRA/regulatory source they come from
- Do not surface more than 7 insights at a time — the design caps the list to avoid overwhelming the user
