# AGENTS.md

## Mission

Build a reliable, permission-based calling automation system around SalesGodCRM's supported AI caller capabilities.

## Source-of-truth hierarchy

1. Explicit user requirements.
2. Repository-local requirements and contracts.
3. JML Engineering Standard Playbook.
4. Repository architecture decisions and ADRs.
5. Reusable skills and Engineering Memory.
6. General conventions and defaults.

Do not silently resolve material conflicts. Record the decision or surface the ambiguity.

## Non-negotiable engineering rules

- Inspect repository reality before changing architecture.
- Prefer the simplest architecture that satisfies requirements.
- Do not invent undocumented SalesGodCRM APIs, endpoints, payloads, authentication mechanisms, or capabilities.
- Treat SalesGodCRM as an external provider behind an adapter boundary.
- Keep campaign and business state authoritative in our system once implemented.
- Enforce eligibility, consent, suppression, and authorization on the backend.
- Default to deny for authorization and default to no-call when eligibility is unknown.
- Never store provider credentials in source control.
- Make provider callbacks and events idempotent.
- Treat external calls and webhooks as unreliable.
- Do not allow an AI agent to invent business facts, pricing, contractual terms, or policies.
- Preserve an auditable trail for material campaign and call-state changes.
- Do not introduce browser automation against SalesGodCRM unless explicitly authorized by SalesGodCRM.
- Add deterministic tests for state transitions and integration contracts.
- Update Engineering Memory when a reusable lesson or bug is discovered.
- Update Evolution or ADR documentation when system direction or an architecture decision changes.

## Agent workflow

Planner/Architect -> Orchestrator -> Implementer -> Independent Tester -> Critical Reviewer -> Human Gate.

## Sensitive data

Treat contact information, call recordings, transcripts, consent evidence, credentials, and provider identifiers as sensitive. Minimize retention and access. Never place secrets in logs or tests.

## Production safety

No live calling campaign may be enabled by default in development. Test with synthetic or explicitly authorized test contacts first.

## Definition of done

A meaningful change is not done until relevant automated checks pass, architecture documentation is current, security and authorization implications are reviewed, and reusable lessons are recorded when applicable.
