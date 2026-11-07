# ADR-0008: Replace CRM browser calling with Twilio

Date: 2026-11-08. Status: implemented; live acceptance pending working credentials and an explicitly authorized test call.

## Decision

The owner requested Twilio for dialing and all telephone operations. The shipped runtime remains tools/audio-bridge; the older src prototype is not the team calling application. Live list execution moves to a backend worker using the existing CampaignStore. The browser imports, reviews, explicitly starts, pauses/stops and observes lists. Closing the browser does not stop the backend worker.

TwilioProvider uses the documented Calls API for once-only dispatch, read-only polling and verified-SID hangup. Every contact has a persisted attempt UUID before dispatch; signed callbacks bind the Call SID even if they arrive before the REST response. Duplicate and out-of-order terminal callbacks are idempotent. An uncertain dial result is never retried. On restart, existing active Twilio attempts must be reconciled before another list starts.

TwilioAudio pre-warms a server-side OpenAI Realtime WebSocket with G.711 PCMU input/output. This eliminates browser audio interception, virtual microphones and the extension from the live path. Realtime speech detection clears Twilio's playback queue immediately on interruption, cancels/truncates the unplayed response and resumes the live conversation. The existing context, brief, timezone and disposition semantics remain.

The exact approved voicemail is synthesized before dialing, converted from 24 kHz PCM to 8 kHz mu-law, and gated by asynchronous Twilio DetectMessageEnd. A short human greeting can start live mode before AMD returns. A voicemail is considered played only after its Twilio playback mark is acknowledged. Clear-generated stale marks never confirm delivery. Speech during/after voicemail can take over into live mode. Unknown answer classification is a review outcome, not claimed voicemail success. AMD is probabilistic; automated checks cannot prove a recipient heard a message.

Twilio requests a dual-channel recording. Completed answered-call recordings are fetched through authenticated Twilio REST and retained as local MP3s; the next contact waits for saving. Live transcripts and events are retained locally. These are live drafts, not guaranteed verbatim recorded-audio transcripts. A recording failure is visible as needs_review. Provider-side logs/recordings also exist in Twilio; local deletion does not erase them.

## Network and credentials

The private Fastify desk stays at http://127.0.0.1:28431 with strict Host/Origin checks. A separate loopback callback service on 28432 exposes only specific signed Twilio callbacks, signed WebSocket upgrades for current attempts, and a non-sensitive instance health response. Never tunnel 28431. Webhook validation uses the configured public origin rather than proxy-supplied Host headers. The official Twilio SDK validates signatures.

TWILIO_PUBLIC_URL supports a stable HTTPS/WSS tunnel or hosted callback endpoint. When absent, startup can use an official Cloudflare quick tunnel with a pinned, SHA-256-verified private binary. Quick tunnels are for development/testing and can be unavailable; a managed stable tunnel is required for dependable team operations. No DNS, billing, phone-number purchases or account upgrades are performed. Windows system proxy settings or explicit HTTP/HTTPS proxy variables are respected by HTTP and OpenAI WebSocket clients.

OPENAI_API_KEY, TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN remain in the local ignored .env. An SK API-key SID is not an AC Account SID, and an API-key secret is not the account Auth Token needed to verify Twilio callbacks. Secrets never enter front-end code, package templates, event logs or Git history.

## Acceptance

Deterministic tests cover dispatch once, sequential progression, duplicate Start, signature validation, private/public separation, voicemail marks, pickup during playback, interruption and finish-tool playback ordering. Existing store, rehearsal, import and history tests remain. Live Twilio/OpenAI acceptance requires valid credentials; a simulated pass must never be reported as a successful telephone test. No telephone calls were authorized or placed during migration.

## References

- https://www.twilio.com/docs/voice/api/call-resource
- https://www.twilio.com/docs/voice/media-streams/websocket-messages
- https://www.twilio.com/docs/voice/answering-machine-detection
- https://www.twilio.com/docs/usage/security
- https://developers.openai.com/api/docs/guides/voice-websockets
- https://developers.openai.com/api/reference/resources/realtime/client-events
