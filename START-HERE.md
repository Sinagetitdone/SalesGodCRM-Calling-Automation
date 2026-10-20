# Start here

Read [README.md](README.md) for the current implementation and commands, then [AGENTS.md](AGENTS.md) for the engineering rules.

## Active direction

Current stopping point: [resume notes](docs/RESUME-HERE.md). Extension **0.4.0** and the loopback audio server implement [calling lists](tools/audio-extension/CALLING-LISTS.md), including import/preview, a sequential worker, transcripts, recovery and completion. Work is paused at the owner's request; no further call should be made without a new request.

The owner requested browser automation of their logged-in SalesGodCRM **manual** dialer, with OpenAI voice. Setup-only pages never dial and stop on a new dialer peer. Live list mode uses a separate DOM adapter and must be explicitly started from a paired CRM window. Supervised manual controls remain available. VB-CABLE is not required. [ADR-0002](docs/architecture/ADR-0002-BROWSER-DIALER-VOICE.md) records the browser integration direction; [ADR-0003](docs/architecture/ADR-0003-LOCAL-CALLING-LISTS.md) records local lists and recovery.

The owner states imported lists are pre-authorized. The audio bridge enforces suppression/windows and records campaign-level Start authorization without a per-contact consent field. It trusts the local OS user and exact loopback origin, not a public/multi-user authentication system. The original TypeScript/Docker fake-provider service remains a separate development runtime.

## Implemented

- Deterministic eligibility/state rules and voicemail message model.
- Application orchestration and fake provider.
- In-memory and SQLite repositories, atomic request reservations, duplicate dispatch protection, and conflicting call-ID rejection.
- Local Fastify API and Docker configuration for the fake runtime.
- Generic configurable SalesGod webhook client and token-verification helper.
- Driver-free Chrome audio diagnostic extension with generated microphone, local graph test, explicit ICE signaling, silent WebRTC rendering, packet/signal evidence, and cancellation.
- Version 0.2.0 local-window audio pairing, a no-OpenAI routing test, and a bounded Realtime voice test with a server-side key, explicit response request, and cleanup on failure/disconnect.
- CI checks for core behavior, repositories, real local fake-provider HTTP routes, setup server, and extension.
- Local CSV campaign database, single-use dispatch, lease/restart recovery, sequential browser worker, opt-outs, conversation transcripts, export and completion UI.
- Automatic voicemail playback and guarded hangup exercised on real calls; actual carrier recording is not inferred from playback telemetry.
- Human-pickup fixes for voicemail interruption, post-message listening, correlated classification, explicit interactive questions and repeated speech, with deterministic regressions and metadata-only detection diagnostics.

## Not implemented or unverified in this branch

A later single real call automatically switched from voicemail to a human conversation after earlier failed tests. The owner reported slow interruption recovery; a subsequent patch removes extra polling, preserves pending decisions across repeated speech, and shortens VAD silence. That latency patch has synthetic coverage but has not been phone-tested. Multiple-contact live processing, carrier recording, provider outcome reconciliation, hosted multi-user identity and unattended production operation remain unverified or unimplemented. Do not describe the whole automatic workflow as passed. A specific approved brief is required before business campaigns; do not invent offers, contact details or bookings.

## Validation and workflow

    npm ci
    npm run check

`main` is stable work; `dev` is the integration branch. Use a short-lived task branch and a pull request into `dev` as described in [CONTRIBUTING.md](CONTRIBUTING.md). No live calling is part of ordinary development or CI.

See [audio test results](tools/audio-extension/TEST-RESULTS.md), [architecture](docs/architecture/), and [Engineering Memory](docs/engineering-memory/) for evidence and known boundaries.
