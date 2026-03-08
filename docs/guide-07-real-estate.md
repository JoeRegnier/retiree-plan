# Real Estate and Rental Income

## Purpose and Role

For most Canadian households, the primary residence is the largest asset on their balance sheet — often larger than their RRSP. Yet traditional retirement planning tools treat real estate as invisible. RetireePlan models real property as a first-class asset that participates in the projection through appreciation, rental income, downsizing events, and capital gains at disposition.

**Database model:** `RealEstate` in `prisma/schema.prisma`  
**Engine file:** `packages/finance-engine/src/real-estate/real-estate.ts`  
**API module:** `apps/api/src/accounts/` (real estate is part of the accounts module)  
**Frontend:** `apps/web/src/pages/AccountsPage.tsx` (Real Estate section)

---

## Property Types

The system supports three types of real property:

| Type | Modelled as | Capital Gains Treatment |
|---|---|---|
| Primary residence | Appreciating asset + optional downsizing event | **Exempt** via the Principal Residence Exemption (PRE) |
| Rental property | Income-generating asset | Taxable capital gain at disposition |
| Vacation property / cottage | Appreciating asset | Taxable capital gain (unless PRE nominated) |

A household can have multiple properties of any combination. Each is stored as a separate `RealEstate` record.

---

## The Data Model

```typescript
RealEstate {
  id              String
  householdId     String
  name            String        // "Main St House", "Cottage"
  type            String        // 'primary' | 'rental' | 'vacation'
  
  currentValue    Float         // Current estimated market value
  purchasePrice   Float         // Original purchase price (for ACB / capital gain)
  purchaseYear    Int           // Year of purchase (for PRE calculation)
  
  // Appreciation
  annualAppreciationRate  Float // e.g. 0.03 = 3% per year
  
  // Rental income (rental properties only)
  grossRentalIncome   Float?    // Annual gross rental income
  rentalExpenses      Float?    // Annual expenses: mortgage interest, property tax, maintenance
  
  // Downsizing (primary residence)
  downsize            Boolean   // Does the household plan to sell this property?
  downsizeAge         Int?      // Age at which they sell
  downsizeCommission  Float?    // Real estate commission (e.g. 0.05 = 5%)
  downsizeReinvest    Boolean?  // Invest net proceeds into portfolio?
}
```

---

## Engine Functions

### `projectRealEstateValue(property, fromAge, toAge)`

Projects the property's market value from the current age to a future age using the annual appreciation rate:

```
futureValue = currentValue × (1 + annualAppreciationRate)^(toAge - fromAge)
```

This is used to estimate the property's value at the downsizing age for proceeds calculation.

### `calculateNetRentalIncome(property)`

For rental properties, calculates the annual net income:

```
netRentalIncome = grossRentalIncome - rentalExpenses
```

This net figure is added to the household's `incomeSources[]` in `buildProjectionPayload`, active for the years the property is held. For simplicity, the income is treated as ordinary income (no capital cost allowance modelling in the current implementation).

### `calculateDownsizingProceeds(property, currentAge)`

Calculates the net proceeds available to invest when the household sells the property at `downsizeAge`:

```
projectedValue    = currentValue × (1 + appreciationRate)^(downsizeAge - currentAge)
commission        = projectedValue × downsizeCommission
netProceeds       = projectedValue - commission
```

If `type === 'primary'`, the Principal Residence Exemption applies and there is no capital gains tax. These net proceeds are added to the portfolio as a `lump_sum_in` milestone event at the downsizing age. If `downsizeReinvest` is true, the proceeds are directed into the non-registered investment account; otherwise they go to the cash bucket.

### `calculateRealEstateCapitalGain(property, currentAge)`

For rental and vacation properties, calculates the capital gain at disposition:

```
projectedValue = currentValue × (1 + appreciationRate)^(yearsHeld)
capitalGain    = projectedValue - purchasePrice
taxableGain    = capitalGain × 0.5           // 50% inclusion rate
taxOwed        = taxableGain × marginalRate  // Approximate
```

The `0.5` inclusion rate reflects the current Canadian capital gains inclusion rate. Note: The 2024 federal budget proposed increasing this to 2/3 for gains above $250,000 as of June 2024 — this update should be applied to `calculateRealEstateCapitalGain` when the legislation is confirmed.

### Principal Residence Exemption (PRE)

The PRE eliminates capital gains tax on the sale of a property designated as the principal residence. Key rules:
- Only one property per family unit (including spouses and dependent children under 18) can be designated per year
- Designation is made on Form T2091 when the property is sold
- If a household owns a house AND a cottage, they can split the designation years between properties to minimize total capital gains tax

The current engine assumes the primary residence is always fully exempt. PRE optimization between a primary residence and cottage is identified as a future enhancement.

---

## How Real Estate Flows Into the Projection

The `buildProjectionPayload` function in the projections service processes real estate records as follows:

1. **Rental income** → Added to `incomeSources[]` with appropriate age bounds (stops when the property is sold or the household reaches `endAge`)
2. **Downsizing proceeds** → Added as a `lump_sum_in` milestone event at `downsizeAge`. The milestone amount is the net proceeds after commission. This creates a one-time cash injection in the year the household sells.
3. **Capital gains tax** → For rental/vacation properties, the capital gain is estimated and a corresponding `lump_sum_out` expense is added at the downsizing year (tax payment)

This means the downsizing event shows up in the projection charts as a visible spike in net worth at the sale age — the household's portfolio suddenly grows by the net proceeds.

---

## AccountsPage — Real Estate Section

The Real Estate section below the account cards on AccountsPage shows:

- A card for each property with: name, type chip (Primary / Rental / Vacation), current value, appreciation rate, and rental income (if applicable)
- **Downsizing plan chip** — shows the planned downsizing age if set
- A "+ Add Property" button opening the property dialog
- **KPI cards:**
  - Total Property Value (sum of all current property values)
  - Net Rental Income (sum of all net rental income)

The property creation/edit dialog includes all fields from the data model with appropriate validation (appreciation rate 0–10%, commission 0–10%, rental income > expenses validation advisory).

---

## AI-Assisted Coding Quick Reference

**When adding a new property type (e.g. commercial real estate):**
1. Add the type string to the `type` field's Zod union in `packages/shared/src/schemas/`
2. Add tax treatment logic in `calculateRealEstateCapitalGain` — commercial property has different rules (no PRE, full inclusion)
3. Add a new chip color/icon in AccountsPage for the new type
4. Update `buildProjectionPayload` to handle the new type appropriately

**When implementing PRE nomination optimization:**
- The optimization problem: given N years a couple owns both a primary residence and a cottage, allocate the PRE designation years to minimize total capital gains
- Approach: A greedy or brute-force search across possible designation-year allocations for small N; LP relaxation for larger N
- The function signature would be: `optimizePrincipalResidenceExemption(properties: RealEstate[], memberBirthYear: number): { property: RealEstate, nominatedYears: number[] }[]`

**When updating the capital gains inclusion rate:**
1. Update the `0.5` constant in `calculateRealEstateCapitalGain` and add a note about which budget bill changed it
2. Consider whether the inclusion rate should be a parameter (for pre/post threshold scenarios) rather than a constant
3. Also update `estate.ts` which independently calculates capital gains tax at death

**What NOT to do:**
- Do not assume the primary residence has zero effect on retirement income — downsizing is often a major retirement funding event
- Do not aggregate all real estate into a single "property value" number — each property needs to be tracked separately for capital gains and PRE purposes
- Do not calculate rental taxes in the real estate module — net rental income flows into the tax calculation as ordinary income in the projection engine
