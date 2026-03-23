# RetireePlan — Proposed Enhancements Roadmap

**Document purpose:** Identify every gap between the current app and a market-leading Canadian retirement planning product.  Each item is rated for **impact** (how much does this differentiate vs. competitors or delight users) and **effort** (engineering complexity), using H/M/L.

---

## Current Feature Inventory (as of March 2026)

| Module | What exists |
|---|---|
| Household | Members, income sources (CPP, OAS, Employment, Pension, etc.), expenses |
| Accounts | RRSP, TFSA, LIRA, LIF, Non-Reg, Cash; brokerage sync (Questrade, Wealthsimple, TD) |
| Scenarios | Multiple parameter sets; side-by-side Compare page |
| Projections | Year-by-year deterministic engine; Cash Flow, Sankey, Waterfall, Income Allocation, Monte Carlo fan charts |
| Simulations | Monte Carlo (1 000 trials), Historical Backtest (TSX 1970–2024), Guyton-Klinger, Success-Rate Heatmap, Historical Scenarios |
| Earliest Retire Finder | Parallel sweep across age range; bar chart + detail view |
| Tax Analytics | 2024 federal + provincial bracket visualiser; effective vs. marginal rate curves; OAS clawback |
| RRSP Meltdown | `optimizeRrspMeltdown` engine; meltdown strategy card in Simulations |
| Estate | Deemed disposition, probate by province, capital gains on non-reg, principal residence |
| International | Canada-US treaty rates, departure tax, T1135, RRSP non-resident, QROPS, repatriation, SS/CPP totalization |
| Milestones | Ad-hoc lump-sum events (buy cottage, gift, etc.) |
| Integrations | YNAB (budgets/transactions), Questrade, Wealthsimple, TD |
| AI Assistant | Context-aware OpenAI chat with household data |
| PDF / CSV Export | Full multi-scenario PDF with charts; CSV row-per-year data |
| Retirement Readiness Score | Composite 0–100 gauge (Monte Carlo 40%, income replacement 25%, tax efficiency 20%, diversification 15%); score component bars; projection stat tiles; portfolio allocation stacked bar |
| Plan Completeness Checklist | 13-item checklist with hints; per-category progress bars (Basics, Income, Accounts, Planning); plan quality % badge |
| Income Replacement Card | Pre-retirement vs. retirement income comparison with replacement ratio gauge |
| Net Worth Sparkline | D3 animated area sparkline on Dashboard showing projected net worth timeline with milestone annotations |
| Quick What-If Calculator | Floating drawer with sliders (extra savings, return rate, retirement age shift, life expectancy); live chart in Web Worker; integrated into QuickActionsPanel overlay |
| Desktop Distribution | Electron 32 app bundling its own API server; packaged as DMG (macOS x64/arm64), NSIS installer (Windows x64), and AppImage+deb (Linux x64); GitHub Actions CI workflow builds all three platforms on each version tag |

---

## Gap Analysis vs. Competitors

| Competitor | Key differentiator they have that we lack |
|---|---|
| **Boldin (NewRetirement)** | Plan health score, Roth-equivalent (RRSP→TFSA) conversion optimizer, bucket strategy, advisor sharing, plan audit checklist |
| **MaxiFi** | Consumption-smoothing model, life insurance needs calculator, lifetime balance sheet |
| **Projection Lab** | Linked real accounts with live balance pull, spending category drill-down, goal-based tracking |
| **FP Canada / Naviplan** | Defined-benefit pension splitting, RDSP, corporate structure |
| **DIY spreadsheet users** | Pension splitting optimizer, CPP/OAS timing break-even, full GIS modelling |

---

## Proposed Enhancements — Grouped by Theme

---

### Theme 1 — Plan Health & Actionable Intelligence

These are the highest-ROI items. Users need a clear answer to *"how good is my plan?"* and the app currently gives data without a verdict.

#### 1.1 Retirement Readiness Score ✅ SHIPPED
**Impact: H | Effort: M**

A single composite score (0–100) displayed on the Dashboard, computed from:

- Monte Carlo success rate (40% weight)
- Income replacement ratio in Year 1 of retirement (25%)
- Tax efficiency vs. theoretical optimum (20%)
- Diversification across account types — RRSP:TFSA:Non-Reg balance (15%)

Gauge dial, per-component score bars, projection stat tiles (Monte Carlo %, portfolio survival age, peak net worth), portfolio allocation stacked bar, and "Opportunities to improve" issue list are all live on the Dashboard.

**Shipped:** March 2026. Location: Dashboard left column card.

---

#### 1.2 Automated Insights Engine ✅ SHIPPED
**Impact: H | Effort: M**

A rule-based engine that fires contextual recommendations. Examples:

| Trigger | Recommendation |
|---|---|
| RRSP balance > 2× annual income AND user is 55–68 | "You have $X in RRSP. A meltdown withdrawal of $Y/yr from now to 71 saves an estimated $Z in lifetime taxes." |
| OAS clawback zone crossed in projection | "Your projected income at 65 ($X) exceeds the OAS clawback threshold ($90,997). Shift RRSP withdrawals earlier to reduce clawback." |
| TFSA contribution room left unused | "You have $X in unused TFSA room. Moving non-registered assets accelerates $Y in tax-free growth." |
| RRIF conversion year approaching | "You turn 71 in [N] years. RRIF conversion is mandatory. Your minimum withdrawal will be $X/yr." |
| Age 60 with CPP eligible | "You can take CPP now at a reduced rate or delay to 65/70. Run CPP Timing Optimizer to see break-even." |
| Pension splitting eligible (coupled household) | "You and your spouse have a $X income gap. Pension splitting could save up to $Y/yr in taxes." |

Surface a maximum of 5 insights at a time, ordered by estimated dollar impact. Each insight links to the relevant page.

7-rule engine (`insights-engine.ts`) covering RRSP meltdown, OAS clawback, TFSA room, RRIF reminder, CPP timing, pension splitting, and RRSP room. Dashboard InsightsCard with category icons, dollar impact chips, and priority indicators. AppBar notification bell badge with insight count.

**Shipped:** March 2026. Location: Dashboard full-width card + AppBar bell badge.

---

#### 1.3 Plan Completeness Checklist ✅ SHIPPED
**Impact: M | Effort: S**

13-item checklist with actionable hint text per item. Per-category progress bars (Basics, Income, Accounts, Planning) in a 2×2 grid. Incomplete items listed with severity. Completed items in 2-column grid. Plan quality % badge with circular progress ring. YNAB expense categories are included in the expenses check.

**Shipped:** March 2026. Location: Dashboard right column card.

---

### Theme 2 — Income Optimization

Canada has unusually rich income-timing decisions (CPP/OAS deferral, pension splitting, RRSP meltdown) that no single tool handles end-to-end.

#### 2.1 CPP Timing Optimizer  
**Impact: H | Effort: M**

A dedicated page (or prominent card in HouseholdPage/Projections) that calculates:

- Benefit at 60, 61, … 70 (using current reduction/enhancement factors: −0.6%/mo before 65, +0.7%/mo after 65)
- Break-even age for each start age vs. 65 baseline
- Lifetime value (NPV) under three mortality assumptions: life table median, optimistic (+5 years), conservative (−5 years)
- Interactive line chart: cumulative lifetime CPP benefit by start age vs. age of death

Input: expected CPP benefit fraction (or let user paste from My Service Canada).

**Integration:** Feed the winner age back as the default `cppStartAge` in scenarios.

---

#### 2.2 OAS Deferral + Clawback Optimizer  
**Impact: H | Effort: M**

Similar to CPP Optimizer but for OAS:

- OAS at 65 vs. deferred to 70 (+0.6%/mo deferral bonus)
- Clawback modelling: if income exceeds $90,997 (2024), OAS is clawed back at 15¢/$
- Two-scenario table: "Take at 65" vs. "Defer to 70" showing: annual OAS, clawback amount, net OAS received, break-even age
- Recommendation chip: e.g. "Deferring to 70 pays off if you live past age 73 AND your income stays below the clawback threshold."

**Integration:** Scenario parameters for `oasStartAge` auto-populated from optimizer output.

---

#### 2.3 Pension Income Splitting Optimizer (Couples)  
**Impact: H | Effort: M**

When the household has two members, calculate the tax savings from allocating up to 50% of eligible pension income to the lower-income spouse:

- Eligible income: RRIF withdrawals (any age), annuity payments, RPP/DB pension, LIF/LIRA income
- NOT eligible: CPP, OAS, RRSP withdrawals before age 65
- Show: combined household tax before/after splitting, optimal split %, annual tax saving
- Year-by-year table across the full projection period

**Engine change:** `runCashFlowProjection` needs to accept a `pensionSplitFraction` per member and compute combined household tax rather than per-person.

---

#### 2.4 Spousal RRSP Contribution Optimizer ✅ SHIPPED
**Impact: M | Effort: S**

For couples with income disparity, calculate:

- Tax saved this year by contributing to spousal RRSP vs. own RRSP
- 3-year attribution rule warning
- Break-even years for the strategy to pay off

`analyzeSpousalRrsp()` in `spousal-rrsp.ts` computes contributor marginal tax saved, annuitant marginal tax on withdrawal, net annual saving, attribution risk flag (`lastContributionYear + 3` rule), and recommendation text. `Account` schema extended with `isSpousalRrsp`, `contributorMemberId`, `annuitantMemberId`, `lastContributionYear`, `costBasis` (Prisma migration `20260322193414_add_spousal_rrsp_and_acb`). `SpousalRrspCalculator` component on ProjectionsPage (Spousal RRSP tab) with contributor/annuitant income + province inputs, attribution risk Alert, and 3 metric cards. API endpoint: `POST /optimization/spousal-rrsp`.

**Shipped:** March 2026. Location: Projections page Spousal RRSP tab + engine `spousal-rrsp.ts`.

---

#### 2.5 GIS (Guaranteed Income Supplement) Planner  
**Impact: M | Effort: M**

GIS is available for low-income OAS recipients (threshold ~$21,768/yr single in 2024). For users with low projected income, show:

- GIS benefit estimate given projected net income
- How specific moves (RRSP withdrawal, part-time income) affect GIS eligibility
- Alert: "Withdrawing $5,000 more from RRSP this year reduces your GIS by $2,500 — consider timing."

Currently the engine tracks OAS but appears to not compute GIS clawback. Add `calcGIS(netIncome, province)` to `benefits/government.ts`.

---

### Theme 3 — Spending & Budget Planning

Retirement planning requires a realistic spending model, not just one flat "annual expenses" number.

#### 3.1 Phased Retirement Spending Template ✅ SHIPPED
**Impact: H | Effort: M**

The "smile curve" of retirement spending: most retirees spend more in early retirement (active years, travel), less in mid-retirement (slower), then more again in late retirement (healthcare).

Add a `SpendingPhase[]` UI on the Scenarios/Household page:

```
Phase 1: Age 60–74  — 100% of base expenses + $10,000 travel budget
Phase 2: Age 75–84  — 80% of base expenses
Phase 3: Age 85+    — 90% of base + $8,000/yr healthcare escalation
```

ScenariosPage spending phases section renamed to "Phased Retirement Spending" with explanatory text about the smile curve, phase labels, and a "Travel Heavy Early" preset added alongside existing Conservative and Moderate presets.

**Shipped:** March 2026. Location: Scenarios page spending section.

---

#### 3.2 Expense Category Drill-Down  
**Impact: M | Effort: M**

YNAB integration already imports categorized spending. Extend this to:

- Show actual spending by category on the Dashboard
- Let users set per-category retirement budgets
- Project each category forward with category-specific inflation rates (e.g., healthcare: 5%/yr, housing: 2.5%/yr, food: CPI)
- "Actual vs. Planned" variance tracking once the user reaches retirement

---

#### 3.3 Healthcare Cost Modeller  
**Impact: M | Effort: S**

Add a healthcare cost input section to HouseholdPage:

- Private drug plan premium (after employer coverage ends)
- Dental and vision estimates
- Long-term care cost estimate (current Ontario average: ~$2,700/mo semi-private)
- "Self-insure vs. buy LTC insurance" comparison: model the break-even point

---

#### 3.4 One-Time "What-If" Quick Calculator ✅ SHIPPED
**Impact: H | Effort: S**

Four sliders (extra monthly savings, return rate change ±3%, retirement age shift ±5 yr, life expectancy 75–105) run `runCashFlowProjection` in a Web Worker, debounced at 300ms. Net-worth delta chip and baseline-vs-what-if D3 line chart update live. Integrated into the QuickActionsPanel floating overlay (Calculate icon) — no longer a separate FAB that overlapped UI.

**Shipped:** March 2026 (initial); delta comparison bug fix (always showed −$5,633) corrected March 2026 — delta now measured at original planned retirement age.

---

### Theme 4 — Account & Asset Management

#### 4.1 RRSP/TFSA Contribution Room Tracker ✅ SHIPPED
**Impact: H | Effort: M**

A dedicated section (on AccountsPage or a new sub-page) that shows:

- **RRSP:** Contribution limit this year (18% of prior-year earned income, up to annual maximum), cumulative unused room carried forward, pension adjustment (DB members), projected room at retirement
- **TFSA:** Annual limit by year since 2009 ($5,000–$7,000), total room since 18th birthday, withdrawals re-added the following January
- Warning alerts: "You are over-contributing" (if user enters an amount exceeding room)

Enhanced Contribution Room Tracker section on AccountsPage with detailed RRSP and TFSA tables showing annual limits, cumulative room, contributions, and remaining room. Over-contribution alerts displayed with warning styling. Member-level `rrspContributionRoom` and `tfsaContributionRoom` fields persisted in DB.

**Shipped:** March 2026. Location: Accounts page dedicated section.

---

#### 4.2 Asset Allocation Modeller ✅ SHIPPED
**Impact: M | Effort: M**

Currently each account has `estimatedReturnRate`. Upgrade to:

- A structured asset allocation model: % equity / % fixed income / % alternatives / % cash per account
- Age-based glide path builder (target date fund logic): drag a slider to set equity % at retirement, it linearly reduces from today
- Expected return auto-calculated from asset mix using configurable capital market assumptions (default: equity 7%, bonds 4%, cash 2%)
- Visualization: donut chart of household-wide allocation + glide path line chart

Per-account allocation fields (equityPercent, fixedIncomePercent, alternativesPercent, cashPercent) in Prisma schema and account dialog with sum=100% validation and computed expected return. AllocationDonut (D3 interactive donut) and GlidePathChart (D3 line chart) components. Household Asset Allocation section on AccountsPage. `asset-allocation.ts` engine module with `calculateExpectedReturn`, `buildGlidePath`, `calculateHouseholdAllocation`. `CAPITAL_MARKET_ASSUMPTIONS` in shared constants.

**Shipped:** March 2026. Location: Accounts page + engine module.

The engine's `GlidePathStep[]` already supports this — only the UI is missing.

---

#### 4.3 Real Estate & Rental Income ✅ SHIPPED
**Impact: M | Effort: M**

Extend Accounts to include real property:

- Primary residence: value, purchase price (for capital gain tracking), estimated annual appreciation
- Rental property: gross rental income, expenses (mortgage, maintenance, property tax), net rental income fed into income sources
- Downsizing event: sell primary home at a future age, net proceeds (after real estate commission) invested into portfolio
- Vacation property / cottage: capital gain exposure, principal residence nomination optimization

Full CRUD for real estate properties via `RealEstate` Prisma model, NestJS API module, and AccountsPage UI section with property dialog. Engine module (`real-estate.ts`) with `projectRealEstateValue`, `calculateNetRentalIncome`, `calculateDownsizingProceeds`, `calculateRealEstateCapitalGain` (with Principal Residence Exemption handling).

**Shipped:** March 2026. Location: Accounts page + API + engine.

---

#### 4.4 Defined Benefit Pension Deep-Dive  
**Impact: H | Effort: M**

Many Canadians have DB pensions that are modelled crudely as a fixed "Pension" income source. Add a proper DB pension module:

- Pension formula: Years of service × Benefit rate × Best-N-year average salary
- Survivor's benefit fraction (e.g. 60% Joint & Survivor)
- Bridging benefit (additional amount until age 65, then reduced once CPP starts)
- Indexing: CPI-indexed vs. fixed
- Commuted value vs. pension election comparison

**Proposed UI:** A dedicated dialog or accordion in HouseholdPage for income sources with type "Pension" — expand to reveal DB formula fields.

---

### Theme 5 — Withdrawal Strategy

#### 5.1 Withdrawal Order Optimizer ✅ SHIPPED
**Impact: H | Effort: H**

Today the engine uses a hardcoded withdrawal order: TFSA → Cash → RRSP/RRIF → Non-Reg. This is a reasonable default but is rarely optimal. The optimizer should:

1. Run the projection under multiple withdrawal sequences:  
   - TFSA-first, RRSP-first, Non-Reg-first, proportional, and custom
2. Compute lifetime total taxes paid for each strategy
3. Recommend the strategy with the lowest lifetime tax + highest final estate value
4. Display the recommended year-by-year withdrawal schedule as a stacked bar chart

`CashFlowInput` now accepts `withdrawalStrategy` (one of `oas-optimized`, `rrsp-first`, `tfsa-last`, `non-reg-first`, `proportional`, `custom-order`) and `withdrawalOrder` for custom sequences. `compareWithdrawalStrategies()` in `withdrawal-optimizer.ts` runs all strategies, ranks by lifetime tax (ties broken by final net worth), and returns a `WithdrawalComparisonResult` with `recommendedStrategyId` and savings estimate. Flexible spending guardrails (`flexSpendingEnabled`, floor, ceiling) added to `CashFlowInput`. ACB tracking for non-registered accounts. Strategy selector dropdown on ScenariosPage. `WithdrawalOptimizerCard` on ProjectionsPage (Strategy tab) renders a ranked comparison table with Best chip, lifetime tax, OAS clawback, final net worth, and depletion age. API endpoint: `POST /optimization/withdrawal-comparison`.

**Shipped:** March 2026. Location: Projections page Strategy tab + ScenariosPage spending section + engine `withdrawal-optimizer.ts`.

---

#### 5.2 Bucket Strategy Modeller ✅ SHIPPED
**Impact: M | Effort: M**

A visual bucket framework (popularized by Harold Evensky) where the portfolio is mentally divided into:

- **Bucket 1 (Cash):** 1–2 years of expenses; never invested, refilled annually
- **Bucket 2 (Conservative):** 3–10 years of expenses; bonds and GICs
- **Bucket 3 (Growth):** Remainder; equities for long-term growth

`runBucketProjection()` in `bucket-strategy.ts` simulates the three-bucket cascade (B3 → B2 → B1 refill) year-by-year with configurable `cashYears`, `conservativeYears`, `annualRefill` toggle, and threshold-based top-up. `BucketStrategyCard` on ProjectionsPage (Buckets tab) with cash/conservative year controls, annual refill toggle, and a custom inline SVG stacked bar chart (no Recharts dependency). API endpoint: `POST /optimization/bucket-strategy`.

**Shipped:** March 2026. Location: Projections page Buckets tab + engine `bucket-strategy.ts`.

---

#### 5.3 Dynamic Withdrawal Rate (Beyond Guyton-Klinger)  
**Impact: M | Effort: M**

Add two additional withdrawal strategies to the Simulations page alongside existing Guyton-Klinger:

- **Endowment Method (% of portfolio):** Withdraw a fixed % of portfolio value each year (e.g., 4%). Income fluctuates with markets.
- **Floor-and-Upside:** Cover essential expenses with guaranteed income (CPP + OAS + DB pension), invest the rest for discretionary spending.

Compare all three against the base deterministic plan on a single success-rate bar chart.

---

### Theme 6 — Visualization & UX

#### 6.1 Income Replacement Dashboard Card ✅ SHIPPED
**Impact: H | Effort: S**

Dashboard card showing pre-retirement vs. Year-1 retirement income, replacement ratio with colour-coded progress bar (green ≥70%, yellow 50–70%, red <50%), and status chip.

**Shipped:** March 2026. Location: Dashboard summary row.

---

#### 6.2 Net Worth Evolution Timeline ✅ SHIPPED
**Impact: H | Effort: S**

D3 animated area sparkline (CatmullRom curve) on the Dashboard showing projected net worth through retirement. Current-age dot, hover tooltip with age + value, milestone annotations (Retire, RRIF, CPP, OAS) with vertical dotted lines.

**Shipped:** March 2026. Location: Dashboard bottom full-width section.

---

#### 6.3 Account Drawdown Waterfall Animation ✅ SHIPPED
**Impact: M | Effort: M**

An animated visualization on the Projections page showing how each account (RRSP, TFSA, Non-Reg, Cash) shrinks year by year during retirement. Inspired by swimming-lane diagrams:

- Each account is a horizontal bar that shrinks right-to-left
- Different colour per account type
- User can scrub through retirement years on a slider

D3 animated stacked bar chart (`DrawdownWaterfallChart.tsx`) with age scrubber slider, auto-play button, account color coding (RRSP blue, TFSA green, Non-Reg orange, Cash grey), and responsive ResizeObserver. Integrated as "Drawdown" tab (index 6) on the Projections page.

**Shipped:** March 2026. Location: Projections page Drawdown tab.

---

#### 6.4 Sequence-of-Returns Risk Heatmap  
**Impact: M | Effort: S**

Extend the existing Heatmap page to add a "sequence-of-returns" axis:

- X-axis: withdrawal rate
- Y-axis: sequence type (normal, crash-then-recover, steady, early-crash, late-crash)
- Heat: success rate

Currently the heatmap only sweeps withdrawal rate vs. equity fraction. This addition shows how timing of a crash (year 1 vs. year 15 of retirement) dramatically impacts outcomes — a very teachable moment.

---

#### 6.5 Purchasing Power Erosion Chart  
**Impact: M | Effort: S**

Add a chart to the Projections page showing a fixed $60,000 retirement income in today's dollars vs. real purchasing power at each future inflation rate:

- Static nominal income line
- Real value line discounted by inflation assumption
- Highlight the point where real purchasing power falls below some user-defined floor

---

#### 6.6 PDF Report Improvements ✅ SHIPPED
**Impact: M | Effort: M**

Current PDF is comprehensive but advisor-unfriendly. Upgrade it:

- Cover page with household name, plan date, and a one-sentence plan summary
- Executive summary page with: Readiness Score, key metrics, and top 3 recommendations
- Dedicated RRSP/TFSA room table
- CPP/OAS timing recommendation section
- Estate summary page
- Appendix: assumptions and methodology disclosure

Extended `RetirementPlanData` with optional `readinessScore`, `insights`, `contributionRoom`, `estateResult`, and `assumptions` fields. New Executive Summary page (after Overview) with Readiness Score box, Key Metrics 2×2 grid, Top Recommendations from insights, and Contribution Room section. New Appendix page (after all scenarios) with Capital Market Assumptions table and Methodology disclosure. All backward-compatible via optional fields.

**Shipped:** March 2026. Location: PdfReport.tsx enhanced pages.

---

### Theme 7 — Life Events & Goals

#### 7.1 Goals-Based Retirement View ✅ SHIPPED
**Impact: H | Effort: M**

Shift from a "how much will I have?" model to "can I afford what I want?" goals-based approach. Users define goals:

- "Retire at 60 with $80,000/yr income in today's dollars"
- "Leave $200,000 to my children"
- "Buy a $50,000 car at age 67"
- "Fund a $300,000 cottage at age 62"

Each goal gets a success rate from the Monte Carlo engine and a progress indicator. Users can prioritize goals (essential vs. discretionary) and the engine models tradeoffs between them.

Full CRUD GoalsPage at `/goals` with `Goal` Prisma model, NestJS API module, and React page. Goals have name, description, targetAmount, targetAge, priority (essential/important/nice-to-have), and category (income/legacy/lifestyle/health). Summary stats at top, category-colored cards, create/edit dialog. Engine module (`goals-engine.ts`) with `evaluateGoals` computing success rate and shortfall from Monte Carlo trials. Nav item with TrackChangesIcon.

**Shipped:** March 2026. Location: `/goals` page + API + engine.

---

#### 7.2 Extended Milestones Templates ✅ SHIPPED
**Impact: M | Effort: S**

The current Milestones page accepts freeform events. Add a template library with pre-configured common events:

| Template | Fields pre-populated |
|---|---|
| Sell primary home | Proceeds = estimated value - commission; invest net proceeds |
| Start CPP | Benefit amount, timing from CPP Optimizer |
| Move to retirement community | Monthly cost, occupancy start age |
| Pay off mortgage | Date, lump-sum cash freed up |
| Receive inheritance | Amount, expected age |
| Part-time work in retirement | Income amount, years of work |
| Major renovation | One-time expense |
| Fund child's education | Annual RESP withdrawal |

8 milestone templates (Sell Home, Start CPP, Retirement Community, Pay Off Mortgage, Receive Inheritance, Part-Time Work, Major Renovation, Fund Education) with pre-populated fields. Template selector dialog with descriptive cards and "Add from Template" button on Milestones page.

**Shipped:** March 2026. Location: Milestones page template selector.

---

#### 7.3 Legacy & Estate Giving Planner  
**Impact: M | Effort: M**

Extend the Estate page to include proactive estate planning strategies:

- **Spousal testamentary trust:** model the tax deferral on RRSP rollover to surviving spouse
- **Charitable giving:** calculate donation tax credit; model DAF (Donor-Advised Fund) contributions
- **Life insurance for estate equalization:** "Your RRSP will create $X of income at death. A $Y life insurance policy would cover that tax and leave equal inheritances to each child."
- **Principal residence nomination optimizer:** if the couple owns a primary house + cottage, calculate which property to designate for each year to maximize the exemption

---

### Theme 8 — Collaboration & Sharing

#### 8.1 Advisor Sharing Mode  
**Impact: M | Effort: M**

Allow users to generate a read-only share link of their plan for a financial advisor:

- Shareable link with a time-limited token
- Advisor sees a read-only version of the plan including all projections
- Advisor can add timestamped notes / annotations synced back to the user
- Print-optimized advisor view (letterhead of user's choice)

---

#### 8.2 Household Member Accounts  
**Impact: M | Effort: H**

Both spouses can log in and see the same household:

- Primary user creates/owns the household, invites partner by email
- Both can edit their own member profile (income, CPP, OAS)
- Primary user manages accounts and scenarios
- Change log shows who updated what

---

### Theme 9 — Data & Integration

**Context:** The average Canadian retiree holds accounts at a Big 5 bank + one brokerage. We currently have no reliable data pull from RBC, BMO, Scotiabank, or CIBC — ~80% of Canadian banking relationships — requiring 100% manual entry. This theme closes that gap. Full technical specs: [guide-16-integrations-roadmap.md](guide-16-integrations-roadmap.md).

---

#### 9.0 Questrade: Positions, ACB & Activity History ✅ SHIPPED
**Impact: H | Effort: S**

Questrade is already integrated for balances. The existing OAuth infrastructure supports three additional high-value endpoint calls at no extra auth cost.

**Positions + ACB (Tier 1 — immediate):**
- `GET {apiServer}v1/accounts/{number}/positions` → per-holding: symbol, openQuantity, averageEntryPrice, totalCost
- Write `account.costBasis = sum(position.totalCost)` for non-registered accounts → enables accurate capital gains projection
- Compute `account.equityPercent` / `fixedIncomePercent` / `cashPercent` from security type distribution
- Auto-populate `account.estimatedReturnRate` from asset mix using capital market assumptions

**Activity/Transaction History (Tier 2):**
- `GET {apiServer}v1/accounts/{number}/activities?startTime=...&endTime=...` (31-day windows, paginated)
- Reconstruct RRSP/TFSA contribution history → auto-calculate remaining contribution room
- Surface as a "Sync Contribution History" action on AccountsPage

**New endpoints:** `GET /brokerage/questrade/positions`, `POST /brokerage/questrade/sync-positions`

**Shipped:** March 2026. Location: BrokerageService `getQuestradePositions` / `syncPositions` + `POST /brokerage/questrade/sync-positions` endpoint + IntegrationsPage "Sync Positions + ACB" button.

---

#### 9.1 CRA My Account Data Import  
**Impact: H | Effort: H**

Allow users to import key data directly from the CRA via the MyGovID API (when available) or JSON/PDF upload:

- RRSP contribution room from Notice of Assessment
- TFSA contribution room
- CPP Statement of Contributions (to improve benefit fraction estimate)
- T1 income slips to pre-populate prior-year income

Canada's FCAC accreditation regime is expected to open in Q3 2026 — register as a data recipient then. Until that API is available, support Notice of Assessment PDF parsing (text extraction + regex for key fields).

---

#### 9.2 Market Data Refresh & Assumptions Audit ✅ SHIPPED
**Impact: M | Effort: S**

The engine uses static 2024 tax bracket figures and a hardcoded historical return dataset. Add:

- Annual "plan refresh" reminder (first login of each calendar year)
- Prompt: "CRA updated the TFSA limit to $7,000 for 2025. Update your contribution room?"
- Update built-in capital market assumptions annually (equity return forward estimate, inflation expectation)
- Pull live bond yield for expected bond return estimate (via Bank of Canada API)

AssumptionsAuditDialog component with assumptions table (TFSA limit, RRSP max, CPP/OAS, equity/fixed income returns, inflation, bond yield), "Refresh from Bank of Canada" button with spinner, last-updated timestamps, and current/stale status chips. API endpoint `GET /market-data/assumptions` pulling from `CAPITAL_MARKET_ASSUMPTIONS` constants. Annual plan refresh reminder Alert on Dashboard with localStorage-based dismissal per year.

**Shipped:** March 2026. Location: Dashboard reminder + Assumptions dialog.

---

#### 9.3 Universal OFX/QFX File Import ✅ SHIPPED
**Impact: H | Effort: M**

Every Canadian bank and brokerage (TD, RBC, BMO, Scotiabank, CIBC, National Bank, Qtrade, BMO InvestorLine, Scotia iTRADE, CIBC Investor's Edge) supports OFX/QFX export from their web portal. This single import format covers the entire Big 5 ecosystem without requiring a third-party aggregator.

- `POST /import/ofx` — accepts `.ofx` or `.qfx` file upload
- Parse OFX SGML/XML: extract `<BANKACCTFROM>` account details, `<LEDGERBAL>` balance, `<STMTTRN>` transactions
- For investment accounts: parse `<INVPOSLIST>` positions and `<INVTRANLIST>` trades
- Preview UI: "Found 3 accounts: TD RRSP $142,000 | TD TFSA $68,000 | TD Chequing $12,000. Import?"
- Upsert Account balances; optionally import transactions for expense analysis
- Zero-dependency SGML/XML parser (`ofx-parser.ts`) handles both SGML open-tag and XML `<TAG>value</TAG>` forms; detects RRSP/TFSA/RRIF/LIRA/RESP/FHSA from broker-ID hints

**Replaces and supersedes the old 9.4 TD-only scope** — this covers all institutions.

**Shipped:** March 2026. Location: `apps/api/src/import/ofx-parser.ts` + `POST /import/ofx/preview` + `POST /import/ofx/apply` + IntegrationsPage OFX/QFX upload card with 3-column preview dialog.

---

#### 9.4 Wealthsimple: CSV Activity Import + OAuth Upgrade ✅ SHIPPED (Phase 1)
**Impact: H | Effort: M**

Wealthsimple has 3M+ users and is the most common brokerage for Canadian millennials, but has no public developer API. Two-phase approach:

**Phase 1 — CSV Import (immediate, stable):** ✅ SHIPPED
- Accept Wealthsimple Activity CSV export (`Activity Date, Type, Symbol, Quantity, Price, Commission, Currency, Account`)
- `POST /import/wealthsimple/preview` + `POST /import/wealthsimple/apply`
- Detects RRSP/TFSA/RRIF/RESP/LIRA/CASH from account name; uses EOD Balance rows for accuracy; strict validation (throws if no balance rows found)
- Update account balances; match against existing accounts by provider + name

**Phase 2 — OAuth (once Wealthsimple opens developer program):**
- Wealthsimple uses OAuth2 internally (observed: `api.production.wealthsimple.com/v1/oauth/token`)
- Apply for official partnership/developer access
- Once available: pull accounts, positions, tax documents (T3, T5, T5008)
- Replace current fragile Bearer-token scraping entirely

**Current state:** existing Bearer-token flow is a liability — it breaks on app updates and violates ToS. Phase 1 CSV import provides a stable fallback immediately.

**Shipped:** March 2026. Location: `ImportService._parseWealthsimpleCSV` + `POST /import/wealthsimple/preview|apply` + IntegrationsPage Wealthsimple CSV card with preview dialog.

---

#### 9.5 Monarch Money CSV Import ✅ SHIPPED
**Impact: M | Effort: S**

Monarch Money is the fastest-growing Canadian budgeting app (replacing Mint for many users who switched after the January 2024 shutdown). It connects to RBC, TD, Scotiabank, BMO, CIBC, Desjardins, EQ Bank, Neo Financial, and Tangerine via Plaid/Flinks.

- Accept Monarch CSV export: `Date, Merchant, Category, Account, Original Statement, Notes, Amount, Tags`
- `POST /import/monarch/preview` + `POST /import/monarch/apply`
- Maps 12 Monarch categories to local expense categories; computes monthly averages per category → upserts `Expense` rows (unique on `householdId + name`)
- Show onboarding prompt: "Are you a Mint or Monarch user? Import your spending history in one click."

**Shipped:** March 2026. Location: `ImportService._parseMonarchCSV` + `POST /import/monarch/preview|apply` + IntegrationsPage Monarch Money card with expense preview dialog.

---

#### 9.6 Flinks Bank Aggregator (Big 5 + 200 Canadian FIs)  
**Impact: H | Effort: H**

[Flinks](https://flinks.com) is Canada's leading financial data aggregator — the Plaid equivalent for Canadian banks. A single Flinks integration covers RBC, TD, Scotiabank, BMO, CIBC, National Bank, Desjardins, Meridian, EQ Bank, Tangerine, Simplii, Neo Financial, and 190+ more institutions.

**Integration model:**
- Embed Flinks Connect (white-labelled iframe SDK) on the IntegrationsPage — user logs in to their bank inside the iframe; credentials never touch our server
- After successful auth, Flinks returns a `loginId`
- Backend: `POST /flinks/connect` → call Flinks API `GetAccountsSummaryAsync` → poll for accounts + balances
- New `FlinksConnection` DB model stores encrypted `loginId`; `Account` gets `flinksAccountId`
- Nightly background sync via `GetAccountsSummary` using cached loginId

**Data available:** Account list, account type (CHEQUING, SAVINGS, RRSP, TFSA, non-reg), balance, 90–366 days of categorized transactions.

**Pricing:** ~$0.15–$0.50/connection/month. Free developer tier for testing.

**Why this matters:** Eliminates the need for individual RBC, BMO, Scotiabank, CIBC integrations. Covers Desjardins — essential for the Quebec market.

---

#### 9.7 Wealthica Investment Aggregator (130 Canadian Brokerages)  
**Impact: H | Effort: H**

[Wealthica](https://wealthica.com/developers/) is a Canadian portfolio tracker with an official public API and OAuth2. It aggregates investment data from 130+ Canadian financial institutions including RBC Direct Investing, TD WebBroker, BMO InvestorLine, CIBC Investor's Edge, Scotia iTRADE, Qtrade, NBDB, Manulife (group plans), Sun Life, Interactive Brokers Canada.

**Integration model:**
- OAuth2 PKCE flow: user grants Wealthica consent → `api.wealthica.com/oauth/token`
- Pull: `GET /v1/accounts`, `GET /v1/portfolio/positions` (book_value = ACB), `GET /v1/portfolio/transactions`
- Write to DB: Account balance, `costBasis` (from book_value), equityPercent/fixedIncomePercent, brokerageProvider (institution name)

**The leverage:** One Wealthica connection covers virtually all Canadian brokerages where we have no direct API. Especially valuable for users at RBC Direct, TD WebBroker, or BMO InvestorLine.

---

#### 9.8 Group RRSP / DPSP / Pension Plan CSV Import  
**Impact: M | Effort: S**

Many Canadians hold significant retirement savings through employer-sponsored group plans administered by Manulife, Sun Life, or Canada Life. These platforms don't offer public consumer APIs, but all support statement CSV/PDF export.

- Standardized import template for group plan data (account type, balance, annual contribution, employer match %, vesting schedule, plan type: Group RRSP, DPSP, DC pension)
- `POST /import/csv?format=group-plan`
- Auto-detect common Manulife, Sun Life statement CSV column layouts
- Special handling: DC pension → project as additional RRSP-like balance; DB pension → create income source

---

#### 9.9 Guided Onboarding Wizard with Integration Steps ✅ SHIPPED
**Impact: H | Effort: M**

Replace the current blank-slate onboarding with a guided 5-step wizard that routes users to the integrations most relevant to them:

1. **Household basics** (names, DOBs, province, retirement age)
2. **Connect finances** — three parallel tracks shown side-by-side:
   - 🏦 Bank accounts → Flinks Connect or OFX file upload
   - 📊 Investments → Questrade/Wealthsimple/Wealthica or OFX/CSV upload
   - 💰 Budget → YNAB/Monarch or CSV upload
3. **Income sources** (CPP estimate, OAS, employment income, pensions)
4. **Goals** (retirement income target, legacy amount, major milestones)
5. **First projection** → auto-run on completion → land on Dashboard with populated plan

**Target metric:** A user who connects via Flinks + Questrade should have ≥80% of their data pre-populated in under 5 minutes, without a single manual balance entry.

**Shipped:** March 2026. Location: `OnboardingWizard.tsx` updated to 7 steps — added step 4 "Connect Your Data" (between Add Accounts and Milestones) linking to `/integrations` with CloudSync icon and description of all import formats.

---

### Theme 10 — Specialized Canadian Topics

#### 10.1 RDSP (Registered Disability Savings Plan)  
**Impact: M | Effort: M**

Support for households with a member who has a disability:

- RDSP contribution and government grant/bond calculator (Canada Disability Savings Grant, Canada Disability Savings Bond)
- Lifetime contribution limit ($200,000) tracking
- Holdback rules (withdrawals before 10 years after last government contribution)
- DAP (Disability Assistance Payment) projections

---

#### 10.2 Corporation / Holding Company  
**Impact: M | Effort: H**

Business owners often have corporate investment accounts and must decide: pay salary and invest personally, or retain in the corp and invest corporately?

- Corporate income tax rate (federal + provincial small business deduction)
- Passive income threshold: passive income > $50,000 reduces small business deduction
- Integration rate: compare after-tax income + corporate investment return vs. personal
- Salary vs. dividend vs. capital dividend account optimization
- GRIP (General Rate Income Pool) tracker

---

#### 10.3 RESP Planner  
**Impact: M | Effort: M**

Many users will have children approaching post-secondary while they plan retirement. Sequence these events:

- RESP balance projection with CESG (20% match on first $2,500/yr, max $500/yr grant)
- CLB (Canada Learning Bond) for lower-income families
- EAP (Educational Assistance Payment) withdrawal tax in child's hands
- AIP (Accumulated Income Payment) if child doesn't attend post-secondary — cost to collapse
- Coordination: "RESP runs out in 2031. Does this affect your retirement savings targets?"

---

#### 10.4 QPP vs. CPP Differentiation  
**Impact: S | Effort: S**

Quebec residents contribute to QPP, not CPP. QPP has slightly different rates and benefit formulas. Currently the app may treat both identically:

- Verify the `benefits/government.ts` engine distinguishes CPP from QPP for QC residents
- Québec Pension Plan has a "post-retirement benefit" structure different from CPP2
- Québec parental insurance plan (QPIP) contributions affect pensionable income

---

## Implementation Priority Matrix

| # | Feature | Impact | Effort | Priority | Status |
|---|---|---|---|---|---|
| 1.1 | Retirement Readiness Score | H | M | ★★★★★ | ✅ Shipped |
| 1.2 | Automated Insights Engine | H | M | ★★★★★ | ✅ Shipped |
| 2.1 | CPP Timing Optimizer | H | M | ★★★★★ | — |
| 2.3 | Pension Splitting Optimizer | H | M | ★★★★★ | — |
| 9.0 | Questrade: Positions, ACB & Activity History | H | S | ★★★★★ | ✅ Shipped |
| 9.3 | Universal OFX/QFX File Import (all Big 5 + brokerages) | H | M | ★★★★★ | ✅ Shipped |
| 9.9 | Guided Onboarding Wizard with Integration Steps | H | M | ★★★★★ | ✅ Shipped |
| 2.2 | OAS Deferral + Clawback Optimizer | H | M | ★★★★☆ | — |
| 3.1 | Phased Spending Template | H | M | ★★★★☆ | ✅ Shipped |
| 3.4 | Quick What-If Calculator | H | S | ★★★★☆ | ✅ Shipped |
| 4.1 | RRSP/TFSA Room Tracker | H | M | ★★★★☆ | ✅ Shipped |
| 5.1 | Withdrawal Order Optimizer | H | H | ★★★★☆ | ✅ Shipped |
| 6.1 | Income Replacement Card | H | S | ★★★★☆ | ✅ Shipped |
| 7.1 | Goals-Based View | H | M | ★★★★☆ | ✅ Shipped |
| 9.4 | Wealthsimple CSV Import + OAuth Upgrade | H | M | ★★★★☆ | ✅ Shipped |
| 9.6 | Flinks Bank Aggregator (Big 5 + 200 Canadian FIs) | H | H | ★★★★☆ | — |
| 9.7 | Wealthica Investment Aggregator (130 Canadian brokerages) | H | H | ★★★★☆ | — |
| 1.3 | Plan Completeness Checklist | M | S | ★★★☆☆ | ✅ Shipped |
| 2.5 | GIS Planner | M | M | ★★★☆☆ | — |
| 4.2 | Asset Allocation Modeller | M | M | ★★★☆☆ | ✅ Shipped |
| 4.3 | Real Estate / Rental Income | M | M | ★★★☆☆ | ✅ Shipped |
| 4.4 | Defined Benefit Pension Deep-Dive | H | M | ★★★☆☆ | — |
| 5.2 | Bucket Strategy Modeller | M | M | ★★★☆☆ | ✅ Shipped |
| 6.2 | Net Worth Sparkline Timeline | H | S | ★★★☆☆ | ✅ Shipped |
| 6.6 | PDF Report Improvements | M | M | ★★★☆☆ | ✅ Shipped |
| 7.3 | Legacy & Estate Giving Planner | M | M | ★★★☆☆ | — |
| 8.1 | Advisor Sharing Mode | M | M | ★★★☆☆ | — |
| 9.2 | Market Data Refresh / Assumptions Audit | M | S | ★★★☆☆ | ✅ Shipped |
| 9.5 | Monarch Money CSV Import | M | S | ★★★☆☆ | ✅ Shipped |
| 9.8 | Group RRSP / DPSP / Pension Plan CSV Import | M | S | ★★★☆☆ | — |
| 10.1 | RDSP | M | M | ★★★☆☆ | — |
| 10.3 | RESP Planner | M | M | ★★★☆☆ | — |
| 2.4 | Spousal RRSP Optimizer | M | S | ★★☆☆☆ | ✅ Shipped |
| 3.2 | Expense Category Drill-Down | M | M | ★★☆☆☆ | — |
| 3.3 | Healthcare Cost Modeller | M | S | ★★☆☆☆ | — |
| 5.3 | Dynamic Withdrawal (Floor-and-Upside) | M | M | ★★☆☆☆ | — |
| 6.3 | Account Drawdown Animation | M | M | ★★☆☆☆ | ✅ Shipped |
| 6.4 | Sequence-of-Returns Heatmap | M | S | ★★☆☆☆ | — |
| 6.5 | Purchasing Power Chart | M | S | ★★☆☆☆ | — |
| 7.2 | Milestone Templates | M | S | ★★☆☆☆ | ✅ Shipped |
| 8.2 | Household Multi-User Accounts | M | H | ★★☆☆☆ | — |
| 9.1 | CRA Data Import | H | H | ★★☆☆☆ | — |
| 10.2 | Corporation / Holding Company | M | H | ★★☆☆☆ | — |
| 10.4 | QPP Differentiation | S | S | ★☆☆☆☆ | — |

---

## Suggested Sprint Sequence (3-week sprints)

### Sprint 1 — "Plan Quality" ✅ COMPLETE
Items: 1.1 (Readiness Score), 1.3 (Checklist), 6.1 (Income Replacement Card), 6.2 (Net Worth Sparkline), 3.4 (Quick What-If Calculator)  
*Deliverable: Users immediately know if their plan is good or bad when they log in.*  
*Shipped: March 2026.*

### Sprint 2 — "Income Timing"  
Items: 2.1 (CPP Optimizer), 2.2 (OAS Optimizer)  
*Deliverable: The most-asked Canadian retirement question ("when should I take CPP?") answered in the app.*

### Sprint 3 — "Smart Insights"  
Items: 1.2 (Insights Engine), 9.2 (Market Data Refresh)  
*Deliverable: The app proactively tells users what to do — from passive data viewer to advisor.*

### Sprint 4 — "Tax Efficiency"  
Items: 2.3 (Pension Splitting), 5.1 (Withdrawal Order Optimizer pt.1: UI + engine parameter)  
*Deliverable: Couples with pension income get concrete savings numbers.*

### Sprint 5 — "Spending & Goals"  
Items: 3.1 (Phased Spending), 7.1 (Goals View)  
*Deliverable: The user experience shifts from "what will happen?" to "can I achieve what I want?"*

### Sprint 6 — "Assets & Room"  
Items: 4.1 (RRSP/TFSA Room Tracker), 4.2 (Asset Allocation), 4.3 (Real Estate)  
*Deliverable: Complete picture of the balance sheet, not just account totals.*

### Sprint 7 — "Estate & Legacy"  
Items: 4.4 (DB Pension), 7.3 (Estate Giving Planner), 6.6 (PDF improvements)  
*Deliverable: App is credible for near-retirement households with pensions and real estate.*

### Sprint 8 — "Sharing & Collaboration"  
Items: 8.1 (Advisor Share), 7.2 (Milestone Templates)  
*Deliverable: Users can work with an advisor through the app.*

### Sprint 9 — "Zero-Friction Data Onboarding" ✅ COMPLETE
Items: 9.0 (Questrade Positions + ACB), 9.3 (Universal OFX/QFX Import), 9.4 (Wealthsimple CSV Import), 9.5 (Monarch Money CSV), 9.9 (Onboarding Wizard)  
*Deliverable: A new user whose broker is Questrade or whose bank supports OFX export can onboard in under 5 minutes with all balances pre-populated. No manual entry required.*  
*Shipped: March 2026.*

### Sprint 10 — "Integration Aggregators"  
Items: 9.6 (Flinks Bank Aggregator), 9.7 (Wealthica Investment Aggregator), 9.5 (Monarch Money CSV), 9.8 (Group Plan CSV)  
*Deliverable: Single-connection coverage for 200+ Canadian FIs (Flinks) and 130+ Canadian brokerages (Wealthica). A user at RBC, BMO, TD, Scotiabank, CIBC, or Desjardins can connect their accounts without any file export.*

---

## Competitive Differentiation Summary

If all Priority ★★★★★ and ★★★★☆ items from Sprints 1–5 are shipped, RetireePlan would be the **only Canadian retirement planning tool that offers:**

1. ✅ A real-time composite plan health score with component breakdown and projection stat tiles
2. ✅ Goals-based checklist with actionable hints and per-category progress tracking
3. ✅ Interactive what-if explorer (savings, returns, retirement age, life expectancy) in a live drawer
4. — CPP + OAS timing optimization with lifetime NPV break-even analysis
5. — Pension income splitting modelling with year-by-year tax savings
6. ✅ Multi-method withdrawal order comparison with lifetime tax minimization
7. — Goals-based planning (can I afford what I want?) alongside deterministic projections
8. ✅ Historical backtesting + Guyton-Klinger + Monte Carlo in a single interface
9. ✅ Per-province probate and estate analysis
10. ✅ Canada-US cross-border and expat tools (currently unique in the market)
11. ✅ Brokerage account balance sync (Questrade, Wealthsimple)
12. ✅ Universal OFX/QFX file import — covers all Big 5 banks without a third-party aggregator
13. — Flinks bank aggregator — single connection to 200+ Canadian financial institutions
14. — Wealthica investment aggregator — single connection to 130+ Canadian brokerages with ACB data

No competitor — including Boldin, MaxiFi, Projection Lab, or any major Canadian bank's online calculator — covers this full set for a Canadian audience.

---

*Document authored: March 2026. Updated March 2026 (Sprint 1 shipped; Theme 5 — Withdrawal Strategy shipped: 5.1 Withdrawal Order Optimizer, 5.2 Bucket Strategy Modeller, 2.4 Spousal RRSP Optimizer). Theme 9 — Data & Integration expanded: Flinks, Wealthica, Questrade positions, universal OFX import, Wealthsimple CSV, Monarch Money, Group Plans, and Guided Onboarding Wizard added. Sprint 9 fully shipped March 2026: 9.0 Questrade Positions + ACB, 9.3 Universal OFX/QFX Import, 9.4 Wealthsimple CSV Import (Phase 1), 9.5 Monarch Money CSV Import, 9.9 Onboarding Wizard "Connect Your Data" step — all with full security hardening (IDOR guards, SSRF validation, transaction wrapping, upsert idempotency, CSV injection sanitisation). Full technical reference: [guide-16-integrations-roadmap.md](guide-16-integrations-roadmap.md). Review and re-prioritize quarterly as user feedback is collected.*
