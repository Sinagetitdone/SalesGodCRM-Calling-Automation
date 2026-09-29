# Security Baseline

## Sensitive data

Expected sensitive data includes names, phone numbers, consent evidence, suppression/DNC state, call transcripts, recordings or recording references, appointment information, provider identifiers, and integration credentials.

## Requirements

- Secrets are supplied through a secret-management mechanism and never committed.
- Logs must avoid secrets and unnecessary personal data.
- Provider callbacks must be authenticated or verified when the provider supports verification.
- All externally supplied events are treated as untrusted input.
- Tenant and resource authorization is enforced server-side.
- Data retention is explicit before production use.
- Production calling is disabled by default in development and test environments.

## Compliance boundary

This repository does not provide legal advice. The application should enforce documented campaign eligibility and suppression rules and preserve evidence required by the selected compliance process.
