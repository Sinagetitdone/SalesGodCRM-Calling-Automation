# Local audio setup server

Package 0.6.0 adds a saved short screening introduction, local TXT/MD/DOCX/PDF imports and specific journal failure details. New real-list final transcripts are generated from separate recordings of captured inbound/outbound audio after hangup; live drafts remain available as audit data. See [ADR-0007](../../docs/architecture/ADR-0007-SCREENING-AND-AUDIO-TRANSCRIPTS.md) and the updated team guide. Five feminine-sounding presets are available for real/supervised calls and both rehearsal agents; Marin Calm and Marin Confident share the Marin base voice with different instructions. `/live-log` now accepts a bounded, redacted diagnostic detail field. Old historical notes below describe earlier releases.

Optional no-call browser recorder check: run `node tools/audio-bridge/recording-browser-check.mjs`, open `http://127.0.0.1:28432`, and click Run. It records generated tones using actual Chrome MediaRecorders; no microphone, API or dialer is used. Stop this temporary test server when finished. It is excluded from team packages.

Current: [calling lists](../audio-extension/CALLING-LISTS.md) at `/campaigns` default to simulation, import first_name/last_name/phone CSV, persist transcripts/outcomes in ignored `data/campaigns.db`, and show completion. No calls were placed during implementation. Automatic phone dispatch/classification/hangup has synthetic tests only. Keep live lists stopped under the owner's current **do not call anyone** instruction. See [ADR-0003](../../docs/architecture/ADR-0003-LOCAL-CALLING-LISTS.md). The following setup notes also describe historical versions.

Version 0.3.0 adds [supervised first-call controls](../audio-extension/SUPERVISED-FIRST-CALL.md) at `/supervised-call`, with silent preparation, owner-confirmed answer, conversational VAD, pause and cleanup. The extension opens that page with an explicit pairing token. `/call-simulator` exercises the full conversation path with synthetic speech and no phone provider. The replacement key has passed live Realtime audio; older HTTP 401 notes below concern the revoked key.

`/live-log` stores only validated event metadata in ignored `data/live-audio.db`; reads return the sequence for the given local session UUID. Seven-day retention is enforced on startup, new sessions and reads. Both log routes retain the existing loopback/origin restrictions; this is a local development service, not an authenticated multi-user API. Set `AUDIO_DATABASE_PATH` for an alternate database location. No transcript or recording fields are accepted. Automated tests use memory or temporary synthetic databases.

Run `npm run audio:bridge` and open http://127.0.0.1:28431. Setup/lab pages never dial. The separate calling-list page can command the 0.4.0 CRM adapter only after explicit Start on a live draft; imports and restarts never start calls.

## Driver-free setup

Load the repository's `tools/audio-extension` folder as an unpacked Chrome extension. See its README and TEST-RESULTS.md for the no-call procedure and verified limits. VB-CABLE is not required; the old cable-based UI has been retired.

The standalone lab at `/audio-diagnostics` loads the same audio code as regular page scripts, independently of extension installation. `/extension-lab` is also covered by the extension's manifest. Only the installed CRM page establishes whether its device selector recognizes the generated microphone.

## Key preparation

Enter `OPENAI_API_KEY` in the ignored repository-root `.env` file using a local editor. Do not paste it into chat, AGENTS.md, source, or GitHub. Optional model override: `OPENAI_REALTIME_MODEL`. Restart the setup server after editing `.env`.

The `/voice-test` page invokes the `/session` SDP-exchange endpoint only when the owner starts an AI test. It uses a fixed OpenAI URL, a timeout, loopback binding, and origin/host checks. The browser receives SDP and connects to OpenAI over WebRTC, without receiving the standard API key. AI tests may incur usage; automated checks mock external requests.

The extension's **Open AI voice setup** action explicitly pairs an idle CRM page with that local window through a short-lived token and MessagePort. **Test paired routing without OpenAI** checks both local audio directions using synthetic tones, without requiring a key. **Test paired AI connection** requests one setup introduction and disconnects after measuring its audio. See [VOICE-SETUP.md](../audio-extension/VOICE-SETUP.md).

Setup mode has automatic turn detection disabled, a 45-second session limit, and no dialing controls. A new dialer peer stops setup. Supervised mode supports live conversations; list mode adds automatic orchestration with synthetic validation pending a real integration test. The earlier revoked-key HTTP 401 blocker was resolved with a local replacement key.

## Validation

- `npm run audio:check`: loopback server checks with mocked OpenAI.
- `npm run audio:extension:check`: generated microphone, local signaling, cancellation, and boundary tests.
- Browser local graph/WebRTC diagnostics: synthetic streams only, with no physical microphone capture, phone call, or OpenAI request.
- Actual telephone audio and successful live OpenAI output remain separate, unverified checks.

The panel styles are served from this local origin to comply with its existing Content Security Policy; that policy is not relaxed for the test UI.
