# ADR-0001 — SQLite as Local-First Development Database

**Date:** 2025-01-15  
**Status:** Accepted

---

## Context

RetireePlan is built as both a hosted web app and a local desktop (Electron) app. The database choice must support zero-configuration local development, desktop embedding, and a clear migration path to a hosted database for the cloud/SaaS deployment.

## Decision

Use **SQLite** via Prisma ORM for all local and desktop deployments. The Prisma datasource `provider` is set to `sqlite` in development; switching to `postgresql` for production is a one-line change in `schema.prisma`.

## Rationale

- Zero dependency: SQLite requires no server process — ideal for Electron and developer onboarding.
- Prisma abstracts SQL dialect differences, making the SQLite → PostgreSQL switch non-breaking.
- The data volume for a single household's retirement plan is well within SQLite's performance envelope.
- WASM-based SQLite distributions exist for potential future Web Worker use.

## Alternatives Considered

| Option | Why Rejected |
|---|---|
| PostgreSQL from day one | Requires Docker or a hosted instance; slows local dev and Electron packaging |
| IndexedDB (browser-side) | No server-side access; cannot run NestJS/Prisma logic |
| JSON flat files | No referential integrity, no query capability, migration tooling absent |

## Consequences

- Desktop build packages the SQLite `.db` file alongside the Electron app.
- All migrations must be SQLite-compatible (no PostgreSQL-only features until production switch).
- Backup/restore scripts (`prisma/backup.js`, `prisma/restore.js`) operate on the flat `.db` file.

## Review Date

Re-evaluate when a multi-user / hosted SaaS tier is introduced.
