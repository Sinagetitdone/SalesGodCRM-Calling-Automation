# SalesGodCRM Calling Automation

Local calling-workflow prototype and a driver-free Chrome audio diagnostic extension for the owner's logged-in SalesGodCRM manual dialer.

## Current behavior

- The Fastify API uses a **fake provider** and SQLite storage. It cannot place real calls.
- Call orchestration checks suppression and calling-window flags and reserves idempotency keys atomically. A call ID already assigned to another request returns HTTP 409.
- The owner's imported lists are pre-authorized: no per-contact consent field is required. The optional old field is retained as metadata; missing metadata is not fabricated consent evidence.
- The Chrome extension exposes a generated page-level microphone and tests local audio graphs and synthetic two-way WebRTC. It starts disabled and has no OpenAI requests or dialing code.
- Synthetic WebRTC passed on the CRM origin and on localhost in the owner's tested Chrome configuration. Actual CRM telephone media and OpenAI integration are not verified.

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

Open http://127.0.0.1:4318 for setup instructions. Load `tools/audio-extension` as an unpacked Chrome extension, refresh the idle SalesGodCRM page, and use its local diagnostics. VB-CABLE is not required.

- [Extension setup and limits](tools/audio-extension/README.md)
- [Observed no-call test results](tools/audio-extension/TEST-RESULTS.md)
- [Local setup server](tools/audio-bridge/README.md)
- [Architecture direction](docs/architecture/ADR-0002-BROWSER-DIALER-VOICE.md)

## Credentials

Copy `.env.example` to `.env` if needed and enter `OPENAI_API_KEY` locally when it is available. Never put a key in AGENTS.md, source code, tests, chat, or GitHub. `.env` is ignored by Git. The local setup server reads `.env` at startup; the diagnostic extension does not use the key yet.

A generic webhook client is retained as an alternative integration primitive. Do not infer a SalesGod call-initiation API or payload from a webhook URL.

## Remaining work before real campaigns

- Connect OpenAI audio securely to the browser adapter and verify real telephone media with an authorized test contact.
- Implement list import, durable campaign queue/recovery, approved conversation instructions, voicemail detection/delivery, and persistent campaign event logs in this branch.
- Implement application authentication/authorization, authoritative suppression and calling-window checks, campaign authorization records, audit retention, and provider outcome reconciliation.
- Complete end-to-end review and explicit human release approval before enabling live calling.

The existing fake runtime stays active until the real integration is implemented and tested. See [START-HERE.md](START-HERE.md) and [AGENTS.md](AGENTS.md) for contribution guidance.
