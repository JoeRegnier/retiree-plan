# Canadian Financial Concepts Reference

This document captures key Canadian financial rules and concepts that the finance engine must implement.

## Registered Account Types

### RRSP (Registered Retirement Savings Plan)
- Contributions are tax-deductible (reduce taxable income).
- Contribution room: 18% of prior-year earned income, up to annual limit ($31,560 for 2024), minus pension adjustment.
- Unused room carries forward indefinitely.
- Withdrawals are fully taxable as income.
- Must convert to RRIF by Dec 31 of the year the holder turns 71.
- Over-contribution penalty: 1% per month on amounts > $2,000 buffer.

### TFSA (Tax-Free Savings Account)
- Contributions are NOT tax-deductible.
- Growth and withdrawals are completely tax-free.
- Annual contribution room: $7,000 (2024); indexed to inflation in $500 increments.
- Cumulative room since 2009 (age 18+).
- Withdrawals restore contribution room the following January 1.

### RESP (Registered Education Savings Plan)
- Lifetime contribution limit: $50,000 per beneficiary.
- CESG: Government matches 20% of first $2,500/year (max $500/year, $7,200 lifetime).
- Additional CESG for lower-income families.
- Education Assistance Payments (EAPs) taxable to the student.

### LIRA / LIF (Locked-In Retirement Account / Life Income Fund)
- Holds pension funds from former employers.
- LIRA: accumulation phase (no withdrawals except hardship).
- LIF: decumulation phase; minimum and maximum annual withdrawal limits (vary by province).
- Must convert LIRA to LIF by age 71.

### RRIF (Registered Retirement Income Fund)
- Mandatory minimum withdrawal each year (percentage based on age or spouse's age).
- Withdrawals taxable as income.
- No maximum withdrawal.
- Minimum withdrawal percentages: age 71 = 5.28%, age 72 = 5.40%, ... age 95+ = 20.00%.

## Government Benefits

### CPP/QPP (Canada/Quebec Pension Plan)
- Standard start age: 65.
- Can start as early as 60 (reduced by 0.6%/month = 36% reduction at 60).
- Can defer to 70 (increased by 0.7%/month = 42% increase at 70).
- Maximum monthly benefit at 65 (2024): $1,364.60.
- Based on contributory period and earnings.
- CPP2: Additional contributions on earnings between first and second ceilings (starting 2024).

### OAS (Old Age Security)
- Available at age 65 (can defer to 70 for 0.6%/month increase = 36% at 70).
- Maximum monthly (2024): ~$713.34 (indexed quarterly to CPI).
- Clawback (recovery tax): 15% on net income above threshold ($90,997 for 2024).
- Fully clawed back at ~$148,000+ income.
- 40 years of Canadian residency for full OAS; pro-rated for 10-40 years.

### GIS (Guaranteed Income Supplement)
- For low-income OAS recipients.
- Income-tested; reduced as income increases.
- Must apply annually.

## Tax System

### Federal Tax Brackets (2024)
| Bracket | Rate |
|---|---|
| $0 – $55,867 | 15% |
| $55,867 – $111,733 | 20.5% |
| $111,733 – $154,906 | 26% |
| $154,906 – $220,000 | 29% |
| $220,000+ | 33% |

### Basic Personal Amount: $15,705 (2024)

### Capital Gains
- Inclusion rate: 50% for first $250,000 (individuals), 66.67% above (as of June 25, 2024 proposal).
- Only the included portion is added to taxable income.

### Dividend Tax Credit
- **Eligible dividends** (from public corps): gross-up by 38%, then federal credit of 15.0198%.
- **Non-eligible dividends** (from CCPCs/small business): gross-up by 15%, then federal credit of 9.0301%.
- Provincial credits vary.

### Withholding Tax on RRSP/RRIF Withdrawals
| Amount | Rate (non-QC) |
|---|---|
| ≤ $5,000 | 10% |
| $5,001 – $15,000 | 20% |
| > $15,000 | 30% |
- Quebec: 5%/10%/15% federal + provincial withholding.

## Estate Planning

### Deemed Disposition at Death
- All capital property deemed sold at FMV at date of death.
- Exception: rollover to surviving spouse.
- RRSP/RRIF balance included in final return as income (unless rolled to spouse/dependent).

### Probate Fees by Province
- Vary significantly: Ontario = 1.5% above $50K; BC = 1.4% above $50K; Alberta = max $525; Quebec = $0 (notarial will).

## Provincial Tax Notes
- Quebec has its own tax return separate from federal.
- Ontario surtax on basic provincial tax above thresholds.
- Provincial credits for dividends, age, pension income differ.

## Inflation & Indexing
- CRA indexes tax brackets, credits, and benefit thresholds annually to CPI.
- OAS indexed quarterly.
- CPP/QPP indexed annually.
- The engine should support user-configurable inflation rate (default: 2.0%).
