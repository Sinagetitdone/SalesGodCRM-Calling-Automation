# START HERE

## Purpose

SalesGodCRM Calling Automation is intended to automate a permission-based outbound calling workflow using SalesGodCRM's native AI calling capabilities.

The system will manage campaign intake, eligibility, campaign state, provider integration, outcomes, auditability, and reporting. SalesGodCRM remains the external calling provider and AI conversation runtime.

## Current status

This repository is in architecture/discovery bootstrap. It contains no application implementation yet.

The first implementation milestone is to establish the supported SalesGodCRM integration contract and then implement the smallest end-to-end testable slice.

## Architecture principles

1. SalesGodCRM is an external provider.
2. Provider-specific behavior is isolated behind an adapter.
3. Our system owns campaign state and business rules.
4. Calling eligibility and suppression are hard gates.
5. The AI caller operates from approved campaign instructions and knowledge.
6. Unknown facts must not be invented by the conversational agent.
7. Production calling is blocked until provider integration, compliance controls, and end-to-end tests are verified.
8. Browser automation against the SalesGodCRM UI is not an accepted integration path unless SalesGodCRM explicitly authorizes it.

## Immediate architecture spike

Determine the supported SalesGodCRM integration mechanism available to this account: API, webhook, native workflow, supported connector, or another provider-approved mechanism.

Do not infer endpoints, authentication schemes, webhook payloads, or undocumented UI behavior.

## Working branches

- main: stable/releasable work.
- dev: active integration and implementation work.
- Feature branches should be short-lived and merged through pull requests.

## Next action

Obtain and document the provider-approved SalesGodCRM integration contract, then finalize the architecture gates in docs/architecture.
