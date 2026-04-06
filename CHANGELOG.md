# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1.0] - 2026-04-06

### Added
- Per-automation webhook URLs for triggering scripts via HTTP POST from external services
- Webhook management UI with enable/disable/regenerate, tabbed code snippets (curl/Python/JS), and inline API reference
- Schema endpoint (`GET /api/hooks/:id/:token/schema`) for programmatic input discovery
- Input validation against manifest schema on webhook requests
- Rich error responses with type, message, and actionable hints
- Self-documenting async responses with absolute pollUrl, retryAfter, and expiresAt
- viewToken-based polling for webhook-triggered runs (no API key required)
- Shared SHA-256 hash utility (`convex/lib/crypto.ts`)

### Fixed
- IDOR in apiKeys.create: any authenticated user could create keys for any organization
- IDOR in apiKeys.revoke: any authenticated user could revoke any organization's keys
- IDOR in apiKeys.list: key metadata leaked for any organization
- Cross-org code download: getVersionDownloadUrl had no authentication check
- Unified webhook 401 responses to prevent automationId enumeration
- Raw error messages truncated to 500 chars to prevent sensitive data leakage

### Changed
- Rate limit raised from 50 to 200 runs per hour per organization
- Webhook token generation extracted to shared helper (DRY fix)

## [0.0.0.1] - 2026-04-06

### Added
- Initial release with PostHog session replay, multi-file deploy, automation publishing
