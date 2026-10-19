# Start here

Read [README.md](README.md) for the current implementation and commands, then [AGENTS.md](AGENTS.md) for the engineering rules.

## Active direction

Latest: [version 0.3.0 supervised first-call mode](tools/audio-extension/SUPERVISED-FIRST-CALL.md) is implemented and passed a two-way OpenAI conversation rehearsal without a phone call. Phone-network audio still requires the first authorized test call. The older setup-only mode remains available as a diagnostic.

The owner requested browser automation of their logged-in SalesGodCRM **manual** dialer, with a separate OpenAI voice integration. The custom Chrome extension provides local diagnostics, opt-in audio pairing and supervised first-call conversation controls. It does not dial. The setup-only mode still stops if a dialer peer appears; supervised mode explicitly permits and monitors the next dialer peer. VB-CABLE is not required. The prior native-AI/webhook-only assumption and provider-authorization prerequisite for browser automation are superseded by [ADR-0002](docs/architecture/ADR-0002-BROWSER-DIALER-VOICE.md).

The owner states imported lists are pre-authorized. Per-contact consent verification is removed; suppression, calling windows, access control, and campaign-level authorization records remain separate requirements. The current API trusts supplied policy flags and is a local fake-provider prototype.

## Implemented

- Deterministic eligibility/state rules and voicemail message model.
- Application orchestration and fake provider.
- In-memory and SQLite repositories, atomic request reservations, duplicate dispatch protection, and conflicting call-ID rejection.
- Local Fastify API and Docker configuration for the fake runtime.
- Generic configurable SalesGod webhook client and token-verification helper.
- Driver-free Chrome audio diagnostic extension with generated microphone, local graph test, explicit ICE signaling, silent WebRTC rendering, packet/signal evidence, and cancellation.
- Version 0.2.0 local-window audio pairing, a no-OpenAI routing test, and a bounded Realtime voice test with a server-side key, explicit response request, and cleanup on failure/disconnect.
- CI checks for core behavior, repositories, real local fake-provider HTTP routes, setup server, and extension.

## Not implemented or unverified in this branch

Automatic browser dialing, actual telephone audio, sales conversation instructions, list import/campaign jobs, production identity/authorization, authoritative contact policies, durable campaign audit logs, call outcome reconciliation, and voicemail delivery. Live OpenAI output and supervised conversation mode are now verified with synthetic customer audio. A generated microphone appearing in the CRM selector does not establish that the CRM acquires its audio for a phone call.

## Validation and workflow

    npm ci
    npm run check

`main` is stable work; `dev` is the integration branch. Use a short-lived task branch and a pull request into `dev` as described in [CONTRIBUTING.md](CONTRIBUTING.md). No live calling is part of ordinary development or CI.

See [audio test results](tools/audio-extension/TEST-RESULTS.md), [architecture](docs/architecture/), and [Engineering Memory](docs/engineering-memory/) for evidence and known boundaries.
