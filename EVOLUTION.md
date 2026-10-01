# Evolution

## 2026-09-29 — Repository bootstrap

The repository was created as a dedicated project for automating a permission-based calling workflow around SalesGodCRM's native AI caller.

The initial direction is deliberately provider-adapter based. No undocumented SalesGodCRM API or UI automation is assumed.

The first architecture spike is to establish the provider-approved integration contract. Implementation is blocked from live calling until that contract and the required compliance and authorization gates are resolved.

## Relationship to other artifacts

- Git history records implementation changes.
- ADRs record discrete architecture decisions.
- RFCs record proposals requiring broader discussion.
- Changelog records user-visible changes.
- Engineering Memory records reusable lessons and bugs.
- Evolution records system-direction history.

## 2026-10-01 — Strict JML audit

The repository was re-audited against the supplied JML standards. CI is green, but production release remains blocked by unresolved provider contract, authorization, persistence, runtime, audit, and security-validation gates. The repository now records those gaps explicitly and corrects stale onboarding/status documentation.
