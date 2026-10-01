# Integration Architecture

## Principle

External provider integrations are isolated behind explicit adapters.

## SalesGodCRM

### Verified public capability

SalesGodCRM publicly describes AI Sales Agents that can follow up with leads, answer questions, handle objections, qualify prospects, book appointments, move leads through pipelines, and trigger automations.

### Account-specific configuration

The supplied account endpoint is configured as:

- SALESGOD_WEBHOOK_URL
- SALESGOD_TOKEN

The actual credential value is intentionally excluded from source control.

### Current adapter boundary

SalesGodWebhookClient sends caller-defined JSON to the configured endpoint using bearer authentication.

It does **not** claim that the endpoint starts a call. The payload is deliberately not guessed.

### Required provider contract before live dispatch

The final adapter must verify:

- authentication format
- endpoint semantics
- provider identifiers
- contact/lead mapping
- campaign mapping
- exact call-initiation payload
- call status and event payloads
- voicemail outcome
- human-answer outcome
- call completion
- transcript/recording references, if available
- appointment actions
- error taxonomy
- retry and timeout behavior
- rate limits
- idempotency
- webhook signature/authentication
- degraded behavior
- observability

### Forbidden assumptions

Do not guess endpoint URLs, request/response payloads, API keys, webhook signatures, or undocumented browser operations.
