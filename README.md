# SalesGodCRM Calling Automation

Local calling-workflow prototype and a driver-free Chrome audio diagnostic extension for the owner's logged-in SalesGodCRM manual dialer.

## Current behavior

- The Fastify API uses a **fake provider** and SQLite storage. It cannot place real calls.
- Call orchestration checks suppression and calling-window flags and reserves idempotency keys atomically. A call ID already assigned to another request returns HTTP 409.
- The owner's imported lists are pre-authorized: no per-contact consent field is required. The optional old field is retained as metadata; missing metadata is not fabricated consent evidence.
- The Chrome extension exposes a generated page-level microphone and tests local audio graphs and synthetic two-way WebRTC. Version 0.2.0 adds explicit pairing to a loopback voice setup window. It starts disabled and has no dialing code or key storage.
- The local voice page can test paired audio without OpenAI, or request one short AI introduction through the server's Realtime connection. Setup stops when a dialer peer appears. It is not a live conversation or campaign runner.
- Extension 0.3.2 supports supervised-call audio routing. The local controls now prepare an editable voicemail message, listen silently for an English voicemail greeting and beep, play the message once, and log playback or uncertain outcomes. Human conversations retain the explicit answer control. Real two-way telephone audio was confirmed by the owner on Windows/Chrome on 2026-10-20. The bridge never dials or hangs up the phone automatically.
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

Open http://127.0.0.1:28431 for setup instructions. The [calling-list workflow](tools/audio-extension/CALLING-LISTS.md) uses extension **0.4.0**; reload and refresh the CRM only while idle. Opening/importing never starts calls. `/campaigns` defaults to simulation without calls or OpenAI requests. The [supervised procedure](tools/audio-extension/SUPERVISED-FIRST-CALL.md) and [voicemail procedure](tools/audio-extension/VOICEMAIL.md) describe manual controls. `/voice-test` and `/call-simulator` can incur API usage. VB-CABLE is not required.

- [Extension setup and limits](tools/audio-extension/README.md)
- [Observed no-call test results](tools/audio-extension/TEST-RESULTS.md)
- [Local setup server](tools/audio-bridge/README.md)
- [Architecture direction](docs/architecture/ADR-0002-BROWSER-DIALER-VOICE.md)

## Credentials

Copy `.env.example` to `.env` if needed and enter `OPENAI_API_KEY` locally. Never put a key in AGENTS.md, source code, tests, chat, or GitHub. `.env` is ignored by Git. Only the loopback server reads the key; browser pages receive SDP, never the standard API key. Restart the server after changing `.env`.

A generic webhook client is retained as an alternative integration primitive. Do not infer a SalesGod call-initiation API or payload from a webhook URL.

## Remaining work before real campaigns

- Prior supervised calls established audible AI and a received voicemail according to the owner. The new **automatic list mode** needs a controlled real integration test after renewed calling authorization; the current instruction is **do not call anyone**.
- CSV lists, local suppression/window checks, explicit Start authorization, crash recovery, transcripts and completion UI are now implemented in the audio bridge and tested synthetically. Hosted multi-user authentication and provider reconciliation remain future work.
- Supply an approved business brief before real lists. Playback cannot prove carrier recording. Review unknown attempts in the CRM before explicit resume; they are never redialed automatically.

The TypeScript fake-provider runtime remains separate from audio-bridge lists. See [ADR-0003](docs/architecture/ADR-0003-LOCAL-CALLING-LISTS.md), [START-HERE.md](START-HERE.md) and [AGENTS.md](AGENTS.md).
