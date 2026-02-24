# RetireePlan — Project Overview

## Vision

A comprehensive, open-source, DIY financial & retirement planning web application purpose-built for **Canadian households** pursuing a Direct-Investing / Personal-Finance strategy. The tool empowers users to model, simulate, and optimise their financial future without relying on expensive advisor-gated software.

## Target User

- Canadian individuals or households managing their own investments (self-directed / direct-investing).
- Users of YNAB (You Need A Budget) who want deeper retirement projection capabilities.
- People comfortable with a modern web UI but who are **not** financial professionals.

## Core Value Proposition

| Capability | Description |
|---|---|
| **Cash-Flow Projections** | Year-by-year income, expense, tax, and savings projections through retirement. |
| **Monte Carlo Simulations** | Probabilistic modelling of portfolio outcomes using historical & synthetic return distributions. |
| **Historical Backtesting** | Replay plans against actual market history (TSX, S&P 500, bonds, inflation). |
| **Flexible Modelling** | Multiple accounts (RRSP, TFSA, RESP, Non-Reg, LIRA, LIF, corporate), custom asset mixes, phased retirement. |
| **Tax Estimation** | Federal + provincial Canadian tax brackets, CPP/QPP, OAS/GIS clawback, capital-gains inclusion, dividend gross-up & credit. |
| **Advanced Visualisations** | Interactive D3.js charts — waterfall, Sankey, fan/cone, heatmap, net-worth over time. |
| **What-If Scenarios** | Side-by-side scenario comparison (e.g., retire at 55 vs 60, sell rental property, etc.). |
| **RRSP-to-RRIF / Roth-equivalent Conversions** | Model optimal draw-down & conversion strategies to minimise lifetime tax. |
| **Tax Analytics** | Marginal vs effective rate visualisation, bracket stacking, OAS clawback zones. |
| **Estate Planning** | Deemed-disposition modelling, beneficiary designations, probate estimate by province. |
| **International Planning** | Cross-border (Canada/US) considerations — treaty, FBAR, departure tax. |
| **Compare Mode** | Overlay two or more complete plans for visual comparison. |
| **Flex Spending** | Variable "fun" spending guardrails (Guyton-Klinger style). |
| **Downloadable Reports** | PDF / CSV export of projections, tax summaries, net-worth statements. |
| **YNAB Integration** | Pull actual spending data to ground projections in real behaviour. |
| **AI Assistance** | Ollama (local LLM) or GitHub Copilot SDK for natural-language "what should I do?" guidance. |

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) everywhere |
| Runtime | Node 24+ LTS |
| Monorepo | npm workspaces |
| Frontend | React 19, Vite 6, Material UI 6, D3.js 7, React Router 7, TanStack Query 5, Zod |
| Backend | NestJS 11, Prisma 6, PostgreSQL (prod) / SQLite (dev), Winston logging |
| API Contract | OpenAPI 3.1 spec (code-gen'd types shared FE ↔ BE) |
| Testing | Vitest + React Testing Library (unit/integration), Playwright (E2E) |
| Code Quality | Prettier, ESLint (flat config) |
| AI | Ollama REST API / GitHub Copilot SDK (pluggable) |
| Integrations | YNAB API v2 |

## Repository Layout (Monorepo)

```
retiree-plan/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # React + Vite frontend
├── packages/
│   ├── shared/       # Zod schemas, types, constants, utilities
│   ├── finance-engine/ # Pure-TS simulation/tax/projection engine
│   └── openapi/      # OpenAPI spec + generated client/server types
├── e2e/              # Playwright end-to-end tests
├── docs/             # Project documentation
├── prisma/           # Prisma schema & migrations (shared)
├── .github/          # CI workflows
└── package.json      # Root workspace config
```
