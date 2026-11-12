# SalesGodCRM voicemail maintenance 1.0.13 — 2026-11-13

The owner supplied SalesGod-Team-1.0.12.zip and described a mailbox reporting that nothing was recorded. A failed-call event export was not available, so the precise sequence of that particular call remains unverified. The package's call engine, detector, list worker and extension audio hook match the af7634f release baseline. The fix is maintained on fix/crm-voicemail-1.0.13, without replacing the later Twilio development branch.

## Reproduced and repaired

1. A mailbox's trailing “When you have finished recording, you may hang up” segment erased the prior recording invitation. With a missed beep, silence recovery never started the prepared message. The repair preserves approval for narrow, recognized mailbox continuations; unknown speech still invalidates it.
2. A delayed beep transcript arriving after playback began permanently stopped the prepared message through the generic interruption path. The repair silences immediately but retains the playback position, resuming the remainder only when the transcript confirms a mailbox artifact and the line is quiet. Human pickup supersedes pending resume and enters the existing live conversation flow.

Common detailed-message and name-and-number invitations are now recognized directly. Resume is journaled as voicemail.playback_resumed. Only completed source playback plus the existing drain marks local playback complete. Carrier mailbox storage remains separately unverified. No contact, dialer, routing or calling-list behavior was changed. The extension is unchanged at 0.4.12.

## Validation

- npm run check passed: TypeScript, 24 Vitest tests and 186 Node tests (210 total).
- The final 63 call-engine/voicemail tests include the two reproductions, exact resume offset, final completion, human supersession, opt-out/live behavior, unknown speech, failed media, manual pause, full mailbox and interruption protection. The new resume event is accepted by the real local journal API.
- All seven distribution checks passed, including ZIP byte-for-byte extraction, blank credentials, exact dependency locks, executable Mac metadata and the Windows launcher with a synthetic child. Actual Finder/Gatekeeper behavior was not tested on a Mac.
- All 72 packaged files and modified source were checked against the local credential values; none were included.
- No live calls, OpenAI requests, CRM actions or changes to private .env/data were made during this validation.

Close old calling-list windows and stop the bridge before applying this package. Preserve the installation's .env and data folder, restart the updated bridge, refresh idle CRM and reopen the calling list. A previously opened calling-list window retains old JavaScript until reloaded. Read SETUP.html for Windows/Mac update steps.

## Additional simulated mailbox audio check — 2026-11-13

At the owner's request to test a fake number, two isolated local browser calls were simulated instead of dialing any telephone number. The unmodified call engine, voicemail detector and local WebRTC signaling modules were loaded from the actual 1.0.13 ZIP. Chrome used a separate temporary test profile. Real Web Audio and two real local WebRTC connections carried the prepared message to a captured receiver stream. The extension's media gate/phone endpoint and OpenAI control/transcription events were simulated; no CRM session, physical microphone, OpenAI API or telephone provider was used.

Offline Windows speech synthesis spoke the owner's approved test voicemail. Three short measurement tones bracketed its beginning, middle and end without removing any words. Total reference audio was 11.52 seconds including tones. The receiver captured all three tones in order, and playback_completed occurred exactly once before normal shutdown in both cases:

- Completed acoustic beep, followed by a delayed beep transcript during playback: the message paused and resumed; all 20 non-silent half-second reference windows matched receiver energy envelopes in order (minimum normalized correlation 0.7437).
- Missed acoustic beep plus a trailing recorded hangup instruction: fresh silence started playback; all 20 reference windows matched in order (minimum normalized correlation 0.8282).

Envelope comparison accounts for Opus compression and jitter-buffer timing; raw PCM phase equality is not an appropriate transport test. Receiver WAVs and detailed reports remain under the ignored .runtime test folder. No production source or package bytes changed in this additional test. This is stronger evidence of complete local audio transmission than a success event alone, but it does not establish real SalesGodCRM routing, actual OpenAI recognition/voice generation or carrier mailbox storage.
