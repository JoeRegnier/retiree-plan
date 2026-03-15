# Contributing to RetireePlan

Thank you for your interest in contributing! RetireePlan is a community-driven project and all contributions — code, documentation, bug reports, and ideas — are welcome.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Review Process](#review-process)
- [Canadian Tax Accuracy](#canadian-tax-accuracy)

---

## Code of Conduct

Be respectful. Critique ideas, not people. This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) Code of Conduct. Violations can be reported to the project maintainers.

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally: `git clone https://github.com/<your-username>/retiree-plan.git`
3. Follow the [Development Setup](#development-setup) steps below.
4. Create a **feature branch**: `git checkout -b feature/my-improvement`
5. Make your changes, add tests, verify the build.
6. Push and open a **Pull Request** against `main`.

---

## How to Contribute

### Reporting Bugs

Open a [GitHub Issue](../../issues/new) and include:
- **Steps to reproduce** — the exact sequence that triggers the bug
- **Expected behaviour** — what you thought would happen
- **Actual behaviour** — what actually happened
- **Environment** — OS, Node.js version, desktop vs. web, browser
- **Screenshots or logs** if applicable

> Please search existing issues before opening a new one.

### Suggesting Features

Open a [GitHub Discussion](../../discussions) or an Issue tagged `enhancement`. Describe:
- The problem you're trying to solve
- Your proposed solution (optional)
- Any Canadian-specific context (tax law, CRA references, etc.)

### Submitting Pull Requests

- Keep PRs **focused** — one logical change per PR makes review faster.
- Reference any related issue in the PR description (`Closes #123`).
- All PRs require:
  - Tests for new logic (see [Testing](#testing))
  - The build to pass (`npm run build`)
  - Lint to pass (`npm run lint`)
  - No TypeScript errors (`tsc --noEmit`)

---

## Development Setup

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 24.0.0 |
| npm | ≥ 10 |
| Git | any recent |

### First-time setup

```bash
# Install all workspace dependencies
npm install

# Copy env template and fill in required values
cp .env.example .env
# Required: JWT_SECRET (any long random string for dev)
# Optional: YNAB_API_KEY, NEXT_PUBLIC_*

# Run Prisma migrations and generate the client
npm run db:migrate
npm run db:generate

# (Optional) Seed development data
npm run db:seed
```

### Running in development

```bash
# Start API + web concurrently (recommended)
npm run dev

# Or start individually
npm run dev:api     # NestJS on http://localhost:3001
npm run dev:web     # Vite on http://localhost:5173

# Desktop (Electron, requires web and API builds first)
npm run desktop:dev
```

### Building

```bash
npm run build              # Build all workspaces
npm run build -w apps/api  # API only
npm run build -w apps/web  # Web only
npm run desktop:build      # Full desktop package (DMG/ZIP)
```

### Useful scripts

```bash
npm run lint               # ESLint across all workspaces
npm run format             # Prettier (auto-fix)
npm run format:check       # Prettier (CI check)
npm run test               # Vitest unit tests
npm run test:e2e           # Playwright E2E tests

npm run db:backup          # Manual database backup
npm run db:restore         # Restore from backup
npm run db:restore:list    # List available backups
```

---

## Project Structure

```
retiree-plan/
├── apps/
│   ├── api/              # NestJS backend — controllers, services, Prisma
│   ├── web/              # React 19 + Vite frontend — pages, components, hooks
│   └── desktop/          # Electron main process, preload, electron-builder config
├── packages/
│   ├── shared/           # Zod schemas, constants, types shared across all apps
│   ├── finance-engine/   # Pure TypeScript: tax, projections, simulations, accounts
│   └── openapi/          # OpenAPI 3.1 spec + generated client/server types
├── prisma/               # schema.prisma, migrations/, seed scripts, backup/restore utils
├── docs/                 # Architecture, user guides, roadmap
├── e2e/                  # Playwright tests
└── .github/              # CI workflows
```

### Where to put new code

| Type of change | Location |
|---|---|
| New API endpoint | `apps/api/src/<module>/` |
| New page or component | `apps/web/src/pages/` or `apps/web/src/components/` |
| Tax calculation or simulation logic | `packages/finance-engine/src/` |
| Shared types / Zod schemas | `packages/shared/src/` |
| Database schema change | `prisma/schema.prisma` + new migration |
| Desktop IPC handler | `apps/desktop/src/main.ts` + `apps/desktop/src/preload.ts` |

---

## Coding Standards

- **TypeScript strict mode** everywhere — no `any` unless unavoidable and explained
- **Prettier** for formatting — run `npm run format` before committing
- **ESLint flat config** — run `npm run lint`; fix all errors before opening a PR
- **Zod schemas** at all API and engine boundaries — never trust raw input
- **No hard-coded paths** — use environment variables or derive from `DATABASE_URL`
- **No secrets in code** — use `.env` (never committed) or the desktop secrets manager
- **Comments** only where logic is non-obvious; prefer self-documenting code

---

## Testing

### Unit tests (Vitest)

```bash
npm run test                      # Run all unit tests
npm run test -w packages/finance-engine  # Engine tests only
```

New finance-engine functions **must** have unit tests covering:
- Normal/happy-path inputs
- Edge cases (zero income, maximum contribution room, etc.)
- Canadian-specific boundary conditions (provincial thresholds, etc.)

### E2E tests (Playwright)

```bash
npm run test:e2e
```

E2E tests live in `e2e/` and exercise key user flows (login, create household, run projection).

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer — e.g., Closes #123]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

**Examples:**
```
feat(tax): add 2025 federal bracket rates
fix(desktop): resolve profile switch sending path instead of id
docs(readme): add screenshots and install guide
test(finance-engine): add CPP deferral break-even edge cases
```

---

## Review Process

- A maintainer will review your PR, usually within a few business days.
- Reviewers may request changes — please respond to all comments before the PR is merged.
- PRs are merged with **squash-merge** to keep `main` history clean.
- Breaking changes to the API or finance engine require discussion before implementation.

---

## Canadian Tax Accuracy

This project's primary differentiator is accurate Canadian tax modelling. When contributing to `packages/finance-engine/src/tax/`:

- Cite the specific **CRA publication, IT Bulletin, or Income Tax Act section** in a code comment when implementing a rule.
- Include the applicable **tax year** — tax constants change annually.
- Test against published **CRA examples** where available.
- When in doubt, open an Issue for community discussion before implementing.

Key references:
- [CRA — Individual income tax rates](https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canadian-income-tax-rates-individuals-current-previous-years.html)
- [CRA — RRSP deduction limit](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/contributing-a-rrsp-prpp/rrsp-deduction-limit-how-its-calculated.html)
- [TFSA contribution room](https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account/contributions.html)
- [OAS clawback thresholds](https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/recovery-tax.html)
