# SalesGodCRM Calling Automation

Automation for a permission-based outbound calling workflow using SalesGodCRM's native AI caller.

## Status

The deterministic calling domain and orchestration core are implemented. The supplied SalesGod integration URL is wired as configuration, but **live call dispatch is not enabled** because the URL is a webhook endpoint and its provider payload/call-initiation contract has not been verified.

## Current implementation

- Deterministic eligibility and call-state machine.
- Idempotent application-level call orchestration.
- In-memory repository for deterministic tests.
- SalesGod webhook client with bearer-token configuration.
- Constant-time bearer-token verification helper.
- No credentials committed to the repository.
- No browser automation.

## SalesGod configuration

Set these environment variables in the runtime secret store:

    SALESGOD_WEBHOOK_URL=
    SALESGOD_TOKEN=

The token supplied during development must be stored as a secret and must not be copied into source, tests, logs, GitHub comments, or documentation.

The webhook client intentionally accepts a caller-defined JSON payload. The exact SalesGod payload is **not inferred** from the URL. A real provider implementation requires the provider-supported call-initiation schema.

## Development

Requirements: Node.js 22+ and npm.

Commands:

    npm install
    npm run check
    npm test

## Production gate

Production calling must not be enabled until:

1. SalesGodCRM's supported call-initiation and webhook contract is verified.
2. Authorization and tenant/resource boundaries are implemented.
3. Consent, suppression, and calling-window policy are implemented.
4. Provider callback/event verification and idempotency are implemented.
5. Persistent production storage is implemented.
6. End-to-end tests pass with an authorized test contact.
7. Human release approval is recorded.
