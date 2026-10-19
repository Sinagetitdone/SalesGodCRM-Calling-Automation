# SalesGodCRM Calling Automation

Local calling-workflow prototype and a driver-free Chrome audio diagnostic extension for the owner's logged-in SalesGodCRM manual dialer.

## Current behavior

- The Fastify API uses a **fake provider** and SQLite storage. It cannot place real calls.
- Call orchestration checks suppression and calling-window flags and reserves idempotency keys atomically. A call ID already assigned to another request returns HTTP 409.
- The owner's imported lists are pre-authorized: no per-contact consent field is required. The optional old field is retained as metadata; missing metadata is not fabricated consent evidence.
- The Chrome extension exposes a generated page-level microphone and tests local audio graphs and synthetic two-way WebRTC. Version 0.2.0 adds explicit pairing to a loopback voice setup window. It starts disabled and has no dialing code or key storage.
- The local voice page can test paired audio without OpenAI, or request one short AI introduction through the server's Realtime connection. Setup stops when a dialer peer appears. It is not a live conversation or campaign runner.
- Extension 0.3.0 adds a separate supervised-call mode with verified microphone/media readiness, explicit owner-confirmed answer, conversational VAD/interruption, pause, disconnect and local event logging. It never dials or hangs up the phone automatically.
- Live OpenAI output and a two-way simulated customer conversation passed. Actual CRM telephone media remains unverified until the first authorized test call.

This is a development prototype. The API has no authentication/tenant model and trusts caller-supplied policy flags. Do not expose it publicly or use it for live calling.

## Development

Use Node.js 24 and npm:

    npm ci
    npm run check

`check` runs type checking, domain/storage tests, the audio-server and extension checks, and a real local HTTP check using only the fake provider and a temporary database. No phone calls or paid API requests are needed.

Optional synthetic demonstrations:

    npm run smoke
    npm run smoke:failure
    npm run smoke:persistence

## Audio setup

    npm run audio:bridge

Open http://127.0.0.1:4318 for setup instructions. Reload `tools/audio-extension` version 0.3.0 and refresh SalesGodCRM only when no call is active. See the [supervised first-call procedure](tools/audio-extension/SUPERVISED-FIRST-CALL.md). For a standalone AI voice test use `/voice-test`; for a no-phone conversational rehearsal use `/call-simulator`. OpenAI tests may incur API usage. VB-CABLE is not required.

- [Extension setup and limits](tools/audio-extension/README.md)
- [Observed no-call test results](tools/audio-extension/TEST-RESULTS.md)
- [Local setup server](tools/audio-bridge/README.md)
- [Architecture direction](docs/architecture/ADR-0002-BROWSER-DIALER-VOICE.md)

## Credentials

Copy `.env.example` to `.env` if needed and enter `OPENAI_API_KEY` locally. Never put a key in AGENTS.md, source code, tests, chat, or GitHub. `.env` is ignored by Git. Only the loopback server reads the key; browser pages receive SDP, never the standard API key. Restart the server after changing `.env`.

A generic webhook client is retained as an alternative integration primitive. Do not infer a SalesGod call-initiation API or payload from a webhook URL.

## Remaining work before real campaigns

- Verify actual SalesGodCRM microphone acquisition and telephone media with an authorized test contact. The implemented conversation mode is limited to a supervised audio test; approved sales conversation instructions are still needed for campaigns.
- Implement list import, durable campaign queue/recovery, approved conversation instructions, voicemail detection/delivery, and persistent campaign event logs in this branch.
- Implement application authentication/authorization, authoritative suppression and calling-window checks, campaign authorization records, audit retention, and provider outcome reconciliation.
- Complete end-to-end review and explicit human release approval before enabling live calling.

The existing fake runtime stays active until the real integration is implemented and tested. See [START-HERE.md](START-HERE.md) and [AGENTS.md](AGENTS.md) for contribution guidance.
