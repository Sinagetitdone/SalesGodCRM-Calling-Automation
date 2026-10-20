# No-call diagnostic results — 2026-10-19

## Build and installation

- Latest version: 0.1.1, diagnostic-only Chrome extension. The first graph/device tests used 0.1.0.
- The owner explicitly approved installation, then manually loaded the extension after browser automation policy blocked the extension manager. No policy bypass was attempted.
- Observed the extension's panel on the real logged-in SalesGodCRM dashboard after refreshing its idle page.
- No OpenAI key, API request, or phone call was used.

## Observed results

| Check | Result | Scope |
| --- | --- | --- |
| Automated extension checks | 12 passed | Original 7 checks plus candidate queuing, explicit exchange, candidate-error reporting, timeout, and cancellation coverage |
| Local generated microphone request | Passed in standalone browser lab | Page received a live generated audio track, without physical microphone access |
| Synthetic two-way graph on real CRM page | Passed | Outgoing and incoming peak amplitudes both 0.1; no WebRTC signaling or phone connection involved |
| CRM device enumeration | Passed | CRM enumerated devices twice and displayed SalesGod AI Bridge (local audio) |
| CRM device selection | Passed | Selected generated microphone; refreshed device list and retained selection |
| CRM requested generated microphone audio | Not observed | 0 getUserMedia requests for the bridge device after selection and refresh |
| Dialer audio peers | None observed | 0 peers and 0 active dialer connections during test |
| Local WebRTC on SalesGodCRM origin | Passed twice consecutively | Two local peers connected, packets flowed both ways, and synthetic received audio measured in both directions. No CRM provider connection was invoked |
| Standalone localhost WebRTC loopback | Passed after the owner changed Chrome's masking flag and relaunched | Received synthetic audio and RTP packets in both directions; the assistant did not change the flag |
| Live telephone audio and OpenAI | Not tested | Explicitly excluded from this task |

The dialer may defer microphone acquisition until a call starts. This is an inference, not a verified behavior. A selected microphone proves UI recognition, not phone-audio acceptance. Do not place a call merely to force further diagnostics.

## WebRTC investigation and fix

### Localhost retest after the owner's Chrome change

The owner reported disabling the WebRTC local-IP masking flag and relaunching Chrome. Without changing the audio/signaling logic, the standalone `http://127.0.0.1:28431/audio-diagnostics` test passed twice. On the final run at 2026-10-19T17:36:58Z, both peers sent and received 7 packets, received peaks were 0.1015 and 0.1017, and candidate exchange reported zero errors. No microphone permission prompt, phone call, external ICE server, physical microphone capture, or OpenAI request was used. The assistant disabled test routing afterward. A separate local stylesheet adjustment made the lab panel readable under its existing Content Security Policy; it did not change test behavior or relax that policy.

This resolves the prior localhost test failure in the owner's current Chrome configuration. It does not validate real telephone audio or OpenAI.

### Earlier investigation with masking enabled

The standalone localhost reproduction had one masked UDP host candidate per peer, stable signaling, and completed ICE gathering, but connection state stayed new. Explicit forwarding confirmed both candidates were applied without errors. On the CRM origin, where microphone permission was already granted, both peers produced two unmasked host candidates and connected. This comparison isolates the remaining localhost failure to its local-address path; it does not prove the underlying OS/network mDNS cause.

The initial CRM-origin attempt connected but measured silence. The revised diagnostic starts the synthetic sources before negotiation, explicitly consumes remote streams in zero-volume audio renderers, and connects the measurement graph to a zero-gain output. Both received signals then passed, with actual RTP packet counts:

- First pass at 2026-10-19T17:30:45Z: received peaks 0.1009 / 0.1003; peer A sent/received 7/7 packets; peer B sent/received 8/8 packets.
- Second pass at 2026-10-19T17:31:11Z: received peaks 0.1014 / 0.1021; each peer sent and received 5 packets.
- The required received-peak threshold was 0.005, and no ICE candidate application errors occurred.
- Raw address values, SDP, credentials, physical microphone audio, customer audio, and external ICE servers were not used in these saved results.

The 0.1.1 helper also bounds signaling waits, handles candidates that arrive before remote descriptions, and aborts promptly when the owner disables routing. The standalone timeout was not reclassified as a pass.

## Final state

- Restored SalesGodCRM microphone to **System default** and verified it in the settings UI.
- Speaker remained **System default**.
- Disabled local audio routing and released generated tracks.
- Extension remains installed and defaults to disabled on each refresh.
- No number was entered and no call control was activated.

Screenshots are local ignored artifacts under tests/: crm-audio-proof.png records the selected generated microphone and passing graph result; final-state.png records disabled routing. The restored default microphone was separately verified in the settings UI.
# Version 0.2.0 — installed CRM to local setup link

2026-10-19: The owner reloaded the unpacked extension, and the CRM Calls view showed **No ongoing calls** before refresh. The extension paired the idle https://www.salesgodcrm.net dashboard with the loopback setup page through an origin-checked MessagePort. **Test paired routing without OpenAI** passed: local link sent 6 RTP packets and received 6; synthetic customer peak 0.04364 and generated-microphone graph peak 0.05032. It then disconnected automatically. No OpenAI request, physical microphone capture, telephone call, or number entry occurred. An earlier attempt closed before connectivity; it was not counted as a pass.

Live OpenAI setup was separately attempted from the standalone page, and failed with HTTP 401. The upstream model-access check reported invalid_api_key. The setup released its peers, generated tracks and audio context. Successful live model audio remains unverified. See VOICE-SETUP.md for the version 0.2.0 boundaries; older measurements below concern the earlier diagnostic prototype.
