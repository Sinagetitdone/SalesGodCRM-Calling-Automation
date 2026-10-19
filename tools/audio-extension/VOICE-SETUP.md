# Version 0.2.0 voice setup

Historical setup-only procedure. Version 0.3.0 adds a separate [supervised first-call mode](SUPERVISED-FIRST-CALL.md). The replacement local API key has passed live OpenAI audio; HTTP 401 evidence below concerns the old revoked key.

This is supervised setup, not a working telephone caller. No calls are placed, no physical microphone is opened, and no key is stored in the extension.

## Use

1. Run `npm run audio:bridge` from the repository. Only this loopback server reads the ignored `.env` file.
2. Reload **SalesGod Local Audio Bridge** in `chrome://extensions`, then refresh the idle CRM page. Do not refresh an ongoing call.
3. Keep the number field empty. Enable local routing, then choose **Open AI voice setup**.
4. In the new local window, choose **Test paired routing without OpenAI**. Synthetic customer audio travels to the local page; a second tone returns to the generated microphone's audio graph. Both signal peaks and both RTP packet directions are required to pass. No API request is made.
5. Reopen voice setup for **Test paired AI connection**. This requires a valid key. The local server exchanges SDP with OpenAI; the browser sends audio over WebRTC. One explicit AI introduction is requested, measured in both audio graphs, and allowed to finish before disconnecting. Automatic turn detection is disabled.
6. Restore the CRM's original microphone setting and disable local routing when finished. Reports may be saved from the setup window.

Standalone AI output testing is available at http://127.0.0.1:4318/voice-test. Use http://127.0.0.1:4318/audio-diagnostics to test the exact new audio files before reloading an installed extension; the URL avoids an old installed content script taking precedence over the lab's scripts.

## Connection boundaries

The extension opens a local window with a short-lived random pairing token in its URL fragment. The hook accepts only that token from the exact loopback origin. The local window accepts only its opener at an allowed CRM or lab origin. SDP and ICE candidates travel through the transferred MessagePort, with queued early candidates, a 12-second handshake timeout, and explicit close propagation. They are never written to reports.

The hook uses the original native peer constructor for this private link, preventing its own AI audio from being captured as a customer stream. It sends the incoming-audio graph to the local page and connects returned audio to the generated microphone graph. A newly created dialer peer stops setup immediately. This setup mode cannot be used during a telephone call.

The API key remains on the loopback server. There are no new extension permissions, background workers, CRM cookies, or direct CRM-to-OpenAI requests. Opening the local window does not create an OpenAI session; the owner must start the AI test there. API usage may be billed. Setup sessions have a 45-second limit and close peers, renderers, generated tracks and audio contexts on completion or error. Idle pairing expires after 90 seconds.

The setup report contains states, timestamps, signal peaks and packet counters, without IP addresses, SDP, keys, audio recordings, or conversation text. It is transient unless the owner saves it. It is not a durable campaign audit log.

## Current evidence

On the installed 0.2.0 extension, the idle SalesGodCRM page paired with the local setup page. The no-OpenAI test passed with 6 RTP packets sent and 6 received, customer-side peak 0.04364 and generated-microphone graph peak 0.05032. The test disconnected automatically. An earlier attempt closed before connectivity; after refreshing the idle page with improved error reporting, the test passed. No telephone audio or physical microphone was involved.

The configured key was tested against OpenAI's model endpoint and Realtime setup endpoint. Both rejected it with HTTP 401; model access reported `invalid_api_key`. The UI displays that failure and disconnects cleanly. This is an upstream authentication blocker, not a WebRTC timeout. Successful live AI output remains unverified.

No test here establishes actual telephone media, CRM microphone acquisition, speech recognition, live conversation behavior, voicemail, or list campaigns. The fake provider remains the application runtime.

## Reference

OpenAI's server-mediated WebRTC flow: https://developers.openai.com/api/docs/guides/voice-webrtc
