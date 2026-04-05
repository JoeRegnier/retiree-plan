# ADR-0002 — Prisma ORM as the Exclusive Data Access Layer

**Date:** 2025-01-15  
**Status:** Accepted

---

## Context

The API needs database access with type safety, migration management, and a path from SQLite (dev/desktop) to PostgreSQL (production). The approach to data access must be consistent across all NestJS modules.

## Decision

Use **Prisma ORM** as the exclusive data access layer. Raw SQL queries are prohibited except for complex reporting aggregations that Prisma cannot express.

## Rationale

- Prisma generates a type-safe client from `schema.prisma`, surfacing schema errors at compile time.
- `prisma migrate dev` provides declarative, versioned migrations stored in source control.
- `prisma generate` keeps the client in sync without manual query updates after schema changes.
- Prisma's relation queries (nested reads/writes) reduce boilerplate for CRUD endpoints.

## Alternatives Considered

| Option | Why Rejected |
|---|---|
| TypeORM | Decorator-heavy; harder to keep schema DRY with Zod; migration tooling less ergonomic |
| Drizzle | Excellent type safety but less mature migration story at project start |
| Knex + manual migrations | No type inference; too much boilerplate |
| Raw SQL (`better-sqlite3`) | No migration management; no type safety |

## Consequences

- Schema truth lives in `prisma/schema.prisma`; all changes must go through `prisma migrate dev`.
- Each new feature that adds a Prisma model must also update the shared Zod schemas.
- Prisma client is imported as `@prisma/client` in the API only — the finance-engine remains pure TS with no ORM dependency.

## Review Date

No fixed review date. Revisit if Drizzle matures significantly or if Prisma licensing changes.
