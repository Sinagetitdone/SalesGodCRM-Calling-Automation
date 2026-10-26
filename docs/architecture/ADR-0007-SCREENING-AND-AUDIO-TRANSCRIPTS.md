# ADR-0007: Screening, imported context and recorded-audio transcripts

Date: 2026-10-26. Status: accepted for team package 0.6.0; extension 0.4.5.

## Decisions

- Recognize automated requests for the caller's name and reason using the existing response-disabled English ASR. Hold/availability announcements are not human answers or mailbox invitations. Save a separate optional 10–300-character introduction with the existing calling profile and list snapshot. Prepare it before dialing, play once after quiet and verified gate acknowledgement, then restart fresh human/voicemail detection. Missing text, uncertain recognition, gate timeouts or continued prompts require review. Human questions can interrupt the short introduction. This does not infer a supported SalesGodCRM API.
- Extract TXT/Markdown/DOCX/PDF locally in a child process, without inherited credentials. Limit input to 5 MB, PDF to 100 pages, extracted text to 200,000 characters, V8 heap to 128 MB and runtime to 20 seconds. The existing textarea enforces its smaller limit. Do not execute macros, follow external DOCX file references, or automatically submit imported text. Scanned PDFs are unsupported without prior OCR. Native PDF dependencies crashed on worker-thread teardown in Windows tests; process isolation protects the running bridge.
- Persist redacted failure detail with journal events and archive it with the attempt. Surface specific reported causes and available status/code/stage; do not invent carrier reasons when the provider supplies none. Preserve exact known timeouts and recording/transcription errors.
- Generated output text is a live draft, not evidence of fully played speech. Keep it for audit, but derive new real-list final transcripts from audio captured after the outbound gate and from the inbound stream before the transcription mute gate. Two separate MediaRecorders establish speaker identity; the existing mixed MP3 remains the downloadable reference. The phone is hung up before encoding/transcription completes.
- Browser segmentation removes silent gaps, pads audible regions and splits long regions without overlapping samples. It preserves the original elapsed timeline. Send bounded MP3 segments to the documented file-transcription API using gpt-transcribe. Do not inject draft text or business scripts into ASR. Commit the result atomically; on any error retain the draft and MP3 and pause the list. Existing historical calls are not automatically reprocessed. Transcription is ASR, not a guarantee of perfect wording or proof of sound reaching the remote device.

## Validation and limits

Guidance verification used two full saved guides in the actual Realtime session path. The same question elicited different approved representatives, appointment preferences and reference phrases as specified. This proves the guides affect replies, not universal compliance with every possible instruction. Existing list snapshots remain explicit: save defaults for future imports, Apply for an idle existing list. The UI now shows editor/list mismatches. Rehearsal office guidance is separately wired and takes precedence over its short brief; it is not injected into the fictional customer role. Manual next-reply guidance still requires the Send action and acknowledgement during a supervised human conversation.

Deterministic tests cover screening-to-human/voicemail transitions, prompt/gate timeouts, interruption, separate recording directions, silent/continuous segment boundaries, draft retention, API failure/cross-origin/worker isolation, profile snapshots, real document parsing and upload edit preservation. A small synthetic WAV returned the correct sentence through the actual gpt-transcribe API. No real telephone call or macOS runtime test was made for this release. Browser microphone capture is never used by the recorder. Short/transmitted/noisy speech remains subject to ASR errors; source labels and MP3 playback remain essential.

## Sources

- [OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text): supported recorded-audio workflow, gpt-transcribe and transcript formatting.
- [OpenAI Realtime server events](https://developers.openai.com/api/reference/resources/realtime/server-events): generated audio transcript completion is distinct from audio playback completion; input ASR is separate from native audio understanding.
