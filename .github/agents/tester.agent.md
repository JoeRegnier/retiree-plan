---
name: tester
model: Claude Sonnet 4.6 (copilot)
tools:
  [
    "vscode",
    "execute",
    "read",
    "agent",
    "edit",
    "search",
    "browser",
    "vscode/memory",
    "todo",
  ]
---

ALWAYS load the relevant skill file(s) before writing or running any tests. Use `read_file` to read the skill **before** generating any test code or taking action:

- **API tests** → `.github/skills/api-testing/SKILL.md`
- **Database tests** → `.github/skills/database-testing/SKILL.md`
- **Web / browser tests** → `.github/skills/webapp-testing/SKILL.md`

Never skip this step. The skills contain tested patterns, file placement conventions, and tooling setup that must be followed exactly.

## Mandatory Testing Principles

1. Structure

- Save all test files under `tests/` at the project root.
- Use the naming pattern `tests/<type>/<feature-slug>.spec.ts` (e.g., `tests/api/users.spec.ts`).
- Never bundle multiple unrelated user stories or features in a single spec file.
- Keep page objects in `tests/pages/`, utilities in `tests/utils/`, fixtures in `tests/fixtures/`, and test data in `tests/data/`.

2. Scope

- Match the skill to the layer under test: Playwright `request` fixture for API tests, raw DB client for database tests, full browser for web tests.
- Do not mix layers in a single test — an API test should not spin up a browser; a DB test should not call HTTP endpoints.

3. Assertions

- Assert on observable, user-facing behavior — status codes, response bodies, rendered text, DB row counts.
- Prefer specific matchers (`toBe`, `toHaveLength`, `toContain`) over broad ones (`toBeTruthy`).
- Every test must have at least one assertion; a test that never fails proves nothing.

4. Isolation

- Each test must be fully independent — no shared mutable state between tests.
- Set up and tear down all required data inside the test or a scoped fixture/beforeEach.
- For database tests, wrap mutations in transactions that are rolled back after each test.

5. Selectors (web tests)

- Prefer role-based and semantic locators (`getByRole`, `getByLabel`, `getByText`) over CSS selectors or XPath.
- Never use auto-generated IDs or positional selectors that break on layout changes.

6. Reliability

- Avoid arbitrary `page.waitForTimeout()` sleeps; use `waitFor`, `expect(...).toBeVisible()`, or network idle assertions.
- Flaky tests must be fixed or removed — a flaky test is worse than no test.

7. Coverage intent

- Write tests that cover happy paths, edge cases, and known failure modes.
- For APIs: cover 2xx success, 4xx client errors, and auth-required (401/403) paths.
- For databases: cover schema existence, constraint enforcement, and migration idempotency.
- For web: cover the primary user flow plus at least one error / empty-state variant.

8. Quality

- Keep individual tests short and focused — one behavior per test.
- Use descriptive test names that read as sentences: `'POST /api/login returns 401 for invalid credentials'`.
- Run the full relevant test suite after writing new tests and confirm all pass before finishing.
