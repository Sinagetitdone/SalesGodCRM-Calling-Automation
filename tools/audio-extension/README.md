# SalesGod Local Audio Bridge — diagnostic extension

Latest: version 0.3.0 adds [supervised first-call controls](SUPERVISED-FIRST-CALL.md), conversational audio and local event logging. Live OpenAI and a two-way no-phone rehearsal passed. The diagnostics described below remain available; actual telephone media is the next verification step.

Latest no-call test result: [TEST-RESULTS.md](TEST-RESULTS.md).

Version 0.2.0 adds explicit pairing to a local Realtime setup window. See [VOICE-SETUP.md](VOICE-SETUP.md) for the current flow, limits, and authentication blocker. It cannot place calls, handle voicemail, or record conversations. The local diagnostic tests still need no API key. The following sections describe the original diagnostic behavior, retained in this version.

## Scope and access

The extension runs only on `https://www.salesgodcrm.net/*`, `https://salesgodcrm.net/*`, and the local test page `http://127.0.0.1:28431/extension-lab*`. It has no background service worker, broad browser permissions, network endpoints, cookies API, or key storage. Main-world code is visible to the CRM page and is not a place to put secrets.

On SalesGodCRM it adds an audio diagnostic panel, exposes one generated microphone to page-level device enumeration, and observes newly created WebRTC audio peers. It never invokes the dialer's Call button or provider APIs. Routing starts disabled on every page load. It intercepts a microphone request only when the page explicitly requests the synthetic device ID; other microphone requests retain normal behavior.

When enabled, the generated microphone is silent until a diagnostic or explicitly paired setup test supplies audio. Incoming WebRTC audio tracks are routed locally. Version 0.2.0 can pair its graphs to the local voice setup window; setup stops immediately if a new dialer peer appears. Live telephone forwarding is not enabled.

## Install for a supervised test

1. Open `chrome://extensions` in the same Chrome profile as SalesGodCRM.
2. Enable Developer mode, choose **Load unpacked**, and select this folder (`tools/audio-extension`, containing manifest.json).
3. Refresh the SalesGodCRM dashboard so the audio hook loads before the dialer initializes. Do not refresh during a call.
4. Confirm the panel says **Local routing disabled · OpenAI disconnected**.

Installing grants code access to the matched SalesGodCRM pages. Review the three runtime files (manifest.json, audio-hook.js, panel.js) before enabling it.

## No-call test sequence

1. Confirm the CRM Calls view says **No ongoing calls**. Keep the destination number empty.
2. Click **Enable local routing** in the extension panel.
3. Click **Test local audio**. Synthetic 440 Hz and 660 Hz audio must be measured through the generated microphone and incoming-audio graph. No physical microphone or speaker is used. This does not test a WebRTC handshake.
   Separately, click **Test WebRTC** on the CRM page to verify two local peers negotiate and receive synthetic audio in both directions. The test exchanges ICE candidates explicitly, queues them until the peer's remote description is ready, and uses silent remote renderers and a zero-gain graph output to keep decoding/analysis active. Reports include audio packet counts, candidate counts, and signal peaks, without addresses or SDP.
4. In SalesGodCRM call Settings click **Refresh devices**. Check whether **SalesGod AI Bridge (local audio)** appears under Microphone.
5. Select it. Check the extension evidence for **Dialer bridge-mic requests**. A positive value establishes that the CRM requested a generated microphone. If selection only saves a preference and acquisition waits until dialing, report that as unverified; do not place a call to force it.
6. Restore the CRM microphone to its previous setting, then click **Disable**. Save the local evidence report if useful.

## Local lab and automated checks

- `npm run audio:bridge`, then open `http://127.0.0.1:28431/extension-lab`.
- The lab loads the exact audio hook as a regular page script for real browser audio testing before installation. This does **not** establish Chrome extension installation or CRM compatibility.
- The lab has a separate optional local WebRTC probe, using two local peers without external ICE servers. Its result is recorded separately; failure must not be presented as an audio transport pass.
- With Chrome's local-IP masking enabled, this machine's localhost probe could not establish a pair, while the CRM-origin test passed. After the owner disabled that flag and relaunched Chrome, localhost also passed twice. The assistant did not change browser privacy settings, firewall rules, or microphone permissions. See TEST-RESULTS.md for measurements and the historical comparison.
- `npm run audio:extension:check` tests scoping, disabled defaults, generated input interception, pass-through behavior, track cleanup, message origin checks, and duplicate-load handling.

## Known limits

- The browser-only microphone is visible to patched page APIs, not Windows audio settings.
- The CRM may use a cross-origin iframe, cached browser APIs, a different audio engine, or device validation that rejects synthetic IDs. This version targets the observed top-level SalesGodCRM origin only.
- Existing dialer audio peers are not retroactively hooked; refresh the idle page after installation.
- A no-call test cannot establish actual telephone media, voicemail detection, or OpenAI latency.
- Do not leave the synthetic microphone selected while the bridge is disabled: it will reject acquisition rather than fall back to a physical microphone.
- **Disable** aborts pending WebRTC signaling promptly and stops generated tracks; the test closes its peers and releases its silent renderers. A successful synthetic test still does not verify the CRM's actual telephone session or OpenAI.
- Local MAIN-world commands are not a security boundary against the CRM itself. They expose diagnostics and short-lived local-window pairing, with no credentials or phone controls. OpenAI session creation requires the separate local setup page.

## References

- Chrome content script execution: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- Generated Web Audio streams: https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioDestinationNode
