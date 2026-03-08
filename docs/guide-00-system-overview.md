# System Overview — RetireePlan

## What This System Does

RetireePlan is a Canadian retirement planning application that gives households a clear, honest picture of whether their financial plan will survive their retirement. It is not a robo-advisor, an investment platform, or a budgeting app. It is a **projection and decision-support tool**: the user enters their financial reality (accounts, income, expenses, goals), and the system runs a rigorous year-by-year simulation to answer questions like:

- "If I retire at 60, does my money last to age 90?"
- "When should I take CPP — at 60, 65, or 70?"
- "What happens if markets drop 30% in my first year of retirement?"
- "How much of my estate will the CRA take?"

The system is designed specifically for the Canadian context: federal and provincial tax brackets, CPP/OAS/GIS rules, RRSP/RRIF/TFSA rules, and estate law are all modelled accurately.

---

## Design Philosophy

**The engine is the truth.** Every number shown in the UI comes from the same deterministic projection engine (`cash-flow.ts`). The UI is only a way to configure that engine and visualise its output. No calculation is performed in a React component.

**Canadian rules are first-class.** Generic financial planning tools treat Canada as "like the US but with different numbers." This system is built from the ground up for Canadian married couples with RRSP-heavy portfolios who need to make CPP/OAS timing decisions and manage RRIF minimums through retirement.

**Determinism over complexity.** The base scenario is fully deterministic — every run with the same inputs produces exactly the same result. This makes debugging, testing, and user explanation straightforward. Probabilistic analysis (Monte Carlo) is offered as an opt-in layer on top, not the default.

**Pure engine, no I/O.** The `finance-engine` package performs no database access, no HTTP calls, and no side effects. It accepts plain TypeScript objects and returns plain TypeScript objects. This means the engine runs identically in the API, in unit tests, in browser Web Workers, and in the PDF report generator.

---

## Repository Layout

```
retiree-plan/
├── apps/
│   ├── api/                    # NestJS backend (REST API, auth, DB access)
│   │   └── src/
│   │       ├── auth/           # JWT authentication module
│   │       ├── households/     # Household + member CRUD
│   │       ├── accounts/       # Account + real estate CRUD
│   │       ├── scenarios/      # Scenario parameter CRUD
│   │       ├── projections/    # Invokes finance-engine, returns results
│   │       ├── simulations/    # Monte Carlo + backtest execution
│   │       ├── goals/          # Goals CRUD + evaluation
│   │       ├── milestones/     # Milestone event CRUD
│   │       ├── market-data/    # Assumptions / market data refresh
│   │       └── estate/         # Estate calculation API
│   └── web/                    # React frontend (Vite + MUI + D3)
│       └── src/
│           ├── pages/          # One file per route (DashboardPage, etc.)
│           ├── components/     # Shared UI components + all D3 charts
│           ├── layouts/        # AppLayout (nav + providers)
│           └── contexts/       # QuickActionsContext, etc.
├── packages/
│   ├── finance-engine/         # Pure TS calculation engine (no I/O)
│   │   └── src/
│   │       ├── projection/     # cash-flow.ts — the core engine
│   │       ├── tax/            # canadian-tax.ts — federal + provincial
│   │       ├── benefits/       # government.ts — CPP, OAS, GIS
│   │       ├── simulation/     # Monte Carlo + Guyton-Klinger
│   │       ├── optimization/   # rrsp-meltdown.ts
│   │       ├── insights/       # insights-engine.ts
│   │       ├── scoring/        # readiness-score.ts
│   │       ├── estate/         # estate.ts
│   │       ├── real-estate/    # real-estate.ts
│   │       ├── goals/          # goals-engine.ts
│   │       ├── contributions/  # contribution-room.ts
│   │       ├── allocation/     # asset-allocation.ts
│   │       └── international/  # cross-border.ts
│   ├── shared/                 # Zod schemas, TypeScript types, constants
│   │   └── src/
│   │       ├── constants/      # canada.ts — tax limits, TFSA limits, etc.
│   │       ├── schemas/        # Zod validation schemas
│   │       └── types/          # Shared TypeScript interfaces (ProjectionYear, etc.)
│   └── openapi/                # OpenAPI spec (auto-generated, not hand-edited)
├── prisma/
│   └── schema.prisma           # Single Prisma schema for the entire system
├── data/
│   └── retiree-plan.db         # SQLite dev database (real data, NOT prisma/dev.db)
└── docs/                       # All documentation (this directory)
```

---

## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19 + Vite | Fast HMR, modern React features |
| UI | MUI v6 | Consistent design system, accessible components |
| Charts | D3.js v7 | Custom animated visualisations |
| Data fetching | TanStack Query v5 | Cache management, background refetch |
| Backend | NestJS 11 | Module-based architecture, dependency injection |
| ORM | Prisma 6 | Type-safe DB access, easy migrations |
| Database | SQLite (dev) / PostgreSQL (prod) | Zero-config dev, scalable prod |
| Engine | Pure TypeScript | Portable, testable, no dependencies |
| Validation | Zod | Shared schemas between API and frontend |
| Testing | Vitest (unit) + Playwright (E2E) | Fast unit tests, full-stack E2E |

---

## Data Flow Architecture

```
User interaction
     │
     ▼
React page (e.g. ProjectionsPage)
     │  reads from TanStack Query cache
     ▼
TanStack Query hook
     │  GET /projections/:id or POST /projections
     ▼
NestJS API (ProjectionsController)
     │  loads household/scenario from Prisma
     ▼
ProjectionsService.buildProjectionPayload()
     │  maps DB records → CashFlowInput shape
     ▼
runCashFlowProjection(input: CashFlowInput)   ← finance-engine
     │  returns ProjectionYear[]
     ▼
API serializes JSON response
     ▼
TanStack Query stores in cache
     ▼
React components render from cache
     │
     ▼
D3 charts, tables, cards read from ProjectionYear[]
```

The key insight is that `runCashFlowProjection` is called exactly once per projection request. Everything downstream (charts, scores, insights, PDF) reads from the same `ProjectionYear[]` array.

---

## Key Data Shapes

### `CashFlowInput` — what goes into the engine

The complete input to a projection. Defined in `packages/finance-engine/src/projection/cash-flow.ts`. Key fields:

```typescript
{
  currentAge: number          // Primary member's current age
  endAge: number              // Project to this age (typically 90–105)
  province: Province          // For provincial tax calculation
  retirementAge: number       // Employment income stops at this age
  employmentIncome: number    // Annual pre-retirement income
  incomeSources?: IncomeSourceEntry[]  // Detailed multi-source income (overrides scalar)
  annualExpenses: number      // Annual living expenses (today's dollars)
  expenseEntries?: ExpenseEntry[]      // Detailed per-category expenses
  inflationRate: number       // e.g. 0.026
  nominalReturnRate: number   // e.g. 0.06
  rrspBalance: number
  tfsaBalance: number
  nonRegBalance: number
  cashBalance?: number
  rrspContribution?: number
  tfsaContribution?: number
  cppStartAge: number         // When to begin CPP
  cppBenefitFraction?: number // 0–1, fraction of maximum CPP benefit
  oasStartAge: number
  oasResidencyYears?: number
  rrifConversionAge?: number  // Default 71
  glidePathSteps?: GlidePathStep[]     // Age-based return rate changes
  spendingPhases?: SpendingPhase[]     // Age-based spending multipliers
  yearlyReturnRates?: number[]         // Override for Monte Carlo / backtest
  rrspReturnRate?: number              // Per-account return overrides
  tfsaReturnRate?: number
  nonRegReturnRate?: number
}
```

### `ProjectionYear` — what comes out

One record per simulated year. Defined in `packages/shared/src/types/`. Key fields:

```typescript
{
  age: number
  year: number
  income: number            // Total employment + benefit income
  expenses: number          // Inflation-adjusted expenses
  cppIncome: number
  oasIncome: number
  rrspBalance: number
  tfsaBalance: number
  nonRegBalance: number
  cashBalance: number
  totalNetWorth: number
  taxPaid: number
  rrspWithdrawal: number
  tfsaWithdrawal: number
  nonRegWithdrawal: number
  cashWithdrawal: number
  rrifMinimumWithdrawal: number
  netCashFlow: number       // After tax income - expenses (positive = surplus)
}
```

---

## Page Map

| Route | Page | Purpose |
|---|---|---|
| `/` | DashboardPage | Plan health summary, score, insights, net worth chart |
| `/accounts` | AccountsPage | Account CRUD, real estate, contribution room, asset allocation |
| `/household` | HouseholdPage | Members, income sources, retirement parameters |
| `/projections` | ProjectionsPage | Projection charts (6 tabs), year-by-year table |
| `/scenarios` | ScenariosPage | Scenario parameters, what-if sliders, spending phases |
| `/simulations` | SimulationsPage | Monte Carlo, backtesting, success rates |
| `/goals` | GoalsPage | Goals CRUD, success rates per goal |
| `/milestones` | MilestonesPage | One-time events (sell home, inheritance, etc.) |
| `/estate` | EstatePage | Estate value calculator, probate, beneficiaries |
| `/heatmap` | HeatmapPage | Return rate vs. withdrawal rate success heatmap |
| `/pdf` | PDF generation | Report export via @react-pdf/renderer |

---

## AI-Assisted Coding Quick Reference

### "I want to change how a number is calculated"
The calculation lives in `packages/finance-engine/src/`. Find the appropriate module and edit or add to the pure function there. Run tests with `npm run test --workspace=packages/finance-engine`.

### "I want to add a new field to the projection"
1. Add the field to `ProjectionYear` in `packages/shared/src/types/`
2. Populate it in the main loop in `projection/cash-flow.ts`
3. The API and frontend will immediately receive the new field — no API changes needed unless a new endpoint is required
4. Add the field to any relevant chart/table component in `apps/web/src/`

### "I want to add a new page"
1. Create `apps/web/src/pages/NewPage.tsx`
2. Add to router in `apps/web/src/App.tsx`
3. Add nav item to `apps/web/src/layouts/AppLayout.tsx`
4. If the page needs data, add a TanStack Query hook calling an existing or new API endpoint

### "I want to add a new API endpoint"
1. Add the method to the relevant NestJS service (`apps/api/src/<module>/<module>.service.ts`)
2. Add the route to the controller (`apps/api/src/<module>/<module>.controller.ts`)
3. The service should call `buildProjectionPayload` or other mapper helpers, then invoke the engine function
4. The engine function lives in `packages/finance-engine/src/`

### "Where is the real database?"
`data/retiree-plan.db` — not `prisma/dev.db`. Both exist but only the one in `/data/` has real user data.

### "How do I run everything?"
```bash
npm run dev          # Starts both API (port 3000) and web (port 5173) concurrently
npm run build        # Builds all 4 packages in dependency order
npm run test         # Runs all Vitest unit tests
npm run lint         # ESLint across all packages
```

### Things to avoid
- Never add I/O (DB calls, HTTP, file reads) inside `packages/finance-engine/`
- Never calculate financial values inside React components — put them in the engine
- Never skip the `buildProjectionPayload` mapper in the API service — it ensures the DB data is correctly shaped for the engine
- Never edit `prisma/schema.prisma` without running `npx prisma migrate dev` and updating any affected Zod schemas in `packages/shared/`
