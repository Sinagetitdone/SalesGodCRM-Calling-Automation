# ADR-0002: Browser dialer with an OpenAI voice bridge

- Status: Accepted direction; supervised audio setup implemented, telephone integration unverified
- Date: 2026-10-19
- Supersedes: ADR-0001's provider-authorization requirement for browser automation and native SalesGod AI caller assumption

## Requirements

The owner reports that SalesGodCRM's dialer makes manual microphone calls and explicitly requests automating their logged-in session. Input is a list of names and phone numbers. The owner states that the list is pre-authorized; per-contact consent verification is removed. Suppression, opt-outs, calling-window policy, and application access controls remain separate concerns.

The old consent field remains optional legacy metadata for compatibility with existing SQLite records. Missing metadata is stored as false, not fabricated consent evidence, and does not block a call. Campaign-level authorization recording and list import still need implementation.

## Intended flow

Current voicemail update (2026-10-19): the local supervised controls prepare owner text through OpenAI TTS and screen incoming Realtime transcription with responses disabled. Restricted English voicemail cues plus a locally detected completed beep permit one message playback through the existing audio bridge. Missing/uncertain signals, unavailable mailboxes and interrupted playback have distinct metadata events; playback completion does not claim carrier delivery. A full no-phone browser rehearsal passed, including audio received by the simulated mailbox. Phone hangup remains an operator action; list execution and actual carrier recording remain unverified. See tools/audio-extension/VOICEMAIL.md. Earlier notes below are historical.

Version 0.3.0 update: a separate supervised conversation mode now permits the next observed dialer peer, verifies the generated microphone sender and incoming track, and waits for explicit owner-confirmed human answer. Its two-way synthetic conversation with OpenAI passed, including VAD interruptions, pause and hangup cleanup. The replacement local key is accepted. Metadata-only event logging is durable and idempotent. Actual telephone media, automatic dispatch, list jobs and voicemail remain unverified or unimplemented; see tools/audio-extension/SUPERVISED-FIRST-CALL.md. No live phone call was placed during this implementation.

Update 2026-10-19: the owner chose a driver-free custom Chrome extension. A diagnostic prototype is installed and recognized by the CRM microphone selector; see tools/audio-extension/TEST-RESULTS.md. Version 0.2.0 adds opt-in audio pairing to a loopback setup window, a synthetic routing test independent of OpenAI, and a server-mediated Realtime test. The key stays server-side; no extension permissions were expanded. Setup has automatic turn detection disabled and stops on a new dialer peer. This is deliberately not live telephone forwarding. Real CRM microphone acquisition, telephone audio, and successful OpenAI voice remain unverified; the supplied key returned HTTP 401. VB-CABLE is not required by this direction.

Import list -> durable queue -> browser dialer adapter -> two-way audio bridge -> OpenAI Realtime voice session -> outcome and event log.

The browser worker enters the number and starts one call at a time. The audio bridge must route customer audio into the voice session and synthesized speech into the dialer's microphone input without feedback. Login alone does not establish this audio route. A dedicated audio device/bridge may be necessary; the dialer's actual capabilities must be inspected.

On a human answer, introduce the caller as an AI assistant and follow approved campaign instructions. On a verified voicemail greeting and recording opportunity, deliver an approved message once. Ringing timeout alone is not evidence of voicemail. Record uncertain outcomes as unknown and avoid automatic redial after ambiguous dispatch.

Persist call attempts, timestamps, observed states, errors, transcript events where available, summary, and follow-up outcome. Do not put credentials or session cookies in logs. Recording retention must be configured explicitly.

## Remaining implementation dependencies

- SalesGodCRM site URL and read-only dialer inspection.
- Verified audio routing and call-state detection on the target machine.
- Secure OpenAI API configuration, approved conversation instructions, and voicemail message.
- Durable queue and crash recovery, authoritative suppression handling, and campaign authorization records. SQLite reservation concurrency and call-ID conflict handling are implemented and tested.
- Controlled end-to-end test before list execution.

No live call was placed as part of this decision. The runtime continues to use the fake provider.
