# Contribution Room Tracker

## Purpose and Role

Contributing to an RRSP or TFSA without knowing your available room is one of the most common — and expensive — mistakes in Canadian personal finance. A 1% per month penalty tax on over-contributions can cost thousands of dollars. The contribution room tracker prevents this by displaying the household's estimated available room for both registered accounts and raising an alert when contributions approach or exceed limits.

**Engine file:** `packages/finance-engine/src/contributions/contribution-room.ts`  
**API:** Part of the accounts module — contribution room data is returned when fetching household accounts  
**Frontend:** `apps/web/src/pages/AccountsPage.tsx` (Contribution Room section)

---

## RRSP Contribution Room

### How room works

RRSP room is earned annually and accumulates indefinitely:
- **Annual new room:** 18% of prior year's earned income, capped at the annual maximum
  - 2023: $30,780 maximum
  - 2024: $31,560 maximum
- **Carryforward:** Any unused room from prior years carries forward
- **Pension adjustment (PA):** Members of a defined benefit or money purchase pension plan have their RRSP room reduced by a PA that reflects the value of pension benefits accruing for the year
- **Pension adjustment reversal (PAR):** If a member leaves a pension plan early, some of the RRSP room reduction is reversed
- **Over-contribution buffer:** Taxpayers may hold $2,000 over their room permanently without penalty; contributions above this $2,000 are subject to 1% per month penalty

### Engine function

```typescript
interface ContributionRoomInput {
  currentRrspRoom:  number    // Room available from CRA Notice of Assessment
  annualIncome:     number    // Prior year earned income (for new room calculation)
  currentYear:      number
  pensionAdjustment?: number  // DB/MP pension plan PA for the year
}

interface RrspRoomResult {
  newRoomThisYear:  number    // 18% × annualIncome, capped at max
  pensionAdjustment: number   // PA deduction
  netNewRoom:       number    // newRoomThisYear - pensionAdjustment
  totalAvailableRoom: number  // currentRrspRoom + netNewRoom
  annualMax:        number    // CRA maximum for this year
}
```

### Display on AccountsPage

The RRSP table shows:
- **Current available room** (from the `rrspContributionRoom` field stored on the member record)
- **New room this year** (calculated from member income)
- **Pension adjustment** (if applicable)
- **Net available room** = current + new - PA
- **Warning alert** (red) if projected contributions from new RRSP account entries would exceed available room

---

## TFSA Contribution Room

### How room works

TFSA room is entirely different from RRSP room:
- **Year-based, not income-based:** Every eligible Canadian accumulates the same annual room regardless of income
- **Lifetime room** accumulates from the later of: the year they turned 18 (if born before 1991), or 2009 (when TFSAs were introduced)
- **Withdrawals add back room the following January 1:** If you withdraw $10,000 from your TFSA in 2024, you get $10,000 new room back on January 1, 2025. This makes TFSA room essentially permanent — but it means using TFSA room, withdrawing, and re-contributing in the same year creates an over-contribution

### TFSA annual limits

```typescript
export const TFSA_ANNUAL_LIMITS: Record<number, number> = {
  2009: 5000, 2010: 5000, 2011: 5000, 2012: 5000,
  2013: 5500, 2014: 5500,
  2015: 10000,
  2016: 5500, 2017: 5500, 2018: 5500,
  2019: 6000, 2020: 6000, 2021: 6000, 2022: 6000,
  2023: 6500,
  2024: 7000,
  // Updated annually
};
```

**Cumulative room as of 2024** for a resident who was 18+ in 2009: **$95,000**

### Engine function

```typescript
interface TfsaRoomInput {
  birthYear:           number   // To determine which years have accumulated room
  currentYear:         number
  provinceTaxResident: Province // Non-residents cannot contribute
  priorContributions:  number   // Total contributions ever made
  priorWithdrawals:    number   // Total withdrawals ever made (re-added to room)
}

interface TfsaRoomResult {
  totalRoomAccumulated:  number   // Sum of annual limits from eligibility year to current
  withdrawalsReAdded:    number   // Withdrawals added to available room
  totalContributed:      number
  availableRoom:         number   // = totalRoomAccumulated + withdrawalsReAdded - totalContributed
  yearByYearBreakdown:   { year: number; limit: number; cumulative: number }[]
}
```

### Display on AccountsPage

The TFSA table shows year-by-year: the annual limit, running cumulative total, and a note showing the member's available room. There is an **over-contribution alert** (red chip) if the total of all TFSA account balances plus untracked contributions would exceed the calculated available room.

---

## Data Stored in DB

Two fields are stored per `HouseholdMember`:

```typescript
HouseholdMember {
  rrspContributionRoom: Float?  // Known available RRSP room (from CRA NOA)
  tfsaContributionRoom: Float?  // Known available TFSA room (from CRA)
}
```

These are the **user-reported** figures. The system cannot access CRA directly. The user should check their CRA My Account for accurate room figures and enter them during household setup.

The system estimates room from income and account history if the CRA figures are not entered, but estimates are less reliable due to:
- Unknown prior-year RRSP contributions
- Unknown TFSA withdrawals that add back room
- Pension adjustments not tracked

---

## How Contribution Room Affects the Projection

The contribution room tracker is primarily a data entry and alerting tool. Its impact on the projection:

1. **RRSP annual contribution** is set on the `Scenario` as `rrspAnnualContribution`. If this exceeds the estimated available room, an over-contribution warning appears on ScenariosPage.
2. **TFSA annual contribution** is set similarly. The engine enforces that TFSA contributions cannot exceed available room in the contribution tracking, but the projection itself does not enforce this — it is the user's responsibility.
3. The readiness score's "Savings Utilization" component gives credit for using available RRSP/TFSA room each year.

---

## Annual Limit Updates

When CRA announces new TFSA and RRSP limits for the upcoming year:

1. Update `TFSA_ANNUAL_LIMITS` in `packages/shared/src/constants/canada.ts` with the new year's amount
2. Update `RRSP_ANNUAL_MAXIMUMS` in the same file
3. The Market Data Assumptions Audit dialog on the Dashboard surfaces these as "needs review" when a new calendar year begins

---

## AI-Assisted Coding Quick Reference

**When a user reports their contribution room is wrong:**
- The system estimates room from account data; it does not read CRA's records
- Prompt the user to check their CRA My Account at `canada.ca/my-cra` and enter the exact room in the Household section
- The `rrspContributionRoom` and `tfsaContributionRoom` fields on `HouseholdMember` are the overrides

**When adding CRA data import (future feature):**
- The NOA (Notice of Assessment) PDF or XML contains exact RRSP room and TFSA room figures
- Parse these fields from the CRA file and populate `rrspContributionRoom` and `tfsaContributionRoom` on the member record
- Show a "last imported" date so the user knows how current the data is

**When implementing the over-contribution alert in projections:**
- Compare `scenario.rrspAnnualContribution × yearsToRetirement` against `member.rrspContributionRoom + projectedNewRoom`
- Raise an alert in the scenario editor if the cumulative projection exceeds available room in any year

**What NOT to do:**
- Do not calculate projected future RRSP room by assuming 18% of income — the user's actual contribution history with CRA is the only reliable source
- Do not block the user from saving if room is not entered — it should warn, not prevent, because room estimation is unreliable
- Do not forget that TFSA withdrawals add back room the *next January 1*, not the same year — this matters if modelling intra-year TFSA transfers
