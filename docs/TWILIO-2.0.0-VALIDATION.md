**Later update:** Twilio authentication was corrected after these initial checks. See [2.0.1 validation](TWILIO-2.0.1-VALIDATION.md) for current account restrictions and readiness.

# Twilio migration 2.0.0 — validation and remaining setup

Date: 2026-11-08.

## Implemented

Live dialing and audio use Twilio Calls REST, signed callbacks and bidirectional Media Streams with an OpenAI Realtime WebSocket. Live lists no longer depend on CRM contacts, a CRM browser page or an extension. The backend handles sequential progression, explicit Start, pause/stop, transcript/event retention, voicemail playback verification, human takeover and authenticated recording downloads.

The shareable package includes Windows/Mac launchers, private Node bootstrap, a step-by-step guide, blank credentials and optional pinned/checksummed Cloudflare quick-tunnel setup. Existing launcher names are retained for shortcut compatibility. A tunnel failure blocks calls while preserving the local desk and logs.

## Automated evidence

The full check command passes TypeScript plus 220 automated tests: 24 Vitest tests and 196 Node tests. Tests include 14 direct Twilio checks: signatures and exact call ownership, a real local synthetic WebSocket carrying PCMU in both directions, interrupted voicemail/stale marks, full mailbox, finish-tool playback ordering, duplicate Start, sequential progression, pause/stop, lost dial response without retry, recording save ordering/ID3 MP3 support, private/public route separation and tunnel failure blocking. These tests do not place telephone calls.

The package was extracted into an isolated runtime directory, production dependencies were installed from its lockfile, and the packaged server/Twilio imports loaded successfully. Windows launcher checks passed. Mac launcher files, architecture downloads and executable attributes are checked automatically; no physical Mac or telephone was used for live acceptance.

Changed source and every packaged entry were checked against the actual local secret values; none were included. The ZIP contains no .env, runtime databases, call records or private logs.

## Actual no-call connection checks

The local desk opens in Chrome and its Calling lists page loads existing local data, import controls and Twilio readiness status without a CRM opener. The no-call connection button reports errors visibly and leaves dialing blocked when setup fails.

Twilio currently rejects the supplied account authentication with HTTP 401 / code 20003. The supplied SK key also cannot read the account with its current permissions. No permissions were expanded and no new credentials were created.

OpenAI currently rejects the saved key with expired_secret_key. This is an authentication failure rather than proof of a regional networking block.

The temporary Cloudflare URL could be allocated, but its public health endpoint did not reach the correct local instance and its connection process exited after a network timeout. A usable URL alone is not successful ingress verification. Setup must obtain a working HTTPS/WSS connection; a stable managed tunnel is recommended for daily team use.

## Live acceptance still pending

Supply the actual Twilio account Auth Token and a valid OpenAI key in the private .env; establish a working callback tunnel; restart and pass the no-call account/public-instance/voice checks. Only then run an explicitly authorized single test destination and verify both live conversation and recorded voicemail at the receiving phone. No migration calls, account upgrades, number purchases or billing changes have been made. No live campaign is enabled by default.
