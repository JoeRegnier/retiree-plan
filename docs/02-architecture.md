# Architecture

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                        │
│  React 19 · MUI 6 · D3.js 7 · React Router · TanStack Q   │
│  ┌────────┐ ┌────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Dashboard│ │Scenarios│ │Simulations│ │Reports / Charts  │  │
│  └────────┘ └────────┘ └──────────┘ └───────────────────┘  │
│                         ▲  Fetch (TanStack Query)           │
└─────────────────────────┼───────────────────────────────────┘
                          │  REST / JSON  (OpenAPI 3.1)
┌─────────────────────────┼───────────────────────────────────┐
│                     NestJS API                              │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐  │
│  │Auth     │ │Households│ │Projections │ │Integrations  │  │
│  │(JWT)    │ │Accounts  │ │Simulations │ │(YNAB, AI)    │  │
│  └─────────┘ └──────────┘ └────────────┘ └──────────────┘  │
│                 │                │                           │
│       ┌─────────┘    ┌───────────┘                          │
│       ▼              ▼                                      │
│  ┌──────────┐  ┌──────────────────┐                         │
│  │ Prisma   │  │ finance-engine   │  (pure TS, no I/O)     │
│  │ ORM      │  │ tax · sim · proj │                         │
│  └────┬─────┘  └──────────────────┘                         │
│       │                                                     │
└───────┼─────────────────────────────────────────────────────┘
        │
   ┌────▼─────┐
   │ SQLite   │  (dev)
   │ Postgres │  (prod)
   └──────────┘
```

## Design Principles

1. **Shared-nothing engine** — The `finance-engine` package is pure TypeScript with zero I/O. It receives inputs, returns outputs. This makes it trivially testable and potentially runnable in a Web Worker.
2. **Schema-first API** — An OpenAPI 3.1 spec is the single source of truth. Types are generated for both client and server.
3. **Zod everywhere** — Runtime validation at API boundaries and within the engine. Zod schemas double as TypeScript types via `z.infer<>`.
4. **Context + Hooks over Redux** — Lightweight state via React Context providers; server-state via TanStack Query.
5. **Progressive complexity** — Start with SQLite for zero-config dev; Prisma makes the switch to PostgreSQL a one-line change.

## Key Modules

### `packages/finance-engine`

The computational heart. Implements:

| Module | Responsibility |
|---|---|
| `tax/canadian-tax.ts` | Federal + provincial bracket math, CPP/QPP, EI, OAS/GIS clawback, dividend gross-up & credit, capital-gains inclusion rate |
| `projection/cash-flow.ts` | Year-by-year deterministic cash-flow projection |
| `simulation/monte-carlo.ts` | Configurable MC simulation (normal, log-normal, historical bootstrap) |
| `simulation/backtesting.ts` | Replay plan against historical return series |
| `accounts/registered.ts` | RRSP, TFSA, RESP, LIRA, LIF contribution/withdrawal rules |
| `accounts/non-registered.ts` | ACB tracking, capital gains/losses |
| `spending/flex-spending.ts` | Guyton-Klinger guardrails, variable withdrawal strategies |
| `estate/deemed-disposition.ts` | Terminal tax, probate by province, beneficiary modelling |
| `international/cross-border.ts` | Canada-US treaty basics, departure tax |
| `benefits/government.ts` | CPP/QPP, OAS, GIS calculation with start-age optimisation |
| `conversion/rrsp-rrif.ts` | Optimal RRSP→RRIF conversion / meltdown strategies |
| `reporting/pdf-export.ts` | PDF generation from projection data |

### `apps/api` (NestJS)

| Module | Responsibility |
|---|---|
| `auth` | JWT-based authentication, sessions |
| `households` | CRUD for household profiles (members, ages, provinces) |
| `accounts` | Financial accounts CRUD (type, balance, contributions) |
| `scenarios` | Named plan scenarios with full parameter sets |
| `projections` | Invoke finance-engine, cache & return projection results |
| `simulations` | Monte Carlo / backtest job management |
| `integrations/ynab` | OAuth2 flow, budget/transaction sync |
| `integrations/ai` | Ollama / Copilot SDK proxy for AI chat |
| `reports` | Generate & serve PDF/CSV exports |

### `apps/web` (React)

| Area | Key Screens |
|---|---|
| Dashboard | Net-worth summary, key metrics, quick actions |
| Household Setup | Members, income sources, expenses, accounts |
| Scenarios | Create/edit/compare named plans |
| Projections | Interactive cash-flow chart (D3), year-by-year table |
| Simulations | Monte Carlo fan chart, success rate, percentile bands |
| Tax Analytics | Bracket visualisation, marginal vs effective, clawback zones |
| Reports | Download centre for PDF/CSV |
| Settings | YNAB connection, AI preferences, data import/export |

## Data Model (Prisma — simplified)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  households Household[]
}

model Household {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  members   HouseholdMember[]
  accounts  Account[]
  scenarios Scenario[]
}

model HouseholdMember {
  id            String   @id @default(cuid())
  name          String
  dateOfBirth   DateTime
  province      String
  householdId   String
  household     Household @relation(fields: [householdId], references: [id])
  incomeSources IncomeSource[]
}

model Account {
  id          String   @id @default(cuid())
  name        String
  type        AccountType
  balance     Decimal
  householdId String
  household   Household @relation(fields: [householdId], references: [id])
}

enum AccountType {
  RRSP
  TFSA
  RESP
  LIRA
  LIF
  NON_REGISTERED
  CORPORATE
  CASH
}

model Scenario {
  id          String   @id @default(cuid())
  name        String
  parameters  Json
  householdId String
  household   Household @relation(fields: [householdId], references: [id])
}
```

## Integration Points

### YNAB
- OAuth2 authorization code flow.
- Sync budgets & transactions via YNAB API v2.
- Map YNAB categories → RetireePlan expense categories.
- Periodic background refresh (NestJS CRON).

### AI Assistance
- **Ollama** (local): POST to `http://localhost:11434/api/chat` with plan context.
- **GitHub Copilot SDK**: Cloud-based alternative; user selects provider in settings.
- Use cases: "How much can I safely spend?", "Should I convert RRSP this year?", scenario suggestions.

## Security

- JWT access + refresh tokens (httpOnly cookies).
- All financial data encrypted at rest (Prisma middleware or DB-level).
- YNAB tokens stored encrypted; refresh handled automatically.
- CORS restricted to known origins.
- Rate limiting on API routes.
