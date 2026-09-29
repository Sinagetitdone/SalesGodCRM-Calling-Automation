# ADR-0001: SalesGodCRM Integration Boundary

- Status: Proposed
- Date: 2026-09-29

## Context

The product requirement is to automate outbound calling while using SalesGodCRM's native AI caller.

The repository must not assume undocumented provider APIs, payloads, authentication mechanisms, or browser automation.

## Decision

Treat SalesGodCRM as an external provider behind a dedicated adapter.

The application domain will depend only on a normalized provider interface. Provider-specific identifiers, payloads, authentication, retries, webhook verification, and error mapping remain inside the adapter.

Live provider integration remains blocked until a provider-supported integration contract is obtained and verified.

## Consequences

### Positive

- Business logic remains independent of provider implementation details.
- A deterministic fake provider can support domain and orchestration tests.
- Provider integration can evolve without rewriting campaign rules.

### Negative

- Some implementation work is intentionally deferred.
- The adapter contract cannot be finalized until provider capabilities are verified.

## Evidence required to accept this ADR

- Official SalesGodCRM API or supported integration documentation, or
- Provider confirmation of the supported automation mechanism available to this account.
