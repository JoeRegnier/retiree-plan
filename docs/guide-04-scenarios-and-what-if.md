# Scenarios, Projections, and What-If Analysis

## Purpose and Role

Scenarios are the control panel for the projection engine. A scenario is a named set of parameters that defines the assumptions used when running `runCashFlowProjection`. The user can create multiple scenarios to compare outcomes — "optimistic retirement at 60" vs. "conservative retirement at 65" vs. "what if inflation runs at 3.5%?".

The What-If calculator is a lightweight overlay on top of scenarios that lets the user quickly change four key variables and see the impact in real time, without creating a full saved scenario.

**Database model:** `Scenario` in `prisma/schema.prisma`  
**API module:** `apps/api/src/scenarios/`, `apps/api/src/projections/`  
**Frontend:** `apps/web/src/pages/ScenariosPage.tsx`, `apps/web/src/pages/ProjectionsPage.tsx`

---

## What a Scenario Contains

A scenario is stored as a record with named parameters. The projection service reads these parameters and merges them with household data to build a `CashFlowInput`:

```typescript
Scenario {
  id            String
  householdId   String
  name          String          // "Base Case", "Early Retirement", "Bear Market"
  
  // Core assumptions
  retirementAge     Float       // Age primary member stops working
  endAge            Float       // Age to project to (longevity assumption)
  inflationRate     Float       // Annual inflation (e.g. 0.026)
  nominalReturnRate Float       // Investment return (e.g. 0.06)
  
  // Withdrawal contributions (pre-retirement)
  rrspAnnualContribution  Float?
  tfsaAnnualContribution  Float?
  
  // CPP / OAS timing
  cppStartAge       Float       // 60–70
  oasStartAge       Float       // 65–70
  
  // Spending flexibility
  spendingPhases    Json?       // SpendingPhase[] — age-based expense multipliers
  
  // Glide path
  glidePath         Json?       // GlidePathStep[] — age-based return rate changes
}
```

---

## How Scenarios Become Projections

The key service function is `buildProjectionPayload` in `apps/api/src/projections/projections.service.ts`. It:

1. Loads the scenario parameters from the DB
2. Loads the household, members, accounts, income sources, expenses, milestones, and real estate from the DB
3. Maps all of this into a single `CashFlowInput` object
4. Calls `runCashFlowProjection(input)`
5. Returns the resulting `ProjectionYear[]` to the caller

This mapping step is where DB records (with their IDs, timestamps, etc.) become pure financial data objects. It is the **only place** in the system where DB records are translated into engine inputs.

### Key mapping decisions made in buildProjectionPayload

- Multiple accounts of the same type are **aggregated by sum**: all RRSP accounts become one `rrspBalance`
- Per-account return rates are used if set; otherwise the scenario `nominalReturnRate` is used
- Real estate rental income is added to `incomeSources[]` with the property's age range
- Milestone events are applied to the year matching the member's age at the event
- If asset allocation is set on accounts, `calculateExpectedReturn` determines the effective return rate

---

## Scenario Comparison Mode

The ScenariosPage allows two scenarios to be displayed side-by-side (compare mode). Both projections are fetched independently and overlaid on the same chart. This is implemented as:
1. Two separate TanStack Query calls, each fetching `ProjectionYear[]` for a different scenario
2. The D3 chart component accepts `{ base: ProjectionYear[], comparison: ProjectionYear[] }` and renders both lines

Compare mode is read-only — the user cannot edit parameters while in compare mode.

---

## Spending Phases

Spending phases are stored on the scenario as a `spendingPhases` JSON array. Each phase defines a transition point and a multiplier:

```typescript
interface SpendingPhase {
  fromAge: number   // Apply this multiplier from this age onward
  factor: number    // Multiply total inflation-adjusted expenses by this
}
```

**Built-in templates available in the UI:**

| Template | Phase 1 (60–74) | Phase 2 (75–84) | Phase 3 (85+) |
|---|---|---|---|
| "Smile Curve" (default) | 1.0× | 0.80× | 0.90× |
| "Travel Heavy Early" | 1.15× | 0.90× | 0.85× |
| "Step Down" | 1.0× | 0.75× | 0.75× |
| "Healthcare Rise" | 1.0× | 0.85× | 1.10× |

The "Smile Curve" reflects research showing retirees actually spend less in mid-retirement (less travel, lower energy levels) but spending can rise again in late retirement due to healthcare costs.

Users can also define custom phases with arbitrary ages and multipliers.

---

## What-If Calculator

The What-If calculator (`GlobalWhatIfController` component) is a quick exploration tool that does not save a scenario. It runs as a floating drawer accessible from any page via the Calculate icon in the QuickActionsPanel.

### How it works

1. The `GlobalWhatIfController` fetches the household and base projection data (cached via TanStack Query with the `['dash-projection', hh?.id]` key — shared with the Dashboard to avoid duplicate API calls)
2. When the user opens the drawer and adjusts sliders, the component calls `runCashFlowProjection` in a **Web Worker** with modified inputs
3. The Web Worker runs the engine client-side — no API call is made for the what-if computation
4. The result is debounced (300ms) to avoid running on every slider tick
5. The UI shows:
   - Net worth delta chip: `whatIfNetWorth - baseNetWorth` at the original retirement age
   - Baseline vs. What-If D3 line chart showing the full projection curves

### Four adjustable parameters

| Slider | Range | Effect |
|---|---|---|
| Extra monthly savings | -$2,000 to +$2,000 | Adds to `rrspAnnualContribution` pre-retirement |
| Return rate change | -3% to +3% | Adjusts `nominalReturnRate` by the delta |
| Retirement age shift | -5 to +5 years | Adjusts `retirementAge` |
| Life expectancy | 75 to 105 | Adjusts `endAge` |

### Performance note

The Web Worker approach is essential here. The engine runs synchronously and can take 20–40ms for a 40-year projection. Running it on the main thread during slider movement would cause UI jank. The Worker runs in `apps/web/src/workers/projection.worker.ts`.

### Net worth delta calculation

The delta is measured at the **original planned retirement age**, not at end of life. This is intentional: showing the delta at age 90 could be misleading if one scenario runs to zero earlier. The retirement age provides a consistent comparison point.

---

## Projection Charts (ProjectionsPage)

The ProjectionsPage displays the `ProjectionYear[]` data across six tabs:

| Tab | Chart Type | What It Shows |
|---|---|---|
| Cash Flow | D3 area chart | Income vs. expenses vs. net cash flow by year |
| Monte Carlo | Fan/cone chart | Probability band of outcomes across 1,000 trials |
| Income | Stacked bar chart | CPP, OAS, employment, RRIF income breakdown by year |
| Waterfall | Sankey diagram | Flow of money through income → tax → expenses → savings |
| Heatmap | Grid heatmap | Success rate across return rate × withdrawal rate combinations |
| Drawdown | Animated stacked bars | Account balances (RRSP, TFSA, Non-Reg, Cash) shrinking by age, with scrubber |

All tabs are lazy-rendered (only computed when the user clicks the tab) to avoid heavy D3 rendering on initial page load.

---

## AI-Assisted Coding Quick Reference

**When adding a new scenario parameter:**
1. Add the field to `Scenario` in `prisma/schema.prisma` with a default value
2. Run `npx prisma migrate dev --name add-param-name`
3. Add the field to the Zod scenario schema in `packages/shared/src/schemas/`
4. Read the field in `buildProjectionPayload` and pass it to `CashFlowInput`
5. Add a UI control in `ScenariosPage.tsx` for the new parameter

**When adding a new What-If slider:**
1. Add the slider state to the `GlobalWhatIfController` component
2. Update the `buildWhatIfInput` function to apply the slider delta to the base `CashFlowInput`
3. The Web Worker automatically picks up the new input — no worker changes needed unless you're adding a new calculation type

**What NOT to do:**
- Do not call `runCashFlowProjection` directly in a React component outside of a Web Worker — use the API endpoint for saved-scenario projections and the worker for what-if
- Do not store calculated projection results in the DB — they are always computed on demand
- Do not pass a partial `CashFlowInput` to the engine — all required fields must be present; use defaults from `buildProjectionPayload` for optional fields
