# Contributing

## Workflow

1. Read START-HERE.md and AGENTS.md.
2. Inspect relevant architecture documents and Engineering Memory.
3. Create a short-lived task branch from dev.
4. Keep changes within an explicit capability boundary.
5. Add or update deterministic tests.
6. Update architecture/documentation in the same change when behavior or decisions change.
7. Record reusable bugs/lessons in Engineering Memory.
8. Open a pull request into dev.
9. Independent testing and critical review must complete before release.
10. Human approval is required for production release/high-blast-radius changes.

## Required checks

    npm install
    npm run check

Do not enable live calling as part of ordinary development or CI.

## Provider safety

Do not guess SalesGodCRM endpoints, payloads, authentication, webhook signatures, or browser workflows. Provider-specific behavior belongs behind the SalesGod adapter boundary.

## Secrets

Never commit .env files, tokens, credentials, contact lists, transcripts, recordings, or other sensitive data.
