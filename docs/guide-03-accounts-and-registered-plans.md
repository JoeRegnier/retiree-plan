# Accounts and Registered Plans

## Purpose and Role

Accounts represent the user's actual financial holdings — the assets that the projection engine grows, withdraws from, and reports on. Getting accounts right is crucial: the engine's starting balances drive every number in the projection. An incorrectly entered RRSP balance propagates through 30+ years of projection.

**Database model:** `Account` in `prisma/schema.prisma`  
**API module:** `apps/api/src/accounts/`  
**Frontend:** `apps/web/src/pages/AccountsPage.tsx`

---

## Account Types

The system recognizes five account types, stored as a string field `type` in the `Account` model:

| Type String | CRA Name | Tax Treatment | Key Rules |
|---|---|---|---|
| `RRSP` | Registered Retirement Savings Plan | Contributions deductible; withdrawals fully taxable | Converts to RRIF at age 71; contribution room is 18% of prior year income, max $31,560 (2024) |
| `RRIF` | Registered Retirement Income Fund | Withdrawals fully taxable; mandatory minimum each year | Minimum rates start at 5.28% at 71; no new contributions |
| `TFSA` | Tax-Free Savings Account | Contributions not deductible; growth and withdrawals completely tax-free | 2024 limit $7,000/year; cumulative room since 2009 or since 18th birthday |
| `NON_REG` | Non-Registered Investment Account | Growth taxed annually (interest/dividends) or as capital gain on sale | No contribution limits; ACB tracking needed for capital gains |
| `CASH` | Cash / Savings / HISA | Interest income taxable | Models chequing accounts, HISAs, emergency funds |

### Why the distinction matters for the engine

The projection engine treats each account type differently:
- **RRSP/RRIF:** Subject to forced minimum withdrawals at 71+; any withdrawal is taxable income
- **TFSA:** Never taxed; preserved as long as possible in the withdrawal priority order
- **NON_REG:** Can apply `nonRegTaxDragRate` for ongoing tax drag on growth
- **CASH:** Grows at `cashSavingsRate` (low, default 2.5%) not the investment return rate; first account to be drawn in a shortfall

When the API's `buildProjectionPayload` function maps DB records to a `CashFlowInput`, it aggregates all accounts by type. For example, if a household has two RRSP accounts, their balances are summed into the single `rrspBalance` input field. This is a simplification — the engine models each type as a single pool, not individual accounts.

---

## The Data Model

```typescript
// Prisma Account model (simplified)
Account {
  id            String
  householdId   String
  name          String          // "RBC RRSP", "TD TFSA"
  type          String          // 'RRSP' | 'RRIF' | 'TFSA' | 'NON_REG' | 'CASH'
  balance       Float           // Current balance in today's dollars
  
  // Asset allocation (optional — used by asset-allocation module)
  equityPercent        Float?   // e.g. 60 (meaning 60%)
  fixedIncomePercent   Float?   // e.g. 30
  alternativesPercent  Float?   // e.g. 5
  cashPercent          Float?   // e.g. 5
  
  // Return rate override (optional — overrides scenario nominalReturnRate)
  estimatedReturnRate  Float?   // e.g. 0.06 (6%)
}
```

The four allocation percentage fields must sum to 100 when provided. The `estimatedReturnRate` can be set explicitly or computed from the asset allocation using `calculateExpectedReturn` in the asset allocation engine.

---

## Registered Plan Rules Reference

### RRSP Contribution Room
- **Annual limit:** 18% of prior year's earned income, up to the annual maximum ($31,560 for 2024)
- **Unused room carries forward** — room unused in 2020 is still available in 2024
- **Pension adjustment (PA):** Members of a defined benefit pension plan have their RRSP room reduced by their PA, which reflects the value of benefits accruing under the DB plan that year
- **Over-contribution penalty:** 1% per month of the excess above the $2,000 buffer
- **Contribution deadline:** 60 days after calendar year end for that year's deduction

### TFSA Contribution Room
- **Annual limit by year:**
  - 2009–2012: $5,000/year
  - 2013–2014: $5,500/year
  - 2015: $10,000 (one-time increase)
  - 2016–2018: $5,500/year
  - 2019–2022: $6,000/year
  - 2023: $6,500
  - 2024: $7,000
- **Cumulative room** for a Canadian who turned 18 before 2009: $95,000 as of 2024
- **Withdrawals re-added the following January 1** — unlike RRSP, TFSA withdrawals create new room
- **No age limit for contributions** — RRSP is closed at 71; TFSA continues for life
- **Non-residents:** Cannot contribute but accounts continue to exist; risk of 1%/month penalty on contributions while non-resident

### RRIF Conversion
When a member turns 71, their RRSP must be converted to a RRIF (or used to purchase an annuity). The RRIF is identical to the RRSP in terms of investments, but:
- No new contributions allowed
- Mandatory minimum withdrawals each year (see `guide-01-cash-flow-projection-engine.md` for the rate table)
- There is no maximum — you can withdraw any amount, but the minimum is non-negotiable

In the system, `rrifConversionAge` is configurable but defaults to 71. The engine begins applying RRIF minimums from this age.

---

## Contribution Room Tracker

The contribution room tracker is a dedicated section on AccountsPage that shows the household's current RRSP and TFSA room positions. It is powered by the `contribution-room.ts` engine module.

**Engine file:** `packages/finance-engine/src/contributions/contribution-room.ts`

### What it shows

**RRSP section:**
- Current year's new room (18% × prior year income, capped at annual max)
- Cumulative unused room carried forward from prior years
- Pension adjustment deduction (if applicable)
- Net available room
- **Warning alert** if a household's total RRSP contributions would exceed available room

**TFSA section:**
- Annual limit by year since the member's 18th birthday
- Cumulative total room
- Contributions made (from account records)
- Net available room
- **Warning alert** for over-contribution

### How room is estimated
The system does not have access to the household's CRA Notice of Assessment. Room is estimated from:
- The member's date of birth (to know which TFSA years apply)
- The `rrspContributionRoom` field stored per member in the DB
- The current contributions stored in account records

For accurate room figures, users should check their MyCRA account and enter the current available room manually.

---

## Per-Account Return Rates

Each account can have an `estimatedReturnRate` that overrides the scenario-level `nominalReturnRate`. This allows modelling a household where:
- RRSP holds a balanced fund at 5.5% return
- TFSA holds an all-equity portfolio at 7% return
- Non-reg holds GICs at 4% return
- Cash earns 2.5% in a HISA

If no per-account rate is set, all investment accounts use the scenario's `nominalReturnRate`. Cash always uses `cashSavingsRate`.

When `equityPercent` / `fixedIncomePercent` / `alternativesPercent` / `cashPercent` are set on an account, the `calculateExpectedReturn` function in `packages/finance-engine/src/allocation/asset-allocation.ts` computes an expected return using CMA (Capital Market Assumptions) defaults:
- Equity: 7.0%
- Fixed income: 4.0%
- Alternatives: 5.5%
- Cash: 2.5%

These defaults are stored in `packages/shared/src/constants/canada.ts` as `CAPITAL_MARKET_ASSUMPTIONS` and can be updated in the Assumptions Audit dialog on the Dashboard.

---

## AccountsPage Features

The `AccountsPage` is the most feature-dense page in the application. It contains:

1. **Investment Accounts section** — CRUD for RRSP, RRIF, TFSA, NON_REG, CASH accounts with balance, allocation, and return rate
2. **Real Estate section** — Property CRUD (see `guide-07-real-estate.md`)
3. **Asset Allocation section** — Household-wide donut chart and glide path (see `guide-09-asset-allocation.md`)
4. **Contribution Room section** — RRSP and TFSA room tables with over-contribution alerts

All sections use the same MUI `Card` + `Dialog` pattern. Account creation/editing opens a Dialog with validation (sum-to-100 for allocation percentages, positive balance, valid account type).

---

## AI-Assisted Coding Quick Reference

**When adding a new account type:**
1. Add the string value to the `type` field's DB enum / Zod union in `packages/shared/src/schemas/`
2. Update `buildProjectionPayload` in `apps/api/src/projections/projections.service.ts` to aggregate the new type into the appropriate `CashFlowInput` field (or add a new field)
3. Add the new type to the `type` dropdown in the account creation dialog on AccountsPage
4. Add the type to the account type display chips and color codes on AccountsPage

**When aggregating accounts in the projection service:**
```typescript
// Pattern used in buildProjectionPayload:
const rrspBalance = accounts
  .filter(a => a.type === 'RRSP' || a.type === 'RRIF')
  .reduce((sum, a) => sum + a.balance, 0);
```

**What NOT to do:**
- Do not store RRSP/TFSA room in DB without validating the sum against CRA rules — the system estimates room but does not enforce CRA limits because it does not have access to CRA's records
- Do not assume all users have their RRSP as a single account — always aggregate by type
- Do not use `estimatedReturnRate` alone — if asset allocation fields are present, `calculateExpectedReturn` should be used instead
