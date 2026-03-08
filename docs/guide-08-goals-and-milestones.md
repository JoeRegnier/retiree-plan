# Goals-Based Planning and Milestone Events

## Purpose and Role

Traditional retirement planning answers one question: "Will I run out of money?" Goals-based planning flips this to: "Can I afford the life I want?" Instead of projecting a generic portfolio, the system lets users define specific retirement objectives — a target income, a legacy gift, a cottage purchase — and then quantifies the probability that each goal will be achieved.

Milestone events complement goals by capturing one-time financial events that occur at a specific age. While goals describe ongoing outcomes, milestones describe specific transactions: selling a home, receiving an inheritance, starting CPP.

**Database models:** `Goal`, `Milestone` in `prisma/schema.prisma`  
**Engine files:**
- `packages/finance-engine/src/goals/goals-engine.ts`
**API modules:** `apps/api/src/goals/`, `apps/api/src/milestones/`  
**Frontend:** `apps/web/src/pages/GoalsPage.tsx`, `apps/web/src/pages/MilestonesPage.tsx`

---

## Goals

### What a goal is

A goal is a named financial outcome the household wants to achieve. Goals have four dimensions:
1. **What:** A target amount (`targetAmount`) — e.g. $80,000/year income, $200,000 legacy, $50,000 car
2. **When:** A target age (`targetAge`) — the age at which the goal should be met  
3. **How important:** A priority level — Essential, Important, or Nice-to-Have
4. **What kind:** A category — Income, Legacy, Lifestyle, or Health

```typescript
Goal {
  id            String
  householdId   String
  name          String          // "Retire with $80K/year income"
  description   String?
  targetAmount  Float           // Annual income target or lump sum
  targetAge     Int             // Age at which this goal should be met
  priority      String          // 'essential' | 'important' | 'nice_to_have'
  category      String          // 'income' | 'legacy' | 'lifestyle' | 'health'
}
```

### Goal evaluation

Goals are evaluated by the `evaluateGoals` function, which runs them against the Monte Carlo trial results:

```typescript
interface GoalResult {
  goalId: string
  successRate: number          // 0–100%: fraction of MC trials where goal is met
  shortfall: number            // Average shortfall when goal is NOT met
  surplusMedian: number        // Median surplus when goal IS met
  status: 'on_track' | 'at_risk' | 'unlikely'
}
```

**How success is determined per goal type:**

- **Income goal:** In each Monte Carlo trial, check whether the projected income at `targetAge` (from the projection year matching that age) meets or exceeds `targetAmount`. If `totalNetWorth > 0` and `income >= targetAmount`, the goal is met in that trial.  
- **Legacy goal:** At `endAge`, is `totalNetWorth >= targetAmount`?  
- **Lifestyle goal:** Is the projected net worth at `targetAge` sufficient to fund a one-time withdrawal of `targetAmount` without depleting the portfolio?  
- **Health goal:** Similar to lifestyle but modelled as an ongoing expense increase from `targetAge`.

### GoalsPage features

The GoalsPage at `/goals` shows:
- **Summary stats cards:** Total goals, % on track, average success rate
- **Goal cards** — one per goal, showing:
  - Name and category (color-coded chip)
  - Priority badge (Essential / Important / Nice-to-Have)
  - Progress ring — circular chart showing success rate percentage
  - Success rate chip (green ≥ 90%, yellow 75–90%, red < 75%)
  - "Evaluate" button (runs `POST /goals/evaluate` which calls `evaluateGoals` with the latest MC data)
- **Create/edit dialog** with all goal fields + priority selector

---

## Goal Priority and Tradeoffs

Goals are categorized by priority to communicate to the user which sacrifices are acceptable:

- **Essential:** Must be achieved. If not on track, the system should surface a high-priority insight. Examples: "Have $60K/year income in retirement", "Zero debt at retirement"
- **Important:** Should be achieved but can flex. Example: "Leave $150K to children", "Fund grandkids' education"
- **Nice-to-Have:** Aspirational. Example: "Take a $20K vacation at 70", "Buy a sports car"

The priority field currently drives the display order on GoalsPage (essential first) and the insight severity in the insights engine. Future work: the engine could automatically model tradeoffs between priority levels (e.g. "achieving the Nice-to-Have cottage goal reduces your Essential income goal success rate from 94% to 87%").

---

## Milestone Events

### What a milestone is

A milestone is a one-time financial event at a specific age. Unlike goals (which describe desired outcomes), milestones are inputs to the projection — they happen and affect the portfolio regardless of whether the household "wants" them.

```typescript
Milestone {
  id          String
  householdId String
  name        String
  type        String     // 'lump_sum_in' | 'lump_sum_out' | 'income' | 'expense'
  amount      Float      // Dollar amount
  age         Int        // Age at which the event occurs
  description String?
}
```

**Milestone types and their effect on projection:**

| Type | Effect |
|---|---|
| `lump_sum_in` | One-time cash inflow at the event age — adds to portfolio/cash |
| `lump_sum_out` | One-time cash outflow — reduces portfolio/cash |
| `income` | Adds to income in the event year |
| `expense` | Adds to expenses in the event year |

Milestones are processed in `buildProjectionPayload` by mapping them to modifications on the `ProjectionYear` for the year matching the member's age.

### The 8 Milestone Templates

The MilestonesPage includes a template library to reduce friction for common planning events. Users select a template, which pre-fills the form. They can then adjust amounts and ages before saving:

| Template | Type | Pre-filled Amount | Pre-filled Age | Notes |
|---|---|---|---|---|
| Sell Primary Home | `lump_sum_in` | $500,000 | 70 | Proceeds after commission |
| Start CPP | `income` | $16,375/year | 65 | Maximum CPP 2024 |
| Move to Retirement Community | `expense` | $60,000/year | 80 | Annual cost |
| Pay Off Mortgage | `lump_sum_out` | $200,000 | 62 | Final mortgage payoff |
| Receive Inheritance | `lump_sum_in` | $100,000 | 65 | User should adjust |
| Part-Time Work in Retirement | `income` | $20,000/year | 60 | Phased retirement |
| Major Renovation | `lump_sum_out` | $75,000 | 63 | Kitchen, roof, etc. |
| Fund Education | `lump_sum_out` | $30,000 | 55 | Per child |

The template creates a starting point — the user must always review and adjust the amount and age to match their situation.

### Difference between Milestones and Goals

This is a common source of confusion. The distinction is:
- **Milestones** are *inputs to the projection* — they represent events that will happen (planned or expected), and they change the trajectory of the projection
- **Goals** are *desired outcomes measured against the projection* — they describe what you want the projection to produce

A "Sell Home" **milestone** causes the projection engine to inject $500K of proceeds at age 70. A "Leave $200K estate" **goal** measures whether the final net worth in each Monte Carlo trial meets that target.

---

## AI-Assisted Coding Quick Reference

**When adding a new goal category:**
1. Add the category string to the `category` union in `packages/shared/src/schemas/`
2. Add icon and color mapping in GoalsPage for the new category
3. Add evaluation logic in `evaluateGoals` for how success is measured for the new category

**When adding a new milestone type:**
1. Add the type string to the `type` union in `packages/shared/src/schemas/`
2. Add the processing logic in `buildProjectionPayload` — determine how it modifies the `ProjectionYear` for the event age
3. Add the type to the milestone dialog type selector

**When adding a new milestone template:**
1. Add the template object to `MILESTONE_TEMPLATES` array in `apps/web/src/pages/MilestonesPage.tsx`
2. No backend changes needed — templates are client-side presets

**When implementing goal tradeoff analysis:**
- The approach is to run `evaluateGoals` with and without each goal, comparing the impact on other goals' success rates
- This requires the Monte Carlo results (same trial set) to be available — do not re-run MC for each tradeoff analysis; cache the trial paths

**What NOT to do:**
- Do not treat milestones as recurring income sources — they are one-time events. Use `incomeSources[]` in the scenario for recurring income
- Do not set goal `targetAmount` to the total portfolio value needed — for income goals, it should be the annual income amount; the engine calculates whether the portfolio can sustain it
- Do not skip the `evaluateGoals` call for the initial display — without an evaluation, goals show no success rate and the page is misleading
