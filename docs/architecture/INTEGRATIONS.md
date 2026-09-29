# Integration Architecture

## Principle

External provider integrations are isolated behind explicit adapters.

## SalesGodCRM

### Status

Discovery required.

No public API contract has been established for this repository.

### Required contract

The adapter must eventually define:

- authentication
- provider identifiers
- contact and lead mapping
- campaign mapping
- call initiation
- call status and events
- voicemail outcome
- human-answer outcome
- call completion
- transcript and recording references
- appointment actions
- error taxonomy
- retry and timeout behavior
- rate limits
- idempotency
- webhook verification
- degraded behavior
- observability

### Forbidden assumptions

Do not guess endpoint URLs, request or response payloads, API keys, webhook signatures, or undocumented browser operations.

## Internal provider interface

The application should use a provider-neutral internal interface that can be tested with a fake provider. Provider-specific identifiers and payload structures must not leak into campaign or domain logic.
