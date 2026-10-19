# Local audio setup server

Run `npm run audio:bridge` and open http://127.0.0.1:4318. This loopback-only panel documents the custom Chrome extension and serves its standalone audio lab. It cannot control the SalesGodCRM dialer or place phone calls.

## Driver-free setup

Load the repository's `tools/audio-extension` folder as an unpacked Chrome extension. See its README and TEST-RESULTS.md for the no-call procedure and verified limits. VB-CABLE is not required; the old cable-based UI has been retired.

The standalone lab at `/audio-diagnostics` loads the same audio code as regular page scripts, independently of extension installation. `/extension-lab` is also covered by the extension's manifest. Only the installed CRM page establishes whether its device selector recognizes the generated microphone.

## Key preparation

Enter `OPENAI_API_KEY` in the ignored repository-root `.env` file using a local editor. Do not paste it into chat, AGENTS.md, source, or GitHub. Optional model override: `OPENAI_REALTIME_MODEL`. Restart the setup server after editing `.env`.

The server retains a prepared `/session` SDP-exchange endpoint for later OpenAI integration. It uses a fixed OpenAI URL, a timeout, loopback binding, and origin/host checks. The current page and diagnostic extension do not invoke it. Possessing a key does not make the extension a working AI phone caller. Tests mock that endpoint's external request and incur no API usage.

## Validation

- `npm run audio:check`: loopback server checks with mocked OpenAI.
- `npm run audio:extension:check`: generated microphone, local signaling, cancellation, and boundary tests.
- Browser local graph/WebRTC diagnostics: synthetic streams only, with no physical microphone capture, phone call, or OpenAI request.
- Actual telephone audio and OpenAI are separate checks for the next implementation phase.

The panel styles are served from this local origin to comply with its existing Content Security Policy; that policy is not relaxed for the test UI.
