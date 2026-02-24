# Implementation Plan

## Phase 0 — Foundation (Sprint 1–2)
> Goal: Runnable monorepo with skeleton apps, CI green, dev tooling solid.

- [x] Documentation: overview, architecture, implementation plan, WBS
- [x] Initialise npm-workspaces monorepo
- [x] Scaffold `apps/api` (NestJS + Prisma + SQLite)
- [x] Scaffold `apps/web` (Vite + React + MUI + React Router)
- [x] Scaffold `packages/shared` (Zod schemas, TS types)
- [x] Scaffold `packages/finance-engine` (empty modules, vitest)
- [x] Scaffold `packages/openapi` (stub spec)
- [x] Configure Prettier, ESLint (flat config)
- [x] Configure Vitest (unit) + Playwright (E2E) harnesses
- [x] Root scripts: `dev`, `build`, `test`, `lint`, `e2e`
- [x] GitHub Actions CI: lint → test → build

## Phase 1 — Core Data Model & CRUD (Sprint 3–4)
> Goal: Users can create a household, add members, accounts, income, expenses.

- [x] Prisma schema: User, Household, HouseholdMember, Account, IncomeSource, Expense
- [x] Auth module (JWT signup/login, guards)
- [x] Households CRUD API + validation (Zod)
- [x] Accounts CRUD API
- [x] Front-end: Auth pages (login/register)
- [x] Front-end: Household setup wizard (stepper)
- [x] Front-end: Account list & forms
- [x] Shared Zod schemas consumed by both FE & BE
- [x] Unit tests for all CRUD endpoints
- [x] E2E: household creation happy path

## Phase 2 — Finance Engine v1 (Sprint 5–7)
> Goal: Deterministic cash-flow projections with Canadian tax.

- [x] Canadian federal tax brackets & rates (current year)
- [x] Provincial tax brackets (all 13 provinces/territories)
- [x] CPP/QPP contribution & benefit calculation
- [x] OAS/GIS calculation with clawback
- [x] RRSP contribution room & withdrawal taxation
- [x] TFSA contribution room tracking
- [x] Basic cash-flow projection engine (year-by-year)
- [x] Scenarios CRUD (parameters stored as JSON)
- [x] Projections API endpoint (invoke engine, return results)
- [x] Front-end: Projection chart (D3 line/area chart)
- [x] Front-end: Year-by-year table view
- [x] Unit tests for tax calculations (known brackets)
- [x] Unit tests for projection engine

## Phase 3 — Simulations & Backtesting (Sprint 8–10)
> Goal: Monte Carlo & historical backtesting operational.

- [x] Historical return data loader (CSV ingestion for TSX, S&P500, bonds, CPI)
- [x] Monte Carlo simulation engine (configurable: n-trials, distribution, correlation)
- [x] Backtesting engine (sequential historical windows)
- [x] Simulation results storage & caching
- [x] Fan/cone chart (D3) for MC results
- [x] Success-rate gauge & percentile table
- [x] Backtesting timeline chart
- [x] What-If scenario comparison (side-by-side)
- [x] Compare mode overlay charts
- [x] Unit tests for MC engine (deterministic seed)
- [x] Performance benchmarks (1000+ trials < 2s)

## Phase 4 — Advanced Features (Sprint 11–14)
> Goal: Full feature set — tax analytics, estate, flex spending, RRSP meltdown.

- [x] Tax analytics module: marginal vs effective rate chart, bracket stacking
- [x] OAS clawback visualisation
- [x] RRSP → RRIF meltdown optimisation algorithm
- [x] Flex spending (Guyton-Klinger guardrails)
- [x] Estate planning: deemed disposition, probate by province
- [x] International: Canada-US cross-border basics (RRSP treaty, SS/CPP totalization, PFIC, US estate tax)
- [x] International: Worldwide/expat strategies (departure tax, T1135, RRSP non-resident, QROPS, repatriation)
- [x] Ad-hoc planning: freeform milestone events (buy cottage, gift to kids)
- [x] Downloadable reports: CSV export
- [x] Downloadable reports: PDF (via @react-pdf/renderer)
- [x] Advanced D3 visualisations: Sankey (income flow), waterfall, heatmap

## Phase 5 — Integrations (Sprint 15–16)
> Goal: YNAB connected, AI assistant functional.

- [x] YNAB OAuth2 flow (NestJS integration module)
- [x] YNAB budget & transaction sync
- [x] Category mapping UI (YNAB → RetireePlan)
- [x] Background sync job (NestJS scheduler)
- [x] AI module: Ollama adapter (local LLM)
- [x] AI module: GitHub Copilot SDK adapter (`@github/copilot-sdk` — JSON-RPC via Copilot CLI)
- [x] AI chat UI component (side panel)
- [x] AI context builder (summarise plan for prompt)

## Phase 6 — Polish & Launch (Sprint 17–18)
> Goal: Production-ready, documented, deployable.

- [x] Responsive design pass (mobile-friendly)
- [x] Accessibility audit (WCAG 2.1 AA)
- [x] Performance optimisation (lazy loading, Web Workers for engine)
- [x] Error handling & user-friendly error states (ValidationPipe, global error alerts)
- [x] Onboarding tour / first-run experience (wizard-based on first login)
- [x] Data export (JSON backup download)
- [x] Data import (JSON restore)
- [x] Docker Compose for local dev (API + SQLite)
- [x] Production deployment config (Docker, env vars, nginx)
- [x] User documentation / help pages
- [x] Final E2E test suite covering all major flows
