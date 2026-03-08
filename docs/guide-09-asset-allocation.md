# Asset Allocation and Glide Path

## Purpose and Role

Asset allocation determines how a portfolio is divided among investment classes — stocks, bonds, alternatives, and cash — and this mix is the most powerful lever controlling both expected return and volatility. The asset allocation module lets households model a per-account investment mix, view their aggregate household allocation, and build an automatic age-based "glide path" that shifts toward more conservative holdings as retirement approaches.

**Engine file:** `packages/finance-engine/src/allocation/asset-allocation.ts`  
**Constants:** `packages/shared/src/constants/canada.ts` (`CAPITAL_MARKET_ASSUMPTIONS`)  
**Frontend:** `apps/web/src/pages/AccountsPage.tsx` (Household Asset Allocation section)  
**Chart components:**
- `apps/web/src/components/charts/AllocationDonut.tsx`
- `apps/web/src/components/charts/GlidePathChart.tsx`

---

## Per-Account Allocation Fields

Each `Account` record in the database has four optional allocation percentage fields:

```typescript
equityPercent        Float?   // Stocks, ETFs, equity mutual funds
fixedIncomePercent   Float?   // Bonds, GICs, fixed income
alternativesPercent  Float?   // REITs, infrastructure, private equity
cashPercent          Float?   // Money market, savings within the account
```

**Constraint:** When set, these fields must sum to 100. The account creation/edit dialog in AccountsPage enforces this with real-time validation.

If allocation fields are not set, the account uses the scenario-level `nominalReturnRate` for all projections. If they are set, the `calculateExpectedReturn` function computes a blended return rate using Capital Market Assumptions.

---

## Capital Market Assumptions (CMA)

Capital Market Assumptions are the expected long-run annual return rates for each asset class. They are stored in `CAPITAL_MARKET_ASSUMPTIONS` in `packages/shared/src/constants/canada.ts`:

```typescript
export const CAPITAL_MARKET_ASSUMPTIONS = {
  equity:       0.070,   // 7.0% — diversified global equity
  fixedIncome:  0.040,   // 4.0% — investment-grade bonds
  alternatives: 0.055,   // 5.5% — diversified alternatives
  cash:         0.025,   // 2.5% — HISA / money market
};
```

These are default assumptions based on long-run historical averages and forward-looking consensus estimates. They can be adjusted in the Assumptions Audit dialog (see `guide-13-market-data-assumptions.md`).

### Expected return calculation

```typescript
function calculateExpectedReturn(account: Account): number {
  const { equity, fixedIncome, alternatives, cash } = CAPITAL_MARKET_ASSUMPTIONS;
  return (
    (account.equityPercent       / 100) * equity       +
    (account.fixedIncomePercent  / 100) * fixedIncome  +
    (account.alternativesPercent / 100) * alternatives +
    (account.cashPercent         / 100) * cash
  );
}
```

This is a simple weighted average — it does not account for correlation between asset classes or volatility-adjusted returns. The Monte Carlo module handles volatility through the return sequence sampling approach rather than through variance in the expected return calculation.

---

## Household-Level Allocation View

The `calculateHouseholdAllocation` function aggregates all accounts by their total value-weighted allocation:

```typescript
function calculateHouseholdAllocation(accounts: Account[]): AssetAllocation {
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  return {
    equity:       valueWeightedAvg(accounts, 'equityPercent',       totalBalance),
    fixedIncome:  valueWeightedAvg(accounts, 'fixedIncomePercent',  totalBalance),
    alternatives: valueWeightedAvg(accounts, 'alternativesPercent', totalBalance),
    cash:         valueWeightedAvg(accounts, 'cashPercent',         totalBalance),
  };
}
```

This is displayed as the **AllocationDonut** chart on AccountsPage: an interactive D3 donut chart showing the household's aggregate exposure to each asset class. Hovering shows the dollar amount and percentage for each slice.

---

## The Glide Path

A glide path is an automatic schedule that reduces equity exposure as the investor ages toward retirement. The classic "target date fund" rule of thumb is: hold `(100 - age)%` in stocks and the rest in bonds. The system provides a more flexible glide path builder.

### GlidePathStep

```typescript
interface GlidePathStep {
  age:        number   // At this age, switch to this return rate
  returnRate: number   // The nominal return rate from this age onward
}
```

The user sets a starting equity percentage and a target equity percentage at retirement. The system generates intermediate steps that linearly interpolate between them.

### Glide path in the projection

When `glidePathSteps` is provided to the projection engine, each year resolves its return rate by finding the nearest applicable step. This means:
- At age 45 with a 70/30 equity/bond split → 6.35% blended return
- At age 65 with a 50/50 split → 5.50% blended return  
- At age 75 with a 30/70 split → 4.90% blended return

The glide path is stored as JSON on the `Scenario` record (`glidePath: Json?`) and passed to `CashFlowInput.glidePathSteps`.

### GlidePathChart component

The `GlidePathChart` component (`apps/web/src/components/charts/GlidePathChart.tsx`) is a D3 line chart on ScenariosPage showing:
- X-axis: age from current age to end age
- Y-axis: equity percentage (0–100%)
- A smooth declining curve from the current equity % to the retirement equity %
- Gray vertical line at the retirement age
- Annotations: "Current (X%)", "Retirement (Y%)"

---

## Per-Account Return Rate Overrides

In addition to the allocation-based calculation, each account can have an explicit `estimatedReturnRate`. The priority order when the engine determines a rate for each account:

1. `rrspReturnRate` (or `tfsaReturnRate`, `nonRegReturnRate`) in `CashFlowInput` — set by `buildProjectionPayload` from account-level `estimatedReturnRate`
2. If no per-account rate: `nominalReturnRate` from the scenario, modified by glide path steps
3. For cash: always `cashSavingsRate` (default 2.5%), regardless of other settings

**In buildProjectionPayload**, if an account has allocation fields set, `calculateExpectedReturn` is called and the result is used as that account's `estimatedReturnRate`. This flows into the corresponding `rrspReturnRate` / `tfsaReturnRate` / `nonRegReturnRate` field in `CashFlowInput`.

---

## Allocation Dialog on AccountsPage

When creating or editing an account, the dialog includes allocation controls:

- Four percentage sliders (`equity`, `fixedIncome`, `alternatives`, `cash`)
- A live sum indicator that turns red when the total ≠ 100
- A computed "Expected Return" chip that updates as sliders change (calls `calculateExpectedReturn` client-side)
- An optional "Use explicit return rate instead" toggle that shows a single rate field

The dialog prevents saving when the allocation sum is not 100.

---

## AI-Assisted Coding Quick Reference

**When updating Capital Market Assumptions:**
1. Edit `CAPITAL_MARKET_ASSUMPTIONS` in `packages/shared/src/constants/canada.ts`
2. These values also appear in the Assumptions Audit dialog — verify the dialog reads from the same constant
3. All per-account expected return calculations update automatically for new accounts; existing accounts with stored `estimatedReturnRate` are not affected unless recalculated

**When adding a new asset class (e.g. crypto, commodities):**
1. Add the field to `Account` in `prisma/schema.prisma` (new percentage field)
2. Add to `CAPITAL_MARKET_ASSUMPTIONS` with a default return estimate
3. Update `calculateExpectedReturn` to include the new class
4. Update `calculateHouseholdAllocation` to include the new class
5. Add the new class to the allocation donut chart and account dialog slider

**When implementing the glide path builder UI:**
1. Two MUI Sliders: "Current equity %" (0–100) and "Equity % at retirement" (0–100)
2. A "Step size" field (default: smooth linear)
3. Generate `GlidePathStep[]` by mapping return rates from `calculateExpectedReturn` for an allocation at each equity %
4. Display `GlidePathChart` as a preview
5. On save, store the steps in `Scenario.glidePath`

**What NOT to do:**
- Do not use allocation percentages as risk-adjusted returns — the CMA values are nominal expected returns, not certainty equivalents
- Do not assume all accounts have allocation fields set; always fall back to scenario `nominalReturnRate`
- Do not mix per-account return rates with glide path simultaneously — in `buildProjectionPayload`, account-level rates take priority over the glide path for that account type
