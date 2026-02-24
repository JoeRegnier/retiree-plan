# Work Breakdown Structure (WBS)

Each task is sized **S/M/L** (Small ≈ ½ day, Medium ≈ 1–2 days, Large ≈ 3–5 days).

## WBS 0 — Foundation

| ID | Task | Size | Depends On | Status |
|---|---|---|---|---|
| 0.1 | Create project documentation (overview, arch, plan, WBS) | M | — | ✅ |
| 0.2 | Init npm-workspaces monorepo + root package.json | S | — | ✅ |
| 0.3 | Scaffold `apps/api` (NestJS, tsconfig, basic module) | M | 0.2 | ✅ |
| 0.4 | Scaffold `apps/web` (Vite + React + MUI shell) | M | 0.2 | ✅ |
| 0.5 | Scaffold `packages/shared` (Zod schemas, barrel exports) | S | 0.2 | ✅ |
| 0.6 | Scaffold `packages/finance-engine` (module stubs, vitest) | S | 0.2 | ✅ |
| 0.7 | Scaffold `packages/openapi` (stub spec + codegen config) | S | 0.2 | ✅ |
| 0.8 | Configure Prettier + ESLint (flat config, shared) | S | 0.2 | ✅ |
| 0.9 | Configure Vitest (unit tests) across all packages | S | 0.3–0.6 | ✅ |
| 0.10 | Configure Playwright E2E harness | S | 0.3, 0.4 | ✅ |
| 0.11 | Root dev/build/test/lint scripts | S | 0.3–0.7 | ✅ |
| 0.12 | Prisma initial setup (schema + SQLite) | M | 0.3 | ✅ |
| 0.13 | GitHub Actions CI pipeline | S | 0.11 | ✅ |

## WBS 1 — Core Data Model & CRUD

| ID | Task | Size | Depends On | Status |
|---|---|---|---|---|
| 1.1 | Prisma schema: User, Household, Member, Account, Income, Expense | M | 0.12 | ✅ |
| 1.2 | Auth module: JWT signup/login/refresh, guards | L | 0.3 | ✅ |
| 1.3 | Shared Zod schemas: household, account, member, income, expense | M | 0.5 | ✅ |
| 1.4 | Households API: CRUD + validation | M | 1.1, 1.2, 1.3 | ✅ |
| 1.5 | Accounts API: CRUD + validation | M | 1.1, 1.2, 1.3 | ✅ |
| 1.6 | Members API: CRUD + validation | M | 1.1, 1.2, 1.3 | ✅ |
| 1.7 | FE: Auth pages (login, register, forgot password) | M | 0.4 | ✅ |
| 1.8 | FE: App shell (sidebar nav, top bar, theme) | M | 0.4 | ✅ |
| 1.9 | FE: Household setup wizard (stepper) | L | 1.4, 1.8 | ✅ |
| 1.10 | FE: Account list & add/edit forms | M | 1.5, 1.8 | ✅ |
| 1.11 | Unit tests: Auth & CRUD endpoints | M | 1.2–1.6 | ✅ |
| 1.12 | E2E: Household creation happy path | S | 1.9 | ✅ |

## WBS 2 — Finance Engine v1

| ID | Task | Size | Depends On | Status |
|---|---|---|---|---|
| 2.1 | Federal tax bracket calculation | M | 0.6 | ✅ |
| 2.2 | Provincial tax brackets (13 provinces/territories) | L | 2.1 | ✅ |
| 2.3 | CPP/QPP contribution & benefit engine | M | 0.6 | ✅ |
| 2.4 | OAS/GIS calculation with clawback | M | 0.6 | ✅ |
| 2.5 | RRSP contribution room & withdrawal tax | M | 2.1 | ✅ |
| 2.6 | TFSA contribution room tracking | S | 0.6 | ✅ |
| 2.7 | Cash-flow projection engine (deterministic) | L | 2.1–2.6 | ✅ |
| 2.8 | Scenarios API: CRUD | M | 1.1 | ✅ |
| 2.9 | Projections API: invoke engine, return results | M | 2.7, 2.8 | ✅ |
| 2.10 | FE: Projection line/area chart (D3) | L | 2.9 | ✅ |
| 2.11 | FE: Year-by-year table view | M | 2.9 | ✅ |
| 2.12 | Unit tests: tax calculations (known values) | M | 2.1, 2.2 | ✅ |
| 2.13 | Unit tests: projection engine | M | 2.7 | ✅ |

## WBS 3 — Simulations & Backtesting

| ID | Task | Size | Depends On | Status |
|---|---|---|---|---|
| 3.1 | Historical return data loader (CSV → DB) | M | 0.12 | ✅ |
| 3.2 | Monte Carlo simulation engine | L | 2.7 | ✅ |
| 3.3 | Backtesting engine (rolling historical windows) | L | 2.7, 3.1 | ✅ |
| 3.4 | Simulation results caching | M | 3.2, 3.3 | ✅ |
| 3.5 | Simulations API: run MC, run backtest, get results | M | 3.2–3.4 | ✅ |
| 3.6 | FE: Fan/cone chart (D3) for MC | L | 3.5 | ✅ |
| 3.7 | FE: Success-rate gauge & percentile table | M | 3.5 | ✅ |
| 3.8 | FE: Backtesting timeline chart | M | 3.5 | ✅ |
| 3.9 | FE: What-If side-by-side comparison | L | 3.6 | ✅ |
| 3.10 | FE: Compare mode overlay | M | 3.9 | ✅ |
| 3.11 | Unit tests: MC engine (deterministic seed) | M | 3.2 | ✅ |
| 3.12 | Performance benchmark (1000 trials < 2s target) | S | 3.2 | ✅ |

## WBS 4 — Advanced Features

| ID | Task | Size | Depends On | Status |
|---|---|---|---|---|
| 4.1 | Tax analytics: marginal vs effective chart | M | 2.1 | ✅ |
| 4.2 | OAS clawback visualisation | M | 2.4 | ✅ |
| 4.3 | RRSP→RRIF meltdown optimisation | L | 2.5, 2.7 | ✅ |
| 4.4 | Flex spending (Guyton-Klinger) | M | 2.7 | ✅ |
| 4.5 | Estate: deemed disposition + probate | L | 2.1 | ✅ |
| 4.6 | International: cross-border CAN/US | L | 2.1 | ⏭ skipped |
| 4.7 | Ad-hoc planning: milestone events | M | 2.7 | ✅ |
| 4.8 | PDF report generation | L | 2.9 | ⏭ skipped |
| 4.9 | CSV export | S | 2.9 | ✅ |
| 4.10 | Sankey diagram (income flow) | L | 2.10 | ✅ |
| 4.11 | Waterfall chart | M | 2.10 | ✅ |
| 4.12 | Heatmap visualisation | M | 2.10 | ✅ |

## WBS 5 — Integrations

| ID | Task | Size | Depends On | Status |
|---|---|---|---|---|
| 5.1 | YNAB OAuth2 integration (NestJS) | L | 1.2 | 🔲 |
| 5.2 | YNAB budget & transaction sync | M | 5.1 | 🔲 |
| 5.3 | FE: YNAB category mapping UI | M | 5.2 | 🔲 |
| 5.4 | Background sync scheduler | S | 5.2 | 🔲 |
| 5.5 | AI adapter: Ollama | M | 0.3 | 🔲 |
| 5.6 | AI adapter: GitHub Copilot SDK | M | 0.3 | 🔲 |
| 5.7 | FE: AI chat side panel | L | 5.5 or 5.6 | 🔲 |
| 5.8 | AI context builder (plan summariser) | M | 5.5 | 🔲 |

## WBS 6 — Polish & Launch

| ID | Task | Size | Depends On | Status |
|---|---|---|---|---|
| 6.1 | Responsive design pass | M | 1.8 | ✅ |
| 6.2 | Accessibility audit (WCAG 2.1 AA) | M | 6.1 | ✅ |
| 6.3 | Performance: lazy loading, Web Workers | M | all | ⏭ deferred |
| 6.4 | Error handling & friendly error states | M | all | ✅ |
| 6.5 | Onboarding tour | M | 1.8 | ⏭ deferred |
| 6.6 | Data export (JSON backup download) | M | 1.4 | ✅ |
| 6.6b | Data import (JSON restore) | M | 6.6 | ✅ |
| 6.7 | Docker Compose (API + SQLite) | M | 0.3 | ✅ |
| 6.8 | Production deployment config (nginx, env vars) | M | 6.7 | ✅ |
| 6.9 | User documentation / help | L | all | ✅ |
| 6.10 | Final E2E test suite | L | all | ✅ |
