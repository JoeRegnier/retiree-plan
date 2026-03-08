# Cash-Flow Projection Engine

## Purpose and Role

The cash-flow projection engine is the single most important component in the system. Every number shown to the user — every chart, every score, every insight, every PDF page — ultimately comes from this engine. Understanding how it works is essential for anyone making changes to financial behaviour in the application.

**File:** `packages/finance-engine/src/projection/cash-flow.ts`  
**Entry point:** `runCashFlowProjection(input: CashFlowInput): ProjectionYear[]`

The engine takes a complete description of a household's financial situation and returns an array of `ProjectionYear` records — one per year from the user's current age to their specified end age. It is a **pure function**: no database access, no HTTP calls, no randomness (in the deterministic base case). The same inputs always produce the same outputs.

---

## How the Simulation Works

The engine runs a year-by-year loop. Starting at `currentAge` and going up to `endAge`, each iteration:

1. **Determines the phase** — Is the person still working (`age < retirementAge`) or retired?
2. **Calculates income** — Employment income (if working), CPP benefit (if past `cppStartAge`), OAS benefit (if past `oasStartAge`), and any time-bounded income sources from `incomeSources[]`
3. **Calculates expenses** — Base expenses adjusted for inflation and any `spendingPhases[]` multipliers
4. **Grows all account balances** — RRSP, TFSA, non-registered, and cash each grow at their respective return rates (which may differ by account or change with the glide path)
5. **Applies RRIF forced minimums** — From age 71 (or `rrifConversionAge`), a CRA-mandated percentage of the RRSP/RRIF balance must be withdrawn as taxable income regardless of whether it is needed
6. **Handles pre-retirement contributions** — RRSP and TFSA contributions (if age < retirementAge) are added to balances
7. **Calculates any shortfall** — If expenses exceed income (including RRIF minimums), the engine withdraws from investment accounts in a specific priority order
8. **Handles any surplus** — If income exceeds expenses, optionally directs surplus into the non-registered account
9. **Calculates tax** — Total tax owed on all taxable income for the year
10. **Records the year** — Packages all values into a `ProjectionYear` record

---

## Account Growth

Each account type grows differently:

| Account | Growth rate | Tax drag |
|---|---|---|
| RRSP/RRIF | `rrspReturnRate` or `nominalReturnRate` or glide path | None — grows tax-sheltered until withdrawn |
| TFSA | `tfsaReturnRate` or `nominalReturnRate` or glide path | None — fully tax-free forever |
| Non-registered | `nonRegReturnRate` or `nominalReturnRate` or glide path | `nonRegTaxDragRate` (default 0) — models annual tax on interest/dividends |
| Cash | `cashSavingsRate` (default 2.5%) | None |

The glide path (`glidePathSteps[]`) lets the return rate shift automatically at certain ages. For example: 6% return until age 65, then 4.5% to model a conservative bond-heavy portfolio in retirement. The engine resolves the return rate for each year by finding the most recent step at or before the current age.

---

## RRIF Mandatory Minimums

When a member reaches `rrifConversionAge` (default 71), the RRSP is legally converted to a RRIF. The CRA requires a minimum percentage of the RRIF balance to be withdrawn each year. This is taxable income.

The CRA table is implemented in `getRRIFMinRate(age)`:
- Age 71: 5.28%
- Age 75: 5.82%
- Age 80: 6.82%
- Age 85: 8.51%
- Age 90: 11.92%
- Age 95+: 20.00% (capped)

**Important:** These minimums are forced even if the household has no shortfall. At age 71 forward, the RRIF withdrawal appears in income and tax is calculated on it. For many households with large RRSP balances, RRIF minimums generate more income than they need, resulting in a net surplus.

---

## Withdrawal Priority (Post-Retirement Shortfall)

When expenses exceed income (after RRIF minimums), the engine withdraws from accounts in this order:

1. **Cash bucket** — First, because it earns the lowest return (HISA rate) and withdrawing from it costs nothing in terms of foregone investment growth
2. **RRSP/RRIF up to the OAS clawback threshold** — After deducting CPP, OAS, and forced RRIF minimums already counted, there may be "headroom" before the OAS clawback kicks in at ~$91,000 (2024, inflation-adjusted). Drawing RRSP income up to this threshold is tax-efficient because it voluntarily reduces the RRSP balance before RRIF minimums force increasingly large draws at higher ages
3. **TFSA** — Tax-free withdrawals that do not affect clawback calculations or marginal tax rates. Preserved as long as possible because the TFSA is the ideal legacy account
4. **Non-registered** — Capital gains are taxable; this account is drawn before the RRSP beyond the clawback threshold
5. **RRSP beyond the OAS clawback threshold** — Last resort. Withdrawals at this level trigger OAS clawback and are taxed at the highest marginal rate

**Why this order matters:** The intuition is that you want to drain the most tax-inefficient accounts (RRSP) while the tax cost is lowest (below the clawback threshold), preserve the tax-free accounts (TFSA) as long as possible, and avoid the worst outcome (large RRSP forced draws at 80+ that could be avoided with earlier voluntary draws).

**Pre-retirement:** Investment accounts are completely locked. Only the cash bucket can be drawn from before retirement. This prevents the simulation from accidentally depleting the RRSP or TFSA during the working years.

### OAS Clawback Threshold

The 2024 OAS clawback threshold is `$90,997` (constant `OAS_CLAWBACK_THRESHOLD_2024`). It is inflation-adjusted each year:

```
clawbackThreshold = OAS_CLAWBACK_THRESHOLD_2024 × inflationFactor
rrspHeadroom = clawbackThreshold - cppIncome - oasIncome - rrifMinimumAlreadyForced
```

The headroom calculation ensures voluntary RRSP draws do not accidentally push total income over the clawback line.

---

## Income Sources

The engine supports both a simple scalar and a detailed list of income sources:

**Simple mode:** `employmentIncome` — a single annual income figure active from `currentAge` until `retirementAge - 1`.

**Detailed mode:** `incomeSources[]` — each entry specifies:
- `annualAmount`: income in today's dollars
- `startAge` / `endAge`: active age range (defaults to working years if omitted)
- `indexToInflation`: whether to inflate the amount each year (default: true)

When `incomeSources[]` is provided, it replaces the scalar `employmentIncome`. This is used for part-time work in early retirement, pension income starting at a specific age, rental income from a property, etc.

---

## Expenses

Similarly, expenses can be a simple scalar (`annualExpenses`) or a detailed list (`expenseEntries[]`). Each expense entry supports age bounds and an independent inflation flag.

On top of individual expenses, **spending phases** (`spendingPhases[]`) apply a multiplier to all inflation-adjusted expenses at a given age. This models the well-documented "smile curve" pattern:
- Active retirement (65–74): 100% spending (travel, dining, activities)
- Slow-go phase (75–84): 80% spending (less travel, reduced activity)
- Healthcare phase (85+): 90% spending (lower lifestyle costs but rising healthcare)

The multipliers are applied in addition to inflation. A phase with `fromAge: 75, factor: 0.8` means expenses from age 75 onward are 80% of the inflation-adjusted baseline.

---

## Tax Calculation

Tax is calculated each year by calling `calculateTotalTax(taxableIncome, province)` from `packages/finance-engine/src/tax/canadian-tax.ts`. The taxable income for a year is:

```
taxableIncome = employmentIncome + cppIncome + oasIncome + rrifMinimumWithdrawal + additionalRrspWithdrawals
```

TFSA withdrawals do not appear in taxable income. Non-registered account growth can include a `nonRegTaxDragRate` but this is separate from the explicit withdrawal tax.

---

## Key Constants and Their Source

All CRA-mandated figures are defined in `packages/shared/src/constants/canada.ts`:

| Constant | Value (2024) | Purpose |
|---|---|---|
| `RRIF_MINIMUM_WITHDRAWAL` | Map of age → rate | RRIF mandatory minimum schedule |
| `OAS_CLAWBACK_THRESHOLD_2024` | $90,997 | Engine OAS headroom calculation |
| `TFSA_ANNUAL_LIMIT_2024` | $7,000 | Contribution room tracking |
| `RRSP_2024.maxContribution` | $31,560 | RRSP contribution room cap |
| `OAS_MONTHLY_2024` | $713.34 | OAS maximum monthly benefit |
| `CPP_MAX_MONTHLY_2024` | $1,364.60 | CPP maximum monthly benefit |

These are updated annually when CRA publishes new limits. The `market-data` module provides a UI for checking whether they are stale.

---

## Milestone Events

The engine integrates freeform one-time events into the projection. Milestone events are stored separately and passed to the engine as modifications to a specific year:
- `type: 'lump_sum_in'` — adds cash to the portfolio (inheritance, home sale proceeds)
- `type: 'lump_sum_out'` — subtracts cash from the portfolio (major renovation, cottage purchase)
- `type: 'income'` — adds to the income stream for a year (part-time work income)
- `type: 'expense'` — adds to expenses for a year (retirement community costs)

Milestones are applied during the year matching the member's age at the event.

---

## Testing the Engine

Unit tests live in `packages/finance-engine/src/projection/__tests__/`. Run them with:

```bash
npm run test --workspace=packages/finance-engine
```

Tests should verify:
- Known account balance at specific ages given a fixed input
- Correct RRIF minimum amounts at ages 71, 80, 90
- Correct OAS clawback headroom calculation
- Withdrawal priority order (TFSA should not be touched before RRSP headroom is exhausted)
- Spending phase multipliers applied correctly

### Quick manual test pattern
```typescript
import { runCashFlowProjection } from '../projection/cash-flow.js';

const result = runCashFlowProjection({
  currentAge: 55,
  endAge: 90,
  province: 'ON',
  retirementAge: 65,
  employmentIncome: 120_000,
  annualExpenses: 80_000,
  inflationRate: 0.026,
  nominalReturnRate: 0.06,
  rrspBalance: 500_000,
  tfsaBalance: 87_000,
  nonRegBalance: 0,
  cashBalance: 20_000,
  cppStartAge: 65,
  cppBenefitFraction: 0.75,
  oasStartAge: 65,
  oasResidencyYears: 40,
});

// Check TFSA at age 65 — should be $87K × (1.06^10) ≈ $155K
const age65 = result.find(y => y.age === 65);
console.log(age65?.tfsaBalance);
```

---

## Common Mistakes

**Modifying account balances in React** — All balance calculations must happen inside this engine file, not in components or API controllers.

**Forgetting the `isWorking` guard** — Pre-retirement: only cash withdrawals are permitted. Editing the withdrawal block without maintaining this guard will drain investment accounts during the working years.

**Using nominal vs. real returns** — The engine uses nominal return rates and nominal expenses inflated by `inflationRate`. Do not mix real (inflation-adjusted) return rates with nominal expense growth — the simulation will double-count inflation.

**OAS clawback headroom without subtracting forced RRIF** — When calculating headroom for voluntary RRSP draws, always subtract `rrifMinimumWithdrawal` already in the year. Failing to do this overstates the headroom and can push income over the clawback line.
