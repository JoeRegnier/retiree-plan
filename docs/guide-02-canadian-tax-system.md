# Canadian Tax System

## Purpose and Role

The tax module is responsible for calculating how much income tax a household pays in any given year of the projection. Accurate tax modelling is fundamental to the system — it affects net cash flow, determines whether savings gaps appear, and drives key recommendations like RRSP meltdown timing and CPP deferral decisions.

**File:** `packages/finance-engine/src/tax/canadian-tax.ts`  
**Entry point:** `calculateTotalTax(taxableIncome: number, province: Province): number`

This is a pure function that returns the total income tax owed — federal plus provincial — for a given income level and province.

---

## Canadian Tax Structure

Canada uses a **combined federal + provincial marginal tax system**. There is no flat tax; each dollar of income is taxed in the bracket it falls into.

### Federal Tax Brackets (2024)

| Income Range | Federal Rate |
|---|---|
| $0 – $55,867 | 15.0% |
| $55,867 – $111,733 | 20.5% |
| $111,733 – $154,906 | 26.0% |
| $154,906 – $220,000 | 29.0% |
| Over $220,000 | 33.0% |

The federal Basic Personal Amount (BPA) provides a non-refundable tax credit that effectively makes the first ~$15,705 tax-free.

### Provincial Tax Brackets

All 13 provinces and territories have their own tax bracket systems. The `calculateTotalTax` function looks up provincial brackets for the user's `province` code (e.g. `'ON'`, `'BC'`, `'AB'`). The combined marginal rate is the sum of federal and provincial marginal rates at a given income level.

**Example combined top rates (2024):**
- Ontario: ~53.5%
- British Columbia: ~53.5%
- Alberta: ~48.0% (no provincial surtax)
- Quebec: ~53.3%

These rates matter most for the RRSP meltdown optimization — the engine tries to keep RRSP withdrawals below the income level where the combined rate jumps sharply.

---

## Government Benefits: CPP, OAS, and GIS

**File:** `packages/finance-engine/src/benefits/government.ts`

### Canada Pension Plan (CPP)

CPP is an earnings-based benefit paid from age 60 onwards. The amount depends on:
- **Years of contribution** — how long and how much the person contributed through employment
- **Average earnings** — relative to the Year's Maximum Pensionable Earnings (YMPE)
- **Timing** — taking CPP early (before 65) reduces benefits 0.6% per month; taking it late (after 65) increases benefits 0.7% per month

In the engine, CPP is represented as a `cppBenefitFraction` (0–1) applied to the current maximum CPP benefit:

```
monthlyBenefit = CPP_MAX_MONTHLY_2024 × cppBenefitFraction × adjustmentFactor
```

Where `adjustmentFactor` is:
- `1 - (0.006 × monthsBeforeAge65)` if starting before 65
- `1 + (0.007 × monthsAfterAge65)` if starting after 65

**Key 2024 figure:** Maximum CPP (age 65): $1,364.60/month = $16,375/year

**Engine function:** `calculateCppBenefit(startAge, benefitFraction)`

### Old Age Security (OAS)

OAS is a flat benefit available to Canadians with at least 10 years of residency after age 18. Full OAS requires 40 years of residency. Partial OAS is prorated at 1/40th per year.

**Key 2024 figure:** Maximum OAS (age 65): $713.34/month = $8,560/year

OAS can be deferred past 65, increasing by 0.6% per month (up to 7.2% per year, maximum at age 70 = 36% increase).

**OAS Clawback:** If net income exceeds $90,997 (2024), OAS is clawed back at a rate of 15 cents per dollar of excess income. Full OAS is eliminated at approximately $148,000 income. The engine uses this threshold in the withdrawal priority logic — see the cash-flow engine guide for details.

**Engine function:** `calculateOasBenefit(startAge, residencyYears)`

### Guaranteed Income Supplement (GIS)

GIS is an income-tested top-up for low-income OAS recipients. It is inversely income-tested: as income rises, GIS is reduced by 50 cents per dollar. GIS is fully eliminated at approximately $22,000 of non-OAS income for a single person.

GIS is relevant in the system for households where the projection shows very low income in retirement — perhaps due to a small RRSP, no DB pension, or a very early OAS start.

---

## How Tax Is Applied in the Projection

Each year, the engine collects all taxable income sources:

```
taxableIncome = employmentIncome
              + cppIncome
              + oasIncome
              + rrifMinimumWithdrawal
              + additionalRrspWithdrawals
              + pensionIncome  (if any)
```

TFSA withdrawals are **not** taxable. Non-registered account **growth** can have an annual drag applied via `nonRegTaxDragRate`, but the underlying capital gains rate when withdrawing is not explicitly applied in the base case (the estate module handles deemed disposition tax).

The engine calls `calculateTotalTax(taxableIncome, province)` and stores the result in `ProjectionYear.taxPaid`. This is the combined federal + provincial income tax for the year.

---

## Tax Impact on Financial Decisions

Understanding marginal rates is key to several major features in the system:

### RRSP vs. TFSA Contribution Tradeoff
- **RRSP:** Tax deduction today at your marginal rate; withdrawals taxed at future marginal rate
- **TFSA:** No deduction; withdrawals tax-free
- **The rule:** Contribute to RRSP when your current marginal rate is higher than your expected retirement marginal rate. Contribute to TFSA when they are equal or your retirement rate will be higher.
- The insights engine surfaces an alert when a household has unused RRSP room and non-registered savings — suggesting a switch.

### RRSP Meltdown (RRIF Management)
The goal is to drain the RRSP gradually into lower tax brackets before RRIF minimums force large draws at high marginal rates. See `guide-11-rrsp-meltdown-and-drawdown.md` for the full optimization strategy.

### OAS Clawback Zone
When income exceeds $90,997 (~$91K), every additional dollar costs 15 cents of OAS back. At $148K, OAS is completely eliminated. This creates an effective marginal rate 15% higher in this zone. The engine explicitly models this in the withdrawal strategy.

### Pension Income Splitting
Couples can split pension income (RRIF, DB pension) to equalize incomes and reduce the combined household tax burden. The insights engine detects income disparity between spouses and estimates the annual tax saving.

---

## Provincial Differences

All 13 provinces and territories are supported. The most relevant differences for retirement planning:

| Province | Notable Tax Characteristic |
|---|---|
| Alberta | No provincial surtax; flat 10% on first bracket; lowest combined rates for middle incomes |
| Ontario | Surtax on provincial tax above ~$5,315 (adds ~20%); high combined rates at $100K+ |
| Quebec | Highest combined rates; QPP instead of CPP (slight benefit formula differences); provincial credits differ |
| BC | Similar to Ontario but surtax structured differently |
| Atlantic provinces | Generally higher combined rates due to provincial rates |

The province is set on the household record and used consistently for all tax calculations throughout the projection.

---

## AI-Assisted Coding Quick Reference

**When adding a new income type that should be taxable:**
1. Add it to the `taxableIncome` accumulation in `cash-flow.ts`
2. It will automatically flow through `calculateTotalTax` — no changes to the tax module needed

**When CRA updates tax brackets:**
1. Update `packages/shared/src/constants/canada.ts` — the bracket tables are stored there
2. Update `packages/finance-engine/src/tax/canadian-tax.ts` if the calculation logic changes (rare)
3. Run `npm run test --workspace=packages/finance-engine` to catch any bracket test failures

**When adding a provincial tax bracket:**
1. The provincial bracket table is in `canadian-tax.ts` as a map keyed by `Province` code
2. Add or update the bracket array for the province
3. Verify with a known-good bracket calculation from the CRA provincial comparison tool

**What NOT to do:**
- Do not apply OAS clawback inside the tax function — it is handled in the withdrawal priority logic in `cash-flow.ts`
- Do not hard-code tax brackets in React components — all tax figures must come from the engine
- Do not assume a flat effective rate anywhere — always use the marginal bracket calculation
