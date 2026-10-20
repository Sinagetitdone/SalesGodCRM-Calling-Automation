# Version 0.3.1 — supervised first call

Office instructions (2026-10-20): live human conversations now identify the caller as an AI assistant from **Jay Marketing Lab, on behalf of Cena**, ask whether now is a good time to talk, and continue naturally instead of running an audio test. No specific business purpose or offer has been supplied, so unknown facts must not be invented. The owner explicitly approved keeping the existing voicemail wording unchanged. Human-answer confirmation, supervised phone controls and the five-minute AI session cap remain in place. No call was placed to apply these instructions.

Current installation: extension **0.3.2**, local bridge **http://127.0.0.1:28431**. Windows reserved the previous port; the coordinated origin migration passed all 74 checks. On 2026-10-20 an authorized real call reached a person. The owner confirmed the person heard AI clearly; session `ab22d744-b63d-4f3c-808c-37bf37a08156` recorded incoming speech, AI replies and interruptions. No voicemail was played after switching to the human-answer path. The operator ended the phone call, AI stopped automatically on media closure, and local routing was disabled. This establishes real two-way telephone audio on the tested Windows/Chrome setup. Carrier voicemail recording remains separately unconfirmed.

Current update: [voicemail handling is implemented](VOICEMAIL.md) in the local controls and enabled by default. It prepares your editable message before dialing and listens silently for a greeting plus beep. The earlier first-call results below describe the historical mode without voicemail. For a person use the answer control; for voicemail leave screening active. Phone hangup remains manual. Real carrier voicemail recording still needs verification.

This version routes a supervised manual dialer call to OpenAI Realtime. It starts disabled. It does not enter numbers, click Call, hang up the phone, execute contact lists, or deliver voicemail. The owner or browser operator controls the SalesGodCRM phone. Actual telephone media must still be verified on the first authorized test call.

## Operator sequence

1. Start `npm run audio:bridge`. Keep the key only in the ignored repository-root `.env` file. The server binds to 127.0.0.1:28431 and checks request origin and host.
2. Reload extension 0.3.1 in Chrome and refresh SalesGodCRM only when no call is active. Enable local routing in the audio panel.
3. With the dialer idle, choose **Prepare supervised call**, then **Prepare AI — stay silent** in its local control tab. OpenAI is connected with turn detection disabled, customer input muted, and generated-microphone output gated off. No greeting is requested yet.
4. In CRM call Settings refresh devices and select **SalesGod AI Bridge (local audio)** as Microphone. Keep the speaker on your headset. While a supervised pair exists, physical microphone requests are rejected; there is no fallback to your microphone. If the CRM rejects the generated device, stop and report that incompatibility.
5. Only after receiving the intended test number and authorization to start, the operator enters it and starts the call through the ordinary CRM dialer. The bridge permits that new peer and verifies one connected audio peer, a live generated-microphone sender and a live incoming audio track. These establish media readiness, not a human answer.
6. Verify that a person answered, then choose **Customer answered — start AI**. The output gate and VAD configuration must both be acknowledged before input is unmuted or the first response is requested. The AI identifies itself as an AI assistant calling for Sina and asks whether the listener can hear it. This mode is a brief audio test, with no sales pitch, business commitments, or voicemail.
7. **Pause AI** immediately mutes both directions and clears buffered output. Starting again requires the same explicit answer control. Customer speech can interrupt the AI through OpenAI's server VAD; WebRTC manages truncation of unplayed speech.
8. **End AI session** closes the AI and local bridge. It does not hang up CRM. End the phone call in SalesGodCRM, restore the previous microphone if wanted, and disable local routing.

## Failure behavior

Loss of media after readiness, multiple audio peers, local tab closure, OpenAI disconnection, journal failure, or the five-minute session limit stops AI without redial. The local output gate closes immediately. If the phone remains connected, the operator must end it in CRM. No automatic number retries or dispatch guesses are implemented.

The original setup tests remain separate: they stop if a new dialer peer appears. Live mode is an explicit pairing choice. Private bridge peers use the native constructor saved before patching, so their AI audio is not mistaken for customer audio.

## Logs

The loopback server stores event types, phases, sequence numbers and timestamps in ignored `data/live-audio.db`. Delivery is ordered and idempotent; conflicting retries are rejected. Old metadata is pruned at startup, new-session creation and log reads after seven days. No numbers, contact names, transcripts, audio recordings, credentials, SDP or IP addresses are accepted by the journal schema.

The control tab shows events, turn/interrupt counts and audio signal measurements; **Show saved event log** reads persisted events. **Save report** exports the transient diagnostic report. Local report files are not campaign audit records and are not uploaded automatically. Full conversation recording and list/campaign logs remain separate work.

## Verified rehearsal, 2026-10-19

`/call-simulator` loads the exact audio hook and creates one observed dialer peer plus an unobserved synthetic customer peer, without a phone provider or physical microphone. The synthetic customer voice is generated from a fixed phrase using the speech API, then streamed through the simulated dialer to OpenAI. The AI heard the request to say “orange”; that word was confirmed from its output transcript without saving transcript text. Returned AI audio was measured at the simulated customer's peer (peak 0.41856). The test recorded two speech segments, three AI response attempts and two interruptions. Pause blocked a second playback from creating more turns, and simulated hangup stopped the AI. Events were read back from SQLite.

The first synthetic voice-generation request failed; a retry returned a valid WAV. The UI now distinguishes generation, decoding and playback failures. This is a test-fixture dependency, separate from real customer audio.

The successful new local key also passed the standalone Realtime output test (229 received RTP packets). Historical HTTP 401 measurements in older setup notes concern the revoked key.

After the owner reloaded extension 0.3.0 and confirmed a separate existing call had ended, the idle CRM page paired successfully with the supervised controls and prepared OpenAI silently. No customer audio was present, the speaking control remained disabled, and the session was explicitly ended. No number was entered and the assistant did not click Call. This verifies installed preparation, not actual phone-network media.

This rehearsal does not prove that SalesGodCRM's production SDK will acquire the selected generated track or carry it across the telephone network. Those are the explicit goals of the supervised first call. No actual call was placed by the assistant during preparation.

References: [OpenAI WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [interruptions](https://developers.openai.com/api/docs/guides/realtime-conversations), [synthetic speech](https://developers.openai.com/api/docs/guides/text-to-speech).
## Microphone preflight compatibility (0.3.1)

The first live dispatch attempt stopped at the CRM microphone warning with no dialer media observed. The CRM probes generic microphone access even with the bridge selected. During paired live mode only, generic audio requests now return the generated bridge microphone; explicit physical devices remain blocked. Reload the extension before testing this update. Telephone audio remains unverified until a successful supervised call.

## First telephone test result

After reloading 0.3.1, the CRM device refresh passed and one authorized test call reached an active state. The bridge verified its generated microphone sender and incoming dialer track. The owner described the endpoint as automatically answered and later confirmed it reached voicemail. Session `dea26df5-32ca-42ef-8197-d70e8ef6a9fb` recorded one incoming speech segment, two completed AI responses, and an OpenAI output peak of 0.65761. These observations confirm incoming audio reached OpenAI and AI audio was generated; they do not prove audible delivery or a saved voicemail. The owner reported that no voicemail was left. This version has no voicemail greeting/beep detection or voicemail delivery mode, so this is an unsuccessful voicemail test, not a completed conversation. The operator ended the phone call; dialer closure automatically stopped AI and all 13 metadata events were read back from the journal. Routing was then disabled. No automatic redial was performed.

Version 0.3.1 also fixes the panel's version allowlist. A regression test now loads the real panel and checks its control states against the installed manifest version.
