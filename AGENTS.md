# AGENTS.md

## Mission

Build a reliable, permission-based calling automation system using Twilio Programmable Voice and OpenAI. SalesGodCRM integration is legacy; the owner explicitly requested migration to Twilio on 2026-11-08.

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
- Treat telephony as an external provider behind an adapter boundary. The active adapter is Twilio's documented REST API, signed callbacks and bidirectional Media Streams.
- Keep campaign and business state authoritative in our system once implemented.
- Enforce suppression and application authorization on the backend. The owner explicitly removed calling-hours restrictions from local calling lists: Start processes pending contacts immediately at any time, including existing saved lists with older hour settings. For the owner's pre-authorized imported lists, do not require a per-contact consent verification field; record the owner's campaign-level authorization without inventing individual consent evidence.
- Default to deny for authorization and default to no-call when eligibility is unknown.
- Never store provider credentials in source control.
- Make provider callbacks and events idempotent.
- Treat external calls and webhooks as unreliable.
- Do not allow an AI agent to invent business facts, pricing, contractual terms, or policies.
- Preserve an auditable trail for material campaign and call-state changes.
- Live lists use backend-owned Twilio dialing. Do not require SalesGodCRM, an extension, browser microphone routing, or CRM contacts. Legacy browser code remains only for compatibility and diagnostic/rehearsal coverage. Keep the private administration interface loopback-only on port 28431 and expose only signed Twilio ingress on 28432.
- Keep names, outcomes, transcripts, downloaded recordings and event logs local. Twilio separately retains call records/recordings according to its account settings; local deletion must not claim to delete those copies. Validate the configured Twilio caller, prepare AI and voicemail before once-only dispatch, and verify the owned Call SID before hangup. Never redial an uncertain request.
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
