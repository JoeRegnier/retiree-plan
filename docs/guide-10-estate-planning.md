# Estate Planning

## Purpose and Role

Estate planning in the context of this system answers: "When I die, how much will my heirs actually receive?" The answer is almost always less than the household's net worth, because Canada taxes certain assets at death as if they were sold or withdrawn on the day of death — a concept called "deemed disposition." On top of taxes, provincial probate fees reduce what passes to beneficiaries.

The estate module calculates the estate value, the taxes and fees payable at death, and the net amount to heirs. It also identifies whether the household's current trajectory will leave a meaningful estate or deplete to zero.

**Engine file:** `packages/finance-engine/src/estate/estate.ts`  
**API endpoint:** `POST /estate/calculate`  
**Frontend:** `apps/web/src/pages/EstatePage.tsx`

---

## Deemed Disposition at Death

When a Canadian dies, they are deemed to have disposed of all their assets at fair market value on the date of death. This triggers tax on any unrealized gains. The rules by asset class:

### RRSP / RRIF
At death, the entire RRSP/RRIF balance is added to income for the year of death. It is taxed at marginal rates — the top brackets, for large RRSPs.

**Exception:** RRSP/RRIF passes tax-free to a surviving spouse (spousal rollover). The surviving spouse assumes the account; tax is deferred until they withdraw or die. This is the single most powerful estate planning tool available to couples.

In the engine, `marginalTaxRateAtDeath` is applied to the RRSP balance when no surviving spouse is assumed:

```
rrspTaxOwed = rrspBalance × marginalTaxRateAtDeath
```

### Non-Registered Investments
Capital gains are realized on non-registered investments at death. The gain is the fair market value minus the Adjusted Cost Base (ACB). Only 50% of the capital gain is included in income (the 50% capital gains inclusion rate):

```
capitalGain     = nonRegBalance - nonRegACB
taxableGain     = capitalGain × 0.50
nonRegCapGainsTax = taxableGain × capitalGainsTaxRate
```

### Primary Residence
The primary residence is **not taxed** under the Principal Residence Exemption (PRE). The engine applies zero tax on the primary residence value.

### TFSA
The TFSA passes to heirs or a designated successor holder completely **tax-free**. No deemed disposition rules apply. This is why the TFSA is the ideal account to hold as long as possible — it passes outside the estate without triggering any tax.

### Other Assets
The `EstateInput` accepts an `otherAssetsValue` and `otherAssetsACB` for assets like business interests, investment property, foreign assets, and collectibles. These are taxed at the same capital gains inclusion rate.

---

## Probate Fees

Probate (formally called "Certificate of Appointment of Estate Trustee" in Ontario) is a court fee to validate that a will is authentic and the executor has authority to act. Not all assets go through probate — assets with named beneficiaries (RRSP, TFSA, life insurance) bypass probate entirely. Real estate and non-registered investments with no beneficiary designation typically do go through probate.

Probate fee rates by key provinces:

| Province | Rate Structure |
|---|---|
| Ontario | 0.5% on first $50K; 1.5% on excess |
| British Columbia | $6 per $1,000 on $25K–$50K; $14 per $1,000 on excess |
| Alberta | $35–$525 based on estate size (flat tiers, very low) |
| Quebec | No probate fees for notarial wills |
| Saskatchewan | 0.7% of estate |

The `probateFees(grossEstate, province)` function in `estate.ts` implements the fee calculation for all 13 provinces/territories.

**Note:** The RRSP/RRIF, TFSA, and life insurance proceeds with designated beneficiaries bypass probate. The engine calculates probate on `grossEstate`, which is defined as only the assets that go through the estate (primarily non-registered investments and real estate that will go through probate). Adjust `grossEstate` inputs to exclude assets with beneficiary designations.

---

## Engine Function

```typescript
interface EstateInput {
  rrspBalance:             number   // RRSP/RRIF balance at death
  tfsaBalance:             number   // TFSA balance (no tax)
  nonRegBalance:           number   // Non-registered investment balance
  nonRegACB:               number   // Adjusted cost base of non-reg holdings
  otherAssetsValue:        number   // Other assets (cottage, business, etc.)
  otherAssetsACB:          number   // ACB of other assets
  primaryResidenceValue:   number   // Primary residence (PRE — no tax)
  marginalTaxRateAtDeath:  number   // Combined marginal rate at death (e.g. 0.535)
  capitalGainsTaxRate:     number   // Effective cap gains rate (e.g. 0.267 = 0.535 × 0.5)
  province?:               Province // For probate fee calculation (default: 'ON')
}

interface EstateResult {
  grossEstate:        number   // Total FMV of all assets
  rrspTaxOwed:        number   // Income tax on RRSP/RRIF balance
  nonRegCapGainsTax:  number   // Capital gains tax on non-reg
  otherAssetsTax:     number   // Capital gains tax on other assets
  probateFees:        number   // Provincial probate fees
  totalTaxAndFees:    number   // Sum of all taxes and fees
  netEstateToHeirs:   number   // What heirs actually receive
  effectiveTaxRate:   number   // totalTaxAndFees / grossEstate
  breakdown:          EstateBreakdownItem[]  // Line-by-line detail
}
```

**Engine function call:**
```typescript
import { calculateEstate } from '../estate/estate.js';

const result = calculateEstate({
  rrspBalance: 800_000,
  tfsaBalance: 200_000,
  nonRegBalance: 150_000,
  nonRegACB: 100_000,
  otherAssetsValue: 0,
  otherAssetsACB: 0,
  primaryResidenceValue: 1_200_000,
  marginalTaxRateAtDeath: 0.535,
  capitalGainsTaxRate: 0.2675,   // 0.535 × 0.5
  province: 'ON',
});
// result.netEstateToHeirs ≈ $1,800,000 after ~$428K in RRSP tax + probate
```

---

## EstatePage

The EstatePage provides:
1. **Input section:** Current projected balances at `endAge` (pre-filled from the last projection run), plus ACB fields, marginal rate at death, province
2. **Results section:**
   - Gross estate value chip
   - Net to heirs chip (prominently displayed, often shockingly lower than gross)
   - Effective estate tax rate gauge
3. **Breakdown table:** Line-by-line showing RRSP tax, capital gains on non-reg, probate fees, with a TFSA row showing $0 tax (to reinforce its value)
4. **Spousal rollover note:** Banner explaining that if a spouse survives, the RRSP passes tax-free to them (tax deferred, not eliminated)

---

## The Spousal RRSP Rollover Strategy

For married couples, the most impactful estate strategy is the spousal RRSP rollover. When Spouse A dies, their RRSP/RRIF rolls over to Spouse B's name — no $400K tax bill at death. The tax is deferred until Spouse B withdraws from the RRIF or dies.

**The implication for drawdown planning:** A couple with $1M RRSP does not face a $500K tax bill as long as one spouse is alive. However, when the second spouse dies, the full remaining RRSP is taxable. This creates a strong incentive to drain the RRSP during the second spouse's retirement — exactly what the RRSP meltdown strategy addresses.

---

## AI-Assisted Coding Quick Reference

**When updating the capital gains inclusion rate:**
- 2024 federal budget proposed 2/3 inclusion rate for gains over $250,000 (vs. current 1/2)
- Update the `0.5` multiplier in `calculateRealEstateCapitalGain` (real-estate.ts) AND in `calculateEstate` (estate.ts)
- The threshold ($250K) should be a parameter, not hard-coded, to allow scenarios above and below

**When implementing the spousal rollover properly:**
- Add a `hasSurvivingSpouse: boolean` field to `EstateInput`
- When `hasSurvivingSpouse = true`, set `rrspTaxOwed = 0` (deferred to spouse's eventual estate)
- Show a note explaining the deferral vs. elimination distinction

**When adding beneficiary designation tracking:**
- RRSP, TFSA, RRIF can all have named beneficiaries (bypass probate)
- Add a `hasBeneficiaryDesignation: boolean` to the `Account` model
- In `probateFees` calculation, exclude accounts with beneficiary designations from `grossEstate`
- Surface an insight when a registered account has no beneficiary designation (increases probate exposure)

**What NOT to do:**
- Do not include TFSA in the income or tax calculations at death — it is completely tax-free
- Do not apply probate fees to the entire net worth — only assets going through the estate (without beneficiary designations or joint ownership) are subject to probate
- Do not confuse the 50% inclusion rate (fraction of gain included in income) with the effective tax rate on capital gains (which is marginalRate × 0.5)
