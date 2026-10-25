# RetireePlan — Complete Retirement Planning User Guide

> **How to read this guide.** Each section is written the way a financial planner or retirement analyst would walk you through the topic in a first meeting. The concept is explained first so you understand *why* it matters, then the practical numbers are given, and finally you are pointed to the exact screen in the system where you take action or review the result. Work through the sections in order on your first pass; return to individual sections any time you revisit a topic.

---

## Table of Contents

1. [What Is a Retirement Plan?](#1-what-is-a-retirement-plan)
2. [Step 1 — Build Your Household Profile](#2-step-1--build-your-household-profile)
3. [Step 2 — Enter Your Income Sources](#3-step-2--enter-your-income-sources)
4. [Step 3 — Define Your Expenses](#4-step-3--define-your-expenses)
5. [Step 4 — Set Up Your Investment Accounts](#5-step-4--set-up-your-investment-accounts)
6. [Step 5 — Create Your Baseline Scenario](#6-step-5--create-your-baseline-scenario)
7. [Step 6 — Run and Read Your First Projection](#7-step-6--run-and-read-your-first-projection)
8. [Step 7 — Plan Your Government Benefits (CPP & OAS)](#8-step-7--plan-your-government-benefits-cpp--oas)
9. [Step 8 — RRSP Strategy: Contributions, Conversion, and Meltdown](#9-step-8--rrsp-strategy-contributions-conversion-and-meltdown)
10. [Step 9 — TFSA: Tax-Free Growth and Flexible Withdrawals](#10-step-9--tfsa-tax-free-growth-and-flexible-withdrawals)
11. [Step 10 — Income Flow: Where Your Money Goes Each Year](#11-step-10--income-flow-where-your-money-goes-each-year)
12. [Step 11 — Account Drawdown: How Your Portfolio Empties Over Time](#12-step-11--account-drawdown-how-your-portfolio-empties-over-time)
13. [Step 12 — Monte Carlo: Planning for Market Uncertainty](#13-step-12--monte-carlo-planning-for-market-uncertainty)
14. [Step 13 — Stress Test with Scenarios and What-If Analysis](#14-step-13--stress-test-with-scenarios-and-what-if-analysis)
15. [Step 14 — Goals and Milestones](#15-step-14--goals-and-milestones)
16. [Step 15 — Estate Planning: What Your Heirs Receive](#16-step-15--estate-planning-what-your-heirs-receive)
17. [Step 16 — Tax Analytics and Optimization](#17-step-16--tax-analytics-and-optimization)
18. [Step 17 — Keeping the Plan Current](#18-step-17--keeping-the-plan-current)
19. [Quick Reference: Key Numbers for 2024](#19-quick-reference-key-numbers-for-2024)

---

## 1. What Is a Retirement Plan?

A retirement plan is a forward-looking financial model that answers one fundamental question: **will you run out of money before you run out of time?** That sounds blunt, but it is the right starting point. Everything in this system is built to answer that question — and then to help you improve the answer.

A professional financial planner builds this model by gathering three types of information from you:

1. **Resources** — what you own today (accounts, real estate, pensions)
2. **Obligations** — what you spend and what you owe (expenses, liabilities, taxes)
3. **Assumptions** — how the future behaves (returns, inflation, longevity, benefit timing)

The system then simulates your life from today to a planning horizon (typically age 90–95) on a year-by-year basis, tracking every dollar of income, every dollar of spending, every tax dollar paid, and every account balance. The output tells you whether the plan is solvent, where the stress points are, and which levers have the biggest impact.

**Canadian context:** This system is built specifically for Canadian households. It applies accurate federal and provincial progressive income tax, CPP and OAS benefit calculations, RRIF mandatory minimum withdrawal schedules, RRSP and TFSA contribution limits, the OAS clawback threshold, and capital gains inclusion rules. The numbers are not generic — they are the actual rules applied to your province and your income.

---

## 2. Step 1 — Build Your Household Profile

**Where:** `Household` page (left sidebar)

### What you are doing and why

Your household profile is the foundation that every other calculation rests on. The system needs to know who is in the household, how old they are, where they live, and when they plan to stop working. These facts determine:

- Which provincial tax rates apply
- What CPP benefit they have accumulated
- When RRSP contributions must legally stop (age 71)
- The retirement age at which employment income drops to zero in the projection

### Key fields to complete

| Field | Why it matters | Where to find it |
|---|---|---|
| **Date of birth** | Every projection is age-based, not calendar-based. Getting this right means CPP, OAS, and RRIF ages are automatically correct. | Your SIN card or passport |
| **Province of residence** | Provincial tax rates vary significantly — Ontario's top marginal rate is 53.5%; Alberta's is 48%. This is your actual province today; you can test a move using Scenarios. | —  |
| **Planned retirement age** | Employment income stops here. Everything before is the *accumulation phase*; everything after is the *decumulation phase*. | Your own estimate |
| **RRSP contribution room** | The system uses this to cap how much it recommends you contribute each year. Find it on your CRA Notice of Assessment (or My Account online). | CRA My Account → RRSP/PRPP Deduction Limit |
| **TFSA contribution room** | Available room since you became eligible (age 18 in the year TFSA launched in 2009). CRA tracks lifetime room accumulation including withdrawals re-added the following year. | CRA My Account → TFSA Room |
| **Prior-year earned income** | Used to calculate the RRSP contribution room you will *earn this year* (18% of earned income, up to the annual maximum of $31,560). | Your most recent T4 or T1 |
| **CPP expected benefit** | Your expected monthly CPP at age 65. CRA provides this on My Account or on your annual CPP Statement of Contributions. | Service Canada → My Account |

### Couples and spouses

Add a second household member for your partner. The system tracks two members with independent income, accounts, and province. Income-splitting strategies (pension income splitting, spousal RRSP) are applied automatically in the projection engine. Each member has their own CPP and OAS entitlement and their own retirement age.

---

## 3. Step 2 — Enter Your Income Sources

**Where:** `Household` page → Income Sources section for each member

### The concept

In retirement planning, income is categorized precisely because different types have different tax treatment, different timing, and different flexibility. The system separates:

| Type | Examples | Tax treatment |
|---|---|---|
| **Employment / Self-Employment** | Salary, consulting, contract | Fully taxable; stops at retirement age |
| **CPP** | Canada Pension Plan benefit | Fully taxable; starts at `cppStartAge` |
| **OAS** | Old Age Security | Fully taxable; subject to clawback above ~$91k income |
| **Defined Benefit (DB) Pension** | Government or employer pension | Fully taxable; specify start age and annual amount |
| **RRSP/RRIF** | Registered retirement withdrawals | Fully taxable when withdrawn |
| **Investment / Rental** | Dividends, rent, non-reg portfolio income | Partially taxable (capital gains 50% inclusion; eligible dividends get the DTC) |
| **Other** | Inheritance, insurance proceeds, lump sums | Depends on source |

### Practical guidance

For **employment income**, enter your gross annual salary or self-employment income. The system calculates CPP contributions and income tax from this figure.

For **a DB pension**, enter the annual payment amount and the age it starts. If you have an indexed pension, enter the target amount at the start age — the system handles inflation adjustment from that point.

For **rental income**, enter the net income (after mortgage interest, property tax, and operating costs). This is the amount that appears on your T1.

For **CPP and OAS**, do *not* add these as manual income sources — they are automatically calculated by the projection engine based on your `cppStartAge` and `oasStartAge` settings in the Scenario. Enter your expected CPP benefit on the Household profile so the engine scales it correctly; OAS is calculated from residency.

### Income sources during the decumulation phase

The system distinguishes between income that runs during working years and income that runs in retirement. An income source with a defined `startAge` and `endAge` will only appear in the projection for those years. For example: part-time consulting at $25,000/year from age 60 to 68 would be entered with `startAge: 60`, `endAge: 68`.

---

## 4. Step 3 — Define Your Expenses

**Where:** `Household` page → Expenses section, or via **YNAB Integration** (Integrations page)

### The concept: what do you actually spend?

Expenses are the most consequential single variable in a retirement plan. A difference of $10,000/year in annual spending (e.g. $70,000 vs $80,000) compounds over 30 years of retirement into a differences of hundreds of thousands of dollars in portfolio drawdown.

Most people significantly *underestimate* their expenses when asked to guess. A financial planner will always ask you to pull up your actual bank and credit card statements to get to the real number.

The system supports two approaches:

**Option A — Aggregate:** Enter a single annual expense figure in the Scenario. Good for initial planning before you have detailed data.

**Option B — Itemized (recommended):** Enter expense line items by category (Housing, Food, Transportation, Healthcare, Travel, etc.). This lets you model spending changes at retirement (e.g., commuting costs drop; travel spending increases) and inflation adjustments by category.

### The YNAB integration

If you use YNAB (You Need a Budget), connect your account on the **Integrations** page. The system will sync your budgeted category amounts directly as expense line items, giving you a real-data foundation rather than estimates. YNAB-synced expenses are labeled with `ynab-` IDs and refresh automatically.

### Inflation and spending phases

All expenses in the projection are inflated at the annual inflation rate you set in your Scenario (typically 2.0–2.5%). This means a $72,000 annual expense today becomes approximately $131,000 in 30 years at 2.5% inflation — which is why the projection might show high spending in your 80s even if your lifestyle is unchanged.

**Spending phases** let you model how spending changes at different life stages:
- **"Go-Go" years (65–74):** Full spending + active travel. Factor: 1.0 or 1.1
- **"Slow-Go" years (75–84):** Less discretionary travel but more healthcare. Factor: 0.9
- **"No-Go" years (85+):** Primarily care costs. Factor: 0.75 (but healthcare may spike)

Configure spending phases in the **Scenarios** page under the Advanced section.

---

## 5. Step 4 — Set Up Your Investment Accounts

**Where:** `Accounts` page (left sidebar)

### The Canadian account hierarchy

Canada has a deliberate tax-efficiency hierarchy for investment accounts. Understanding this hierarchy is essential to reading your drawdown chart correctly.

| Account type | Tax on growth | Tax on withdrawal | Key rule |
|---|---|---|---|
| **RRSP** | Tax-sheltered (deferred) | Fully taxable as income | Converts to RRIF by age 71; RRIF has mandatory annual minimum withdrawals |
| **TFSA** | Tax-free | Tax-free | Contributions limited by annual room; withdrawals re-add room the following year |
| **Non-Registered** | Taxable each year (interest) / partially taxable (dividends, cap gains) | Capital gains taxed on disposition | No contribution limits; no tax shelter |
| **Cash / Savings** | Taxable (interest income) | None | Treated as liquid buffer; earns a configurable savings rate (default 2.5%) |

### What to enter

For each account, provide:
- **Account name** — e.g. "RRSP at RBC", "TFSA at Questrade"
- **Account type** — RRSP, TFSA, Non-Registered, Cash
- **Current balance** — the most recent statement value
- **Estimated annual return rate** — your expected nominal return (e.g., 6% for a balanced portfolio). This can be overridden per account or left to use the Scenario's default rate.
- **Annual contribution** — how much you plan to add each year until retirement. The system caps RRSP contributions at your available room.

### Ownership and tax attribution history

The account dialog includes **Tax Attribution Ownership History** so you can model who reports income over time.

- **Joint / Unspecified**: default mode when ownership is not explicitly assigned.
- **Single member**: one member receives full attribution.
- **Joint percentage split**: two members share attribution with percentages that must sum to 100%.

Each row has an effective year. The projection engine uses the latest row active in each simulated year, which means ownership changes (for example, account transfers or spousal attribution adjustments) can be reflected without creating duplicate accounts.

### How accounts are drawn down in retirement

The projection engine uses a *waterfall* withdrawal strategy in this priority order:

1. **Cash** — depleted first as a liquidity buffer
2. **Non-Registered** — next, because growth is the least tax-efficient
3. **RRSP/RRIF** — drawn according to RRIF minimums, plus additional draws if needed
4. **TFSA** — last, preserving tax-free compounding as long as possible

The RRSP meltdown optimizer can recommend voluntary RRSP draws *before* RRIF conversion (see Step 8), which overrides this default order when it produces a lifetime tax saving.

---

## 6. Step 5 — Create Your Baseline Scenario

**Where:** `Scenarios` page (left sidebar)

### What is a scenario?

A scenario is a named collection of planning assumptions. Think of it as answering the question: *"Under these specific conditions, what does the future look like?"* You will create multiple scenarios — a base case, an optimistic case, a stress case — and compare them.

Every scenario is independent and re-runnable. Changing a scenario does not alter your household data; it only changes the assumptions applied to that data.

### Key parameters to set for your baseline

**Retirement & longevity:**
- **Retirement age** — The age at which employment income stops. Default: 65. Consider setting this to your actual target, not the "expected" default.
- **Life expectancy (planning horizon)** — The age you plan *to*, not the age you expect to die. Plan to age 90 at a minimum; 95 is more conservative. The risk of outliving your money is the core risk you are insuring against. Running to age 95 or 100 adds almost no cost to the portfolio if solvent, but dramatically changes the picture if the base case was marginal.

**Returns and inflation:**
- **Expected return rate** — Your portfolio's nominal annual return. A balanced 60/40 portfolio has historically averaged 6–7% nominal; a conservative 40/60 portfolio is closer to 4–5%. Use a realistic number: the system does not let you discover this is a problem after the fact.
- **Inflation rate** — The annual rate at which expenses grow. The Bank of Canada targets 2.0%. Historical Canadian CPI has averaged 2.5%. Use 2.0–2.5% for planning.
- **Volatility** — Standard deviation of returns, used by the Monte Carlo simulation. 12% is appropriate for a balanced portfolio.

**Government benefits timing:**
- **CPP start age** — Can be taken from age 60 (reduced) to age 70 (enhanced). Default: 65. Each month before 65 reduces the benefit by 0.6%; each month after 65 increases it by 0.7%. See Step 7 for how to optimize this.
- **OAS start age** — Available from 65 to 70. Each month deferred increases the benefit by 0.6% (maximum 36% increase at 70). See Step 7.

**Registered account:**
- **RRIF conversion age** — By law, your RRSP must convert to a RRIF by December 31 of the year you turn 71. You may convert earlier voluntarily. Converting earlier means RRIF minimum withdrawals begin earlier. Default: 71.
- **Withdrawal order** — The sequence in which accounts are drawn. Default is Cash → Non-Reg → RRSP → TFSA.

**Province** — Applies the correct provincial income tax rates.

**Annual expenses** — If not using itemized expenses, enter your total annual living cost in today's dollars.

---

## 7. Step 6 — Run and Read Your First Projection

**Where:** `Projections` page → Run Projection button

### What the projection does

The engine runs a year-by-year simulation from your current age to the life expectancy you set. For every year it calculates:

- All income sources (employment, CPP, OAS, pensions, RRIF draws)
- All expenses (inflation-adjusted)
- All taxes (federal and provincial, including RRIF income, CPP, OAS)
- Account balances after contributions, growth at the return rate, and withdrawals
- Net cash flow (income minus expenses minus tax)

### Reading the key metrics at the top of the page

| Metric | What it means |
|---|---|
| **Peak Net Worth** | The highest total portfolio value during the projection. Tells you when the portfolio stops growing and starts depleting. |
| **Final Net Worth (age 90)** | The estimated portfolio value at your planning horizon. If this is positive, the plan is solvent. If it is negative — or approaches zero — you have a sustainability problem to solve. |
| **Avg unused RRSP room** | On average, how much RRSP room you are leaving unused each year. A high number means there is optimization potential. |
| **Avg unused TFSA room** | Same for TFSA. TFSA room is "use it or lose the compounding benefit" — unused room compounds outside the tax shelter. |

### The Cash Flow tab

The main chart on the **Cash Flow** tab shows net worth over time as a stacked area chart. The total height of the shaded area is your total net worth. The coloured bands represent:

- **Blue (RRSP/RRIF)** — Your registered retirement savings
- **Green (TFSA)** — Your tax-free savings
- **Orange (Non-Registered)** — Your taxable investment account
- **Grey (Cash)** — Your liquid savings/chequing

Watch for the point where the total area *starts declining* — that is where net portfolio drawdown begins. A healthy plan has this turning point in the late 60s or 70s, with the total area still well above zero at the right edge of the chart.

### Year-by-Year tab

The table under **Year-by-Year** shows the full detail of every simulated year: income, expenses, tax, RRIF minimum, withdrawal from each account, net cash flow, and balances. Use this to trace exactly what happens in any specific year, especially for tax planning.

---

## 8. Step 7 — Plan Your Government Benefits (CPP & OAS)

**Where:** `Scenarios` page → CPP/OAS section; `Dashboard` for benefit summary

### Canada Pension Plan (CPP)

**What it is:** A mandatory, earnings-based pension paid monthly for life. The amount you receive depends on how many years you worked, your earnings relative to the YMPE (Year's Maximum Pensionable Earnings, $73,200 in 2024), and the age you start.

**The timing decision — the most important CPP choice you make:**

| Start age | Monthly adjustment | Impact example ($800/month at 65) |
|---|---|---|
| 60 | -36% (0.6%/month for 60 months) | $512/month |
| 65 | — (baseline) | $800/month |
| 70 | +42% (0.7%/month for 60 months) | $1,136/month |

**Break-even analysis:** If you start CPP at 60 instead of 65, you collect 5 extra years of benefits but at a permanently lower amount. The "break-even" age — where the cumulative total from age-60 CPP equals what you would have collected from age-65 CPP — is approximately age 74. If you expect to live past 74, deferring to 65 (or later) pays more over your lifetime. The system calculates this for your specific numbers.

**If you defer to 70:** The 42% enhancement means your CPP is significantly higher for life — and indexed to inflation each year. This is one of the best "guaranteed return" decisions available to Canadians.

**How to adjust:** Go to **Scenarios** → slide the CPP Start Age slider between 60 and 70 → **Run Projection** to see the impact on net worth and tax.

### Old Age Security (OAS)

**What it is:** A flat monthly pension paid to Canadians aged 65+ with at least 10 years of Canadian residency after age 18. Full OAS requires 40 years; partial is prorated.

**2024 maximum:** $713.34/month ($8,560/year) at age 65.

**Deferral:** OAS can be deferred up to age 70, gaining 0.6%/month (maximum 36% enhancement, bringing maximum to $9,641/year). Unlike CPP, OAS is not reduced for taking it early — you simply cannot take it before 65. The only question is whether to defer 65 → 70.

**The OAS clawback — critical tax trap:**

If your net income exceeds $90,997 in 2024, the CRA *claws back* OAS at 15 cents per dollar above that threshold. The benefit is fully eliminated when net income reaches approximately $148,000.

This is directly relevant to your RRSP/RRIF strategy. If your RRIF mandatory minimums at age 75–80 push your income above $91,000, you will lose a portion of OAS that you have already started collecting. The RRSP meltdown strategy (Step 8) is specifically designed to prevent this.

**Watch for:** On the Projections → Year-by-Year tab, look for any years where your income column approaches $91,000. If RRIF minimums are driving this, the system's Insights panel will flag it with a "OAS clawback risk" alert.

---

## 9. Step 8 — RRSP Strategy: Contributions, Conversion, and Meltdown

**Where:** `Projections` page → Year-by-Year tab (RRSP rows); `Simulations` page → RRSP Meltdown

### RRSP contributions (accumulation phase)

Every dollar contributed to your RRSP saves income tax today at your *current* marginal rate. If you are in the 43% tax bracket and contribute $10,000, you receive a $4,300 refund. That refund, re-invested, compounds inside the RRSP.

**The rule:** Contribute the maximum permissible as early in the year as possible, every year, until you convert to a RRIF. The RRSP deduction limit on your CRA Notice of Assessment is the authoritative number.

**2024:** Maximum new room earned this year = 18% of 2023 earned income, up to $31,560. Add any unused room carried forward from prior years (unlimited carryforward).

### The RRIF conversion (age 71 deadline)

By law, your RRSP must be converted to a Registered Retirement Income Fund (RRIF) by December 31 of the year you turn 71. Once it is a RRIF:

- You can no longer contribute
- You *must* withdraw a CRA-mandated minimum each year
- All withdrawals are fully taxable income

**Minimum RRIF withdrawal rates increase with age:**

| Age | Minimum annual withdrawal (% of Jan 1 balance) |
|---|---|
| 71 | 5.28% |
| 75 | 5.82% |
| 80 | 6.82% |
| 85 | 8.51% |
| 90 | 11.92% |
| 95+ | 20.00% |

On a $1,000,000 RRIF at age 80, the mandatory minimum is $68,200 — regardless of whether you need that cash for living expenses. This is the core problem the RRSP meltdown strategy addresses.

### The RRSP meltdown strategy

**The problem:** A large RRSP converted to a RRIF at 71 can generate mandatory taxable income above $90,000 in the mid-70s and beyond, triggering the OAS clawback and higher marginal rates.

**The solution:** Between retirement and age 71, *voluntarily withdraw from your RRSP* at amounts calibrated to fill up your lower tax brackets — while you are in a low-income window (you have retired; CPP and OAS have not started yet, or are not yet compulsory). You pay tax at 29–33% during this window instead of 43%+ in your 80s. The after-tax proceeds can be re-invested in your TFSA (if room is available) to continue compounding tax-free.

**Where to model this:** Go to **Simulations** → RRSP Meltdown tab. Enter your current RRSP balance, current age, and the expected "other income" (CPP + OAS + pension that will be running alongside). The optimizer will show you year-by-year recommended draws and the estimated lifetime tax saving. A well-executed meltdown on a $700,000+ RRSP typically saves $40,000–$120,000 in lifetime taxes.

**In the main projection:** The Scenario's RRIF conversion age setting and the withdrawal order interact to reflect this. If you set `rrifConversionAge: 65` (early voluntary conversion), RRIF minimums begin immediately but at a lower balance, reducing future mandatory income.

---

## 10. Step 9 — TFSA: Tax-Free Growth and Flexible Withdrawals

**Where:** `Accounts` page; `Simulations` → Contribution Room; `Projections` → Drawdown tab

### Why the TFSA is your most powerful late-retirement account

The TFSA has a property that no other Canadian account has: **withdrawals are completely tax-free** and **do not count as income**. This means:

- TFSA withdrawals do not trigger OAS clawback
- TFSA withdrawals do not inflate your marginal tax rate
- TFSA withdrawals do not appear on your T1 at all

This makes the TFSA the perfect account to hold until late in retirement and draw from when RRIF minimums are already generating significant taxable income.

### Room calculation

Every Canadian aged 18+ accumulates $7,000 of new TFSA room per year (2024 limit; amounts varied in prior years). Total room since 2009 (when TFSAs launched) through 2024 is **$95,000** if you have never contributed.

Withdrawals *re-add* room the following January 1. So if you withdraw $20,000 in 2024, you regain $20,000 of new room on January 1, 2025 — in addition to that year's new limit.

**Where to see your actual room:** CRA My Account → TFSA → Contribution Room. Enter this on your Household profile. The system tracks room year-by-year in the projection.

### Strategy: maximizing TFSA dollar-for-dollar

If you receive a large tax refund from an RRSP contribution, consider re-investing that refund into your TFSA. This "double-dip" — RRSP deduction today + tax-free TFSA growth — compounds dramatically over 20+ years.

The **Avg unused TFSA room** metric on the Projections page shows you how much room you are leaving empty. Every $7,000 sitting outside the TFSA instead of inside it generates unnecessary annual tax drag.

---

## 11. Step 10 — Income Flow: Where Your Money Goes Each Year

**Where:** `Projections` page → **Income Flow** tab

### What the chart shows

The Income Flow chart is a stacked bar chart showing — for every year from today to your planning horizon — how your gross income is *allocated*. Each colour represents a use of money:

| Colour | What it is |
|---|---|
| **Orange — Expenses** | Your inflation-adjusted annual living costs |
| **Red — Tax** | Federal and provincial income tax, CPP contributions |
| **Purple — RRSP contribution** | Annual amount going into your RRSP |
| **Teal — TFSA contribution** | Annual amount going into your TFSA |
| **Green — Surplus → Non-Reg** | Investable surplus after expenses, tax, and registered contributions |
| **Light blue — Surplus → Cash** | Surplus that sits in savings |
| **Muted purple — Unused RRSP room** | Room you are *not* using (an optimization opportunity) |
| **Muted teal — Unused TFSA room** | Room you are not using |

### How to interpret the chart

**Before retirement (left portion):** You should see meaningful RRSP and TFSA contribution bands. If you see large unused room bands, you have optimization potential — either increase contributions or check that your room is entered correctly.

**The retirement transition:** At the retirement line, employment income drops and a new income mix appears — CPP, OAS, and RRIF draws. The bar heights typically *decrease* after retirement (you are living on a fixed income), then grow again as inflation-adjusted expenses rise in the 70s and 80s.

**Tax burden over time:** Watch the red (tax) band. A well-structured plan keeps this band relatively stable or slowly growing. If you see the red band spike significantly in the mid-70s, that is a RRIF minimum pushing taxable income into a higher bracket — a signal to implement the RRSP meltdown strategy.

**Hover on any bar** to see the exact breakdown for that year.

---

## 12. Step 11 — Account Drawdown: How Your Portfolio Empties Over Time

**Where:** `Projections` page → **Drawdown** tab

### What the chart shows

The Drawdown chart shows one horizontal bar per year of retirement, from your retirement age to your planning horizon. The total length of each bar is your total portfolio value in that year. The colour bands from left to right within each bar show the account breakdown:

- **Blue** — RRSP/RRIF balance
- **Green** — TFSA balance
- **Orange** — Non-Registered balance
- **Grey** — Cash balance

The slider at the bottom controls the "playback age." The header above the chart shows the exact balance in each account at the selected age.

### What a healthy drawdown looks like

**Non-Registered accounts deplete first** (correctly) because they are the most tax-inefficient to hold. If you see an orange band, it should shrink and disappear in the first 10–15 years of retirement.

**RRSP/RRIF shrinks gradually** due to mandatory RRIF minimums increasing each year. This is expected and normal. The rate of decline should accelerate in the 80s.

**TFSA holds or grows** through most of retirement because there are no mandatory withdrawals and returns compound tax-free. It typically becomes the dominant account in the late 70s and beyond.

**Portfolio peak:** Look for the age where the bars stop getting longer and start getting shorter. This is the portfolio peak — the point where net withdrawals exceed investment returns. In a well-funded retirement, this often occurs in the early-to-mid 70s.

**Sustainability test:** If all bars reach zero before your planning horizon, the portfolio is depleted. A sustainable plan maintains positive balances to the end — and ideally leaves a meaningful TFSA balance that can pass to heirs tax-free.

### The Key Insights panel

Below the chart, the **Key Insights** section automatically computes:
- Peak portfolio value and age
- Age when net drawdown begins
- RRSP → RRIF conversion milestone (age 71)
- Non-Registered depletion age
- Sustainability verdict at the planning horizon

---

## 13. Step 12 — Monte Carlo: Planning for Market Uncertainty

**Where:** `Projections` page → **Monte Carlo** tab; also `Run Monte Carlo` button

### Why a single projection is not enough

The projection you saw in Step 6 assumes a *constant* return of, say, 6% every year. Markets do not actually behave this way. A -30% year in your first year of retirement has a dramatically larger impact than a -30% year in year 20 — this is called *sequence of returns risk*. The Monte Carlo simulation addresses this.

### How it works

The system runs 500 separate simulations of your plan. In each simulation, returns are randomly drawn each year from a normal distribution with the mean and volatility you specified. Some simulations have bad early returns; some have great early returns. The results are displayed as percentile bands:

| Band | What it means |
|---|---|
| **P95 (top shaded band)** | The top 5% of outcomes — markets cooperated throughout |
| **P75** | Better than 75% of simulated futures |
| **P50 (median)** | The middle outcome — half of futures better, half worse |
| **P25** | Worse than 75% of futures |
| **P5 (bottom band)** | The worst 5% of outcomes — bad luck throughout |

### Reading the success rate

The most important number is the **success rate** — the percentage of the 500 simulations in which your portfolio survived to your planning horizon without reaching zero. A plan with an 85% Monte Carlo success rate means that in 85 out of 100 randomly simulated retirements, you did not run out of money.

**What is a "good" success rate?**

| Success rate | Interpretation |
|---|---|
| 95%+ | Very conservative / over-funded — you can likely spend more |
| 85–95% | Well-funded — appropriate for most households |
| 70–85% | Moderate risk — consider reducing spending or deferring CPP/OAS |
| Below 70% | High risk — significant structural changes needed |

A professional planner typically targets 85–90% success. Targeting 100% is unnecessarily sacrificial — it means dying with a very large estate, which is not most people's goal.

### What to do if your success rate is low

In order of typical impact:
1. **Reduce initial spending by $5,000–10,000/year** — the most powerful lever
2. **Defer CPP to 70** — permanently higher indexed income for life
3. **Defer OAS to 70** — 36% higher benefit, protected from clawback
4. **Work one additional year** — reduces drawdown period and adds one more year of compounding
5. **Increase return assumption with a higher equity allocation** — but this increases volatility too
6. **Implement RRSP meltdown** — reduces tax drag in later years, extending solvency

---

## 14. Step 13 — Stress Test with Scenarios and What-If Analysis

**Where:** `Scenarios` page; `Compare` page

### The purpose of multiple scenarios

Your base case scenario is what you expect. A retirement plan should also answer: *what if things go wrong?* And: *what if things go right?* Creating a set of scenarios lets you understand the range of outcomes and identify which assumptions matter most.

### Recommended scenario set

| Scenario name | Key changes from base |
|---|---|
| **Base Case** | Your central assumptions |
| **Early Retirement** | Retire at 60 instead of 65; CPP at 60; lower assets |
| **Bear Market** | Return rate 3%; volatility 18%; inflation stays at 2.5% |
| **Longevity** | Planning horizon to age 100; same returns |
| **High Inflation** | Inflation 4%; return stays at 6% (real return drops to ~2%) |
| **Frugal Retirement** | Expenses 80% of base |
| **Generous Spending** | Expenses 120% of base — how much can you afford? |
| **Alberta / BC Comparison (if applicable)** | Different province = different tax rates |

### The Compare page

The **Compare** page places two scenarios side by side, showing:
- Projected net worth over time (both lines on one chart)
- Final net worth difference
- Lifetime tax paid difference
- Monte Carlo success rate for each

This is particularly useful for the CPP timing decision: create one scenario with CPP at 60, another with CPP at 70, and compare.

### The What-If drawer

On any Projections chart, the **What-If** floating panel (accessible from the Quick Actions button) lets you make live changes to a single assumption — like retirement age or return rate — and see the chart update instantly without saving. Good for rapid sensitivity analysis in a planning session.

---

## 15. Step 14 — Goals and Milestones

**Where:** `Goals` page; `Milestones` page

### Goals versus milestones

**Milestones** are dated events on your planning timeline — labelled markers that appear on every chart. They provide context for the trajectory the charts show:

- YNAB sync date (when your expense data was last updated)
- Mortgage paid off
- Retirement date
- CPP start
- OAS start
- A planned major expense or inheritance

Add milestones on the **Milestones** page. They appear as vertical dashed lines on the Cash Flow, Income Flow, and other charts, labelled with their name and a line connecting them to the age axis.

**Goals** are financial targets with a dollar amount and target age. Examples:
- Pay off mortgage by age 60: $200,000 lump sum out
- Annual travel budget in retirement: $20,000/year from 65 to 80
- Inheritance from parents: $100,000 lump sum in at age 68
- Move to retirement community: $60,000/year from age 80

Goals are integrated into the cash flow projection as lump-sum events or recurring income/expense adjustments starting at specific ages.

### Pre-loaded examples

The Goals page includes a library of common retirement milestones and goals (CPP start, major renovation, part-time work, inheritance, retirement community costs) that you can add with one click and then customize to your numbers.

---

## 16. Step 15 — Estate Planning: What Your Heirs Receive

**Where:** `Estate` page (left sidebar)

### The concept: deemed disposition at death

When a Canadian dies, the CRA treats all assets as if they were sold at fair market value immediately before death. This creates a "deemed disposition":

- **RRSP/RRIF balances** are fully included in the deceased's final tax return as income. On a $1,000,000 RRIF, this can generate a tax bill of $450,000–$530,000, depending on province. The sole exception is a surviving spouse who inherits the RRIF as a rollover.
- **Non-Registered portfolio** triggers capital gains tax on accrued gains (50% inclusion rate, taxed at marginal rates).
- **TFSA** transfers to heirs completely tax-free — no income inclusion, no capital gains.
- **Primary residence** is exempt from capital gains tax under the Principal Residence Exemption.
- **Cottage / secondary property** is fully subject to capital gains on the gain since purchase.

### Probate fees (by province)

Probate (estate administration tax) applies to assets that pass through the estate. Assets with named beneficiaries (RRSPs, TFSAs, insurance) bypass probate. Ontario probate is 1.5% above $50,000; BC is 1.4%; Alberta has no probate fee on amounts over $150,000.

### Using the Estate page

Enter:
- RRSP/RRIF balance at death (or use the projected figure from your Drawdown)
- TFSA balance at death
- Non-Registered balance and adjusted cost base (ACB)
- Primary residence value
- Cottage/secondary property value and ACB
- Outstanding liabilities
- Estimated marginal tax rate at death and your province

The system calculates:
- Total estate value (gross)
- Estimated taxes owing (RRIF income tax, capital gains on non-reg and cottage)
- Probate fees
- **Net estate to heirs** — the actual after-tax amount your beneficiaries receive

### Estate optimization strategies (visible in projections and scenarios)

1. **Maximize TFSA throughout retirement** — TFSA bypasses estate tax entirely if beneficiaries are named correctly
2. **RRSP meltdown strategy** — reducing RRIF balance at death reduces the final RRIF income inclusion
3. **Name beneficiaries on all registered accounts** — bypasses probate
4. **Spousal rollover** — RRSP/RRIF passes tax-free to a surviving spouse if named as successor holder (not beneficiary); no deemed disposition until the survivor's death

---

## 17. Step 16 — Tax Analytics and Optimization

**Where:** `Tax Analytics` page (left sidebar)

### What the Tax Analytics page shows

The Tax Analytics page provides a year-by-year breakdown of your projected tax burden across both federal and provincial regimes, including:

- **Marginal rate by year** — which bracket you are in each year (important for withdrawal strategies)
- **Average effective rate** — total tax paid ÷ total gross income
- **Tax by source** — how much of your total tax comes from RRIF income, CPP, OAS, employment
- **OAS clawback years** — any years where net income exceeds $90,997 and OAS is partially clawed back

### Common optimization flags to look for

| What you see | What it means | What to do |
|---|---|---|
| Marginal rate drops sharply at retirement | Big gap between working-year rate and retirement rate | Consider more RRSP contributions; meltdown window is wide |
| Marginal rate spikes at age 72–75 | RRIF minimums pushing income into higher bracket | Implement RRSP meltdown before age 71 |
| OAS clawback years appear | Income consistently above $91,000 | Meltdown RRSP earlier; defer OAS to 70 |
| Net income far below $91,000 every year | OAS safe; possibly under-spending or under-withdrawing | Consider more TFSA contributions, higher spending in early retirement |
| High non-reg income | Investment income taxed annually | Consider moving assets inside TFSA/RRSP |

---

## 18. Step 17 — Keeping the Plan Current

A retirement plan is not a one-time exercise. It is a *living model* that needs to be updated as your circumstances change and as time passes.

### Annual review checklist

Each calendar year, update the following:

**Household and income:**
- [ ] Update RRSP contribution room (from new CRA Notice of Assessment after filing)
- [ ] Update TFSA room (new $7,000/year added January 1)
- [ ] Update CPP expected benefit if you requested a new Statement of Contributions from Service Canada
- [ ] Update employment income if salary changed

**Account balances (Accounts page):**
- [ ] Update all account balances from year-end statements
- [ ] Update annual contribution amounts if your savings rate changed

**YNAB sync (Integrations page):**
- [ ] Trigger a manual YNAB sync to refresh expense categories to current actuals

**Scenarios:**
- [ ] Review return rate — is 6% still appropriate given current market conditions and your portfolio allocation?
- [ ] Review inflation rate — has CPI run above or below your assumption?
- [ ] Re-run Monte Carlo to see if the success rate has changed

**Milestone review:**
- [ ] Mark milestones complete as they pass (mortgage paid off, CPP started, etc.)
- [ ] Add new milestones that have become relevant (healthcare costs, care facility planning)

### Significant life events requiring immediate update

- Change of province
- Marriage or separation
- Birth of a child or grandchild (estate beneficiary update)
- Inheritance received or expected
- Job loss or early retirement offer
- Major health changes (longevity assumption may change)
- Significant market events (check Monte Carlo success rate)

---

## 19. Quick Reference: Key Numbers for 2024

| Item | Amount / Rate |
|---|---|
| **RRSP annual contribution limit** | $31,560 (or 18% of prior-year earned income, whichever is less) |
| **TFSA annual limit** | $7,000 |
| **CPP maximum monthly benefit (age 65)** | $1,364.60/month = $16,375/year |
| **CPP early reduction per month (before 65)** | −0.6% per month |
| **CPP deferral credit per month (after 65)** | +0.7% per month |
| **OAS maximum monthly benefit (age 65)** | $713.34/month = $8,560/year |
| **OAS deferral credit per month (after 65)** | +0.6% per month (max 36% at age 70) |
| **OAS clawback threshold** | $90,997 |
| **OAS clawback rate** | 15 cents per dollar above threshold |
| **OAS full elimination income** | ~$148,000 |
| **RRIF minimum at age 71** | 5.28% of January 1 balance |
| **RRIF minimum at age 80** | 6.82% |
| **RRIF minimum at age 90** | 11.92% |
| **Federal basic personal amount** | $15,705 |
| **Capital gains inclusion rate** | 50% (up to $250,000 gain; 2/3 above that per 2024 federal budget) |
| **RRSP contribution deadline** | 60 days after December 31 (typically March 1) |
| **RRSP-to-RRIF conversion deadline** | December 31 of year you turn 71 |
| **CPP earliest start age** | 60 |
| **OAS earliest start age** | 65 |
| **Maximum deferral age (CPP and OAS)** | 70 |

---

> **A note on professional advice.** This system is a powerful planning and analysis tool. It applies the correct Canadian tax rules and performs rigorous projections. It is not a substitute for a licensed financial planner, tax accountant, or estate lawyer for complex situations. Use the output to arrive at planning sessions better informed and to evaluate the advice you receive. A good financial plan is the product of good inputs, good analysis, and good professional judgment working together.
