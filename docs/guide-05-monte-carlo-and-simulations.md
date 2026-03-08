# Monte Carlo Simulations and Backtesting

## Purpose and Role

The deterministic projection engine gives a single answer: "if everything plays out exactly as assumed, here is what happens." But markets don't follow a fixed return rate. Sequence-of-returns risk — getting a bad sequence of years right at retirement — can permanently impair a plan even if the long-run average return is exactly as expected.

The simulations module answers: "**How likely is this plan to succeed across a realistic range of market outcomes?**"

**Engine files:**
- `packages/finance-engine/src/simulation/` — Monte Carlo engine + Guyton-Klinger
- **API module:** `apps/api/src/simulations/`
- **Frontend:** `apps/web/src/pages/SimulationsPage.tsx`

---

## Monte Carlo Simulation

### What it does

Monte Carlo runs the cash-flow projection hundreds or thousands of times. Each trial uses a **different pseudo-random sequence of annual return rates**, drawn from a distribution based on historical market data. The result is a probability distribution of outcomes — specifically, what fraction of trials end with money remaining at the target age (the "success rate").

### How return sequences are generated

The engine uses a **block bootstrap** approach, not a simple normal distribution. Block bootstrap works by:
1. Loading historical market return data (annual returns for TSX, S&P 500, bonds, and CPI since ~1950)
2. Sampling **blocks** of consecutive years (typically 3–5 years) from this history
3. Assembling each trial's return sequence by chaining sampled blocks until the required number of years is covered

Block bootstrap preserves short-term autocorrelation (a crash year tends to be followed by recovery) that a pure random draw would destroy. This gives more realistic sequences of good and bad runs.

### Success rate definition

A trial is a "success" if `totalNetWorth > 0` at `endAge`. The success rate is:

```
successRate = (trials where money remains at endAge) / totalTrials × 100%
```

A success rate of 90% means 900 of 1,000 simulated futures ended without the household running out of money. Common planning targets:
- **95%+:** Very conservative; likely leaving significant wealth behind
- **85–95%:** Typical "good plan" range
- **70–85%:** Acceptable; may require some spending flexibility
- **Below 70%:** Plan needs adjustment — retire later, save more, or spend less

### Fan chart (cone chart)

The fan chart on SimulationsPage shows the distribution of outcomes as a probability cone:
- **Dark center band:** Median outcome (50th percentile)
- **Medium band:** 25th–75th percentile range
- **Light outer band:** 10th–90th percentile range
- **Individual thin lines:** A sample of individual trial paths

The visual intuition: the cone widens over time because uncertainty compounds. Near-term projections are tighter; distant outcomes have a wide range.

---

## Historical Backtesting

### What it does

Historical backtesting takes the actual sequence of market returns and runs the projection through every possible historical starting year. For example, if you have 70 years of data and a 30-year retirement, the backtest runs ~40 overlapping windows: a retiree who started in 1954, one who started in 1955, etc.

This answers: "How would this plan have performed for every retiree in recorded Canadian market history?"

### Why it's different from Monte Carlo

Monte Carlo generates synthetic sequences. Backtesting uses actual history. Backtesting is more conservative in some ways (it includes the actual 1929, 1970s oil crisis, 2000 dot-com, 2008 GFC sequences) but limited by the fact we only have ~70 years of data.

The system presents both because they're complementary:
- Monte Carlo covers more scenarios (synthesizes beyond historical)
- Backtesting is more viscerally real ("your plan would have failed if you retired in 1968")

### Backtesting chart

The backtesting timeline on SimulationsPage shows each historical start year as a bar colored by outcome:
- **Green:** Plan survived to `endAge`
- **Yellow:** Plan ran out within 5 years of `endAge`  
- **Red:** Plan failed early

---

## Guyton-Klinger Guardrails

### What it does

The base projection uses a fixed inflation-adjusted spending amount. Guyton-Klinger is a **dynamic withdrawal strategy** where the household adjusts spending in response to portfolio performance:

- **Prosperity rule:** If the portfolio performs well, the household can take a spending raise (raise cap: +10% per year)
- **Capital preservation rule:** If the portfolio declines significantly, the household takes a spending cut (cut floor: -10% per year)
- **Overall guardrails:** Define a maximum "withdrawal rate" (relative to portfolio) above/below which cuts or raises trigger

### When guardrails are based on initial withdrawal rate

Guyton-Klinger is defined in terms of the **initial withdrawal rate**: the first year's withdrawal as a percentage of the starting portfolio. For example:
- Starting portfolio: $1,000,000
- Withdrawal rate: 4.5%
- Initial withdrawal: $45,000/year
- Guardrails: cut if withdrawal rate rises to 5.5%; raise if it falls to 3.5%

### Why it increases success rates

A rigid "I will always spend $80,000 inflation-adjusted" plan has a fixed spending trajectory. In bad years, this depletes the portfolio faster, causing a death spiral. Guyton-Klinger introduces spending flexibility: in bad markets, you spend a bit less; in good markets, you spend a bit more. This dramatically improves success rates compared to rigid inflation-adjusted spending.

**Engine location:** `packages/finance-engine/src/simulation/guyton-klinger.ts`

---

## Simulation Performance

Running 1,000 Monte Carlo trials × a 30-year projection = 30,000 engine calls. The engine is designed to run this in under 2 seconds (performance benchmark: `packages/finance-engine/src/simulation/__benchmarks__/`).

Key performance decisions:
- The engine is pure TypeScript with no I/O — no async overhead
- The projection loop avoids object allocations inside the inner loop
- Simulations are cached per-scenario (the API caches the last MC result by scenario ID + trial count + seed)
- The simulations API endpoint accepts a numeric `seed` for reproducible results in tests

---

## Simulation API Endpoints

```
POST /simulations/monte-carlo
  Body: { scenarioId, trials, seed? }
  Returns: { successRate, percentiles: { p10, p25, p50, p75, p90 }[], trialPaths: number[][]  }

POST /simulations/backtest
  Body: { scenarioId }
  Returns: { windows: { startYear, survived, finalBalance }[] }

POST /simulations/guyton-klinger
  Body: { scenarioId, initialWithdrawalRate, prosperityCap, cutFloor }
  Returns: { adjustedWithdrawals: number[], successRate, chartData }
```

---

## SimulationsPage: What Each Section Shows

1. **Success rate gauge** — large percentage number with color coding (red/yellow/green) and a brief description of what that means in plain language
2. **Percentile table** — P10, P25, P50, P75, P90 balances at each projected age
3. **Fan/cone chart** — the D3 spread visualization of all trial outcomes
4. **Backtesting timeline** — historical window success/failure bars
5. **Guyton-Klinger comparison** — rigid vs. flexible spending success rate side-by-side
6. **Key stats chips** — median final balance, probability of leaving $500K+ estate, worst-case depletion age

---

## AI-Assisted Coding Quick Reference

**When changing the return distribution model:**
- The block bootstrap sampler is in `packages/finance-engine/src/simulation/monte-carlo.ts`
- To switch to a parametric normal distribution, replace the bootstrap sampler with `Box-Muller` normal samples using the historical mean and standard deviation

**When adding a new withdrawal strategy:**
1. Create a new file in `packages/finance-engine/src/simulation/`
2. Export a function with signature `(input: CashFlowInput, strategyParams: T) => SimulationResult`
3. Add an API endpoint in `apps/api/src/simulations/simulations.controller.ts`
4. Add a tab or section on SimulationsPage to display the results

**When adding a new chart type to SimulationsPage:**
- Each chart is a separate D3 component in `apps/web/src/components/charts/`
- SimulationsPage renders them conditionally based on which tab is active
- All charts accept already-computed data from the API — no calculation in the chart components

**What NOT to do:**
- Do not run Monte Carlo trials in the main API thread on a large trial count — consider streaming results or running in a NestJS background worker for production
- Do not hardcode historical return data in the engine — it lives in a data file loaded by the simulation module
- Do not set the trial count below 500 for production use — 1,000 is the minimum for stable percentile estimates
