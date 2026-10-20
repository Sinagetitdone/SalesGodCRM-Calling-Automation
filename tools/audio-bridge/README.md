# Local audio setup server

Version 0.3.0 adds [supervised first-call controls](../audio-extension/SUPERVISED-FIRST-CALL.md) at `/supervised-call`, with silent preparation, owner-confirmed answer, conversational VAD, pause and cleanup. The extension opens that page with an explicit pairing token. `/call-simulator` exercises the full conversation path with synthetic speech and no phone provider. The replacement key has passed live Realtime audio; older HTTP 401 notes below concern the revoked key.

`/live-log` stores only validated event metadata in ignored `data/live-audio.db`; reads return the sequence for the given local session UUID. Seven-day retention is enforced on startup, new sessions and reads. Both log routes retain the existing loopback/origin restrictions; this is a local development service, not an authenticated multi-user API. Set `AUDIO_DATABASE_PATH` for an alternate database location. No transcript or recording fields are accepted. Automated tests use memory or temporary synthetic databases.

Run `npm run audio:bridge` and open http://127.0.0.1:28431. This loopback-only panel documents the custom Chrome extension and serves its standalone audio lab. It cannot control the SalesGodCRM dialer or place phone calls.

## Driver-free setup

Load the repository's `tools/audio-extension` folder as an unpacked Chrome extension. See its README and TEST-RESULTS.md for the no-call procedure and verified limits. VB-CABLE is not required; the old cable-based UI has been retired.

The standalone lab at `/audio-diagnostics` loads the same audio code as regular page scripts, independently of extension installation. `/extension-lab` is also covered by the extension's manifest. Only the installed CRM page establishes whether its device selector recognizes the generated microphone.

## Key preparation

Enter `OPENAI_API_KEY` in the ignored repository-root `.env` file using a local editor. Do not paste it into chat, AGENTS.md, source, or GitHub. Optional model override: `OPENAI_REALTIME_MODEL`. Restart the setup server after editing `.env`.

The `/voice-test` page invokes the `/session` SDP-exchange endpoint only when the owner starts an AI test. It uses a fixed OpenAI URL, a timeout, loopback binding, and origin/host checks. The browser receives SDP and connects to OpenAI over WebRTC, without receiving the standard API key. AI tests may incur usage; automated checks mock external requests.

The extension's **Open AI voice setup** action explicitly pairs an idle CRM page with that local window through a short-lived token and MessagePort. **Test paired routing without OpenAI** checks both local audio directions using synthetic tones, without requiring a key. **Test paired AI connection** requests one setup introduction and disconnects after measuring its audio. See [VOICE-SETUP.md](../audio-extension/VOICE-SETUP.md).

The setup mode has automatic turn detection disabled, a 45-second session limit, and no dialing controls. A new dialer peer stops setup. Live telephone conversations and campaign execution remain unimplemented. The configured key currently returns HTTP 401, so live AI output remains unverified.

## Validation

- `npm run audio:check`: loopback server checks with mocked OpenAI.
- `npm run audio:extension:check`: generated microphone, local signaling, cancellation, and boundary tests.
- Browser local graph/WebRTC diagnostics: synthetic streams only, with no physical microphone capture, phone call, or OpenAI request.
- Actual telephone audio and successful live OpenAI output remain separate, unverified checks.

The panel styles are served from this local origin to comply with its existing Content Security Policy; that policy is not relaxed for the test UI.
