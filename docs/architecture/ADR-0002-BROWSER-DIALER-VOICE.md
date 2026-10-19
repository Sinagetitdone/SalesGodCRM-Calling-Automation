# ADR-0002: Browser dialer with an OpenAI voice bridge

- Status: Accepted direction; integration not implemented
- Date: 2026-10-19
- Supersedes: ADR-0001's provider-authorization requirement for browser automation and native SalesGod AI caller assumption

## Requirements

The owner reports that SalesGodCRM's dialer makes manual microphone calls and explicitly requests automating their logged-in session. Input is a list of names and phone numbers. The owner states that the list is pre-authorized; per-contact consent verification is removed. Suppression, opt-outs, calling-window policy, and application access controls remain separate concerns.

The old consent field remains optional legacy metadata for compatibility with existing SQLite records. Missing metadata is stored as false, not fabricated consent evidence, and does not block a call. Campaign-level authorization recording and list import still need implementation.

## Intended flow

Update 2026-10-19: the owner chose a driver-free custom Chrome extension. A diagnostic prototype is installed and recognized by the CRM microphone selector; see tools/audio-extension/TEST-RESULTS.md. Real CRM microphone acquisition, telephone audio, and OpenAI voice remain unverified. VB-CABLE is not required by this direction.

Import list -> durable queue -> browser dialer adapter -> two-way audio bridge -> OpenAI Realtime voice session -> outcome and event log.

The browser worker enters the number and starts one call at a time. The audio bridge must route customer audio into the voice session and synthesized speech into the dialer's microphone input without feedback. Login alone does not establish this audio route. A dedicated audio device/bridge may be necessary; the dialer's actual capabilities must be inspected.

On a human answer, introduce the caller as an AI assistant and follow approved campaign instructions. On a verified voicemail greeting and recording opportunity, deliver an approved message once. Ringing timeout alone is not evidence of voicemail. Record uncertain outcomes as unknown and avoid automatic redial after ambiguous dispatch.

Persist call attempts, timestamps, observed states, errors, transcript events where available, summary, and follow-up outcome. Do not put credentials or session cookies in logs. Recording retention must be configured explicitly.

## Remaining implementation dependencies

- SalesGodCRM site URL and read-only dialer inspection.
- Verified audio routing and call-state detection on the target machine.
- Secure OpenAI API configuration, approved conversation instructions, and voicemail message.
- Durable queue and crash recovery, SQLite concurrency fixes, suppression handling, and campaign authorization records.
- Controlled end-to-end test before list execution.

No live call was placed as part of this decision. The runtime continues to use the fake provider.
