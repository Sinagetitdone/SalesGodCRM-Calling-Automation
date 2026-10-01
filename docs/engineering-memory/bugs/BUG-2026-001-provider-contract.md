---
id: BUG-2026-001
type: bug
status: active
severity: high
components:
  - integration
  - salesgod
categories:
  - contract-mismatch
causes:
  - incorrect-assumption
found_by: jml-audit
first_seen: 2026-10-01
occurrences: 1
---

# Provider contract is not established

## Symptom

The supplied integration value identifies a webhook endpoint, but the repository does not have a verified call-initiation or event contract.

## Risk

A guessed implementation could send incorrect requests, trigger unintended automation, or silently fail.

## Prevention

Keep live dispatch disabled until the provider contract is verified.

## Regression test

Provider contract tests must be added from authoritative SalesGodCRM documentation or an authorized provider test exchange.
