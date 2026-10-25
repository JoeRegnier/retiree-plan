# Installation & Developer Guide

This guide covers all ways to run RetireePlan — desktop app, web-only development, and production deployment.

---

## Table of Contents

- [Desktop App (End Users)](#desktop-app-end-users)
- [Development Setup (Web Mode)](#development-setup-web-mode)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Desktop Development Build](#desktop-development-build)
- [Desktop Production Package](#desktop-production-package)
- [Production Deployment (Web)](#production-deployment-web)
- [Docs, Demo, Screenshots, and GitHub Pages](#docs-demo-screenshots-and-github-pages)
- [Troubleshooting](#troubleshooting)

---

## Desktop App (End Users)

The desktop app bundles everything — no Node.js, no database setup, no configuration required.

1. Download the latest release from the [Releases page](../../releases):
   - **macOS:** `RetireePlan-<version>-arm64.dmg` (Apple Silicon) or `RetireePlan-<version>.dmg` (Intel)
   - **Windows:** `RetireePlan-Setup-<version>.exe`
   - **Linux:** `RetireePlan-<version>.AppImage`

2. Install/open as normal for your platform.

3. On first launch, you will be prompted to choose a folder for your plan data. This folder will contain:
   - `retiree-plan.db` — your SQLite database
   - `secrets.json` — your JWT and encryption keys (never share this file)
   - `backups/` — automatic daily + manual backups

4. Register a new account (local only — credentials never leave your machine).

### Multiple Plans / Profiles

You can maintain multiple completely independent plans (e.g., one for current finances, one for "what if I retired early"). From the login screen or Settings, use **Change** to switch plans, or **New Profile** to create a fresh one. Each plan gets its own database and its own isolated backup set.

---

## Development Setup (Web Mode)

### Prerequisites

| Tool | Minimum Version | Notes |
|---|---|---|
| Node.js | 24.0.0 | Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) |
| npm | 10.0.0 | Bundled with Node 24 |
| Git | any | |

### Clone and install

```bash
git clone https://github.com/your-org/retiree-plan.git
cd retiree-plan
npm install
```

### Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```dotenv
# Required
JWT_SECRET=any-long-random-string-for-local-dev
TOKEN_ENCRYPTION_KEY=32-char-hex-string           # openssl rand -hex 32

# Optional integrations
YNAB_API_KEY=your-ynab-personal-access-token
```

### Initialize the database

```bash
# Apply migrations and generate the Prisma client
npm run db:migrate
npm run db:generate

# (Optional) Seed with sample household data
npm run db:seed
```

### Start development servers

```bash
npm run dev
```

This starts both the API and the web UI concurrently:
- **API:** http://localhost:3001
- **Web:** http://localhost:5173

Or start them individually:

```bash
npm run dev:api   # API only
npm run dev:web   # Web only
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `file:./data/retiree-plan.db` | Prisma database connection string |
| `JWT_SECRET` | Yes | — | Secret key for signing JWT tokens. Use a long random string in production. |
| `TOKEN_ENCRYPTION_KEY` | Yes | — | 32-byte hex key for encrypting stored API tokens (YNAB etc.) |
| `PORT` | No | `3001` | API server port |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin for the frontend |
| `SERVE_STATIC` | No | `false` | Set to `true` to serve the built web app from the API (used by desktop) |
| `STATIC_FILES_PATH` | No | — | Absolute path to the built web `dist/` folder when `SERVE_STATIC=true` |
| `YNAB_API_KEY` | No | — | YNAB personal access token for the YNAB integration |
| `OLLAMA_URL` | No | `http://localhost:11434` | Ollama API base URL for local AI |
| `NODE_ENV` | No | `development` | Set to `production` for production builds |

> **Desktop mode:** The Electron main process sets `DATABASE_URL`, `JWT_SECRET`, `SERVE_STATIC`, and `STATIC_FILES_PATH` automatically based on the selected plan folder. You do not manage these manually.

---

## Database

RetireePlan uses **Prisma** with:
- **SQLite** in development and desktop mode (zero config, file-based)
- **PostgreSQL** in production web deployments

### Common database commands

```bash
# Apply all pending migrations
npm run db:migrate

# Re-generate the Prisma client after schema changes
npm run db:generate

# Push schema changes without creating a migration (dev only)
npm run db:push

# Create a timestamped backup
npm run db:backup

# List available backups
npm run db:restore:list

# Restore the most recent backup
npm run db:restore

# Restore a specific backup file
node prisma/restore.js retiree-plan_2026-03-14_02-00-00.db
```

### Creating a migration

```bash
cd apps/api
npx prisma migrate dev --name describe-your-change
```

This creates a new file in `prisma/migrations/` and automatically runs it against your local database.

---

## Desktop Development Build

The desktop app wraps the React frontend and NestJS API inside an Electron shell.

### Prerequisites (in addition to web setup)

- The web app must be built: `npm run build -w apps/web`
- The API must be built: `npm run build -w apps/api`

### Run in dev mode

```bash
npm run desktop:dev
```

This starts Electron pointing at a pre-built API and the built web dist. The app hot-reloads on file changes.

### Production package

```bash
npm run desktop:build
```

This runs `apps/desktop/scripts/build-desktop.sh` which:
1. Builds the web app (Vite)
2. Bundles the API with `ncc` (single-file Node.js bundle)
3. Writes the embedded `package.json` for native dependencies
4. Installs native dependencies for the target Electron ABI
5. Generates the Prisma client for the bundled runtime
6. Runs `electron-builder` to produce platform-specific installers

Output artifacts are in `apps/desktop/release/`.

---

## Production Deployment (Web)

For a self-hosted web deployment (e.g., on a VPS or internal server):

### With Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f
```

The `docker-compose.yml` in the project root starts the API and (optionally) a PostgreSQL container.

### Manual

```bash
# Build all apps
npm run build

# Set production environment variables (see table above)
export NODE_ENV=production
export DATABASE_URL=postgresql://user:pass@host:5432/retiree_plan
export JWT_SECRET=<long-random-secret>
export TOKEN_ENCRYPTION_KEY=<32-byte-hex>
export PORT=3001

# Run migrations against production DB
npm run db:migrate

# Start the API
node apps/api/dist/main.js

# Serve the web dist behind nginx or a CDN
# Point your web server at apps/web/dist/
```

---

## Docs, Demo, Screenshots, and GitHub Pages

When a feature changes UI behavior, update docs assets in the same PR so README and GitHub Pages stay accurate.

1. Run the full e2e suite and confirm green:

```bash
npm run test:e2e
```

2. Start both local servers in separate terminals:

```bash
npm run dev:api
npm run dev:web
```

3. Regenerate screenshots used by [README](../README.md) and [docs/index.html](index.html):

```bash
npm run screenshots:update
```

4. Regenerate demo video used by GitHub Pages:

```bash
npm run demo:record
```

5. Validate the pages and report locally:

```bash
npx playwright show-report e2e/playwright-report
```

6. Commit updated assets together:
- `docs/demo.webm`
- `docs/screenshots/*`
- any docs files changed for the feature narrative

---

## Troubleshooting

### `EADDRINUSE: address already in use :::3001`

Another process is using port 3001. Find and stop it:

```bash
lsof -i :3001
kill <PID>
```

### `PrismaClientInitializationError` on startup

The database file or directory doesn't exist. Run:

```bash
npm run db:migrate
```

### Desktop: blank white screen on launch

The API is still starting. Wait a few seconds — the desktop app polls `/api/health` and automatically reloads when ready.

### Desktop: "Cannot find module" after plan switch

This can happen if the previous API process didn't fully shut down. Quit the app and relaunch.

### `path-to-regexp` errors in API logs

The ServeStatic exclude patterns must use the formats `/api` or `/api/*path` only. Do not use regex patterns or `/api(.*)`. Verify `apps/api/src/app.module.ts`.
