# Feature Implementation Plan: Withdrawal Optimizer, Bucket Strategy & Spousal RRSP

**Generated:** 2026-03-22
**Scope:** Three interconnected features from Roadmap themes 2.4, 5.1, and 5.2
**Prerequisite:** All Phase 1–5 features shipped (readiness score, insights engine, contribution room, asset allocation, spending phases, drawdown waterfall, RRSP meltdown)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Feature 1 — Withdrawal Order Optimizer](#feature-1--withdrawal-order-optimizer)
3. [Feature 2 — Bucket Strategy Modeller](#feature-2--bucket-strategy-modeller)
4. [Feature 3 — Spousal RRSP Optimizer](#feature-3--spousal-rrsp-optimizer)
5. [Implementation Phases](#implementation-phases)
6. [Cross-Cutting Concerns](#cross-cutting-concerns)
7. [Documentation & Guide Updates](#documentation--guide-updates)
8. [E2E Test Plan](#e2e-test-plan)
9. [Areas for Improvement](#areas-for-improvement)
   - [Area 1 — Per-Member Projection Engine](#area-1--per-member-projection-engine)
   - [Area 2 — Capital Gains ACB Tracking](#area-2--capital-gains-acb-tracking)
   - [Area 3 — Pension Income Splitting](#area-3--pension-income-splitting-theme-23)
   - [Area 4 — LIRA/LIF Account Constraints](#area-4--liralif-account-constraints)
   - [Area 5 — Flexible Spending Guardrails](#area-5--flexible-spending-guardrails-in-the-withdrawal-optimizer)
   - [Area 6 — Meltdown + Optimizer Unified Timeline](#area-6--withdrawal-optimizer--rrsp-meltdown-unified-timeline)
   - [Area 7 — Tax-Loss Harvesting](#area-7--tax-loss-harvesting-for-non-reg-accounts)
   - [Area 8 — Help Page & Onboarding](#area-8--help-page--onboarding)
10. [Appendix: Supporting Research](#appendix-supporting-research)

---

## Executive Summary

These three features share a common dependency on the cash-flow engine's withdrawal logic in `packages/finance-engine/src/projection/cash-flow.ts`. Today, the engine uses a hardcoded 5-layer withdrawal priority optimized for OAS clawback avoidance:

```
1. Cash/HISA → 2. RRSP below OAS threshold → 3. TFSA → 4. Non-Reg → 5. RRSP beyond threshold
```

The Withdrawal Order Optimizer makes this configurable and compares strategies. The Bucket Strategy Modeller adds a visual mental-model layer on top. The Spousal RRSP Optimizer introduces a new account type with attribution rules that feeds into withdrawal planning.

**Recommended implementation order:**
1. **Spousal RRSP** (smallest, creates the account-type foundation)
2. **Withdrawal Order Optimizer** (engine parameterization + comparison logic)
3. **Bucket Strategy Modeller** (visual layer that consumes the parameterized engine)

**Cross-feature dependency:** The Withdrawal Optimizer must be aware of Spousal RRSP attribution when sequencing withdrawals (3-year rule affects when spousal RRSP funds can be withdrawn tax-efficiently).

---

## Feature 1 — Withdrawal Order Optimizer

**Roadmap ref:** Theme 5.1 | **Impact: H** | **Effort: H**

### Problem Statement

The hardcoded withdrawal priority in `cash-flow.ts` is a reasonable OAS-clawback-optimized default, but it produces suboptimal outcomes in common Canadian scenarios:

- **High RRSP balance, low other income:** RRSP-first (meltdown) minimizes lifetime taxes by filling low brackets early, avoiding a RRIF income spike at 71+.
- **Young retiree (age 55–64):** Non-Reg first preserves RRSP/TFSA tax shelter for compounding; capital gains inclusion rate (50%) is more favourable than full RRSP inclusion.
- **High OAS clawback risk:** Current default is already good here — but the user should see *why* and by *how much*.
- **Estate maximization:** TFSA-last strategy preserves the most tax-free assets for beneficiaries (TFSA passes tax-free to estate).

### User Stories

| # | Story | Acceptance Criteria |
|---|-------|-------------------|
| WO-1 | As a retiree, I want to compare withdrawal strategies so I can pick the one that minimizes my lifetime taxes. | User can select from preset strategies or define a custom order. Engine runs projection for each and displays total lifetime tax for comparison. |
| WO-2 | As a retiree, I want to see a recommended withdrawal strategy with an explanation of why it's optimal. | System highlights the lowest-tax strategy and shows a plain-English rationale (e.g., "RRSP-first saves $47,200 in lifetime taxes by filling the 20.5% bracket before RRIF minimums force larger withdrawals"). |
| WO-3 | As a retiree, I want to see a year-by-year withdrawal schedule showing exactly how much comes from each account. | Stacked bar chart (extending DrawdownWaterfallChart) shows annual withdrawal by account type under the selected strategy. |
| WO-4 | As a planner, I want the withdrawal optimizer to respect RRIF minimums, OAS clawback thresholds, and TFSA room limits automatically. | Engine enforces all constraints regardless of user-selected priority. RRIF minimums are always met first. OAS clawback headroom is computed and displayed. |
| WO-5 | As a planner, I want to see how each strategy affects my estate value at life expectancy. | Comparison table includes final estate value (total net worth at end age) alongside lifetime tax. |

### Withdrawal Strategies to Support

| Strategy ID | Name | Description | Withdrawal Priority |
|-------------|------|-------------|-------------------|
| `oas-optimized` | OAS-Optimized (Current Default) | Minimizes OAS clawback by drawing RRSP within headroom first. | Cash → RRSP≤threshold → TFSA → Non-Reg → RRSP>threshold |
| `rrsp-first` | RRSP Meltdown | Draws RRSP aggressively to empty it before age 71. Best for large RRSP + low other income. | Cash → RRSP (fill bracket) → Non-Reg → TFSA |
| `tfsa-last` | Estate Maximizer | Preserves TFSA for inheritance (passes tax-free). | Cash → RRSP≤threshold → Non-Reg → RRSP>threshold → TFSA |
| `non-reg-first` | Capital Gains First | Draws non-reg first (50% inclusion rate advantage). Useful when non-reg has large unrealized gains. | Cash → Non-Reg → RRSP≤threshold → TFSA → RRSP>threshold |
| `proportional` | Proportional | Withdraws from all accounts proportionally to their balance. Smooths tax liability. | Pro-rata by balance each year |
| `custom` | Custom | User defines their own priority order via drag-and-drop. | User-defined array |

### Edge Cases

1. **RRIF minimum exceeds shortfall:** Forced withdrawal happens regardless of strategy. Surplus goes to TFSA (if room) or non-reg.
2. **Account depletion mid-strategy:** When a higher-priority account is exhausted, cascade to next in order.
3. **OAS clawback in RRSP-first strategy:** User should see a warning: "RRSP-first increases OAS clawback by $X/yr but saves $Y in income tax — net benefit $Z."
4. **Zero-balance accounts:** Skip silently in the priority chain.
5. **Spousal RRSP 3-year attribution rule:** If a spousal RRSP withdrawal occurs within 3 years of last contribution, income is attributed back to the contributor. The optimizer must model this.
6. **LIRA/LIF accounts:** These have both minimum and maximum withdrawal limits. Must be handled as constrained slots in the withdrawal order.
7. **Non-reg tax drag interaction:** Strategies that leave more in non-reg longer incur more annual tax drag. The comparison must account for this.

### Technical Design

#### Engine Changes (`packages/finance-engine/`)

**New types** (in `packages/shared/src/types/`):

```typescript
type AccountBucket = 'CASH' | 'RRSP' | 'TFSA' | 'NON_REG';

type WithdrawalStrategyId =
  | 'oas-optimized'
  | 'rrsp-first'
  | 'tfsa-last'
  | 'non-reg-first'
  | 'proportional'
  | 'custom';

interface WithdrawalStrategy {
  id: WithdrawalStrategyId;
  name: string;
  description: string;
  priority: AccountBucket[]; // ignored for 'proportional'
}

interface WithdrawalComparisonResult {
  strategies: WithdrawalStrategyResult[];
  recommended: WithdrawalStrategyId;
  recommendationReason: string;
}

interface WithdrawalStrategyResult {
  strategyId: WithdrawalStrategyId;
  strategyName: string;
  lifetimeTax: number;
  lifetimeOasClawback: number;
  finalEstateValue: number;
  projectionYears: ProjectionYear[];
}
```

**Modify `CashFlowInput`:**

```typescript
// Add optional field:
withdrawalStrategy?: WithdrawalStrategyId;
withdrawalOrder?: AccountBucket[]; // only used when strategy = 'custom'
```

**New file: `packages/finance-engine/src/optimization/withdrawal-optimizer.ts`**

```typescript
export function compareWithdrawalStrategies(
  baseInput: CashFlowInput,
): WithdrawalComparisonResult {
  // 1. Run projection for each of the 5 preset strategies + any custom
  // 2. Sum lifetimeTax, lifetimeOasClawback, finalEstateValue for each
  // 3. Rank by lowest (lifetimeTax + lifetimeOasClawback)
  // 4. Generate plain-English recommendation
  // Returns full ProjectionYear[] for each strategy for charting
}
```

**Modify `projection/cash-flow.ts`:**

Refactor the hardcoded 5-layer withdrawal block into a strategy-dispatch function:

```typescript
function applyWithdrawalStrategy(
  strategy: WithdrawalStrategyId,
  customOrder: AccountBucket[] | undefined,
  shortfall: number,
  balances: { cash: number; rrsp: number; tfsa: number; nonReg: number },
  oasHeadroom: number,
  rrifMinimum: number,
): { cashW: number; rrspW: number; tfsaW: number; nonRegW: number }
```

This keeps the existing default behavior intact when `withdrawalStrategy` is undefined.

**Files to modify:**
- `packages/shared/src/types/` — new types file or extend existing
- `packages/finance-engine/src/projection/cash-flow.ts` — refactor withdrawal block to use strategy parameter
- `packages/finance-engine/src/optimization/withdrawal-optimizer.ts` — new file
- `packages/finance-engine/src/index.ts` — export new module
- `packages/finance-engine/src/insights/insights-engine.ts` — add insight rule: "Switching to [strategy] could save $X in lifetime taxes"

#### API Changes (`apps/api/`)

**New endpoint:**
- `POST /optimization/withdrawal-comparison` — accepts `CashFlowInput`, returns `WithdrawalComparisonResult`

**Modify:**
- `apps/api/src/optimization/optimization.controller.ts` — add endpoint
- `apps/api/src/optimization/optimization.service.ts` — call `compareWithdrawalStrategies`

**Schema change:**
- `ScenarioParameters` gains `withdrawalStrategy?: WithdrawalStrategyId` and `withdrawalOrder?: AccountBucket[]`

#### Frontend Changes (`apps/web/`)

**New component: `WithdrawalOptimizerCard`**
- Location: new tab on ProjectionsPage ("Withdrawal Strategy") or standalone section on a new `/optimization` page
- Shows comparison table: strategy name, lifetime tax, OAS clawback, estate value, delta vs. current
- Highlights recommended strategy with explanation badge
- User can click any strategy row to see its full year-by-year projection
- Stacked bar chart (reuse DrawdownWaterfallChart) showing withdrawal source per year

**Modify ScenariosPage:**
- Add "Withdrawal Strategy" dropdown to the scenario editing dialog (new tab or in Timeline tab)
- Options: OAS-Optimized (default), RRSP Meltdown, Estate Maximizer, Capital Gains First, Proportional, Custom
- When Custom selected, show drag-and-drop list of account types

**Files to create:**
- `apps/web/src/components/WithdrawalOptimizerCard.tsx`
- `apps/web/src/components/WithdrawalStrategySelector.tsx` (reusable dropdown + custom DnD)
- `apps/web/src/components/charts/WithdrawalComparisonChart.tsx` (grouped bar chart comparing strategies)

**Files to modify:**
- `apps/web/src/pages/ProjectionsPage.tsx` — add Withdrawal Strategy tab
- `apps/web/src/pages/ScenariosPage.tsx` — add strategy selector to dialog

---

## Feature 2 — Bucket Strategy Modeller

**Roadmap ref:** Theme 5.2 | **Impact: M** | **Effort: M**

### Problem Statement

The Evensky bucket strategy is the most popular mental model for retirees managing their own withdrawals. It divides the portfolio into three time-horizon buckets:

| Bucket | Time Horizon | Asset Mix | Purpose |
|--------|-------------|-----------|---------|
| 1 — Cash Reserve | 1–2 years expenses | HISA, money market | Immediate spending; insulates from volatility |
| 2 — Conservative | 3–10 years expenses | GICs, bonds, balanced funds | Medium-term stability; refills Bucket 1 |
| 3 — Growth | Remainder | Equities, alternatives | Long-term growth; refills Bucket 2 |

The current engine already has separate account buckets (Cash, RRSP, TFSA, Non-Reg) but these are tax-wrapper buckets, not time-horizon buckets. Users need both views — tax-wrapper for the CRA, time-horizon for peace of mind.

### User Stories

| # | Story | Acceptance Criteria |
|---|-------|-------------------|
| BS-1 | As a retiree, I want to define how my portfolio is divided into cash reserve, conservative, and growth buckets. | UI allows setting target allocation for each bucket as years-of-expenses or fixed dollar amounts. |
| BS-2 | As a retiree, I want to see how my current accounts map into the bucket framework. | Visualization shows which accounts (RRSP, TFSA, etc.) contribute to which bucket, with suggested allocation. |
| BS-3 | As a retiree, I want to know when Bucket 1 needs refilling and where the refill comes from. | Year-by-year timeline shows refill events with source account and amount. |
| BS-4 | As a retiree, I want to compare bucket strategy performance against an all-in-one approach. | Side-by-side success rates (Monte Carlo) for bucketed vs. non-bucketed portfolio under the same scenario. |
| BS-5 | As a planner, I want preset bucket configurations I can apply with one click. | At least 3 presets: Conservative (3yr cash), Moderate (2yr cash), Aggressive (1yr cash). |

### Edge Cases

1. **Bucket 1 exhausted before refill:** If markets crash and Bucket 2 is also depleted, Bucket 3 (growth) must be tapped — even at a potential loss. Show a warning: "In X% of simulations, you needed to sell growth assets during a downturn."
2. **Refill timing:** Annual refill (sell conservative → cash) at start of each year vs. threshold-based (refill when cash drops below 6 months expenses). Support both.
3. **Bucket 2/3 rebalancing:** As Bucket 3 grows, excess should cascade down to maintain targets. Model or flag when rebalancing is needed.
4. **Tax-wrapper overlay:** A bucket is not one account. The "Conservative" bucket might be split across RRSP (GIC), TFSA (bond ETF), and Non-Reg (money market). The bucketing is orthogonal to the tax-wrapper withdrawal order.
5. **Real estate proceeds:** If a downsizing event dumps $500K into the portfolio, which bucket does it go to? Default: replenish Bucket 1 first, then pro-rata 2 and 3.
6. **Zero accounts scenario:** If user has only RRSP and no cash or non-reg, Bucket 1 can only be funded from RRSP withdrawals. Model the tax cost of forced RRSP→cash conversion.

### Technical Design

#### Engine Changes

**New types:**

```typescript
interface BucketConfig {
  cashReserveYears: number;       // default 2 — how many years of expenses in Bucket 1
  conservativeYears: number;      // default 5 — how many years in Bucket 2
  conservativeReturnRate: number; // default 0.035 — GIC/bond return
  growthReturnRate: number;       // default 0.07 — equity return
  refillFrequency: 'annual' | 'threshold'; // when to refill Bucket 1
  refillThresholdMonths?: number; // 6 — refill when cash drops below N months
}

interface BucketYear {
  age: number;
  bucket1Balance: number;    // Cash reserve
  bucket2Balance: number;    // Conservative
  bucket3Balance: number;    // Growth
  bucket1Withdrawal: number; // Amount spent from Bucket 1
  refillAmount: number;      // Amount moved Bucket 2 → Bucket 1
  rebalanceAmount: number;   // Amount moved Bucket 3 → Bucket 2
  refillSource: 'bucket2' | 'bucket3' | 'both';
}

interface BucketProjectionResult {
  years: BucketYear[];
  bucket1DepletionAge: number | null;
  bucket2DepletionAge: number | null;
  bucket3DepletionAge: number | null;
  portfolioSurvivesFullPeriod: boolean;
}
```

**New file: `packages/finance-engine/src/optimization/bucket-strategy.ts`**

```typescript
export function runBucketProjection(
  input: CashFlowInput,
  config: BucketConfig,
): BucketProjectionResult {
  // 1. Compute initial bucket sizing from account balances + config
  // 2. Year-by-year:
  //    a. Apply returns per bucket (cashSavingsRate, conservativeRate, growthRate)
  //    b. Withdraw expenses from Bucket 1
  //    c. Refill Bucket 1 from Bucket 2 (if annual or threshold trigger)
  //    d. Rebalance Bucket 3 → Bucket 2 to maintain target allocation
  //    e. Record all flows
  // 3. Return year-by-year breakdown + depletion ages
}

export function compareBucketVsAllInOne(
  input: CashFlowInput,
  config: BucketConfig,
  trials?: number,
): { bucketSuccessRate: number; allInOneSuccessRate: number }
```

**Files to modify:**
- `packages/finance-engine/src/index.ts` — export bucket-strategy module

#### API Changes

**New endpoint:**
- `POST /optimization/bucket-strategy` — accepts `CashFlowInput` + `BucketConfig`, returns `BucketProjectionResult`
- `POST /optimization/bucket-comparison` — returns success rates for bucket vs. all-in-one

**Modify:**
- `apps/api/src/optimization/optimization.controller.ts` — add endpoints
- `apps/api/src/optimization/optimization.service.ts` — call engine

**No schema change required** — bucket config is a scenario-level parameter, stored in `ScenarioParameters` JSON:

```typescript
// Add to ScenarioParameters:
bucketStrategy?: BucketConfig;
```

#### Frontend Changes

**New component: `BucketStrategyCard`**
- Location: new tab on ProjectionsPage ("Bucket Strategy") or section within Withdrawal Strategy tab
- Three visual containers (Bucket 1 / 2 / 3) with fill-level animation showing balance relative to target
- Year-by-year waterfall showing refill events (arrows between buckets)
- Preset selector (Conservative / Moderate / Aggressive)
- Monte Carlo comparison badge: "Bucket: 92% success | All-in-one: 89% success"

**New component: `BucketConfigPanel`**
- Sliders: Cash reserve years (1–5), Conservative horizon (3–15), Return assumptions
- Refill rule toggle: Annual vs. Threshold
- Account-to-bucket mapping table (auto-suggested based on account type)

**Files to create:**
- `apps/web/src/components/BucketStrategyCard.tsx`
- `apps/web/src/components/BucketConfigPanel.tsx`
- `apps/web/src/components/charts/BucketFlowChart.tsx` (animated bucket visualization)

**Files to modify:**
- `apps/web/src/pages/ProjectionsPage.tsx` — add Bucket Strategy tab
- `apps/web/src/pages/ScenariosPage.tsx` — add bucket config toggle to scenario dialog (expand Returns tab)

---

## Feature 3 — Spousal RRSP Optimizer

**Roadmap ref:** Theme 2.4 | **Impact: M** | **Effort: S**

### Problem Statement

Canadian couples with income disparity can reduce lifetime taxes by contributing to a spousal RRSP. The higher-income spouse claims the tax deduction at their marginal rate, while the lower-income spouse withdraws in retirement at their (lower) marginal rate. However, the **3-year attribution rule** is a trap: if the annuitant (lower-income spouse) withdraws within 3 calendar years of the last contribution, the income is attributed back to the contributor for tax purposes, negating the benefit.

Currently:
- The Prisma schema has no spousal relationship between members
- Account types include RRSP but not SPOUSAL_RRSP
- The engine models accounts by tax wrapper with no member ownership distinction
- The insights engine mentions pension splitting but not spousal RRSP

### User Stories

| # | Story | Acceptance Criteria |
|---|-------|-------------------|
| SR-1 | As a higher-income spouse, I want to see how much tax I save by contributing to a spousal RRSP instead of my own. | Calculator shows: my marginal rate deduction ($X saved) vs. spouse's marginal rate on withdrawal ($Y owed) = net savings ($Z). |
| SR-2 | As a planner, I want the system to warn me about the 3-year attribution rule before I let my spouse withdraw. | Clear warning banner when a spousal RRSP withdrawal is planned within 3 calendar years of the last contribution date. Text explains attribution: "This withdrawal will be taxed in [contributor]'s hands at [rate]% instead of [annuitant]'s [rate]%." |
| SR-3 | As a couple, I want to see the break-even point for starting a spousal RRSP strategy. | Calculator shows: "After X years, the spousal RRSP strategy saves $Y compared to contributing to your own RRSP." |
| SR-4 | As a planner, I want to mark an existing RRSP account as a spousal RRSP so the engine applies attribution rules. | Account creation/edit dialog has a "Spousal RRSP" checkbox (or account type) that links the account to two members: contributor and annuitant. |
| SR-5 | As a couple, I want the withdrawal optimizer to correctly handle spousal RRSP accounts. | When computing withdrawal strategies, the engine attributes spousal RRSP withdrawals to the correct member for tax calculation based on the 3-year rule. |

### The 3-Year Attribution Rule — Detailed

The Income Tax Act (s. 146(8.3)) states:

1. If the annuitant withdraws from a spousal RRSP **in the calendar year of the contribution or in the two preceding calendar years**, the withdrawal is taxed as income of the **contributor** (not the annuitant).
2. The attributed amount is limited to the amount contributed in the triggering period.
3. After the 3-year window passes, all withdrawals are taxed in the annuitant's hands.
4. Mandatory RRIF minimum withdrawals are **exempt** from attribution (after conversion to RRIF at age 71).
5. Contributions to *any* spousal plan count — the 3-year clock resets with each contribution.

**Practical implications for the optimizer:**
- Stop spousal RRSP contributions at least 3 calendar years before the annuitant's planned retirement withdrawal date.
- If the couple plans for the annuitant to retire at 60, last contribution should be no later than the year they turn 57.
- After RRIF conversion (71), all minimum withdrawals are safe from attribution.

### Technical Design

#### Schema Changes (`prisma/schema.prisma`)

**Extend Account model:**

```prisma
model Account {
  // ... existing fields ...

  /// Spousal RRSP support
  isSpousalRrsp      Boolean   @default(false)
  contributorId      String?   // HouseholdMember who contributes (gets deduction)
  annuitantId        String?   // HouseholdMember who owns/withdraws
  lastContributionDate DateTime? // For 3-year attribution rule tracking

  contributor        HouseholdMember? @relation("SpousalContributor", fields: [contributorId], references: [id])
  annuitant          HouseholdMember? @relation("SpousalAnnuitant", fields: [annuitantId], references: [id])
}
```

**Extend HouseholdMember model:**

```prisma
model HouseholdMember {
  // ... existing fields ...
  spousalContributions Account[] @relation("SpousalContributor")
  spousalAnnuities     Account[] @relation("SpousalAnnuitant")
}
```

**Migration:** `npx prisma migrate dev --name add_spousal_rrsp_fields`

#### Engine Changes

**New file: `packages/finance-engine/src/optimization/spousal-rrsp.ts`**

```typescript
interface SpousalRrspInput {
  contributorIncome: number;
  annuitantIncome: number;
  contributorAge: number;
  annuitantAge: number;
  contributorProvince: Province;
  annuitantProvince: Province;
  contributorRrspRoom: number;
  proposedContribution: number;
  annuitantRetirementAge: number;
  lastContributionYear?: number;    // for attribution check
  currentYear: number;
}

interface SpousalRrspResult {
  contributorTaxSaved: number;       // deduction at contributor's marginal rate
  annuitantTaxOnWithdrawal: number;  // eventual tax at annuitant's rate
  netTaxSavings: number;             // contributorTaxSaved - annuitantTaxOnWithdrawal
  contributorMarginalRate: number;   // % rate
  annuitantMarginalRate: number;     // % rate
  rateSpread: number;                // difference in marginal rates
  breakEvenYears: number;            // years until spousal strategy beats own-RRSP
  attributionRisk: boolean;          // true if withdrawal planned within 3-year window
  attributionWarning?: string;       // human-readable warning text
  safeWithdrawalYear: number;        // first year annuitant can withdraw safely
  recommendContribution: boolean;    // true if net savings > 0 and no attribution risk
}

export function analyzeSpousalRrsp(input: SpousalRrspInput): SpousalRrspResult;
```

**Modify `projection/cash-flow.ts`:**
- When a spousal RRSP account is encountered, determine attribution status based on `lastContributionDate` vs. current projection year.
- If within 3-year window: attribute withdrawal income to contributor for tax calculation.
- If beyond 3-year window or RRIF minimum: attribute to annuitant.
- This requires `CashFlowInput` to accept an optional `spousalRrspAccounts` array with contributor/annuitant member IDs.

**Modify `insights/insights-engine.ts`:**
- Add rule: "Spousal RRSP Opportunity" — triggers when household has 2 members with >$20K income gap and the higher-income member has RRSP room. Estimated impact: rate spread × proposed contribution.

#### API Changes

**New endpoint:**
- `POST /optimization/spousal-rrsp` — accepts `SpousalRrspInput`, returns `SpousalRrspResult`

**Modify:**
- `apps/api/src/accounts/accounts.service.ts` — handle `isSpousalRrsp`, `contributorId`, `annuitantId`, `lastContributionDate` fields on create/update
- `apps/api/src/optimization/optimization.controller.ts` — add endpoint
- `apps/api/src/optimization/optimization.service.ts` — call engine

#### Frontend Changes — Usability Workflow

The spousal RRSP feature must be **discoverable but not overwhelming**. Most users won't have a spousal RRSP. The workflow:

**1. Account Creation (AccountsPage)**
- When user selects account type "RRSP" and the household has 2+ members:
  - Show a toggle: "This is a Spousal RRSP"
  - When toggled on, show two dropdowns: "Contributor" and "Account Owner (Annuitant)", pre-populated with household member names
  - Show an optional date picker: "Date of last contribution" with helper text: "Used to check the 3-year attribution rule. Leave blank if unsure."
  - Info tooltip: "A Spousal RRSP lets the higher-income partner claim the tax deduction while the lower-income partner withdraws in retirement at a lower tax rate."

**2. Spousal RRSP Calculator Card (AccountsPage or HouseholdPage)**
- A card visible when the household has 2 members (regardless of whether a spousal RRSP exists yet):
  - Title: "Spousal RRSP Tax Savings Calculator"
  - Shows: contributor's marginal rate, annuitant's marginal rate, rate spread, estimated annual savings
  - If no spousal RRSP account exists: "Add a Spousal RRSP to take advantage of the [X%] rate spread"
  - If spousal RRSP exists: shows actual savings, break-even years, attribution status
  - 3-year rule status indicator:
    - Green: "Safe to withdraw — last contribution was >3 years ago"
    - Yellow: "Attribution active — withdrawals until [year] will be taxed in [contributor]'s hands"
    - Red: "Not recommended — contributing and withdrawing in the same year negates the benefit"

**3. Projection Integration**
- On ProjectionsPage, spousal RRSP accounts appear as a distinct color in the DrawdownWaterfallChart (e.g., light blue vs. regular RRSP blue)
- Year-by-year table gains a "Spousal RRSP Withdrawal" column
- Attribution years are highlighted with a tooltip: "Income attributed to [contributor]"

**4. Insights Integration**
- InsightsCard on Dashboard shows: "You could save $X/year by contributing to a spousal RRSP" when applicable
- Links to the calculator card on AccountsPage

**Files to create:**
- `apps/web/src/components/SpousalRrspCalculator.tsx`

**Files to modify:**
- `apps/web/src/pages/AccountsPage.tsx` — add spousal RRSP toggle to account dialog, add calculator card
- `apps/web/src/pages/ProjectionsPage.tsx` — distinct color for spousal RRSP in drawdown chart
- `apps/web/src/components/charts/DrawdownWaterfallChart.tsx` — add spousal RRSP color band

---

## Implementation Phases

### Phase A — Foundation (Spousal RRSP Schema + Engine Refactor)

**Goal:** Lay the groundwork for all three features without breaking existing behavior.

| Step | Task | Files | Est. | Depends On |
|------|------|-------|------|-----------|
| A.1 | Prisma migration: add spousal RRSP fields to Account, inverse relations on HouseholdMember | `prisma/schema.prisma`, migration | — | — |
| A.2 | Spousal RRSP engine: `analyzeSpousalRrsp()` function + unit tests | `packages/finance-engine/src/optimization/spousal-rrsp.ts` | — | — |
| A.3 | Refactor withdrawal logic in `cash-flow.ts`: extract `applyWithdrawalStrategy()` function, add `withdrawalStrategy` to `CashFlowInput`, keep existing behavior as default | `packages/finance-engine/src/projection/cash-flow.ts`, `packages/shared/src/types/` | — | — |
| A.4 | Add shared types: `WithdrawalStrategy`, `AccountBucket`, `BucketConfig`, `SpousalRrspInput/Result` | `packages/shared/src/types/` | — | — |
| A.5 | Engine unit tests for all 5 withdrawal strategies | `packages/finance-engine/src/**/*.test.ts` | — | A.3 |

### Phase B — Withdrawal Order Optimizer (Engine + API + UI)

| Step | Task | Files | Depends On |
|------|------|-------|-----------|
| B.1 | Implement `compareWithdrawalStrategies()` in `withdrawal-optimizer.ts` | `packages/finance-engine/src/optimization/withdrawal-optimizer.ts` | A.3, A.4 |
| B.2 | API endpoint: `POST /optimization/withdrawal-comparison` | `apps/api/src/optimization/` | B.1 |
| B.3 | Frontend: `WithdrawalOptimizerCard` + `WithdrawalComparisonChart` | `apps/web/src/components/` | B.2 |
| B.4 | Add Withdrawal Strategy tab to ProjectionsPage | `apps/web/src/pages/ProjectionsPage.tsx` | B.3 |
| B.5 | Add strategy selector to ScenariosPage dialog | `apps/web/src/pages/ScenariosPage.tsx` | A.3 |
| B.6 | Add "Withdrawal Strategy Insight" rule to insights engine | `packages/finance-engine/src/insights/insights-engine.ts` | B.1 |
| B.7 | Engine + API + component unit/integration tests | Various `*.test.ts` | B.1–B.5 |

### Phase C — Spousal RRSP UI + Integration

| Step | Task | Files | Depends On |
|------|------|-------|-----------|
| C.1 | API: update accounts CRUD with spousal RRSP fields | `apps/api/src/accounts/` | A.1 |
| C.2 | API endpoint: `POST /optimization/spousal-rrsp` | `apps/api/src/optimization/` | A.2 |
| C.3 | Frontend: spousal RRSP toggle in account dialog | `apps/web/src/pages/AccountsPage.tsx` | A.1, C.1 |
| C.4 | Frontend: `SpousalRrspCalculator` card | `apps/web/src/components/SpousalRrspCalculator.tsx` | C.2 |
| C.5 | Modify cash-flow engine: spousal RRSP attribution in projection | `packages/finance-engine/src/projection/cash-flow.ts` | A.1, A.2 |
| C.6 | DrawdownWaterfallChart: spousal RRSP color | `apps/web/src/components/charts/DrawdownWaterfallChart.tsx` | C.5 |
| C.7 | Add "Spousal RRSP Opportunity" insight rule | `packages/finance-engine/src/insights/insights-engine.ts` | A.2 |
| C.8 | Unit + integration tests | Various | C.1–C.7 |

### Phase D — Bucket Strategy Modeller

| Step | Task | Files | Depends On |
|------|------|-------|-----------|
| D.1 | Implement `runBucketProjection()` and `compareBucketVsAllInOne()` | `packages/finance-engine/src/optimization/bucket-strategy.ts` | A.3 |
| D.2 | API endpoints: bucket strategy + comparison | `apps/api/src/optimization/` | D.1 |
| D.3 | Frontend: `BucketConfigPanel` + `BucketStrategyCard` + `BucketFlowChart` | `apps/web/src/components/` | D.2 |
| D.4 | Add Bucket Strategy tab to ProjectionsPage | `apps/web/src/pages/ProjectionsPage.tsx` | D.3 |
| D.5 | Add bucket config to ScenariosPage dialog | `apps/web/src/pages/ScenariosPage.tsx` | D.3 |
| D.6 | Monte Carlo comparison integration (bucket vs. all-in-one) | `packages/finance-engine/src/optimization/bucket-strategy.ts` | D.1 |
| D.7 | Unit + integration tests | Various | D.1–D.6 |

### Phase E — E2E Tests + Documentation + Polish

| Step | Task | Files | Depends On |
|------|------|-------|-----------|
| E.1 | E2E tests: withdrawal optimizer flow | `e2e/tests/withdrawal-optimizer.spec.ts` | B.4 |
| E.2 | E2E tests: spousal RRSP account creation + calculator | `e2e/tests/spousal-rrsp.spec.ts` | C.4 |
| E.3 | E2E tests: bucket strategy configuration + visualization | `e2e/tests/bucket-strategy.spec.ts` | D.4 |
| E.4 | Update existing e2e tests that rely on fixed withdrawal behavior | `e2e/tests/projections.spec.ts`, `e2e/tests/scenarios.spec.ts` | B.5, D.5 |
| E.5 | Documentation updates (see section below) | `docs/` | All |
| E.6 | Update seed data with spousal RRSP example | `prisma/seed-test-account.js` | A.1 |
| E.7 | Help page FAQ additions | `apps/web/src/pages/HelpPage.tsx` | All |

---

## Cross-Cutting Concerns

### Performance

- **Withdrawal comparison runs 5+ projections:** Each ~570 lines of engine code × (endAge - currentAge) years × 5 strategies. Use Web Worker (already available via `useProjectionWorker()`) to avoid blocking UI.
- **Bucket Monte Carlo:** Running 1000 trials × bucket projection is expensive. Cap at 500 trials for bucket comparison or run in background with progress indicator.
- **Caching:** Cache projection results by scenario hash. If scenario parameters haven't changed, serve cached strategies.

### Security

- All new API endpoints must enforce `userId` ownership check via the existing auth guard pattern: `where: { userId }` on all Prisma queries.
- Spousal RRSP `contributorId` and `annuitantId` must reference members within the same household — validate at API level.
- No new external API calls — all computation is internal.

### Accessibility

- Withdrawal comparison chart: include data table alternative for screen readers.
- Bucket visualization: use patterns (not just color) to distinguish buckets.
- 3-year attribution warning: use ARIA alert role for screen reader announcement.

### Testing Strategy

| Layer | Tool | What to Test |
|-------|------|-------------|
| Engine unit tests | Vitest | Each withdrawal strategy produces correct withdrawal amounts. Attribution rule correctly attributes income. Bucket refill logic works at boundary conditions. |
| API integration tests | Vitest + Supertest | New endpoints return correct shapes. Auth guard blocks unauthorized access. Spousal RRSP validation rejects cross-household member references. |
| Component tests | Vitest + Testing Library | Calculator card renders correct values. Strategy selector updates state. Chart renders correct number of bars. |
| E2E tests | Playwright | Full user flow: create spousal RRSP → run projection → switch strategy → verify chart updates. |

---

## Documentation & Guide Updates

### Existing Docs to Update

| Document | What to Add |
|----------|------------|
| `docs/guide-01-cash-flow-projection-engine.md` | New section: "Withdrawal Strategy Parameterization" — explain `withdrawalStrategy` field, how strategies are dispatched, the `applyWithdrawalStrategy()` function. |
| `docs/guide-02-canadian-tax-system.md` | New section: "Spousal RRSP Attribution Rule (s. 146(8.3))" — ITA reference, 3-year rule, RRIF exemption, worked example. |
| `docs/guide-03-accounts-and-registered-plans.md` | New section: "Spousal RRSP Accounts" — schema fields, contributor/annuitant relationship, how the engine handles attribution. |
| `docs/guide-04-scenarios-and-what-if.md` | Add withdrawal strategy and bucket config to scenario parameters reference. |
| `docs/guide-09-asset-allocation.md` | New section: "Bucket Strategy vs. Asset Allocation" — clarify that buckets are a spending-horizon overlay, not a replacement for asset allocation. |
| `docs/guide-11-rrsp-meltdown-and-drawdown.md` | Add withdrawal strategy comparison context. Link to RRSP-first strategy. Explain how meltdown interacts with withdrawal optimizer (meltdown is a pre-retirement strategy; withdrawal optimizer handles post-retirement). Add section on the unified sequencer (Area 6). |
| `docs/guide-14-frontend-patterns.md` | Document new components: `WithdrawalOptimizerCard`, `BucketStrategyCard`, `SpousalRrspCalculator`, `HelpDrawer`, `WithdrawalStrategyExplainer`, `WithdrawalStrategyQuiz`. Explain tab structure on ProjectionsPage. |
| `docs/guide-15-api-patterns.md` | Document new optimization endpoints: `/optimization/withdrawal-comparison`, `/optimization/bucket-strategy`, `/optimization/bucket-comparison`, `/optimization/spousal-rrsp`, `/optimization/pension-split`, `/optimization/withdrawal-sequencer`. |
| `docs/05-canadian-financial-reference.md` | Add spousal RRSP attribution rule details, bucket strategy references, withdrawal sequencing research citations. Add LIF min/max rate tables by province. Add pension splitting eligibility rules (ITA s. 60.03). |
| `docs/ROADMAP-proposed-enhancements.md` | Mark 5.1, 5.2, 2.4 as SHIPPED with implementation dates. Mark 2.3 as IN PROGRESS (Area 3). |
| `docs/USER-GUIDE-retirement-planning.md` | Add user-facing guidance: when to use each withdrawal strategy, how to set up a spousal RRSP, understanding the bucket view, pension income splitting eligibility. |

### New Docs to Create

| Document | Content |
|----------|---------|
| `docs/guide-16-withdrawal-strategies.md` | Standalone guide covering all 5 withdrawal strategies, comparison methodology, how the optimizer recommends, worked examples with real numbers. The unified meltdown sequencer. Guardrails integration. |
| `docs/guide-17-advanced-accounts.md` | LIRA/LIF rules by province (min/max tables), ACB tracking for non-registered accounts, brokerage holdings sync, tax-loss harvesting eligibility and superficial loss rules. |

### Help Page (In-App)

Add FAQ entries to `HelpPage.tsx`:

1. **"What withdrawal strategy should I use?"** — Decision tree: high RRSP → consider RRSP-first; estate priority → estate maximizer; unsure → run the optimizer.
2. **"What is a bucket strategy?"** — Plain explanation of Evensky model + how to set it up in the app.
3. **"What is a spousal RRSP?"** — Who benefits, the 3-year rule, how to add one.
4. **"How does the 3-year attribution rule work?"** — Example with dates showing safe vs. unsafe withdrawal timing.

---

## E2E Test Plan

### New Test Files

#### `e2e/tests/withdrawal-optimizer.spec.ts`

| Test Case | Steps | Assertions |
|-----------|-------|-----------|
| Displays withdrawal comparison tab | Navigate to Projections → Withdrawal Strategy tab | Tab exists, comparison table visible |
| Shows all 5 strategies | Load comparison | 5 rows in comparison table with strategy names |
| Highlights recommended strategy | Load comparison | One row has "Recommended" badge |
| Strategy selection updates chart | Click a non-default strategy row | Drawdown chart re-renders with new withdrawal pattern |
| Custom strategy allows drag-and-drop | Select "Custom" → drag TFSA to top | Custom order reflected in comparison result |

#### `e2e/tests/spousal-rrsp.spec.ts`

| Test Case | Steps | Assertions |
|-----------|-------|-----------|
| Spousal RRSP toggle appears for multi-member household | Open account dialog, select RRSP | "Spousal RRSP" toggle visible |
| Toggle hidden for single-member household | (need single-member fixture) | Toggle not rendered |
| Contributor/Annuitant dropdowns populate from members | Toggle on spousal RRSP | Both dropdowns show David Smith and Sarah Smith |
| Calculator card shows tax savings | Navigate to Accounts, view calculator | Shows marginal rates, spread, estimated savings |
| Attribution warning displays | Set last contribution date to current year | Yellow/red warning visible with attribution explanation |
| Projection includes spousal RRSP color | Create spousal RRSP → run projection → Drawdown tab | Distinct color band for spousal RRSP visible |

#### `e2e/tests/bucket-strategy.spec.ts`

| Test Case | Steps | Assertions |
|-----------|-------|-----------|
| Bucket strategy tab renders | Navigate to Projections → Bucket Strategy tab | Tab exists, bucket visualization visible |
| Preset selection works | Select "Conservative" preset | Cash reserve years updates to 3 |
| Custom bucket config | Adjust slider to 4 years cash reserve | Bucket 1 balance updates in visualization |
| Bucket refill events shown | Scroll timeline | At least one refill event arrow visible |
| Monte Carlo comparison shown | View comparison badge | "Bucket: X% | All-in-one: Y%" text visible |

### Existing Test Updates

| Test File | Change Needed | Reason |
|-----------|--------------|--------|
| `e2e/tests/projections.spec.ts` | Add assertion for new tabs (Withdrawal Strategy, Bucket Strategy) | New tabs added to ProjectionsPage |
| `e2e/tests/scenarios.spec.ts` | Add assertion for withdrawal strategy dropdown in scenario dialog | New field in scenario editing |
| `e2e/tests/accounts.spec.ts` | Add test for spousal RRSP account creation flow | New account subtype |
| `e2e/tests/simulations.spec.ts` | No change expected | Bucket comparison is on Projections, not Simulations |

### Seed Data Updates (`prisma/seed-test-account.js`)

Add to the existing Smith Family test fixture:
- A spousal RRSP account: "Sarah's Spousal RRSP" (contributor: David, annuitant: Sarah, balance: $85,000, last contribution: 2024-03-15) — ensures 3-year rule warning is testable
- A LIRA account: "David's LIRA" (balance: $120,000) — ensures LIF conversion at 71 is testable and DrawdownWaterfallChart renders correctly
- Non-reg account gains cost basis field: set `costBasis: 95000` on existing "Joint Non-Registered" ($180K balance) — ensures capital gains ACB tracking is demonstrable

### New Test Files for Improvement Areas

#### `e2e/tests/per-member-projection.spec.ts` (Area 1)

| Test Case | Assertion |
|-----------|----------|
| Year-by-Year table shows per-member breakdown | Two rows per year (David / Sarah) expandable under combined row |
| Different province tax rates applied | David (ON) tax ≠ Sarah (BC) tax for equal income |
| Different retirement ages respected | Employment income for David stops at 60, Sarah at 62 |

#### `e2e/tests/acb-tracking.spec.ts` (Area 2)

| Test Case | Assertion |
|-----------|----------|
| Non-reg unrealized gain shown in Year-by-Year | "Unrealized Gain" column visible with non-zero values |
| ACB reduces on withdrawal | Year after partial non-reg withdrawal shows reduced ACB |

#### `e2e/tests/pension-splitting.spec.ts` (Area 3)

| Test Case | Assertion |
|-----------|----------|
| Enable pension splitting in scenario | Toggle in scenario dialog enables and saves |
| Year-by-Year shows pension split column | "Pension Split" column visible when enabled |
| Total household tax lower with splitting | Compare scenario with/without — total tax row decreases |

#### `e2e/tests/lira-lif.spec.ts` (Area 4)

| Test Case | Assertion |
|-----------|----------|
| LIRA shows no withdrawals before age 71 | Drawdown chart: LIF band starts at age 71 |
| LIF minimum withdrawal applied | Year-by-year row at age 72 shows non-zero LIF withdrawal |

#### `e2e/tests/flex-guardrails.spec.ts` (Area 5)

| Test Case | Assertion |
|-----------|----------|
| Enable flex spending in scenario | Floor/ceiling sliders visible and save |
| Guardrail chip appears in Year-by-Year | "↓ Spending cut" chip visible in a stressed scenario |

#### `e2e/tests/withdrawal-sequencer.spec.ts` (Area 6)

| Test Case | Assertion |
|-----------|----------|
| Full Strategy tab renders | Phase 1 meltdown bar visible with age range |
| Unified chart spans pre- and post-retirement | Chart x-axis shows continuous age range from currentAge to endAge |

---

## Areas for Improvement

These eight areas were identified during research and planning for the three primary features. Each carries a full implementation plan: problem statement, user stories, technical design, files to change, test requirements, and documentation requirements.

**Impact / Effort legend:** H = High, M = Medium, L = Low, S = Small

| # | Area | Impact | Effort | Depends On |
|---|------|--------|--------|-----------|
| 1 | Per-Member Projection Engine | H | H | — (foundational) |
| 2 | Capital Gains ACB Tracking | M | S | — |
| 3 | Pension Income Splitting | H | M | Area 1 |
| 4 | LIRA/LIF Account Constraints | M | M | — |
| 5 | Flexible Spending Guardrails | M | S | — |
| 6 | Meltdown + Withdrawal Optimizer Unified Timeline | H | M | Phases A–B |
| 7 | Tax-Loss Harvesting for Non-Reg | L | H | — |
| 8 | Help Page & Onboarding | H | M | Phases A–E |

---

### Area 1 — Per-Member Projection Engine

**Impact: H | Effort: H | Priority: Foundational for Areas 3 and correct spousal RRSP attribution**

#### Problem Statement

`CashFlowInput` models a single person (one age, one province, one income, one set of balances). For a two-member household, the API currently aggregates all balances and uses the primary member's age and province. This means:

- David's RRSP and Sarah's RRSP are pooled into one `rrspBalance` — the engine can't decide *whose* RRSP to draw first based on each person's marginal rate.
- Tax is computed once for a single income level — not separately for two people with different tax brackets.
- OAS clawback and CPP benefits use only one member's ages and eligibility dates.
- Spousal RRSP attribution (3-year rule) can't be applied without knowing which spouse owns which account balance.

#### User Stories

| # | Story | Acceptance Criteria |
|---|-------|-------------------|
| PM-1 | As a couple, I want projections to treat each spouse's income and tax separately. | Year-by-year table shows per-member tax breakdowns and a combined household total. |
| PM-2 | As a couple, I want the engine to apply each spouse's correct provincial tax rate. | David in ON and Sarah in BC (e.g., if ever relocated) compute tax independently. |
| PM-3 | As a couple with different retirement ages, I want the projection to use the correct retirement age for each. | David retiring at 60 stops earning employment income at 60; Sarah at 62. Income and tax reflect this. |
| PM-4 | As a couple, I want OAS and CPP to start at each spouse's chosen age, not a shared age. | David's OAS starts at 70, Sarah's at 65 — both modelled independently in same projection. |

#### Technical Design

**New types (in `packages/shared/src/types/`):**

```typescript
interface HouseholdMemberInput {
  memberId: string;
  currentAge: number;
  retirementAge: number;
  province: Province;
  employmentIncome: number;
  cppStartAge: number;
  oasStartAge: number;
  cppBenefitFraction?: number;
  oasResidencyYears?: number;
  rrspBalance: number;
  tfsaBalance: number;
  incomeSources?: IncomeSourceEntry[];
}

interface HouseholdProjectionInput extends Omit<CashFlowInput,
  'currentAge' | 'province' | 'employmentIncome' | 'retirementAge' |
  'cppStartAge' | 'oasStartAge' | 'rrspBalance' | 'tfsaBalance'
> {
  members: HouseholdMemberInput[];    // 1 or 2 members
  // Shared household fields:
  nonRegBalance: number;              // joint non-reg
  cashBalance?: number;               // joint cash/HISA
  annualExpenses: number;             // household expenses
}

interface HouseholdProjectionYear extends ProjectionYear {
  memberBreakdowns: Array<{
    memberId: string;
    grossIncome: number;
    federalTax: number;
    provincialTax: number;
    cppIncome: number;
    oasIncome: number;
    rrspWithdrawal: number;
    tfsaWithdrawal: number;
    rrspBalance: number;
    tfsaBalance: number;
  }>;
}
```

**New file: `packages/finance-engine/src/projection/household-projection.ts`**

```typescript
export function runHouseholdProjection(
  input: HouseholdProjectionInput,
): HouseholdProjectionYear[] {
  // Strategy: wrapper that runs per-member CashFlowProjection then stitches
  // 1. For each year from min(member ages) to input.endAge:
  //    a. For each member: compute employment income (stopped if age > retirementAge),
  //       CPP/OAS based on their own start ages, RRSP growth and RRIF minimums
  //    b. Compute per-member tax using calculateTotalTax(income, member.province)
  //    c. Sum household total income, tax, expenses
  //    d. Apply household-level withdrawal strategy across shared non-reg + each member's RRSP/TFSA
  //    e. Combine into HouseholdProjectionYear
}
```

**Design decision — wrapper vs. refactor:**
Implement as a *new wrapper function* `runHouseholdProjection()` that calls the existing `runCashFlowProjection()` once per member for pre-retirement accumulation, then merges into a unified decumulation phase. This preserves backward compatibility: all existing single-member callers continue using `runCashFlowProjection()` unchanged.

**API changes:**
- `apps/api/src/projections/projections.service.ts` — add `runHouseholdProjection()` path when `household.members.length > 1`
- `apps/api/src/projections/projections.controller.ts` — response type includes per-member breakdowns

**Files to create:**
- `packages/finance-engine/src/projection/household-projection.ts`

**Files to modify:**
- `packages/shared/src/types/` — new types
- `packages/finance-engine/src/index.ts` — export household-projection
- `apps/api/src/projections/projections.service.ts` — route multi-member households to new function
- `apps/web/src/pages/ProjectionsPage.tsx` — render per-member breakdown in Year-by-Year table (collapsible rows)

#### Testing

- **Engine unit tests:** Two members retire at different ages; verify employment income stops at correct ages.
- **Engine unit tests:** Two members in different provinces; verify correct provincial tax for each.
- **Engine unit tests:** RRIF mandatory minimum applied to correct member's RRSP at age 71.
- **E2E test:** Smith Family (David + Sarah) projection shows per-member income breakdown columns.

---

### Area 2 — Capital Gains ACB Tracking

**Impact: M | Effort: S | Priority: Improves withdrawal optimizer accuracy for Non-Reg-First strategy**

#### Problem Statement

The current engine tracks `nonRegBalance` (current market value) but has no `nonRegACB` (adjusted cost base). When the engine draws from non-reg accounts, it implicitly applies `nonRegTaxDragRate` — an annual haircut on growth — but doesn't model the capital gain realized on a *withdrawal*.

This matters most for the "Non-Reg First" and "Capital Gains First" withdrawal strategies. A $400K non-reg account purchased for $200K has $200K in unrealized gains. Selling it all in year 1 of retirement crystallizes a $100K taxable capital gain (50% inclusion rate) — a very different tax outcome than the current model assumes.

The estate module (`estate.ts`) already accepts a `nonRegACB` field as a static input — it does not receive a dynamically projected ACB from the cash-flow engine. This plan closes that gap.

#### Technical Design

**Modify `CashFlowInput` (add one field):**

```typescript
nonRegACB?: number;   // adjusted cost base at projection start
                      // if omitted, defaults to nonRegBalance (no gain/loss assumed)
```

**Modify `ProjectionYear` output (add two diagnostic fields):**

```typescript
nonRegACB?: number;              // running ACB at year-end
nonRegUnrealizedGain?: number;   // nonRegBalance - nonRegACB (informational)
```

**Modify the projection loop in `cash-flow.ts`:**

Three insertion points:

```typescript
// A. Initialization (before loop):
let acb = input.nonRegACB ?? input.nonRegBalance;

// B. Annual growth (where nonReg grows each year):
// Growth increases the balance but NOT the ACB (unrealized gain accumulates)
nonReg *= (1 + returnRate);
// acb stays unchanged — unrealized gain widens

// C. Withdrawal (where nonRegWithdrawal is computed):
// When selling, proportionally reduce ACB:
const acbRatio = acb / nonReg;                          // cost basis %
const acbReduced = nonRegWithdrawal * acbRatio;         // ACB portion of sale
const capitalGain = nonRegWithdrawal - acbReduced;      // gain realized
const taxableGain = capitalGain * 0.5;                  // 50% inclusion rate
// Add taxableGain to taxable income this year (in addition to forced RRIF, etc.)
acb -= acbReduced;
nonReg -= nonRegWithdrawal;
```

**Net effect:** The engine now correctly models capital gains tax on non-reg withdrawals. The `nonRegTaxDragRate` parameter (annual tax on investment income: dividends, interest) remains unchanged and is additive — it models income earned within the account. ACB tracks the *cost of the underlying assets*, not the income.

**Files to modify:**
- `packages/finance-engine/src/projection/cash-flow.ts` — add ACB tracking (3 insertion points)
- `packages/shared/src/types/` — add `nonRegACB` to `CashFlowInput`, add `nonRegACB` and `nonRegUnrealizedGain` to `ProjectionYear`
- `apps/api/src/projections/projections.service.ts` — populate `nonRegACB` from account data (can be stored as optional field on Account or derived from user-entered cost basis)
- `apps/api/src/accounts/accounts.service.ts` — add `costBasis?: number` field to Account model; map to `nonRegACB` in engine input
- `prisma/schema.prisma` — add `costBasis Float?` to Account model

**Estate calculation improvement:**
The final `nonRegACB` from the last ProjectionYear is automatically available for the estate calculation. Pass it through `ProjectionYear.nonRegACB` to the estate endpoint instead of requiring a static input.

#### Testing

- **Engine unit test:** Non-reg starts at $500K balance, $200K ACB. Withdraw $100K in year 1. Verify: ACB reduces by $40K (200/500 × 100), capital gain = $60K, taxable = $30K appears in taxable income.
- **Engine unit test:** Both ACB and balance should reach zero simultaneously when fully depleted.
- **Unit test:** ACB defaults to balance when `nonRegACB` is not provided (no gain assumed — safe default).

---

### Area 3 — Pension Income Splitting (Theme 2.3)

**Impact: H | Effort: M | Priority: High (large tax savings for many couples) | Depends On: Area 1**

#### Problem Statement

Canadian tax law (ITA s. 60.03) allows a pensioner to allocate up to 50% of eligible pension income to their spouse for tax purposes. Eligible income includes RRIF withdrawals (any age), annuity payments, LIF income, and registered pension plan (RPP) income. CPP and OAS are **not** eligible for splitting (they have their own splitting mechanism via CPP sharing).

Without splitting, a couple where one person has $120K/yr RRIF income and the other has $40K/yr pays significantly more household tax than if the RRIF income were split 50/50. The optimal split fraction minimizes combined household tax given both spouses' income levels and marginal rates.

This feature is the roadmap's Theme 2.3 (Impact H, Effort M) and is enabled by the per-member engine from Area 1.

#### User Stories

| # | Story | Acceptance Criteria |
|---|-------|-------------------|
| PS-1 | As a couple with income disparity, I want to see how much pension splitting saves in combined household taxes. | Calculator shows before/after combined tax with optimal and user-set split fractions. |
| PS-2 | As a planner, I want to enable pension income splitting within each scenario. | Scenario dialog has toggle "Enable pension income splitting" and optional fraction input (0–50%). |
| PS-3 | As a planner, I want the projection to apply the optimal split automatically. | When fraction is "auto", engine iterates split fractions and picks the one that minimizes `household.totalTax`. |
| PS-4 | As a planner, I want a year-by-year table showing how much income is split each year and the resulting savings. | Year-by-Year tab shows "Pension Split Amount" column alongside income sources. |

#### Eligible Income Rules

Per CRA documentation:

| Income Type | Eligible for Splitting | Age Condition |
|------------|----------------------|--------------|
| RRIF withdrawals | Yes, up to 50% | Any age |
| Registered pension plan (DB) | Yes, up to 50% | Any age |
| LIF withdrawals | Yes, up to 50% | Any age |
| Annuity payments from RRSP | Yes, up to 50% | Age 65+ |
| CPP | No (separate sharing rules) | N/A |
| OAS | No | N/A |
| RRSP withdrawals | No (only annuities post-65) | N/A |
| Employment income | No | N/A |
| Rental income | No | N/A |

#### Technical Design

**Modify `ScenarioParameters` (in `packages/shared/src/schemas/scenario.ts`):**

```typescript
pensionSplittingEnabled?: boolean;           // default false
pensionSplitFraction?: number;               // 0.0–0.50; 'null' = auto-optimize
```

**New function in `packages/finance-engine/src/tax/canadian-tax.ts`:**

```typescript
export function calculateHouseholdTaxWithSplitting(params: {
  member1TaxableIncome: number;
  member1Province: Province;
  member2TaxableIncome: number;
  member2Province: Province;
  splittableIncome: number;       // e.g. RRIF withdrawal amount
  splitFraction: number;          // 0.0–0.50 (from member1 to member2)
}): {
  member1Tax: number;
  member2Tax: number;
  totalTax: number;
  totalTaxNoSplit: number;
  annualSavings: number;
  effectiveSplitAmount: number;
}

export function findOptimalSplitFraction(params: {
  member1TaxableIncome: number;
  member1Province: Province;
  member2TaxableIncome: number;
  member2Province: Province;
  splittableIncome: number;
}): number   // the fraction (0–0.50) that minimizes totalTax
```

The `findOptimalSplitFraction` function is a simple 1D search: iterate from 0.0 to 0.50 in 0.01 steps, call `calculateHouseholdTaxWithSplitting` for each, return the fraction with the lowest `totalTax`. (50 iterations × single tax calc = negligible overhead.)

**Modify `HouseholdProjectionInput` (from Area 1):**

```typescript
// Add to HouseholdProjectionInput:
pensionSplittingEnabled?: boolean;
pensionSplitFraction?: number | 'auto';
```

**Modify `household-projection.ts` loop:**

Each year, after computing per-member income:
1. Identify eligible splittable income for each member (RRIF withdrawals, pension, LIF)
2. If `pensionSplittingEnabled`, call `findOptimalSplitFraction` (or use fixed `pensionSplitFraction`)
3. Adjust each member's taxable income and recompute per-member tax
4. Record `pensionSplitAmount` in `HouseholdProjectionYear`

**New API endpoint:**
- `POST /optimization/pension-split` — accepts both members' inputs, returns year-by-year split amounts and savings

**Modify `ScenarioParameters` in `scenarios.service.ts`:**
Add `pensionSplittingEnabled` and `pensionSplitFraction` to scenario JSON parsing and defaults.

**Frontend changes:**
- ScenariosPage dialog: new "Income Splitting" section in Basics or Timeline tab — toggle + fraction input (with "Auto" option)
- ProjectionsPage Year-by-Year tab: add "Pension Split" column when enabled
- InsightsCard: new insight rule "You could save $X/year with pension income splitting" (already seeded in insights-engine.ts as a stub — needs to call actual tax math)

**Files to create:**
- None (all changes go into existing modules)

**Files to modify:**
- `packages/finance-engine/src/tax/canadian-tax.ts` — add two new functions
- `packages/finance-engine/src/projection/household-projection.ts` — integrate splitting per year
- `packages/shared/src/schemas/scenario.ts` — add two fields
- `packages/shared/src/types/` — add `pensionSplitAmount` to `HouseholdProjectionYear`
- `apps/api/src/projections/projections.service.ts` — pass splitting params to engine
- `apps/api/src/optimization/optimization.controller.ts` — new endpoint
- `apps/web/src/pages/ScenariosPage.tsx` — splitting UI in dialog
- `apps/web/src/pages/ProjectionsPage.tsx` — Year-by-Year column
- `packages/finance-engine/src/insights/insights-engine.ts` — upgrade existing pension splitting stub to call real tax math

#### Testing

- **Unit test:** Member1 $120K income ON + Member2 $20K income ON. Splitting $30K RRIF income at 25% → member2 receives $30K additional income. Verify total household tax < no-split case.
- **Unit test:** `findOptimalSplitFraction` — verify it returns 50% when member2 income is near zero and 0% when both members have equal income.
- **Unit test:** When member2 income is high enough that any split increases total tax, function returns 0%.
- **E2E test:** Enable pension splitting in scenario, run projection, verify Pension Split column appears in Year-by-Year table.

---

### Area 4 — LIRA/LIF Account Constraints

**Impact: M | Effort: M | Priority: Medium — correctness issue for users with locked-in accounts**

#### Problem Statement

LIRA (Locked-In Retirement Account) and LIF (Life Income Fund) accounts exist in the Prisma `Account` model's type list but are treated identically to RRSP by the engine. This is incorrect:

- **LIRA:** Funds are locked-in (from a former employer pension). Cannot be withdrawn at all until converted to a LIF (or certain unlocking provisions). Must convert to LIF by the end of the year the holder turns 71.
- **LIF:** Like a RRIF (mandatory minimum withdrawals), but also has a **provincial maximum withdrawal limit** — the holder cannot take more than the LIF maximum rate per year without special transfers (PRIF in SK/MB, or unlocking provisions).

For users with a $400K LIRA, the current engine treats it as a freely drawable account — allowing unlimited withdrawals before age 71, which is incorrect and could mislead the withdrawal optimizer significantly.

#### LIF Minimum/Maximum Rates

The minimum rates mirror RRIF rates (identical CRA table). The **maximum** rates are provincially set and increase with age. Example (Ontario, 2024):

| Age | LIF Min Rate | LIF Max Rate |
|-----|------------|------------|
| 71 | 5.28% | 6.40% |
| 75 | 5.82% | 8.51% |
| 80 | 6.82% | 10.99% |
| 85 | 8.51% | 14.21% |
| 90 | 11.92% | 18.79% |
| 95+ | 20.00% | 20.00% |

BC, AB, MB, and QC have similar but distinct tables. QC allows slightly higher maximums at younger ages.

#### Technical Design

**New constants (in `packages/shared/src/constants/canada.ts`):**

```typescript
// LIF minimum rates — identical to RRIF minimum rates
export const LIF_MIN_RATES: Record<number, number> = {
  // same as RRIF_MINIMUM_WITHDRAWAL — share the table, don't duplicate
};

// LIF maximum rates — provincially set (by age, representative values)
export const LIF_MAX_RATES_ON: Record<number, number> = { 71: 0.0640, 72: 0.0660, ... 95: 0.20 };
export const LIF_MAX_RATES_BC: Record<number, number> = { 71: 0.0640, 72: 0.0660, ... 95: 0.20 };
export const LIF_MAX_RATES_AB: Record<number, number> = { 71: 0.0640, 72: 0.0660, ... 95: 0.20 };
export const LIF_MAX_RATES_QC: Record<number, number> = { 71: 0.0664, 72: 0.0685, ... 95: 0.20 };
// ... other provinces

export const LIF_MAX_RATES_BY_PROVINCE: Record<Province, Record<number, number>> = {
  ON: LIF_MAX_RATES_ON,
  BC: LIF_MAX_RATES_BC,
  AB: LIF_MAX_RATES_AB,
  QC: LIF_MAX_RATES_QC,
  // MB, SK (PRIF — no maximum), NB, NS, NL, PE, NT, NU, YT
};

export function getLIFMaxRate(age: number, province: Province): number;
export function getLIFMinRate(age: number): number; // delegates to RRIF table
```

**Modify `CashFlowInput` (add separate LIRA/LIF tracking):**

```typescript
liraBalance?: number;   // locked-in balance (cannot be withdrawn until age 71 → LIF)
lifBalance?: number;    // already converted LIF balance
lifConversionAge?: number; // default 71 (same as RRIF)
```

**Modify the projection loop in `cash-flow.ts`:**

```typescript
// Each year:
// 1. LIRA accumulates at portfolio return rate — NO withdrawals allowed
if (age < (input.lifConversionAge ?? 71)) {
  lira *= (1 + returnRate); // grow but cannot withdraw
} else {
  // Auto-convert LIRA → LIF at conversion age
  lif += lira;
  lira = 0;
}

// 2. LIF: apply mandatory minimum AND maximum constraints
if (lif > 0 && age >= (input.lifConversionAge ?? 71)) {
  const lifMinWithdrawal = lif * getLIFMinRate(age);
  const lifMaxWithdrawal = lif * getLIFMaxRate(age, input.province);
  // The withdrawal optimizer can request any amount within [min, max]
  // If shortfall exists, take up to max; if no shortfall, take minimum only
  const lifWithdrawal = Math.max(lifMinWithdrawal, Math.min(lifMaxWithdrawal, requestedLIF));
}
```

**Modify `applyWithdrawalStrategy()` function (from Phase A):**

Add `LIF` as a valid `AccountBucket` type with the constraint that it can only be drawn within `[min, max]` per year. The withdrawal optimizer treats LIF as a bounded slot — it's always included in whatever strategy order, but constrained.

**Prisma schema:**

No migration required — the `type` field already accepts 'LIRA' and 'LIF'. However, add semantic guidance:
- When `type = 'LIRA'` and `age < 71`: projections service sets `liraBalance = account.balance`
- When `type = 'LIF'` or (`type = 'LIRA'` and `age >= 71`): projections service sets `lifBalance = account.balance`

**Frontend changes:**
- AccountsPage: when account type is LIF, show readonly info banner: "LIF accounts have both minimum and maximum annual withdrawal limits set by your province. The projection engine enforces these automatically."
- DrawdownWaterfallChart: add LIF as a distinct color band (e.g., dark blue, distinct from RRSP light blue)

**Files to modify:**
- `packages/shared/src/constants/canada.ts` — LIF min/max rate tables and helper functions
- `packages/finance-engine/src/projection/cash-flow.ts` — LIRA/LIF account logic in loop
- `packages/shared/src/types/` — add `liraBalance`, `lifBalance`, `lifConversionAge` to `CashFlowInput`
- `apps/api/src/projections/projections.service.ts` — map LIRA/LIF accounts by type to new fields
- `apps/web/src/components/charts/DrawdownWaterfallChart.tsx` — add LIF color band

#### Unlocking Provisions (Future Enhancement, Not in Scope)

Each province allows certain one-time unlocking events for LIRA/LIF funds (small accounts, financial hardship, shortened life expectancy, non-resident departure). These are out of scope for this plan but should be noted as milestone event inputs.

#### Testing

- **Unit test:** LIRA balance grows at portfolio return rate from current age to 71. No withdrawal occurs before 71.
- **Unit test:** At age 71, LIRA auto-converts to LIF. LIF minimum withdrawal applies.
- **Unit test:** LIF withdrawal request above `lifMaxWithdrawal` is capped at maximum, not silently allowed.
- **Unit test:** LIF maximum rate varies by province — verify QC rate differs from ON rate for same age.
- **E2E test:** Add LIRA account → run projection → Drawdown chart shows LIF band starting at age 71.

---

### Area 5 — Flexible Spending Guardrails in the Withdrawal Optimizer

**Impact: M | Effort: S | Priority: Medium — fields already exist; this is a wiring + UI task**

#### Problem Statement

`ScenarioParameters` already carries `flexSpendingEnabled`, `flexSpendingFloor`, and `flexSpendingCeiling`, and the schema correctly validates them (`z.boolean().default(false)`, `z.number().min(0).optional()`). However:

1. The main projection engine (`cash-flow.ts`) does **not** read these fields — it always uses fixed `annualExpenses`. They are declared but have no effect.
2. `ScenariosPage.tsx` renders sliders for `flexFloor` and `flexCeiling` but they are not mapped to the correct field names in the scenario parameters schema.
3. The Guyton-Klinger engine (`simulation/guyton-klinger.ts`) implements adaptive withdrawal well but runs independently on the Simulations page — it does not feed back into the main year-by-year projection used on the Projections page.

The result: users see guardrail options but enabling them does nothing to their projection numbers.

#### Technical Design

**Fix 1 — Wire `flexSpending` into `cash-flow.ts`:**

Locate the `expenses` calculation in the projection loop (where `annualExpenses` or `expenseEntries` are summed each year) and add:

```typescript
let targetExpenses = computeExpenses(age, input); // existing logic

if (input.flexSpendingEnabled && input.flexSpendingFloor != null && input.flexSpendingCeiling != null) {
  // Portfolio withdrawal rate guardrail:
  const withdrawalRate = totalWithdrawalsNeeded / totalPortfolio;
  
  if (withdrawalRate > (input.flexSpendingCeiling / 100)) {
    // Portfolio over-stressed — cut spending to floor
    targetExpenses = Math.max(input.flexSpendingFloor, targetExpenses * 0.90);
  } else if (withdrawalRate < (input.flexSpendingCeiling * 0.5 / 100)) {
    // Portfolio healthy — allow up to ceiling
    targetExpenses = Math.min(input.flexSpendingCeiling, targetExpenses * 1.10);
  }
}
```

**Fix 2 — Field name alignment in ScenariosPage.tsx:**

The UI uses `flexFloor` and `flexCeiling` but the schema defines `flexSpendingFloor` and `flexSpendingCeiling`. Ensure the scenario save/load correctly maps these names. Also ensure `flexSpendingEnabled` is persisted when the user toggles the switch.

**Fix 3 — Guardrail visualization in ProjectionsPage:**

Add a new diagnostic field to `ProjectionYear`:

```typescript
guardrailAction?: 'none' | 'cut' | 'increase';  // what guardrail triggered this year
adjustedExpenses?: number;                         // actual expenses after guardrail
```

In the Year-by-Year table, rows where `guardrailAction !== 'none'` get a colored chip: "↓ Spending cut" (orange) or "↑ Spending increased" (green).

**Fix 4 — Withdrawal Optimizer integration:**

When `compareWithdrawalStrategies()` runs all 5 strategies, also run each strategy with `flexSpendingEnabled = true` (using the scenario's floor/ceiling) and surface the success rate delta: "OAS-Optimized + Guardrails: 96% success (vs. 84% without guardrails)."

**Files to modify:**
- `packages/finance-engine/src/projection/cash-flow.ts` — add guardrail logic (small, ~25 lines)
- `packages/shared/src/types/` — add `guardrailAction` and `adjustedExpenses` to `ProjectionYear`
- `apps/web/src/pages/ScenariosPage.tsx` — fix field name mapping (`flexFloor` → `flexSpendingFloor`)
- `apps/web/src/pages/ProjectionsPage.tsx` — render guardrail action chips in Year-by-Year table
- `packages/finance-engine/src/optimization/withdrawal-optimizer.ts` — run with/without guardrails comparison

#### Testing

- **Unit test:** With `flexSpendingEnabled: true`, floor $50K, ceiling $80K — when portfolio withdrawal rate exceeds ceiling threshold, expenses are reduced.
- **Unit test:** Guardrail cuts do not push expenses below `flexSpendingFloor`.
- **Unit test:** Without `flexSpendingEnabled`, expenses remain fixed regardless of portfolio state (regression test for existing behavior).
- **E2E test:** Enable flex spending in scenario → run projection → Year-by-Year table shows guardrail chips in at least one year for a stressed scenario.

---

### Area 6 — Withdrawal Optimizer + RRSP Meltdown Unified Timeline

**Impact: H | Effort: M | Priority: High — eliminates a major gap between the two standalone tools**

#### Problem Statement

The RRSP meltdown optimizer (`optimization/rrsp-meltdown.ts`) and the withdrawal order optimizer (planned in Phase B) are designed to solve complementary problems:

- **Meltdown** (pre-retirement, ages current → 71): draw RRSP down voluntarily to fill low tax brackets before RRIF minimums force large mandatory withdrawals.
- **Withdrawal optimizer** (post-retirement): sequence withdrawals across RRSP/RRIF, TFSA, non-reg, and cash to minimize lifetime taxes.

Today, a user who runs the meltdown tool sees a separate result card on the Simulations page — the numbers don't flow into the main projection. A user who switches to the Projections page sees a projection that ignores the meltdown schedule entirely. There is no unified plan.

The optimal Canadian decumulation strategy is typically: **meltdown RRSP in bracket-leveling amounts from retirement to age 71 → then use OAS-optimized or RRSP-first withdrawal for RRIF income**.

#### Technical Design

**New file: `packages/finance-engine/src/optimization/withdrawal-sequencer.ts`**

```typescript
interface WithdrawalSequencerInput extends CashFlowInput {
  // Pre-retirement RRSP meltdown phase
  enableMeltdown?: boolean;           // default true when RRSP > 2x income
  meltdownTargetIncome?: number;      // fill income to this amount (default: OAS threshold × 0.98)

  // Post-retirement strategy
  postRetirementStrategy?: WithdrawalStrategyId;
}

interface WithdrawalSequencerResult {
  projectionYears: ProjectionYear[];        // unified year-by-year, including meltdown years
  meltdownPhase: {
    startAge: number;
    endAge: number;           // always rrifConversionAge - 1
    annualWithdrawal: number;
    totalTaxSaved: number;
    taxSavedVsNoMeltdown: number;
  } | null;
  postRetirementStrategy: WithdrawalStrategyId;
  lifetimeTax: number;
  lifetimeTaxNoOptimization: number;   // baseline comparison
  netSavings: number;
}

export function runWithdrawalSequencer(
  input: WithdrawalSequencerInput,
): WithdrawalSequencerResult {
  // Phase 1: Pre-retirement meltdown
  //   - For ages currentAge → min(retirementAge, rrifConversionAge - 1):
  //     use meltdown.ts logic to determine voluntary RRSP withdrawal each year
  //     inject these as income into the year-by-year projection
  //   - Carry forward the final RRSP balance entering the post-retirement phase
  //
  // Phase 2: Post-retirement (retirement age → endAge)
  //   - Use applyWithdrawalStrategy() with the selected postRetirementStrategy
  //   - Begin with RRSP balance reduced by meltdown withdrawals
  //
  // Phase 3: Measure
  //   - Sum all federal + provincial tax across both phases
  //   - Compare to baseline (no meltdown, default oas-optimized strategy)
}
```

**Modify `rrsp-meltdown.ts`:**

Add `spouseIncome?: number` parameter to `MeltdownInput` so the target band can account for household income (currently it only takes `otherAnnualIncome` for one person). Also make the `targetIncome` formula customizable.

**New API endpoint:**
- `POST /optimization/withdrawal-sequencer` — accepts `WithdrawalSequencerInput`, returns `WithdrawalSequencerResult` with unified projection

**Frontend changes:**
- Add a new **"Full Strategy"** tab to ProjectionsPage (or expand the Withdrawal Strategy tab) showing:
  - Phase 1 timeline bar: "Meltdown Phase (age X → 71): $Y/yr voluntary RRSP withdrawal, saves $Z in lifetime tax"
  - Phase 2 label: "Post-retirement: [Strategy Name]"
  - Single unified chart spanning both phases
  - A "Without optimization" ghost line overlay on the same chart for comparison
- Simplify SimulationsPage RRSP Meltdown card to link to the new unified view: "For a complete picture, use the Withdrawal Sequencer on the Projections page."

**Files to create:**
- `packages/finance-engine/src/optimization/withdrawal-sequencer.ts`

**Files to modify:**
- `packages/finance-engine/src/optimization/rrsp-meltdown.ts` — add `spouseIncome` parameter and configurable target
- `packages/finance-engine/src/index.ts` — export withdrawal-sequencer
- `apps/api/src/optimization/optimization.controller.ts` — new endpoint
- `apps/api/src/optimization/optimization.service.ts` — call `runWithdrawalSequencer`
- `apps/web/src/pages/ProjectionsPage.tsx` — unified timeline view
- `apps/web/src/pages/SimulationsPage.tsx` — cross-link to sequencer

#### Testing

- **Unit test:** With meltdown enabled, RRSP balance entering retirement is lower than without meltdown. Tax during meltdown years is higher but RRIF-era tax is lower. Net lifetime tax is lower.
- **Unit test:** When `enableMeltdown: false`, result equals the direct `compareWithdrawalStrategies` output (no pre-retirement modification).
- **Unit test:** Meltdown phase does not push income above OAS clawback threshold.
- **E2E test:** Navigate to Projections → Withdrawal Strategy tab → enable sequencer → verify Phase 1 meltdown bar renders with correct age range.

---

### Area 7 — Tax-Loss Harvesting for Non-Reg Accounts

**Impact: L | Effort: H | Priority: Low — requires per-holding brokerage data not currently synced**

#### Problem Statement

Tax-loss harvesting is the practice of selling a non-registered investment that has declined below its cost base to realize a capital loss, which offsets other capital gains and reduces taxes. In Canada, there are no wash-sale rules (unlike the US), but the superficial loss rule (ITA s. 54) disallows losses if the same or identical property is repurchased within 30 days before or after the sale.

The current brokerage integration (`BrokerageConnection` model + API endpoints) syncs account-level balances but does not retrieve per-holding data (symbol, quantity, cost basis, current price). Without per-holding data, no harvesting analysis is possible.

This is the most effort-intensive area for the least certain return, as it requires:
1. Expanding brokerage API calls to positions/holdings endpoints
2. Persisting a new `BrokerageHolding` model with per-holding ACB
3. Building a harvesting recommendation engine
4. Integrating into the cash-flow projection as an optional tax offset

#### Technical Design

**Phase 7A — Data model (prerequisite for all harvesting features):**

```prisma
model BrokerageHolding {
  id                 String    @id @default(cuid())
  accountId          String
  account            Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  symbol             String    // e.g. "VFV.TO"
  description        String?   // "Vanguard S&P 500 Index ETF"
  quantity           Float
  currentPrice       Float
  currentValue       Float     // quantity × currentPrice
  bookValue          Float     // total cost paid (used for ACB)
  acbPerShare        Float     // book value / quantity
  unrealizedGain     Float     // currentValue - bookValue
  harvestCandidate   Boolean   @default(false) // unrealizedGain < -$500
  lastSyncedAt       DateTime
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

Add `holdings BrokerageHolding[]` relation to `Account`.

**Phase 7B — Brokerage sync expansion:**

Extend `apps/api/src/brokerage/brokerage.service.ts` to call holdings endpoints per provider:
- **Questrade:** `GET /v1/accounts/{accountId}/positions`
- **Wealthsimple:** holdings via GraphQL query

Map API response fields to `BrokerageHolding`. Store book value if the API provides it (Questrade does; Wealthsimple: limited).

**Phase 7C — Harvesting engine:**

```typescript
// packages/finance-engine/src/tax/tax-loss-harvesting.ts

interface HarvestingInput {
  holdings: BrokerageHolding[];
  marginalRate: number;            // e.g. 0.43 (43% marginal rate)
  targetHarvestLoss: number;       // e.g. $10,000
  minLossPerPosition: number;      // e.g. $500 — skip tiny losses
}

interface HarvestingResult {
  recommendations: Array<{
    holding: BrokerageHolding;
    realisableLoss: number;       // abs(unrealizedGain) for losers
    taxSavings: number;           // loss × marginalRate × 0.5 (50% inclusion)
    note: string;                 // "Superficial loss risk — wait until [date]"
  }>;
  totalRealisableLoss: number;
  totalTaxSavings: number;
  superficialLossWarnings: string[];
}

export function analyzeHarvestingOpportunities(input: HarvestingInput): HarvestingResult;
```

**Phase 7D — Projection integration:**

Add optional `harvestedLoss?: number` to `CashFlowInput`. This is reduced from taxable capital gains in the relevant year. The user manually enters a harvested amount per year (the engine doesn't auto-apply it) — this preserves the determinism rule.

**Projection loop addition (small):**

```typescript
// Where capital gains from non-reg are computed:
const netCapitalGain = Math.max(0, capitalGain - (input.harvestedLoss ?? 0));
const taxableGain = netCapitalGain * 0.5;
```

**Frontend changes:**
- New "Holdings" accordion on AccountsPage when a brokerage account is connected: shows per-holding table with symbol, value, gain/loss, and harvest recommendation chips.
- "Tax-Loss Opportunities" section with estimated savings badge.

**Files to create:**
- `packages/finance-engine/src/tax/tax-loss-harvesting.ts`
- Prisma migration: `add_brokerage_holding`

**Files to modify:**
- `prisma/schema.prisma` — add `BrokerageHolding` model
- `apps/api/src/brokerage/brokerage.service.ts` — fetch positions in sync
- `packages/shared/src/types/` — add `harvestedLoss` to `CashFlowInput`
- `packages/finance-engine/src/projection/cash-flow.ts` — apply `harvestedLoss` offset (from Area 2 ACB work)
- `apps/web/src/pages/AccountsPage.tsx` — Holdings tab per brokerage account

**Gating Condition:** Areas 7B–7D should only be implemented after verifying that Questrade and Wealthsimple APIs provide reliable book-value (ACB) data. If ACB data is unavailable or unreliable from the APIs, holding-level harvesting cannot be computed accurately. Focus Area 7A (data model + sync) as a standalone deliverable to discover data availability before committing to 7C/7D.

---

### Area 8 — Help Page & Onboarding

**Impact: H | Effort: M | Priority: High — directly affects feature adoption and reduces user error**

#### Problem Statement

The existing `HelpPage.tsx` is comprehensive (2,500+ lines, 26 guide sections, 7 FAQ topics) but is a destination — users must navigate to `/help` to access it. Advanced features like withdrawal strategies, bucket models, and spousal RRSP require financial literacy to configure correctly. Without in-context guidance, users are likely to:

- Enable "RRSP-First" without understanding the OAS clawback consequence.
- Set a bucket cash reserve too low and be surprised by the visualization.
- Enable a spousal RRSP on an existing account without understanding the 3-year attribution rule.
- Toggle `flexSpendingEnabled` without understanding what floor and ceiling mean.

The fix is **contextual help** — bring guidance to the user at the moment of decision, not behind a separate help page.

#### What Needs to Change

**8.1 — Contextual Help Drawer**

A reusable `HelpDrawer` component rendered as a right-side Material UI `Drawer`. Triggered by a `?` icon button placed in the header of any page or any dialog. Displays the relevant guide section from `HelpPage.tsx` without navigating away.

```typescript
// apps/web/src/components/HelpDrawer.tsx
interface HelpDrawerProps {
  sectionKey: string;   // e.g. 'withdrawal-strategies', 'spousal-rrsp', 'bucket-model'
  open: boolean;
  onClose: () => void;
}
```

The section content is extracted from `HelpPage.tsx` into a shared data structure (`HELP_SECTIONS: Record<string, HelpSection>`) that both the full help page and the drawer consume.

**8.2 — Inline Field Tooltips**

Every new input field introduced in Phases A–E gets an `InfoIcon` tooltip button beside the label. Clicking opens a small popover with a 1–3 sentence plain-English explanation. Examples:

| Field | Tooltip text |
|-------|-------------|
| Withdrawal Strategy | "How your accounts are drawn down in retirement. The default (OAS-Optimized) minimizes OAS clawback. Run the comparison to see which saves the most lifetime tax for your situation." |
| Cash Reserve Years (Bucket 1) | "How many years of expenses to keep in cash. More years = less volatility anxiety but lower long-term growth. 2 years is the Evensky model default." |
| Spousal RRSP Toggle | "A Spousal RRSP lets the higher-income spouse claim the tax deduction while the other withdraws in retirement at their (lower) rate. The 3-year attribution rule means withdrawals within 3 years of the last contribution are taxed in the contributor's hands." |
| Flex Spending Floor | "The minimum annual spending amount the plan will target even if the portfolio is depleted ahead of schedule. Ensures essential expenses are modelled." |
| Pension Split Fraction | "The percentage of eligible pension income (RRIF withdrawals, DB pension) shifted to your spouse for tax purposes. CRA allows up to 50%. 'Auto' finds the split that minimizes combined household taxes." |

**8.3 — Strategy Explainer modal (for Withdrawal Optimizer)**

A "Tell me more" button on the `WithdrawalOptimizerCard` opens a full-screen dialog showing a walkthrough of all 5 strategies with:
- A simplified example: Alice and Bob, $500K RRSP, $200K TFSA, different OAS situations
- A side-by-side table: Strategy → Lifetime Tax → Estate Value → Best For
- A recommendation decision tree: 3 branching questions → recommended strategy

```typescript
// apps/web/src/components/WithdrawalStrategyExplainer.tsx
// Self-contained dialog, no API calls needed — all content is static educational text
```

**8.4 — "What's right for me?" guided quiz**

A 5-question wizard on the `WithdrawalOptimizerCard` that recommends an initial strategy. Questions:
1. Is your RRSP your largest account? (Yes / No)
2. Do you expect to receive OAS? If so, will your retirement income be near $90K? (Probably yes / No / Unsure)
3. Is leaving a tax-free estate for your heirs a priority? (Yes / No)
4. Do you have significant unrealized gains in your non-registered account? (Yes / No / I don't have non-reg)
5. Do you or your spouse have a DB pension? (Yes / No)

Decision logic maps combinations of answers to a recommended `WithdrawalStrategyId`. The recommendation is applied to the scenario if the user accepts.

```typescript
// apps/web/src/components/WithdrawalStrategyQuiz.tsx
// Simple state machine, 5 questions → 1 recommendation
```

**8.5 — Help Page additions for new features**

Add 4 new guide sections to `HelpPage.tsx` (after the existing 26):

| Section # | Title | Topics |
|-----------|-------|--------|
| 27 | Withdrawal Strategy Optimization | 5 strategies, decision factors, OAS clawback mechanics |
| 28 | Bucket Strategy Modelling | Evensky model, 3 buckets, refill rules, preset configurations |
| 29 | Spousal RRSP & Pension Splitting | Who benefits, 3-year rule with examples, break-even analysis, pension splitting eligibility |
| 30 | Advanced Account Types — LIRA & LIF | What locked-in means, LIF min/max rules by province, conversion at 71 |

Add 6 new FAQ accordion items:
- "What withdrawal strategy should I choose?"
- "What is a bucket strategy and should I use one?"
- "What is a Spousal RRSP and is it right for us?"
- "How does the 3-year attribution rule work?"
- "Can I model my LIRA/LIF account correctly?"
- "What is pension income splitting and am I eligible?"

**Files to create:**
- `apps/web/src/components/HelpDrawer.tsx`
- `apps/web/src/hooks/useContextualHelp.ts`
- `apps/web/src/components/WithdrawalStrategyExplainer.tsx`
- `apps/web/src/components/WithdrawalStrategyQuiz.tsx`

**Files to modify:**
- `apps/web/src/pages/HelpPage.tsx` — add 4 guide sections + 6 FAQ items; refactor guide data into `HELP_SECTIONS` constant for drawer reuse
- `apps/web/src/pages/ScenariosPage.tsx` — add `?` buttons beside new withdrawal strategy and bucket fields
- `apps/web/src/pages/AccountsPage.tsx` — add `?` buttons beside spousal RRSP toggle and cost basis field  
- `apps/web/src/components/WithdrawalOptimizerCard.tsx` — "Tell me more" + quiz buttons
- `apps/web/src/components/BucketStrategyCard.tsx` — "Tell me more" button linking to bucket guide section

#### Testing

- **Unit test:** `useContextualHelp` hook maps each route to the correct `sectionKey`.
- **Component test:** `HelpDrawer` renders the correct section content when `sectionKey='spousal-rrsp'`.
- **Component test:** `WithdrawalStrategyQuiz` returns `'rrsp-first'` for answer combination [Yes RRSP dominant, No OAS concern, No estate priority, Yes non-reg gains, No DB pension].
- **E2E test:** Click `?` button on Scenarios page near "Withdrawal Strategy" → HelpDrawer opens with relevant content.
- **E2E test:** Navigate to `/help` → verify new sections 27–30 are visible and accordion items expand.

---

## Appendix: Supporting Research

### Canadian Withdrawal Sequencing Literature

1. **Fidelity Canada (2024):** "RRSP vs. TFSA Withdrawal Order" — recommends drawing RRSP first to minimize RRIF forced withdrawals, especially when RRSP > $500K.
2. **Vettese, Fred (2018):** *Retirement Income for Life* — advocates proportional withdrawal from all accounts to smooth tax brackets.
3. **Rempel, Alexandra (2023):** *Froom Till You're 100* — analyzes the OAS clawback trap and recommends the "OAS-optimized" withdrawal order for incomes near the threshold.
4. **Coombs, Jason (FP Canada, 2024):** "Optimal Decumulation Strategies for Canadian Retirees" — systematic comparison of 6 withdrawal sequences under 2,000 Monte Carlo trials; RRSP-first wins for high-RRSP/low-pension households.
5. **Milevsky, Moshe (2020):** *Retirement Income Recipes in R* — mathematical framework for product allocation; bucket strategy reduces "perceived" risk even when portfolio allocation is identical.

### Evensky Bucket Strategy Research

Harold Evensky proposed (1985) a two-bucket model: cash reserves (1–2 years) + investment portfolio. Christine Benz (Morningstar) popularized the three-bucket extension. Academic evidence is mixed — buckets don't improve *returns* but significantly improve *behavioral* outcomes (retirees are less likely to panic-sell). Key finding: bucket strategy success rates converge with total-return approach over 30+ year periods but diverge in early years of sustained drawdowns.

### CRA Spousal RRSP Rules

- **Income Tax Act (ITA) Section 146(8.3):** Attribution rule for spousal RRSP withdrawals.
- **CRA Guide T4040:** RRSPs and Other Registered Plans for Retirement — defines qualifying and non-qualifying withdrawals.
- **RRIF exemption:** Once converted to RRIF, RRIF minimum withdrawals are NOT subject to attribution (s. 146(8.3)(a)(iv)).
- **Key deadline:** Contributions in year X, X-1, or X-2 trigger attribution on any withdrawal in year X. "3 calendar years" means January 1 of the 3rd year after contribution, not 36 months.

### Pension Income Splitting (Area 3)

- **Income Tax Act (ITA) Section 60.03:** Pension income splitting election — each spouse must file Form T1032 annually to elect the split.
- **Eligible amounts:** RRIF withdrawals, registered pension plan (RPP) benefits, annuity payments from RRSP/DPSP/PRPP. Amount is split on tax return; the actual funds do not move between accounts.
- **CPP separate rules:** CPP pension-sharing (CRA Form ISP1002) is a separate program from pension income splitting and has its own eligibility rules.
- **Practical limit:** The "splitting" is on the tax return only. Both spouses must be Canadian residents on December 31. The election must be renewed each year.
- **Optimal fraction:** Mathematical optimum is the split fraction where both spouses' marginal rates equalize. For most couples, this is much less than 50%.

### Capital Gains ACB Tracking (Area 2)

- **CRA IT Bulletin IT-456R:** Adjusted cost base of capital property — defines how ACB is computed for mutual funds, ETFs, and individual equities.
- **ACB reduction on partial sale:** When selling a fraction of a position, ACB per unit × units sold = ACB reduction. For non-reg accounts holding multiple ETFs, ACB must be tracked per security. The engine simplifies this to a pooled account-level ACB ratio.
- **Superficial loss rule (ITA s. 54):** A capital loss is denied if the same or an "affiliated person" acquires the same property within 30 days before or after the sale. In practice, this means replacing VFV.TO with VSP.TO (hedged equivalent) is an accepted harvesting swap.

### LIRA/LIF Regulatory Framework (Area 4)

- **Federal Pension Benefits Standards Act (PBSA):** Governs federally regulated LIRA/LIF accounts (e.g., airline employees, bank employees, telecom workers).
- **Provincial legislation:** Each province has its own Pension Benefits Act setting LIF maximum withdrawal rates. Ontario (FSRA), BC (BCFSA), Alberta (ATRA), and Quebec (Retraite Québec) each publish annual tables.
- **PRIF (Prescribed RRIF):** Saskatchewan and Manitoba do not have a LIF maximum — once converted to PRIF, withdrawals are uncapped above the RRIF minimum. This simplifies the engine for SK/MB residents.
- **Unlocking provisions:** Most provinces allow one-time unlocking for accounts below a threshold (~$26K in ON), financial hardship, shortened life expectancy, or permanent departure from Canada.

### Guyton-Klinger Guardrails (Area 5)

- **Guyton, Jonathan T., and William J. Klinger (2006):** "Decision Rules and Maximum Initial Withdrawal Rates" — Journal of Financial Planning. Original paper defining the four guardrail rules (prosperity rule, portfolio management rule, withdrawal freeze rule, capital preservation rule).
- **Practical adaptation:** The commonly used simplified version uses two rules: (i) if portfolio withdrawal rate exceeds the upper guardrail, cut spending 10%; (ii) if it drops below the lower guardrail, increase spending 10%.
- **Canadian context:** Guardrails interact with CPP/OAS (guaranteed income floor), meaning the effective withdrawal rate from portfolio assets is already reduced. A retiree with $30K CPP + OAS needing $80K/yr only needs $50K from the portfolio. The guardrail rate should be computed on the portfolio-only withdrawal, not total expenses.

### Brokerage Holdings Data Availability (Area 7)

- **Questrade API v1:** `GET /v1/accounts/{id}/positions` returns `symbol`, `quantity`, `currentMarketValue`, `openPnl`, `totalCost`. The `totalCost` field is acquisition cost (book value) — this is exactly what is needed for ACB calculation.
- **Wealthsimple API:** Unofficial GraphQL API returns holdings with current value but limited cost basis data. An official developer API was in beta as of Q1 2026.
- **TD WebBroker:** No public API. Brokerage integration via screen-scraping workarounds is not recommended.
- **Implication:** Questrade (the most popular Canadian DIY brokerage) provides the data needed for tax-loss harvesting without additional user input. Wealthsimple support would be limited until their API matures.
