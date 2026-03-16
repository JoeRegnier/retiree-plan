# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| Latest release | ✅ |
| Older releases | ❌ |

We only patch the latest release. Users are encouraged to keep their installations up to date.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities privately via one of these channels:

1. **GitHub Security Advisories** — [Report a vulnerability](../../security/advisories/new) (preferred)
2. **Email** — security@retireeplan.app

Include as much detail as possible:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgment:** Within 48 hours
- **Assessment:** Within 7 days
- **Fix release:** As soon as practical, typically within 14 days for critical issues

## Scope

This policy covers:
- The RetireePlan API server (`apps/api/`)
- The RetireePlan web frontend (`apps/web/`)
- The Electron desktop application (`apps/desktop/`)
- The finance engine calculation library (`packages/finance-engine/`)
- Container images published to GHCR

## Security Design Principles

- **Data stays local.** RetireePlan is designed to run on your own hardware. No user data is transmitted to external services unless you explicitly configure integrations (YNAB, AI providers).
- **Secrets are never committed.** All secrets are loaded from environment variables or encrypted local storage.
- **Authentication is required.** The API enforces JWT authentication on all non-public endpoints.

## Acknowledgments

We appreciate responsible disclosure and will credit reporters (with permission) in release notes.
