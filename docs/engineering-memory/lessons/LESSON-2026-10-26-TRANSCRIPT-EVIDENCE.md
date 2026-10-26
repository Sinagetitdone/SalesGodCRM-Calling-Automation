# Generated words are not playback evidence

An output transcript-done event can precede audible playback and can also occur on interruption. Saving it as a fully spoken turn gives users words the customer never heard. Live input ASR is also an independent estimate, and arrival order may differ from speech order.

Keep generated text explicitly labeled as a draft. For final records, transcribe captured audio on separate inbound/outbound paths, preserve speaker identity and elapsed positions, and retain the MP3 for verification. Never seed transcription with the inaccurate draft. Commit final results atomically and keep the draft if any clip fails. Audio capture does not prove remote carrier delivery, and automatic transcription cannot promise identical spelling, formatting or perfect recognition.

Related findings: distinguish screening name/reason requests from mailbox invitations; restart greeting detection after the short screening response. Bound quiet/gate waits. Persist specific failure detail before generic cleanup, and keep it in the archived event stream. Run untrusted document extraction in a bounded child process: native PDF teardown crashed a worker-thread host during Windows regression tests.

See ADR-0007 and the audio-transcript, recording, call, profile and text-import checks.
