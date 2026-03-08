# RRSP Meltdown Optimizer and OAS-Clawback-Aware Drawdown

## Purpose and Role

The RRSP meltdown strategy is one of the highest-value features in the system. For many Canadian households, 70–90% of their liquid net worth is in the RRSP. When they reach 71, the RRIF mandatory minimum schedule forces them to withdraw large amounts regardless of need — and those withdrawals are fully taxable. If the RRSP is very large, RRIF minimums can push income above the OAS clawback threshold, costing $4,000–$15,000 in lost OAS benefits per year.

The meltdown strategy addresses this by **voluntarily drawing down the RRSP before RRIF minimums force large draws**, converting tax-efficient RRSP room into income at lower marginal rates while there is still control over the timing.

There are two components:
1. **Standalone RRSP Meltdown Optimizer** — A dedicated tool that computes an optimal annual RRSP drawdown schedule between target ages
2. **Integrated OAS-Clawback-Aware Drawdown** — Logic wired directly into the projection engine (`cash-flow.ts`) that applies the optimal withdrawal priority on every simulated year

**Engine files:**
- `packages/finance-engine/src/optimization/rrsp-meltdown.ts` — Standalone optimizer
- `packages/finance-engine/src/projection/cash-flow.ts` — Integrated drawdown (withdrawal priority block)

---

## The Problem Being Solved

Consider a household with:
- $850,000 in RRSP at age 65
- CPP + OAS income: ~$25,000/year
- Annual expenses: $75,000/year
- RRIF conversion at age 71

At age 71, the RRIF minimum is 5.28% × $1,100,000 (after 6 years of 6% growth) ≈ **$58,000**. Combined with CPP + OAS, total taxable income = $83,000. Marginal rate in Ontario: ~33%.

At age 80, RRIF minimum is 6.82% × $1,400,000 (still growing) ≈ **$95,000**. Total income ≈ $120,000. This is **above the OAS clawback threshold**. The household loses ~$4,400/year of OAS permanently from this point. Marginal combined rate: ~43%.

If instead the household had voluntarily drawn $40,000/year from the RRSP between ages 65 and 70 (taxed at ~29% marginal rate, well below the 43% they'll pay at 80), the RRSP balance at 71 would be substantially smaller, the RRIF minimums would be manageable, and OAS clawback would be avoided entirely. The lifetime tax bill is lower, and the TFSA (untouched throughout) continues compounding tax-free.

---

## The Standalone RRSP Meltdown Optimizer

**Engine function:** `optimizeRrspMeltdown(input: MeltdownInput): MeltdownResult`

```typescript
interface MeltdownInput {
  currentRrspBalance:     number
  currentAge:             number
  targetAge:              number      // Age to complete the drawdown (default: 71)
  annualExpenses:         number
  otherRetirementIncome:  number      // CPP + OAS + DB pension
  marginalTaxRate:        number      // Current marginal rate in the drawdown window
  province:               Province
  investSurplusInTfsa:    boolean     // Redirect after-tax proceeds to TFSA?
  tfsaRoom:               number      // Available TFSA room for reinvestment
}

interface MeltdownYear {
  age:               number
  rrspWithdrawal:    number   // Recommended voluntary draw
  taxPaid:           number   // Tax on the withdrawal year
  tfsaContribution:  number   // Proceeds redirected to TFSA (if applicable)
  rrspBalanceEOY:    number   // RRSP balance at end of year
}

interface MeltdownResult {
  schedule:          MeltdownYear[]   // Year-by-year drawdown plan
  totalTaxSaved:     number           // Estimated lifetime tax saving vs. no-meltdown
  finalRrspBalance:  number           // RRSP balance after completing the drawdown
}
```

The optimizer finds the **withdrawal amount per year** that fills the household's income up to the optimal target income band — high enough to use low tax brackets efficiently, but not so high as to trigger OAS clawback or exceed the current marginal bracket. It uses `findWithdrawalToTargetIncome` — an internal iterative search function — to find the exact amount.

---

## Integrated OAS-Clawback-Aware Drawdown

The standalone optimizer produces an advisory schedule. The more powerful component is the withdrawal priority logic integrated directly into `runCashFlowProjection`. This logic runs every year of the projection and ensures that whenever the household faces a shortfall, withdrawals are sourced in the optimal tax-aware order.

### The five-step withdrawal priority

This is implemented in the withdrawal block inside the main simulation loop in `cash-flow.ts`. The logic executes **only in retirement years** (when `age >= retirementAge`):

**Step 1 — Cash bucket**
```typescript
const cashWithdrawal = Math.min(cashBalance, estimatedShortfall);
const rem1 = estimatedShortfall - cashWithdrawal;
```
Cash earns the lowest return (2.5%) and has no tax consequence. Withdraw from here first.

**Step 2 — RRSP up to OAS clawback headroom**
```typescript
const inflFactor = Math.pow(1 + inflationRate, age - currentAge);
const clawbackThreshold = OAS_CLAWBACK_THRESHOLD_2024 * inflFactor;
const rrspHeadroom = Math.max(0,
  clawbackThreshold - cppIncome - oasIncome - rrifMinimumWithdrawal
);
const additionalRrspBelowThreshold = Math.min(rrspBalance, rrspHeadroom, rem1);
const rem2 = rem1 - additionalRrspBelowThreshold;
```
Voluntarily draw RRSP to fill the gap between current income and the clawback threshold. This is tax-efficient and reduces the RRSP for future years.

**Step 3 — TFSA**
```typescript
const tfsaWithdrawal = Math.min(tfsaBalance, rem2);
const rem3 = rem2 - tfsaWithdrawal;
```
The TFSA is tax-free and does not affect clawback calculations. Use it only after RRSP headroom is exhausted.

**Step 4 — Non-registered**
```typescript
const nonRegWithdrawal = Math.min(nonRegBalance, rem3);
const rem4 = rem3 - nonRegWithdrawal;
```
Non-reg capital gains carry a 50% inclusion rate, making this more efficient than above-threshold RRSP.

**Step 5 — RRSP beyond clawback threshold**
```typescript
const additionalRrspBeyondThreshold = Math.min(rrspBalance - additionalRrspBelowThreshold, rem4);
```
Last resort. Withdrawals above the clawback threshold trigger OAS clawback AND are taxed at the highest marginal rate.

### Why TFSA is NOT drawn first

A common misconception: "TFSA withdrawals are tax-free, so draw them first." This is wrong for two reasons:

1. **Opportunity cost:** The TFSA earns the same investment return as the RRSP but generates no future tax liability. Every dollar left in the TFSA compounds tax-free and can be passed to heirs without any estate tax. Every dollar drawn down from the TFSA is simply gone from this incredibly efficient account.

2. **RRSP decay value:** Every dollar left in the RRSP will be forced out at age 71–95 at high marginal rates. Draining it earlier at lower rates saves real money. The RRSP has a "ticking tax clock" that the TFSA does not.

The correct intuition: treat the RRSP as a high-interest loan from the CRA that you are slowly repaying at the lowest available rate.

---

## OAS Clawback Threshold

The 2024 OAS clawback threshold is `$90,997`. This is stored as:

```typescript
const OAS_CLAWBACK_THRESHOLD_2024 = 90_997;
```

Inflation adjustment in the engine:
```typescript
const inflFactor = Math.pow(1 + inflationRate, age - currentAge);
const clawbackThreshold = OAS_CLAWBACK_THRESHOLD_2024 * inflFactor;
```

This means at age 85 with 2.6% inflation for 20 years after age 65, the threshold is approximately $148,000. This is not a fixed number — it grows with general inflation.

---

## Drawdown Animation (DrawdownWaterfallChart)

The visual representation of the drawdown strategy is the **Drawdown Waterfall Chart** on the Projections page (Drawdown tab). This is an animated D3 chart showing:

- **Horizontal stacked bars**, one per account type (RRSP = blue, TFSA = green, Non-Reg = orange, Cash = grey)
- Bars represent **balances at each age** — they shrink year over year as accounts are drawn
- **Age scrubber slider** — drag to any age in retirement to see the balance mix at that point
- **Auto-play button** — automatically animates through retirement years at 1fps
- **Observations:** TFSA bar should remain stable or grow for most of retirement; RRSP bar should gradually shrink; cash bar depletes first; the mix shifts over time

**Component:** `apps/web/src/components/charts/DrawdownWaterfallChart.tsx`  
**Data source:** `ProjectionYear[]` — the engine fields `rrspBalance`, `tfsaBalance`, `nonRegBalance`, `cashBalance` per year

The chart illustrates, visually, whether the drawdown strategy is working correctly. The most common validation check: TFSA should NEVER be the first to zero unless RRSP + Non-Reg + Cash are all already depleted.

---

## AI-Assisted Coding Quick Reference

**When the drawdown looks wrong (e.g. TFSA draining before RRSP):**
- Check the withdrawal priority block in `cash-flow.ts` — the `isWorking` guard and the five-step order
- Verify that `rrspBalance` is being reduced by `additionalRrspBelowThreshold` before TFSA is touched
- Run the engine test: at age 65 with large RRSP and moderate expenses, TFSA should be growing, not draining

**When adding a user-configurable withdrawal order:**
- Add `withdrawalOrder?: ('CASH' | 'RRSP' | 'TFSA' | 'NON_REG')[]` to `CashFlowInput`
- If provided, override the default 5-step order with the user's custom sequence
- The OAS clawback headroom logic should still apply regardless of order (it's a limit on RRSP, not an ordering preference)

**When implementing the standalone optimizer UI:**
- Create a new tab on the Projections page or a dedicated section on ScenariosPage
- Call `POST /projections/meltdown-optimizer` → `optimizeRrspMeltdown`
- Display the `MeltdownResult.schedule` as a table: year, age, RRSP draw, tax, RRSP balance EOY
- Show `totalTaxSaved` as a chip: "Estimated lifetime tax saving: $X"

**What NOT to do:**
- Do not pre-apply the meltdown schedule as a fixed income source in the scenario — it is dynamic per simulation year
- Do not calculate the clawback headroom without subtracting the forced RRIF minimum already withdrawn that year
- Do not implement this as a simple "just draw $X from RRSP" without the headroom check — the headroom varies by year based on inflation and CPP/OAS amounts
