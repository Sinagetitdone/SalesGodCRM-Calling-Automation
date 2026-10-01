# START HERE

## Purpose

SalesGodCRM Calling Automation is intended to automate a permission-based outbound calling workflow using SalesGodCRM's native AI calling capabilities.

The system will manage campaign intake, eligibility, campaign state, provider integration, outcomes, auditability, and reporting. SalesGodCRM remains the external calling provider and AI conversation runtime.

## Current status

The repository now contains the deterministic domain and application orchestration core, SalesGod integration boundary/client primitives, tests, CI, architecture documentation, and JML Engineering Memory.

It is **not production-ready**. Live calling remains disabled because the supplied SalesGod integration endpoint does not establish a verified call-initiation/event contract.

## Architecture principles

1. SalesGodCRM is an external provider.
2. Provider-specific behavior is isolated behind an adapter.
3. Our system owns campaign state and business rules once persistence is implemented.
4. Calling eligibility and suppression are hard gates.
5. The AI caller operates from approved campaign instructions and knowledge.
6. Unknown facts must not be invented by the conversational agent.
7. Production calling is blocked until provider integration, compliance controls, authorization, persistence, and end-to-end tests are verified.
8. Browser automation against the SalesGodCRM UI is not an accepted integration path unless SalesGodCRM explicitly authorizes it.

## Current implementation boundary

Implemented:
- deterministic call state machine;
- eligibility evaluation;
- voicemail model;
- call orchestration;
- idempotency behavior;
- in-memory repository for testing;
- configurable SalesGod webhook client;
- secret-safe configuration;
- integration/unit tests;
- JML architecture and knowledge artifacts.

Not implemented:
- verified SalesGod call-initiation adapter;
- provider event/webhook lifecycle processing;
- production persistence;
- production API/runtime;
- authenticated user/tenant model;
- production authorization enforcement;
- audit persistence;
- production end-to-end calling workflow.

## Immediate gates

1. Obtain or verify the provider-approved SalesGod call/event contract.
2. Resolve the authorization architecture gate.
3. Design persistent storage and audit records.
4. Implement the production runtime/API.
5. Add provider contract and end-to-end tests.
6. Complete independent testing, security review, critical review, and human release approval.

## Working branches

- main: stable/releasable work.
- dev: active integration and implementation work.
- Feature branches should be short-lived and merged through pull requests.

## Validation

    npm install
    npm run check

The latest GitHub Actions CI run for the current dev head is green.

## Documentation

- AGENTS.md: agent operating contract.
- docs/architecture/: current architecture and gates.
- docs/engineering-memory/: reusable lessons and bugs.
- EVOLUTION.md: system-direction history.
- docs/architecture/JML-AUDIT-2026-10-01.md: latest strict JML audit.
