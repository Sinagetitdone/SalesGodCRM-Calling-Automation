# SalesGodCRM Calling Automation

Automation for a permission-based outbound calling workflow using SalesGodCRM's native AI caller.

## Status

Early architecture and domain bootstrap. **No live calling is enabled.**

## Target workflow

Contact source -> eligibility gate -> campaign enrollment -> SalesGod AI caller -> voicemail or human conversation -> qualification/outcome -> appointment, callback, or DNC -> audit/reporting.

## Design

The application will own campaign state, eligibility, suppression, normalized call state, business qualification rules, audit records, and reporting.

SalesGodCRM will remain the external calling and AI-conversation provider.

The provider boundary is intentionally incomplete until the supported SalesGodCRM integration mechanism is verified. No undocumented API or browser automation is being implemented.

## Development

Requirements: Node.js 22+ and npm.

Commands:

    npm install
    npm run check
    npm test

## Repository standards

See AGENTS.md and START-HERE.md.

Architecture documentation lives under docs/architecture/.

Engineering Memory lives under docs/engineering-memory/.

## Production gate

Production calling must not be enabled until:

1. SalesGodCRM's supported integration contract is verified.
2. Authorization and tenant/resource boundaries are implemented.
3. Consent, suppression, and calling-window policy are implemented.
4. Provider callback/event verification and idempotency are implemented.
5. End-to-end tests pass with an authorized test contact.
6. Human release approval is recorded.
